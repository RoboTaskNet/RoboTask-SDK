import { Pagination } from '../utils/pagination.js';

export class RobotRegistryClient {
  constructor(ctx) { this.ctx = ctx; }
  async registerRobot({ wallet, publicKey, metadataURI, capabilities = [] }) {
    if (!wallet) throw new Error('Wallet required');
    const record = { reputationScore: 0, stakedAmount: 0, isActive: true, wallet, publicKey, metadataURI, capabilities };
    this.ctx.store.robots.set(wallet, record);
    this.ctx.events.emit('RobotRegistered', record);
    return record;
  }
  async updateCapabilities(wallet, capabilities) {
    const robot = this.ctx.store.robots.get(wallet);
    if (!robot) throw new Error('Robot not found');
    const updated = { ...robot, capabilities };
    this.ctx.store.robots.set(wallet, updated);
    this.ctx.events.emit('RobotUpdated', updated);
    return updated;
  }
  async listRobots() { return Array.from(this.ctx.store.robots.values()); }
  async getRobot(wallet) { return this.ctx.store.robots.get(wallet) || null; }
  async listRobotsPaginated(options = {}) {
    const { isActive } = options;
    let items = await this.listRobots();
    if (typeof isActive === 'boolean') items = items.filter(r => r.isActive === isActive);
    return Pagination.paginate(items, options);
  }
  async cursor(options = {}) {
    const items = await this.listRobots();
    return Pagination.cursor(items, options);
  }
}

