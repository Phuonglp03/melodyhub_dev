class CollabChannel {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (!handlers.size) {
      this.listeners.delete(event);
    }
  }

  emit(event, detail) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(detail);
      } catch (err) {
        console.error("[CollabChannel] handler error:", err);
      }
    });
  }
}

export const collabChannel = new CollabChannel();






