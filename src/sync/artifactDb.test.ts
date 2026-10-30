import { db } from '@/db';
import { create } from '@/db/repo';
import { SyncEngine } from './engine';
import { ArtifactDbBackend } from './artifactDb';
import type { UserProfile } from '@/types';

/** In-memory stand-in for the claude.ai Artifact `db` capability. */
function fakeDb() {
  const docs = new Map<string, Record<string, unknown>>();
  const coll = (path: string) => {
    const q = (filters: [string, string, unknown][], order?: string) => ({
      where: (f: string, op: string, v: unknown) => q([...filters, [f, op, v]], order),
      orderBy: (f: string) => q(filters, f),
      limit: () => q(filters, order),
      get: async () => ({
        docs: [...docs.entries()]
          .filter(([k]) => k.startsWith(path + '/'))
          .map(([, v]) => v)
          .filter((v) => filters.every(([f, , val]) => (v[f] as number) > (val as number)))
          .sort((a, b) => (order ? (a[order] as number) - (b[order] as number) : 0))
          .map((v) => ({ exists: true, data: () => v }))
      })
    });
    return {
      ...q([]),
      doc: (id: string) => ({
        get: async () => ({ exists: docs.has(`${path}/${id}`), data: () => docs.get(`${path}/${id}`) }),
        set: async (d: Record<string, unknown>) => void docs.set(`${path}/${id}`, structuredClone(d))
      })
    };
  };
  return { docs, api: { collection: coll } };
}

describe('artifact account storage', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('saves to the private user subtree and restores on a fresh device', async () => {
    const store = fakeDb();
    (window as unknown as { claude: unknown }).claude = {
      use: async (n: string) => (n === 'db' ? store.api : n === 'user' ? { id: async () => 'u_abc' } : null)
    };
    const backend = (await ArtifactDbBackend.connect())!;
    expect(backend).not.toBeNull();
    const engine = new SyncEngine(backend);
    await create<UserProfile>('profiles', { name: 'Ebenezar', onboarded: true } as never);
    await engine.push();
    expect([...store.docs.keys()].every((k) => k.startsWith('data/users/u_abc/profiles.'))).toBe(true);

    // "New phone": wipe local data, pull from the account store.
    await Promise.all(db.tables.map((t) => t.clear()));
    const pulled = await new SyncEngine(backend).pull();
    expect(pulled).toBe(1);
    expect((await db.profiles.toArray())[0].name).toBe('Ebenezar');
  });
});
