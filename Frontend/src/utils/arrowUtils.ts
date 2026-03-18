/**
 * arrowUtils — Apache Arrow encode/decode helpers.
 *
 * Connector rows are stored as Arrow IPC buffers in connectorCache.ts
 * (a module-level Map outside Redux) to keep serialisable Redux state small.
 * Components call decodeFromArrow to materialise the rows for rendering.
 */

import { tableFromJSON, tableFromIPC, tableToIPC } from 'apache-arrow';

/** Encode an array of plain JS objects to an Arrow IPC (stream) buffer. */
export function encodeToArrow<T extends object>(rows: T[]): Uint8Array {
  if (rows.length === 0) return new Uint8Array(0);
  const table = tableFromJSON(rows as Record<string, unknown>[]);
  return tableToIPC(table, 'stream');
}

/** Decode an Arrow IPC buffer back to plain JS objects. */
export function decodeFromArrow<T>(buf: Uint8Array): T[] {
  if (buf.length === 0) return [];
  const table  = tableFromIPC(buf);
  const schema = table.schema;
  const results: T[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const obj: Record<string, unknown> = {};
    for (const field of schema.fields) {
      const col = table.getChild(field.name);
      obj[field.name] = col ? col.get(i) : null;
    }
    results.push(obj as T);
  }
  return results;
}

/** Decode a slice (offset + count) without materialising the whole table. */
export function decodeSlice<T>(buf: Uint8Array, offset: number, count: number): T[] {
  if (buf.length === 0) return [];
  const table  = tableFromIPC(buf);
  const schema = table.schema;
  const end    = Math.min(offset + count, table.numRows);
  const results: T[] = [];
  for (let i = offset; i < end; i++) {
    const obj: Record<string, unknown> = {};
    for (const field of schema.fields) {
      const col = table.getChild(field.name);
      obj[field.name] = col ? col.get(i) : null;
    }
    results.push(obj as T);
  }
  return results;
}
