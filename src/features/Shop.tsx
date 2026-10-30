import { AnimatePresence, motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import type { PantryItem, PriceOverride, RecipeIngredientSeed, ShoppingCheck, StoreSection } from '@/types';
import { useApp, useIbs } from '@/store/app';
import { useCurrentPlan } from '@/hooks/data';
import { db } from '@/db';
import { addDays, alive, create, remove, today, update } from '@/db/repo';
import { Chip, Empty, Page, Section, Sheet } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SECTION_LABEL, buildShoppingList, shoppingText } from '@/lib/shopping';
import { celebrate } from '@/components/viz';

/** Deduct cooked ingredients from pantry stock. Returns number of pantry rows touched. */
export async function deductPantryForRecipe(items: RecipeIngredientSeed[], factor: number) {
  const pantry = alive(await db.pantry.toArray());
  let n = 0;
  for (const it of items) {
    const row = pantry.find((p) => p.ingredientId === it.i);
    if (!row) continue;
    await update<PantryItem>('pantry', row.id, { grams: Math.max(0, Math.round(row.grams - it.g * factor)) });
    n++;
  }
  return n;
}

export default function Shop() {
  const [tab, setTab] = useState<'list' | 'pantry' | 'prices'>('list');
  return (
    <Page title="Shopping" subtitle="Rounded to how you actually buy in Indian markets">
      <div className="mb-4 flex gap-2">
        <Chip on={tab === 'list'} onClick={() => setTab('list')}>
          🛒 This week
        </Chip>
        <Chip on={tab === 'pantry'} onClick={() => setTab('pantry')}>
          🫙 Pantry
        </Chip>
        <Chip on={tab === 'prices'} onClick={() => setTab('prices')}>
          ₹ Prices
        </Chip>
      </div>
      {tab === 'list' && <ShoppingList />}
      {tab === 'pantry' && <Pantry />}
      {tab === 'prices' && <Prices />}
    </Page>
  );
}

function ShoppingList() {
  const { catalog, setRoute, toast } = useApp();
  const ibs = useIbs();
  const plan = useCurrentPlan();
  const pantryRaw = useLiveQuery(async () => alive(await db.pantry.toArray()), []);
  const pantryRows = useMemo(() => pantryRaw ?? [], [pantryRaw]);
  const checks = useLiveQuery(async () => (plan ? alive(await db.shoppingChecks.where('planId').equals(plan.id).toArray()) : []), [plan?.id]) ?? [];
  const pantry = useMemo(() => pantryMap(pantryRows), [pantryRows]);
  const lines = useMemo(() => (plan && catalog ? buildShoppingList({ days: plan.days, catalog, people: plan.people, ibs, pantry }) : []), [plan, catalog, ibs, pantry]);
  const checked = new Set(checks.filter((c) => c.checked).map((c) => c.ingredientId));

  if (!plan) return <Empty emoji="🛒" title="No plan yet" text="Generate a meal plan and your list builds itself." action={<button className="btn-primary mt-2" onClick={() => setRoute('/plan')}>Plan my week</button>} />;

  const toggle = async (ingredientId: string) => {
    const row = checks.find((c) => c.ingredientId === ingredientId);
    const now = !checked.has(ingredientId);
    if (row) await update<ShoppingCheck>('shoppingChecks', row.id, { checked: now });
    else await create<ShoppingCheck>('shoppingChecks', { planId: plan.id, ingredientId, checked: true });
    navigator.vibrate?.(15);
    if (now && checked.size + 1 === lines.length) {
      celebrate();
      toast('Shopping done! 🎉');
    }
  };

  const addAllToPantry = async () => {
    for (const l of lines.filter((l) => checked.has(l.ingredientId))) {
      const ing = catalog!.ingredients.get(l.ingredientId)!;
      const existing = pantryRows.find((p) => p.ingredientId === l.ingredientId);
      if (existing) await update<PantryItem>('pantry', existing.id, { grams: existing.grams + l.buyG, expiresOn: addDays(today(), ing.shelfDays) });
      else await create<PantryItem>('pantry', { ingredientId: l.ingredientId, grams: l.buyG, expiresOn: addDays(today(), ing.shelfDays) });
    }
    toast('Bought items added to pantry');
  };

  const share = async () => {
    const text = shoppingText(lines, `ThaliFit list · ${plan.people} ${plan.people > 1 ? 'people' : 'person'}`);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* cancelled */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const total = lines.reduce((a, l) => a + l.cost, 0);
  const staples = lines.filter((l) => l.staple).reduce((a, l) => a + l.cost, 0);
  const eatenCost = Math.round(plan.days.flat().reduce((a, m) => a + (catalog?.recipes.get(m.recipeId)?.costPerServing ?? 0) * m.servings * plan.people, 0));
  const remaining = lines.filter((l) => !checked.has(l.ingredientId)).reduce((a, l) => a + l.cost, 0);

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="card p-3">
          <div className="text-xs font-semibold uppercase text-muted">Items</div>
          <div className="font-display text-2xl font-bold">
            {checked.size}/{lines.length}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-semibold uppercase text-muted">Est. total</div>
          <div className="font-display text-2xl font-bold">₹{total}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-semibold uppercase text-muted">Left to buy</div>
          <div className="font-display text-2xl font-bold">₹{remaining}</div>
        </div>
      </div>
      <p className="mb-4 rounded-xl bg-surface2 p-3 text-sm">
        💰 Food actually eaten this week ≈ <b>₹{eatenCost}</b> (₹{Math.round(eatenCost / 7 / plan.people)}/person/day). Of today's bill, <b>₹{staples}</b> is long-life staples (spices, oils, grains) that last for weeks.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={share}>
          <Icon name="share" size={18} /> Share on WhatsApp
        </button>
        <button className="btn-ghost" onClick={addAllToPantry} disabled={!checked.size}>
          Add bought to pantry
        </button>
      </div>
      <div className="space-y-4">
        {(Object.keys(SECTION_LABEL) as StoreSection[]).map((section) => {
          const ls = lines.filter((l) => l.section === section);
          if (!ls.length) return null;
          return (
            <Section key={section} title={SECTION_LABEL[section]} action={<span className="text-sm text-muted">₹{ls.reduce((a, l) => a + l.cost, 0)}</span>}>
              <ul>
                <AnimatePresence initial={false}>
                  {ls.map((l) => {
                    const on = checked.has(l.ingredientId);
                    return (
                      <motion.li key={l.ingredientId} layout className="border-b border-line/60 last:border-0">
                        <button className="flex min-h-[52px] w-full items-center gap-3 py-2 text-left" onClick={() => toggle(l.ingredientId)} aria-pressed={on}>
                          <motion.span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-leaf bg-leaf text-white' : 'border-line'}`}
                            animate={on ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                            transition={{ type: 'spring', damping: 10 }}
                          >
                            {on && <Icon name="check" size={16} />}
                          </motion.span>
                          <span className="min-w-0 flex-1">
                            <span className={`relative font-semibold transition ${on ? 'text-muted' : ''}`}>
                              {l.name}
                              <motion.span className="absolute left-0 top-1/2 h-0.5 bg-muted" initial={false} animate={{ width: on ? '100%' : '0%' }} />
                            </span>
                            {l.butcherNotes.length > 0 && <span className="block text-xs text-chilli">🔪 {l.butcherNotes.join(' · ')}</span>}
                            {l.split && (
                              <span className="block text-xs text-sky">
                                Perishable: buy {l.split.early} now, {l.split.late} mid-week
                              </span>
                            )}
                            {l.staple && <span className="block text-xs text-muted">Staple — lasts several weeks</span>}
                            {l.pantryG > 0 && <span className="block text-xs text-muted">{l.pantryG} g already in pantry</span>}
                          </span>
                          <span className="text-right">
                            <span className="block font-bold">{l.display}</span>
                            <span className="text-xs text-muted">₹{l.cost}</span>
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </Section>
          );
        })}
      </div>
    </>
  );
}

const pantryMap = (rows: PantryItem[]) => rows.reduce<Record<string, number>>((a, p) => ((a[p.ingredientId] = (a[p.ingredientId] ?? 0) + p.grams), a), {});

function Pantry() {
  const { catalog, setRoute } = useApp();
  const rows = useLiveQuery(async () => alive(await db.pantry.toArray()), []) ?? [];
  const [adding, setAdding] = useState(false);
  const [ingId, setIngId] = useState('');
  const [grams, setGrams] = useState(500);
  const soon = rows.filter((r) => r.expiresOn && r.expiresOn <= addDays(today(), 2) && r.grams > 0);
  const useItUp = useMemo(() => {
    if (!catalog || !soon.length) return [];
    const ids = new Set(soon.map((s) => s.ingredientId));
    return catalog.list
      .map((r) => ({ r, hits: r.ingredients.filter((i) => ids.has(i.i)).length }))
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 6);
  }, [catalog, soon]);
  const ings = [...(catalog?.ingredients.values() ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      {soon.length > 0 && (
        <Section title="⚠️ Use it up">
          <p className="mb-2 text-sm text-muted">Expiring soon: {soon.map((s) => catalog?.ingredients.get(s.ingredientId)?.name).join(', ')}</p>
          <div className="flex flex-wrap gap-2">
            {useItUp.map(({ r }) => (
              <button key={r.id} className="chip" onClick={() => setRoute(`/recipes/${r.id}`)}>
                {r.name}
              </button>
            ))}
          </div>
        </Section>
      )}
      <Section
        title="Pantry stock"
        action={
          <button className="btn-primary !min-h-[40px]" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> Add
          </button>
        }
      >
        {!rows.length ? (
          <Empty emoji="🫙" title="Pantry is empty" text="Add what you already have and it's subtracted from your shopping list. Cooking deducts automatically." />
        ) : (
          <ul className="divide-y divide-line/60">
            {rows.map((p) => {
              const ing = catalog?.ingredients.get(p.ingredientId);
              const expired = p.expiresOn && p.expiresOn < today();
              return (
                <li key={p.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{ing?.name ?? p.ingredientId}</div>
                    <div className={`text-xs ${expired ? 'text-chilli' : 'text-muted'}`}>{p.expiresOn ? `${expired ? 'Expired' : 'Use by'} ${p.expiresOn}` : 'No expiry'}</div>
                  </div>
                  <input
                    className="input !w-24 text-right"
                    type="number"
                    value={p.grams}
                    onChange={(e) => update<PantryItem>('pantry', p.id, { grams: Number(e.target.value) })}
                    aria-label={`${ing?.name} grams`}
                  />
                  <span className="text-sm text-muted">g</span>
                  <button className="rounded-full p-2 text-muted" onClick={() => remove('pantry', p.id)} aria-label={`Remove ${ing?.name}`}>
                    <Icon name="x" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add to pantry">
        <div className="space-y-3">
          <select className="input" value={ingId} onChange={(e) => setIngId(e.target.value)} aria-label="Ingredient">
            <option value="">Choose ingredient…</option>
            {ings.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <label className="block">
            <span className="label">Amount (g / ml)</span>
            <input className="input mt-1" type="number" value={grams} onChange={(e) => setGrams(Number(e.target.value))} />
          </label>
          <button
            className="btn-primary w-full"
            disabled={!ingId}
            onClick={async () => {
              const ing = catalog!.ingredients.get(ingId)!;
              await create<PantryItem>('pantry', { ingredientId: ingId, grams, expiresOn: addDays(today(), ing.shelfDays) });
              setAdding(false);
            }}
          >
            Add
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function Prices() {
  const { catalog, rebuildCatalog } = useApp();
  const overrides = useLiveQuery(async () => alive(await db.priceOverrides.toArray()), []) ?? [];
  const [q, setQ] = useState('');
  const ings = [...(catalog?.ingredients.values() ?? [])].filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));
  const setPrice = async (id: string, v: number) => {
    const row = overrides.find((o) => o.ingredientId === id);
    if (row) await update<PriceOverride>('priceOverrides', row.id, { pricePerKg: v });
    else await create<PriceOverride>('priceOverrides', { ingredientId: id, pricePerKg: v });
    await rebuildCatalog();
  };
  return (
    <Section title="Local price list (₹ per kg / litre)">
      <p className="mb-2 text-sm text-muted">Defaults are typical metro prices. Edit to match your market — costs everywhere update.</p>
      <input className="input mb-3" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search prices" />
      <ul className="divide-y divide-line/60">
        {ings.map((i) => {
          const o = overrides.find((x) => x.ingredientId === i.id);
          return (
            <li key={i.id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1 text-sm">{i.name}</span>
              <span className="text-sm text-muted">₹</span>
              <input
                className={`input !min-h-[40px] !w-24 text-right ${o ? 'ring-2 ring-turmeric' : ''}`}
                type="number"
                defaultValue={o?.pricePerKg ?? i.pricePerKg}
                onBlur={(e) => Number(e.target.value) !== (o?.pricePerKg ?? i.pricePerKg) && setPrice(i.id, Number(e.target.value))}
                aria-label={`${i.name} price per kg`}
              />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
