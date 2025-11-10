/*
  RoboTaskNet SDK (browser/Node UMD)
  Minimal, workable client that simulates protocol behavior now and provides clear extension points for on-chain integration later.

  Usage (Browser):
    <script src="sdk/roboTaskNet-sdk.js"></script>
    const sdk = new RoboTaskNetSDK();

  Usage (Node):
    const RoboTaskNetSDK = require('./sdk/roboTaskNet-sdk');
    const sdk = new RoboTaskNetSDK();
*/

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RoboTaskNetSDK = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Simple EventEmitter for SDK events
  class Emitter {
    constructor() { this.listeners = {}; }
    on(event, handler) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
      return () => this.off(event, handler);
    }
    off(event, handler) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }
    emit(event, payload) {
      (this.listeners[event] || []).forEach(h => {
        try { h(payload); } catch (e) { /* swallow */ }
      });
    }
  }

  // Deterministic non-cryptographic hash (placeholder). Replace with keccak256/sha256 when wiring to chain/TEE.
  function djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
      hash = hash & 0xffffffff;
    }
    return hash >>> 0; // unsigned 32-bit
  }
  function toHex(n) { return '0x' + n.toString(16).padStart(8, '0'); }
  function hash(input) {
    const s = typeof input === 'string' ? input : JSON.stringify(input);
    return toHex(djb2(s));
  }

  // Generic pagination helpers
  const Pagination = {
    paginate(items, { page = 1, pageSize = 10, orderBy = 'createdAt', order = 'desc' } = {}) {
      const sorted = [...items].sort((a, b) => {
        const av = (a?.[orderBy] ?? 0);
        const bv = (b?.[orderBy] ?? 0);
        if (order === 'asc') return av > bv ? 1 : av < bv ? -1 : 0;
        return av < bv ? 1 : av > bv ? -1 : 0;
      });
      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
      const currentPage = Math.min(Math.max(1, page), totalPages);
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      return {
        items: sorted.slice(start, end),
        page: currentPage,
        pageSize,
        total,
        totalPages
      };
    },
    cursor(items, { cursor = null, limit = 10, orderBy = 'createdAt', order = 'desc' } = {}) {
      const sorted = [...items].sort((a, b) => {
        const av = (a?.[orderBy] ?? 0);
        const bv = (b?.[orderBy] ?? 0);
        if (order === 'asc') return av > bv ? 1 : av < bv ? -1 : 0;
        return av < bv ? 1 : av > bv ? -1 : 0;
      });
      let startIndex = 0;
      if (cursor != null) {
        startIndex = sorted.findIndex(i => (i?.id ?? i?.[orderBy]) === cursor);
        if (startIndex >= 0) startIndex = startIndex + 1; // move past the cursor
        else startIndex = 0;
      }
      const slice = sorted.slice(startIndex, startIndex + limit);
      const last = slice[slice.length - 1] || null;
      const nextCursor = last ? (last?.id ?? last?.[orderBy]) : null;
      return {
        items: slice,
        nextCursor,
        hasNext: startIndex + limit < sorted.length
      };
    }
  };

  // Merkle utilities using the placeholder hash
  const Merkle = {
    leafHash(value) { return hash(value); },
    buildTree(leaves) {
      const level0 = leaves.map(v => Merkle.leafHash(v));
      const levels = [level0];
      let current = level0;
      while (current.length > 1) {
        const next = [];
        for (let i = 0; i < current.length; i += 2) {
          if (i + 1 < current.length) next.push(hash(current[i] + current[i + 1]));
          else next.push(current[i]);
        }
        levels.push(next);
        current = next;
      }
      return { levels, root: current[0] || null };
    },
    root(leaves) { return Merkle.buildTree(leaves).root; },
    proof(leaves, index) {
      const tree = Merkle.buildTree(leaves);
      const proof = [];
      let idx = index;
      for (let level = 0; level < tree.levels.length - 1; level++) {
        const currentLevel = tree.levels[level];
        const isRight = idx % 2 === 1;
        const pairIndex = isRight ? idx - 1 : idx + 1;
        const sibling = currentLevel[pairIndex];
        if (sibling) proof.push({ position: isRight ? 'left' : 'right', hash: sibling });
        idx = Math.floor(idx / 2);
      }
      return proof;
    }
  };

  // Token tickers
  const Tokens = {
    RTN: '$RTN'
  };

  // In-memory stores simulate contract state for a workable experience
  class InMemoryStore {
    constructor() {
      this.tasks = new Map(); // taskId -> task
      this.robots = new Map(); // wallet -> robot
      this.lastTaskNumericId = 0;
    }
    createTask(task) {
      const id = 'T' + (++this.lastTaskNumericId);
      const record = { id, status: 'POSTED', createdAt: Date.now(), ...task };
      this.tasks.set(id, record);
      return record;
    }
    getTask(id) { return this.tasks.get(id) || null; }
    listTasks() { return Array.from(this.tasks.values()); }
    listTasksPaginated(opts = {}) {
      const { status, token } = opts;
      let items = this.listTasks();
      if (status) items = items.filter(t => t.status === status);
      if (token) items = items.filter(t => t.token === token);
      return Pagination.paginate(items, opts);
    }
    updateTask(id, patch) {
      const t = this.getTask(id);
      if (!t) return null;
      const updated = { ...t, ...patch };
      this.tasks.set(id, updated);
      return updated;
    }
    upsertRobot(robot) {
      const record = { reputationScore: 0, stakedAmount: 0, isActive: true, ...robot };
      this.robots.set(record.wallet, record);
      return record;
    }
    getRobot(wallet) { return this.robots.get(wallet) || null; }
    listRobots() { return Array.from(this.robots.values()); }
    listRobotsPaginated(opts = {}) {
      const { isActive } = opts;
      let items = this.listRobots();
      if (typeof isActive === 'boolean') items = items.filter(r => r.isActive === isActive);
      return Pagination.paginate(items, opts);
    }
  }

  // Core clients (simulate contract APIs now; ready to swap for ethers/web3 later)
  class TaskEscrowClient {
    constructor(ctx) { this.ctx = ctx; }
    async postTask({ title, description, rewardAmount, token, params }) {
      const task = this.ctx.store.createTask({ title, description, rewardAmount, token: (token !== undefined && token !== null) ? token : Tokens.RTN, params });
      this.ctx.events.emit('TaskPosted', task);
      return task;
    }
    async claimTask(taskId, robotWallet) {
      const robot = this.ctx.store.getRobot(robotWallet);
      if (!robot) throw new Error('Robot not registered');
      const t = this.ctx.store.updateTask(taskId, { status: 'CLAIMED', claimedBy: robotWallet, claimedAt: Date.now() });
      if (!t) throw new Error('Task not found');
      this.ctx.events.emit('TaskClaimed', t);
      return t;
    }
    async submitTelemetryRoot(taskId, telemetryRoot, signature, metadataURI) {
      const t = this.ctx.store.updateTask(taskId, {
        status: 'SUBMITTED',
        telemetry: { root: telemetryRoot, signature, metadataURI, submittedAt: Date.now() }
      });
      if (!t) throw new Error('Task not found');
      this.ctx.events.emit('TelemetrySubmitted', t);
      return t;
    }
    async settle(taskId) {
      const t = this.ctx.store.getTask(taskId);
      if (!t) throw new Error('Task not found');
      if (t.status !== 'VERIFIED') throw new Error('Task not verified');
      const settled = this.ctx.store.updateTask(taskId, { status: 'SETTLED', settledAt: Date.now() });
      this.ctx.events.emit('PaymentSettled', settled);
      return settled;
    }
    async getTask(taskId) { return this.ctx.store.getTask(taskId); }
    async listTasks() { return this.ctx.store.listTasks(); }
    async listTasksPaginated(options = {}) { return this.ctx.store.listTasksPaginated(options); }
    async listTasksByStatus(status, options = {}) { return this.ctx.store.listTasksPaginated({ ...options, status }); }
    async cursor(options = {}) {
      const items = this.ctx.store.listTasks();
      return Pagination.cursor(items, options);
    }
  }

  class RobotRegistryClient {
    constructor(ctx) { this.ctx = ctx; }
    async registerRobot({ wallet, publicKey, metadataURI, capabilities }) {
      if (!wallet) throw new Error('Wallet required');
      const robot = this.ctx.store.upsertRobot({ wallet, publicKey, metadataURI, capabilities: capabilities || [] });
      this.ctx.events.emit('RobotRegistered', robot);
      return robot;
    }
    async updateCapabilities(wallet, capabilities) {
      const robot = this.ctx.store.getRobot(wallet);
      if (!robot) throw new Error('Robot not found');
      const updated = this.ctx.store.upsertRobot({ ...robot, capabilities });
      this.ctx.events.emit('RobotUpdated', updated);
      return updated;
    }
    async listRobots() { return this.ctx.store.listRobots(); }
    async getRobot(wallet) { return this.ctx.store.getRobot(wallet); }
    async listRobotsPaginated(options = {}) { return this.ctx.store.listRobotsPaginated(options); }
    async cursor(options = {}) {
      const items = this.ctx.store.listRobots();
      return Pagination.cursor(items, options);
    }
  }

  class OracleBridgeClient {
    constructor(ctx) { this.ctx = ctx; }
    async submitVerification(taskId, ok, proof) {
      const t = this.ctx.store.getTask(taskId);
      if (!t) throw new Error('Task not found');
      if (!t.telemetry?.root) throw new Error('Telemetry not submitted');
      const status = ok ? 'VERIFIED' : 'REJECTED';
      const updated = this.ctx.store.updateTask(taskId, {
        status,
        verification: { ok, proof, verifiedAt: Date.now() }
      });
      this.ctx.events.emit('TaskVerified', updated);
      return updated;
    }
  }

  // Optional wallet connector (gracefully falls back to mock)
  async function requestAccounts() {
    try {
      if (typeof window !== 'undefined' && window.ethereum && window.ethereum.request) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return accounts;
      }
    } catch (e) {
      // ignore and fall through
    }
    // Mock account
    return ['0xrobot-mock-wallet'];
  }

  // SDK facade
  class RoboTaskNetSDK {
    constructor(options = {}) {
      this.options = options;
      this.events = new Emitter();
      this.store = options.store || new InMemoryStore();

      // Clients
      this.taskEscrow = new TaskEscrowClient(this);
      this.robotRegistry = new RobotRegistryClient(this);
      this.oracleBridge = new OracleBridgeClient(this);

      // Utilities
      this.telemetry = {
        buildMerkleRoot: async (entries) => Merkle.root(entries),
        buildMerkleTree: async (entries) => Merkle.buildTree(entries),
        buildProofForEntry: async (entries, index) => Merkle.proof(entries, index),
        signTelemetryRoot: async (root) => {
          if (this.options.signer && typeof this.options.signer.signMessage === 'function') {
            return this.options.signer.signMessage(root);
          }
          // Fallback mock signature
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
          try {
            if (typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
              const resp = await window.solana.connect();
              const pubKey = resp?.publicKey?.toString ? resp.publicKey.toString() : String(resp?.publicKey);
              this.events.emit('SolanaWalletConnected', { publicKey: pubKey, provider: 'phantom' });
              return pubKey;
            }
            throw new Error('Phantom wallet not found');
          } catch (e) {
            // Surface error to caller
            throw e;
          }
        }
      };

      // Expose token tickers
      this.tokens = Tokens;
    }

    // Convenience helpers
    async connectWallet() { return this.wallet.connect(); }
    async connectSolanaWallet() { return this.wallet.connectSolana(); }

    // Pagination helpers
    async paginateTasks(options = {}) { return this.taskEscrow.listTasksPaginated(options); }
    async paginateRobots(options = {}) { return this.robotRegistry.listRobotsPaginated(options); }
    async cursorTasks(options = {}) { return this.taskEscrow.cursor(options); }
    async cursorRobots(options = {}) { return this.robotRegistry.cursor(options); }

    // Event subscription helper
    on(event, handler) { return this.events.on(event, handler); }

    // Convenience: end-to-end demo flow in one call
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

    // Expose internal hash for testing/demo
    _hash(input) { return hash(input); }
  }

  // Also expose tokens as a static on the class for convenience
  RoboTaskNetSDK.Tokens = Tokens;

  return RoboTaskNetSDK;
});

