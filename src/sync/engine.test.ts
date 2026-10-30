import { db } from '@/db';
import { create, update } from '@/db/repo';
import { SyncEngine } from './engine';
import type { RemoteRow, SyncBackend } from './backend';
import type { SyncRecord } from './merge';
import type { WeightLog } from '@/types';

class MemoryBackend implements SyncBackend {
  name = 'memory';
  rows: (RemoteRow & { seq: number })[] = [];
  seq = 0;
  online = true;
  isConfigured() { return true; }
  async currentUserId() { return 'u1'; }
  async signIn() {}
  async signOut() {}
  async fetch(entity: string, ids: string[]) {
    return this.rows.filter((r) => r.entity === entity && ids.includes(r.record.id)).map((r) => r.record);
  }
  async push(rows: RemoteRow[]) {
    if (!this.online) throw new Error('network down');
    for (const r of rows) {
      this.rows = this.rows.filter((x) => !(x.entity === r.entity && x.record.id === r.record.id));
      this.rows.push({ ...r, seq: ++this.seq });
    }
  }
  async pull(cursor: string | null) {
    const c = Number(cursor ?? 0);
    const rows = this.rows.filter((r) => r.seq > c).sort((a, b) => a.seq - b.seq);
    return { rows, cursor: rows.length ? String(rows.at(-1)!.seq) : cursor };
  }
}

describe('sync engine', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('queues writes in the outbox while offline and drains them on reconnect', async () => {
    const backend = new MemoryBackend();
    const engine = new SyncEngine(backend);
    backend.online = false;
    const w = await create<WeightLog>('weightLogs', { date: '2026-10-30', kg: 80 });
    await update<WeightLog>('weightLogs', w.id, { kg: 79.6 });
    expect(await db.outbox.count()).toBe(2);
    await engine.sync().catch(() => undefined);
    expect(await db.outbox.where('status').equals('error').count()).toBeGreaterThan(0);
    backend.online = true;
    await engine.push();
    expect(await db.outbox.count()).toBe(0);
    expect(backend.rows).toHaveLength(1);
    expect((backend.rows[0].record as SyncRecord).kg).toBe(79.6);
  });

  it('pulls remote changes and merges field-by-field', async () => {
    const backend = new MemoryBackend();
    const engine = new SyncEngine(backend);
    const w = await create<WeightLog>('weightLogs', { date: '2026-10-30', kg: 80 });
    await engine.push();
    // another device edits waist later
    const remote = { ...(backend.rows[0].record as SyncRecord), waistCm: 90, deviceId: 'zz', updatedAt: Date.now() + 1000 };
    remote.fieldTs = { ...(remote.fieldTs ?? {}), waistCm: Date.now() + 1000 };
    await backend.push([{ entity: 'weightLogs', record: remote }]);
    await engine.pull();
    const local = await db.weightLogs.get(w.id);
    expect(local?.waistCm).toBe(90);
    expect(local?.kg).toBe(80);
  });
});
