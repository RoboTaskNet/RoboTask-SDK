import { Pagination } from '../utils/pagination.js';

export class TaskEscrowClient {
  constructor(ctx) { this.ctx = ctx; }
  async postTask({ title, description, rewardAmount, token, params }) {
    const id = 'T' + (++this.ctx.store.lastTaskNumericId);
    const resolvedToken = token ?? (this.ctx.tokens?.RTN ?? 'NATIVE');
    const record = { id, status: 'POSTED', createdAt: Date.now(), title, description, rewardAmount, token: resolvedToken, params };
    this.ctx.store.tasks.set(id, record);
    this.ctx.events.emit('TaskPosted', record);
    return record;
  }
  async claimTask(taskId, robotWallet) {
    const robot = this.ctx.store.robots.get(robotWallet);
    if (!robot) throw new Error('Robot not registered');
    const t = this.ctx.store.tasks.get(taskId);
    if (!t) throw new Error('Task not found');
    const updated = { ...t, status: 'CLAIMED', claimedBy: robotWallet, claimedAt: Date.now() };
    this.ctx.store.tasks.set(taskId, updated);
    this.ctx.events.emit('TaskClaimed', updated);
    return updated;
  }
  async submitTelemetryRoot(taskId, telemetryRoot, signature, metadataURI) {
    const t = this.ctx.store.tasks.get(taskId);
    if (!t) throw new Error('Task not found');
    const updated = { ...t, status: 'SUBMITTED', telemetry: { root: telemetryRoot, signature, metadataURI, submittedAt: Date.now() } };
    this.ctx.store.tasks.set(taskId, updated);
    this.ctx.events.emit('TelemetrySubmitted', updated);
    return updated;
  }
  async settle(taskId) {
    const t = this.ctx.store.tasks.get(taskId);
    if (!t) throw new Error('Task not found');
    if (t.status !== 'VERIFIED') throw new Error('Task not verified');
    const settled = { ...t, status: 'SETTLED', settledAt: Date.now() };
    this.ctx.store.tasks.set(taskId, settled);
    this.ctx.events.emit('PaymentSettled', settled);
    return settled;
  }
  async getTask(id) { return this.ctx.store.tasks.get(id) || null; }
  async listTasks() { return Array.from(this.ctx.store.tasks.values()); }
  async listTasksPaginated(options = {}) {
    const { status, token } = options;
    let items = await this.listTasks();
    if (status) items = items.filter(t => t.status === status);
    if (token) items = items.filter(t => t.token === token);
    return Pagination.paginate(items, options);
  }
  async listTasksByStatus(status, options = {}) {
    return this.listTasksPaginated({ ...options, status });
  }
  async cursor(options = {}) {
    const items = await this.listTasks();
    return Pagination.cursor(items, options);
  }
}
