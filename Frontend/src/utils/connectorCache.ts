/**
 * connectorCache — module-level Arrow buffer store for connector rows.
 *
 * Keyed by techCode (or '__ALL__' for the unfiltered list).
 * Buffers are Uint8Array (Arrow IPC format) so they are compact and GC-friendly.
 * Redux holds only {count, cursor, loading} — NOT the raw item arrays.
 *
 * Usage:
 *   connectorCache.set('POSTGRESQL', items);       // encode + store
 *   connectorCache.get('POSTGRESQL');              // decode + return
 *   connectorCache.evict('POSTGRESQL');            // free memory on collapse
 */

import type { ConnectorSummary } from '@/store/slices/connectionsSlice';
import { encodeToArrow, decodeFromArrow } from './arrowUtils';

const _buffers = new Map<string, Uint8Array>();

export const connectorCache = {
  set(techCode: string, items: ConnectorSummary[], append = false): void {
    if (append) {
      const existing = this.get(techCode);
      items = [...existing, ...items];
    }
    _buffers.set(techCode, encodeToArrow(items));
  },

  get(techCode: string): ConnectorSummary[] {
    const buf = _buffers.get(techCode);
    if (!buf || buf.length === 0) return [];
    return decodeFromArrow<ConnectorSummary>(buf);
  },

  evict(techCode: string): void {
    _buffers.delete(techCode);
  },

  has(techCode: string): boolean {
    return _buffers.has(techCode);
  },

  /** Returns item count without full decode. */
  count(techCode: string): number {
    return this.get(techCode).length;
  },

  /** Evict all slots (e.g., after create/delete invalidation). */
  evictAll(): void {
    _buffers.clear();
  },
};
