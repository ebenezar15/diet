import type { OutboxEntry, SyncEntity } from '@/types';
import { db, getMeta, setMeta } from '@/db';
import { mergeRecords, stripLocalOnly, type SyncRecord } from './merge';
import type { SyncBackend } from './backend';
import { SupabaseBackend } from './supabase';

export type SyncState = 'offline' | 'pending' | 'syncing' | 'synced' | 'error' | 'local';

type Listener = (s: { state: SyncState; pending: number; lastSyncedAt: number | null }) => void;

const MAX_BACKOFF = 5 * 60_000;

export class SyncEngine {
  private listeners = new Set<Listener>();
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  state: SyncState = 'local';
  pending = 0;
  lastSyncedAt: number | null = null;

  constructor(public backend: SyncBackend) {}

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn({ state: this.state, pending: this.pending, lastSyncedAt: this.lastSyncedAt });
    return () => this.listeners.delete(fn);
  }

  private async emit(state?: SyncState) {
    this.pending = await db.outbox.where('status').anyOf('pending', 'error').count();
    this.lastSyncedAt = await getMeta<number | null>('lastSyncedAt', null);
    if (state) this.state = state;
    else if (typeof navigator !== 'undefined' && !navigator.onLine) this.state = 'offline';
    else if (!(await this.canSync())) this.state = this.pending ? 'pending' : 'local';
    else this.state = this.pending ? 'pending' : 'synced';
    this.listeners.forEach((l) => l({ state: this.state, pending: this.pending, lastSyncedAt: this.lastSyncedAt }));
  }

  refresh() {
    return this.emit();
  }

  async canSync() {
    return this.backend.isConfigured() && !!(await this.backend.currentUserId());
  }

  private log(kind: 'push' | 'pull' | 'error' | 'info', message: string, count?: number) {
    return db.syncLog.add({ at: Date.now(), kind, message, count });
  }

  /** Debounced trigger after local writes. */
  schedule(delay = 1500) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), delay);
    void this.emit();
  }

  async sync(): Promise<void> {
    if (this.running) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return void this.emit('offline');
    if (!(await this.canSync())) return void this.emit();
    this.running = true;
    await this.emit('syncing');
    try {
      const pushed = await this.push();
      const pulled = await this.pull();
      await setMeta('lastSyncedAt', Date.now());
      this.failures = 0;
      if (pushed || pulled) await this.log('info', `Synced: ${pushed} up, ${pulled} down`);
      await this.emit('synced');
    } catch (e) {
      this.failures++;
      const msg = e instanceof Error ? e.message : String(e);
      await this.log('error', msg);
      await this.emit('error');
      const backoff = Math.min(MAX_BACKOFF, 2000 * 2 ** this.failures);
      this.timer = setTimeout(() => void this.sync(), backoff);
    } finally {
      this.running = false;
    }
  }

  /** Push the outbox: collapse to latest per record, merge with remote copy, upsert. */
  async push(): Promise<number> {
    const entries = await db.outbox.where('status').anyOf('pending', 'error').sortBy('updatedAt');
    if (!entries.length) return 0;
    const latest = new Map<string, OutboxEntry>();
    for (const e of entries) latest.set(`${e.entity}:${e.payload.id as string}`, e);
    const byEntity = new Map<SyncEntity, OutboxEntry[]>();
    for (const e of latest.values()) byEntity.set(e.entity, [...(byEntity.get(e.entity) ?? []), e]);
    let count = 0;
    for (const [entity, list] of byEntity) {
      const remote = await this.backend.fetch(entity, list.map((e) => e.payload.id as string));
      const remoteById = new Map(remote.map((r) => [r.id, r]));
      const rows = list.map((e) => {
        const local = e.payload as SyncRecord;
        return { entity, record: mergeRecords(local, remoteById.get(local.id)) };
      });
      try {
        await this.backend.push(rows.map((r) => ({ entity: r.entity, record: stripLocalOnly(r.record) })));
      } catch (err) {
        await db.outbox.bulkPut(list.map((e) => ({ ...e, status: 'error' as const, attempts: e.attempts + 1, error: String(err) })));
        throw err;
      }
      // write merged result back locally so this device converges too
      await db.table(entity).bulkPut(rows.map((r) => r.record));
      count += rows.length;
    }
    await db.outbox.bulkDelete(entries.map((e) => e.id));
    await this.log('push', `Pushed ${count} change(s)`, count);
    return count;
  }

  async pull(): Promise<number> {
    let cursor = await getMeta<string | null>('pullCursor', null);
    let total = 0;
    for (let page = 0; page < 20; page++) {
      const { rows, cursor: next } = await this.backend.pull(cursor);
      if (!rows.length) break;
      for (const { entity, record } of rows) {
        const table = db.table(entity);
        const local = (await table.get(record.id)) as SyncRecord | undefined;
        await table.put(mergeRecords(local, record));
      }
      total += rows.length;
      cursor = next;
      await setMeta('pullCursor', cursor);
      if (rows.length < 1000) break;
    }
    if (total) await this.log('pull', `Pulled ${total} change(s)`, total);
    return total;
  }
}

export const engine = new SyncEngine(new SupabaseBackend());
