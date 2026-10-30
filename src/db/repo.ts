import type { SyncEntity, SyncFields } from '@/types';
import { db, getMeta, setMeta } from './index';

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

let cachedDevice: string | null = null;
export async function deviceId(): Promise<string> {
  if (cachedDevice) return cachedDevice;
  let id = await getMeta<string | null>('deviceId', null);
  if (!id) {
    id = uuid();
    await setMeta('deviceId', id);
  }
  cachedDevice = id;
  return id;
}
export const _resetDeviceCache = () => (cachedDevice = null);

type WithFieldTs = { fieldTs?: Record<string, number> };
type Draft<T> = Omit<T, keyof SyncFields> & Partial<SyncFields>;

const listeners = new Set<() => void>();
/** Called after every local write (used to kick the sync engine). */
export const onLocalWrite = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * Every user write goes to IndexedDB first and is appended to the outbox in the same transaction.
 */
export async function create<T extends SyncFields>(entity: SyncEntity, draft: Draft<T>): Promise<T> {
  const now = Date.now();
  const dev = await deviceId();
  const rec = {
    userId: null,
    deletedAt: null,
    createdAt: now,
    ...draft,
    id: draft.id ?? uuid(),
    updatedAt: now,
    deviceId: dev
  } as unknown as T & WithFieldTs;
  rec.fieldTs = Object.fromEntries(Object.keys(rec).map((k) => [k, now]));
  await db.transaction('rw', db.table(entity), db.outbox, async () => {
    await db.table(entity).put(rec);
    await db.outbox.put({ id: uuid(), entity, op: 'create', payload: rec as never, updatedAt: now, deviceId: dev, status: 'pending', attempts: 0 });
  });
  listeners.forEach((l) => l());
  return rec;
}

export async function update<T extends SyncFields>(entity: SyncEntity, id: string, patch: Partial<T>): Promise<T | undefined> {
  const now = Date.now();
  const dev = await deviceId();
  let out: T | undefined;
  await db.transaction('rw', db.table(entity), db.outbox, async () => {
    const cur = (await db.table(entity).get(id)) as (T & WithFieldTs) | undefined;
    if (!cur) return;
    const fieldTs = { ...(cur.fieldTs ?? {}) };
    for (const k of Object.keys(patch)) fieldTs[k] = now;
    out = { ...cur, ...patch, updatedAt: now, deviceId: dev, fieldTs } as T;
    await db.table(entity).put(out);
    await db.outbox.put({
      id: uuid(), entity, op: patch.deletedAt ? 'delete' : 'update', payload: out as never, updatedAt: now, deviceId: dev, status: 'pending', attempts: 0
    });
  });
  listeners.forEach((l) => l());
  return out;
}

/** Soft delete so the deletion propagates to other devices. */
export const remove = (entity: SyncEntity, id: string) => update(entity, id, { deletedAt: Date.now() } as never);

export const alive = <T extends { deletedAt: number | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return today(d);
};
export const mondayOf = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  const day = (d.getDay() + 6) % 7;
  return addDays(iso, -day);
};
