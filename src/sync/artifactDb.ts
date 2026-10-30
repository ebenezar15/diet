import type { SyncEntity } from '@/types';
import type { RemoteRow, SyncBackend } from './backend';
import type { SyncRecord } from './merge';
import { claudeUse } from '@/lib/host';

/* Minimal shapes of the claude.ai Artifact `db` and `user` capabilities that we use. */
type Snap = { exists: boolean; data(): Record<string, unknown> | undefined };
type QSnap = { docs: Snap[] };
type DocRef = { get(): Promise<Snap>; set(d: Record<string, unknown>): Promise<void> };
type Query = { where(f: string, op: string, v: unknown): Query; orderBy(f: string, d?: 'asc' | 'desc'): Query; limit(n: number): Query; get(): Promise<QSnap> };
type Coll = Query & { doc(id: string): DocRef };
type DB = { collection(path: string): Coll };
type User = { id(): Promise<string | null> };

/** Small overlap so a write that landed while we were pulling is never skipped. */
const OVERLAP_MS = 120_000;

/**
 * Stores every record in the viewer's private subtree of the artifact's database
 * (`data/users/<id>/<entity>.<recordId>`), which nobody else — not even the artifact's owner — can
 * read. The local IndexedDB stays the source of truth; this is the durable, cross-device copy.
 */
export class ArtifactDbBackend implements SyncBackend {
  readonly name = 'claude.ai';
  private constructor(private db: DB, private uid: string) {}

  static async connect(): Promise<ArtifactDbBackend | null> {
    const [db, user] = await Promise.all([claudeUse<DB>('db'), claudeUse<User>('user')]);
    if (!db || !user) return null;
    const uid = await user.id();
    return uid ? new ArtifactDbBackend(db, uid) : null;
  }

  private coll() {
    return this.db.collection(`data/users/${this.uid}`);
  }
  private key(entity: SyncEntity, id: string) {
    return `${entity}.${id}`.replace(/[^A-Za-z0-9_\-.~:@+]/g, '_');
  }

  isConfigured() {
    return true;
  }
  async currentUserId() {
    return this.uid;
  }
  async signIn() {
    /* the claude.ai account is the identity */
  }
  async signOut() {
    /* not applicable */
  }

  async fetch(entity: SyncEntity, ids: string[]) {
    const out: SyncRecord[] = [];
    for (const id of ids) {
      const s = await this.coll().doc(this.key(entity, id)).get();
      const rec = s.exists ? (s.data()?.record as SyncRecord | undefined) : undefined;
      if (rec) out.push(rec);
    }
    return out;
  }

  async push(rows: RemoteRow[]) {
    // One write at a time per document; different documents run a few at a time.
    const queue = [...rows];
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        await this.coll()
          .doc(this.key(r.entity, r.record.id))
          .set({ entity: r.entity, record: r.record, syncedAt: Date.now() });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  async pull(cursor: string | null) {
    const since = cursor ? Number(cursor) - OVERLAP_MS : 0;
    const snap = await this.coll().where('syncedAt', '>', since).orderBy('syncedAt', 'asc').limit(1000).get();
    const rows: RemoteRow[] = [];
    let last = cursor ? Number(cursor) : 0;
    for (const d of snap.docs) {
      const body = d.data();
      if (!body?.record) continue;
      rows.push({ entity: body.entity as SyncEntity, record: body.record as SyncRecord });
      last = Math.max(last, Number(body.syncedAt) || 0);
    }
    // Overlapping pages re-deliver rows; merging is idempotent. Stop paging when nothing is new.
    return { rows: last > (cursor ? Number(cursor) : 0) ? rows : [], cursor: String(last || cursor || 0) };
  }
}
