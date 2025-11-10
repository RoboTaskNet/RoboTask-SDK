// Lightweight event emitter
export class Emitter {
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
      try { h(payload); } catch (_) {}
    });
  }
}

