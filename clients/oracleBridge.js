export class OracleBridgeClient {
  constructor(ctx) { this.ctx = ctx; }
  async submitVerification(taskId, ok, proof) {
    const t = this.ctx.store.tasks.get(taskId);
    if (!t) throw new Error('Task not found');
    if (!t.telemetry?.root) throw new Error('Telemetry not submitted');
    const status = ok ? 'VERIFIED' : 'REJECTED';
    const updated = { ...t, status, verification: { ok, proof, verifiedAt: Date.now() } };
    this.ctx.store.tasks.set(taskId, updated);
    this.ctx.events.emit('TaskVerified', updated);
    return updated;
  }
}

