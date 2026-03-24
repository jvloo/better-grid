// ============================================================================
// Typed Event Emitter
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventMap = Record<string, (...args: any[]) => void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => void;

export class EventEmitter<TEvents extends EventMap> {
  private listeners = new Map<keyof TEvents, Set<AnyFn>>();

  on<E extends keyof TEvents>(event: E, handler: TEvents[E]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as AnyFn);

    return () => this.off(event, handler);
  }

  off<E extends keyof TEvents>(event: E, handler: TEvents[E]): void {
    this.listeners.get(event)?.delete(handler as AnyFn);
  }

  emit<E extends keyof TEvents>(event: E, ...args: Parameters<TEvents[E]>): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(...args);
    }
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: keyof TEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
