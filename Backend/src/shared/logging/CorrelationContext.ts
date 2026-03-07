import { AsyncLocalStorage } from 'async_hooks';

/**
 * Fields propagated through the async request lifecycle.
 * Set once by the correlation middleware; read by every logger automatically.
 */
export interface CorrelationStore {
  correlationId: string;
  requestId:     string;
  userId?:       string;
}

/**
 * AsyncLocalStorage-backed context carrier.
 *
 * Usage:
 *   // In middleware (set once per request):
 *   CorrelationContext.run({ correlationId, requestId, userId }, next);
 *
 *   // Anywhere in the async call chain (loggers read this automatically):
 *   const ctx = CorrelationContext.get();
 */
class CorrelationContextStore {
  private readonly storage = new AsyncLocalStorage<CorrelationStore>();

  /**
   * Run `fn` with the given correlation context active for the entire
   * async chain that `fn` initiates (including all awaited calls).
   */
  run(store: CorrelationStore, fn: () => void): void {
    this.storage.run(store, fn);
  }

  /**
   * Returns the active correlation store for the current async context,
   * or an empty fallback if called outside a request lifecycle
   * (e.g. background jobs, startup code).
   */
  get(): CorrelationStore {
    return this.storage.getStore() ?? {
      correlationId: 'no-correlation-id',
      requestId:     'no-request-id',
    };
  }
}

export const CorrelationContext = new CorrelationContextStore();
