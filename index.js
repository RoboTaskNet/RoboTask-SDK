// ESM entrypoint for RoboTaskNet SDK (modular)
import { Emitter } from './core/emitter.js';
import { Merkle, hash } from './core/hash.js';
import { Tokens } from './core/tokens.js';
import { Pagination } from './utils/pagination.js';
import { TaskEscrowClient } from './clients/taskEscrow.js';
import { RobotRegistryClient } from './clients/robotRegistry.js';
import { OracleBridgeClient } from './clients/oracleBridge.js';

class InMemoryStore {
  constructor() {
    this.tasks = new Map();
    this.robots = new Map();
    this.lastTaskNumericId = 0;
  }
}

async function requestAccounts() {
  try {
    if (typeof window !== 'undefined' && window.ethereum?.request) {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      return accounts;
    }
  } catch (_) {}
  return ['0xrobot-mock-wallet'];
}

export class SDK {
  constructor(options = {}) {
    this.options = options;
    this.events = new Emitter();
    this.store = options.store || new InMemoryStore();

    this.taskEscrow = new TaskEscrowClient(this);
    this.robotRegistry = new RobotRegistryClient(this);
    this.oracleBridge = new OracleBridgeClient(this);

    this.telemetry = {
      buildMerkleRoot: async (entries) => Merkle.root(entries),
      buildMerkleTree: async (entries) => Merkle.buildTree(entries),
      buildProofForEntry: async (entries, index) => Merkle.proof(entries, index),
      signTelemetryRoot: async (root) => {
        if (this.options.signer?.signMessage) return this.options.signer.signMessage(root);
        return 'signed:' + root;
      }
    };

    this.wallet = {
      connect: async () => {
        const accounts = await requestAccounts();
        this.events.emit('WalletConnected', { accounts });
        return accounts;
      },
      connectSolana: async () => {
        if (typeof window !== 'undefined' && window.solana?.isPhantom) {
          const resp = await window.solana.connect();
          const pubKey = resp?.publicKey?.toString ? resp.publicKey.toString() : String(resp?.publicKey);
          this.events.emit('SolanaWalletConnected', { publicKey: pubKey, provider: 'phantom' });
          return pubKey;
        }
        throw new Error('Phantom wallet not found');
      }
    };

    // Token tickers
    this.tokens = Tokens;
  }

  on(event, handler) { return this.events.on(event, handler); }
  async connectWallet() { return this.wallet.connect(); }
  async connectSolanaWallet() { return this.wallet.connectSolana(); }

  async paginateTasks(options = {}) { return this.taskEscrow.listTasksPaginated(options); }
  async paginateRobots(options = {}) { return this.robotRegistry.listRobotsPaginated(options); }
  async cursorTasks(options = {}) { return this.taskEscrow.cursor(options); }
  async cursorRobots(options = {}) { return this.robotRegistry.cursor(options); }

  async demoFlow({ title, description, rewardAmount, robotWallet, telemetryEntries }) {
    const task = await this.taskEscrow.postTask({ title, description, rewardAmount });
    const claimed = await this.taskEscrow.claimTask(task.id, robotWallet);
    const root = await this.telemetry.buildMerkleRoot(telemetryEntries);
    const sig = await this.telemetry.signTelemetryRoot(root);
    const submitted = await this.taskEscrow.submitTelemetryRoot(task.id, root, sig, 'ipfs://mock');
    const verified = await this.oracleBridge.submitVerification(task.id, true, { reason: 'demo-ok' });
    const settled = await this.taskEscrow.settle(task.id);
    return { task, claimed, root, sig, submitted, verified, settled };
  }

  _hash(input) { return hash(input); }
}

export function createSDK(options = {}) { return new SDK(options); }
export const clients = { TaskEscrowClient, RobotRegistryClient, OracleBridgeClient };
export const utils = { Pagination, Merkle, hash };
export const tokens = Tokens;
