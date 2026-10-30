/**
 * Last-write-wins per field. Every synced record carries `fieldTs` — a map of field name to the
 * time it was last written — plus `updatedAt` and `deviceId`. For each field the newer write wins;
 * ties are broken by the larger deviceId so every device converges on the same result.
 * Deletes are soft (`deletedAt`) so they propagate like any other field.
 */
export type SyncRecord = Record<string, unknown> & {
  id: string;
  updatedAt: number;
  deviceId: string;
  fieldTs?: Record<string, number>;
};

const META = new Set(['id', 'fieldTs', 'updatedAt', 'deviceId']);
/** Fields that stay on the device (never uploaded); merges keep whichever copy has them. */
export const LOCAL_ONLY = ['photo'];

export function stripLocalOnly<T extends SyncRecord>(r: T): T {
  const out = { ...r, fieldTs: { ...(r.fieldTs ?? {}) } };
  for (const k of LOCAL_ONLY) {
    delete (out as Record<string, unknown>)[k];
    delete out.fieldTs[k];
  }
  return out;
}

export function mergeRecords<T extends SyncRecord>(a: T | undefined, b: T | undefined): T {
  if (!a) return b as T;
  if (!b) return a;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => !META.has(k)));
  const out: Record<string, unknown> = { id: a.id };
  const fieldTs: Record<string, number> = {};
  for (const k of keys) {
    if (LOCAL_ONLY.includes(k)) {
      out[k] = a[k] ?? b[k];
      continue;
    }
    const ta = a.fieldTs?.[k] ?? a.updatedAt;
    const tb = b.fieldTs?.[k] ?? b.updatedAt;
    const aWins = ta > tb || (ta === tb && a.deviceId >= b.deviceId);
    out[k] = aWins ? a[k] : b[k];
    fieldTs[k] = Math.max(ta, tb);
  }
  const newer = a.updatedAt > b.updatedAt || (a.updatedAt === b.updatedAt && a.deviceId >= b.deviceId) ? a : b;
  out.updatedAt = Math.max(a.updatedAt, b.updatedAt);
  out.deviceId = newer.deviceId;
  out.fieldTs = fieldTs;
  return out as T;
}
