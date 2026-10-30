import { db, SYNC_ENTITIES } from '@/db';

export async function exportAll(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const e of SYNC_ENTITIES) data[e] = await db.table(e).toArray();
  return JSON.stringify({ app: 'thalifit', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

/** Imports a backup. Rows are merged by id; the newer `updatedAt` wins. */
export async function importAll(json: string): Promise<number> {
  const parsed = JSON.parse(json) as { app?: string; data?: Record<string, { id: string; updatedAt: number }[]> };
  if (parsed.app !== 'thalifit' || !parsed.data) throw new Error('Not a ThaliFit backup file');
  let n = 0;
  for (const e of SYNC_ENTITIES) {
    const rows = parsed.data[e] ?? [];
    for (const r of rows) {
      const cur = (await db.table(e).get(r.id)) as { updatedAt: number } | undefined;
      if (!cur || cur.updatedAt < r.updatedAt) {
        await db.table(e).put(r);
        n++;
      }
    }
  }
  return n;
}

export async function resetAll() {
  await Promise.all(db.tables.filter((t) => !['ingredients', 'recipes'].includes(t.name)).map((t) => t.clear()));
}
