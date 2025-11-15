CA : ChD2DT8AvCh4Wq4DYZkZ4dsbCvtGgZydYhYN7H57pump
# RoboTaskNet SDK

Workable JavaScript SDK for the RoboTaskNet project. It simulates the protocol today and provides clear extension points to integrate real smart contracts and wallets later.

## Features
- Task escrow client: post, claim, submit telemetry root, settle
- Robot registry client: register robots, update capabilities, list
- Oracle bridge client: submit verification results
- Merkle utilities: build tree, root, and proofs for telemetry entries
- Event emitter: subscribe to lifecycle events
- Optional wallet connect (MetaMask if present, else mock)
- Pagination utilities: page-based and cursor-based listings for tasks and robots

## Install / Use

### ESM (modern bundlers or native `import`)

```js
import { createSDK, SDK, clients, utils, tokens } from './sdk/index.js';

// Factory (recommended)
const sdk = createSDK();

// Or construct directly
// const sdk = new SDK();

// Use clients
await sdk.taskEscrow.postTask({
  title: 'Deliver package',
  description: 'GPS drop-off',
  rewardAmount: '10',
  token: tokens.RTN // '$RTN'
});
```

### Browser (no build tools)
1. Copy `sdk/roboTaskNet-sdk.js` into your project.
2. Include it in your HTML:

```html
<script src="sdk/roboTaskNet-sdk.js"></script>
<script>
  const sdk = new RoboTaskNetSDK();
  sdk.on('TaskPosted', (t) => console.log('Posted:', t));
  // ...
</script>
```

### Node/CommonJS

```js
const RoboTaskNetSDK = require('./sdk/roboTaskNet-sdk');
const sdk = new RoboTaskNetSDK();
// Using token ticker in UMD
const RTN = RoboTaskNetSDK.Tokens.RTN; // '$RTN'
await sdk.taskEscrow.postTask({ title: 'Mapping', description: 'Area scan', rewardAmount: '25', token: RTN });
```

Both ESM and UMD are kept in-sync. `RoboTaskNetSDK` is available globally in the browser for backward compatibility, while `sdk/index.js` provides modular imports.

## Quick Start (Demo Flow)

```js
const sdk = new RoboTaskNetSDK();

// Register a robot
await sdk.robotRegistry.registerRobot({
  wallet: '0xrobot-mock-wallet',
  publicKey: '0xpubkey',
  metadataURI: 'ipfs://robot-metadata',
  capabilities: ['delivery', 'mapping']
});

// Run end-to-end demo
const result = await sdk.demoFlow({
  title: 'Deliver package',
  description: 'Take package to GPS coords',
  rewardAmount: '10',
  robotWallet: '0xrobot-mock-wallet',
  telemetryEntries: [
    { gps: [37.77, -122.42], t: 1 },
    { gps: [37.78, -122.41], t: 2 },
    { gps: [37.79, -122.40], t: 3 }
  ]
});

console.log(result.settled.status); // 'SETTLED'
```

## API Surface

- `sdk.taskEscrow.postTask({ title, description, rewardAmount, token?, params? })`
- `sdk.taskEscrow.claimTask(taskId, robotWallet)`
- `sdk.taskEscrow.submitTelemetryRoot(taskId, telemetryRoot, signature, metadataURI)`
- `sdk.taskEscrow.settle(taskId)`
- `sdk.taskEscrow.getTask(taskId)`
- `sdk.taskEscrow.listTasks()`
- `sdk.taskEscrow.listTasksPaginated({ page?, pageSize?, orderBy?, order?, status?, token? })`
- `sdk.taskEscrow.listTasksByStatus(status, { page?, pageSize?, orderBy?, order? })`
- `sdk.taskEscrow.cursor({ cursor?, limit?, orderBy?, order? })`

- `sdk.robotRegistry.registerRobot({ wallet, publicKey, metadataURI, capabilities? })`
- `sdk.robotRegistry.updateCapabilities(wallet, capabilities)`
- `sdk.robotRegistry.getRobot(wallet)`
- `sdk.robotRegistry.listRobots()`
- `sdk.robotRegistry.listRobotsPaginated({ page?, pageSize?, orderBy?, order?, isActive? })`
- `sdk.robotRegistry.cursor({ cursor?, limit?, orderBy?, order? })`

- `sdk.oracleBridge.submitVerification(taskId, ok, proof)`

- `sdk.telemetry.buildMerkleRoot(entries)`
- `sdk.telemetry.buildMerkleTree(entries)`
- `sdk.telemetry.buildProofForEntry(entries, index)`
- `sdk.telemetry.signTelemetryRoot(root)`

- `sdk.wallet.connect()` // requests accounts via MetaMask if available, else returns mock account

- `sdk.on(event, handler)` // events: `TaskPosted`, `TaskClaimed`, `TelemetrySubmitted`, `TaskVerified`, `PaymentSettled`, `RobotRegistered`, `RobotUpdated`, `WalletConnected`

### Facade Helpers
- `sdk.paginateTasks(opts)` / `sdk.paginateRobots(opts)`
- `sdk.cursorTasks(opts)` / `sdk.cursorRobots(opts)`

## Token Ticker

- Native platform token ticker: `$RTN`.
- ESM: `import { tokens } from './sdk/index.js'; tokens.RTN`
- UMD: `RoboTaskNetSDK.Tokens.RTN` or `sdk.tokens.RTN`
- Pass as `token` when posting tasks to denominate rewards.
- If `token` is omitted in `postTask`, it defaults to `$RTN`.

## Project Structure

```
sdk/
  index.js                 # ESM entrypoint (createSDK, SDK, clients, utils)
  core/
    emitter.js             # Lightweight event emitter
    hash.js                # djb2 hash and Merkle utilities
  utils/
    pagination.js          # Page and cursor helpers
  clients/
    taskEscrow.js          # Post/claim/submit/settle; list & pagination
    robotRegistry.js       # Register/update; list & pagination
    oracleBridge.js        # Submit verification results
  roboTaskNet-sdk.js       # UMD/Browser global (RoboTaskNetSDK)
```

## Pagination Examples

### Page-based pagination

```js
const sdk = new RoboTaskNetSDK();

// Seed sample data
for (let i = 0; i < 25; i++) {
  await sdk.taskEscrow.postTask({
    title: `Task ${i+1}`,
    description: 'Example',
    rewardAmount: String(1 + i),
    token: i % 2 ? tokens.RTN : 'ERC20'
  });
}

// Get first page
const page1 = await sdk.paginateTasks({ page: 1, pageSize: 5 });
console.log(page1.items.map(t => t.id)); // 5 items

// Filter by status
const posted = await sdk.taskEscrow.listTasksByStatus('POSTED', { page: 1, pageSize: 10 });
```

### Cursor-based pagination

```js
// Fetch 5 tasks starting after a cursor
let batch = await sdk.cursorTasks({ limit: 5 });
console.log(batch.items.length); // up to 5
if (batch.hasNext) {
  batch = await sdk.cursorTasks({ limit: 5, cursor: batch.nextCursor });
}

// Robots
const robotsFirst = await sdk.cursorRobots({ limit: 10 });
```

### Merkle proofs

```js
const entries = ['a', 'b', 'c', 'd'];
const root = await sdk.telemetry.buildMerkleRoot(entries);
const proofForB = await sdk.telemetry.buildProofForEntry(entries, 1); // index of 'b'
```

## Integrating Real Web3

This SDK is designed to be upgraded:
- Swap placeholder hash with `keccak256`/`sha256` from a crypto lib
- Replace in-memory store by wiring to contracts via `ethers.js` or `wagmi`
- Implement signer from wallet (`ethers.Signer`) to deliver real signatures
- Persist telemetry in IPFS/Arweave and store URIs on-chain

### Example Wiring (ethers.js outline)

```js
import { ethers } from 'ethers';

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const sdk = new RoboTaskNetSDK({ signer });

// TODO: add contract instances and replace client methods to call contracts
// e.g., sdk.taskEscrow.postTask = async (params) => contract.postTask(...);
```

## Notes

- Hashing uses a deterministic placeholder (djb2) to keep the SDK dependency-free. Replace for production.
- Events are best-effort simulation to match expected lifecycle.
- All methods return Promises for easier future swap to async RPC calls.
=======
# RoboTask-SDK
>>>>>>> cc8a28b0fc000a7bf8f06897cb6e5547a343432e
