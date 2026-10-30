import { motion } from 'framer-motion';
import { useState } from 'react';
import type { Favourite, MealPlan, MealType } from '@/types';
import { useApp, useIbs } from '@/store/app';
import { useCurrentPlan, useFavourites } from '@/hooks/data';
import { db } from '@/db';
import { alive, create, remove, today, update } from '@/db/repo';
import { Chip, FodmapBadge, Page, Section, Empty } from '@/components/ui';
import { RecipeArt } from '@/components/viz';
import { Icon } from '@/components/Icon';
import { logRecipe } from '@/lib/logging';
import { household } from '@/lib/units';
import { macroSplit, microTargets } from '@/lib/nutrition';
import { dayIndex } from '@/lib/planActions';

export default function RecipeDetail({ id }: { id: string }) {
  const { catalog, setRoute, toast, profile } = useApp();
  const ibsOn = useIbs();
  const [ibs, setIbs] = useState(ibsOn);
  const [servings, setServings] = useState<number | null>(null);
  const favs = useFavourites();
  const plan = useCurrentPlan();
  const r = catalog?.recipes.get(id);
  if (!r) return <Page title="Recipe"><Empty emoji="🤔" title="Recipe not found" text="It may have been removed." /></Page>;
  const sv = servings ?? r.servings;
  const ings = ibs ? r.ibsVariant.ingredients : r.ingredients;
  const n = ibs ? r.ibsVariant.perServing : r.perServing;
  const split = macroSplit(n);
  const micro = microTargets(profile!.sex);
  const fav = favs.has(r.id);

  const toggleFav = async () => {
    if (fav) {
      const row = alive(await db.favourites.where('recipeId').equals(r.id).toArray())[0];
      if (row) await remove('favourites', row.id);
    } else await create<Favourite>('favourites', { recipeId: r.id });
  };
  const addToToday = async (slot: MealType) => {
    if (!plan) return toast('Generate a plan first', 'warn');
    const d = dayIndex(plan.weekStart);
    const days = plan.days.map((day, i) => (i === d ? [...day, { key: `${r.id}-${Date.now()}`, slot, recipeId: r.id, servings: 1, locked: true }] : day));
    await update<MealPlan>('mealPlans', plan.id, { days });
    toast(`Added to today's ${slot}`);
  };

  return (
    <div className="pb-28 md:pb-10">
      <motion.div layoutId={`art-${r.id}`} className="relative">
        <RecipeArt recipe={r} className="h-56 w-full md:h-72" />
        <button className="no-print absolute left-4 top-4 rounded-full bg-black/50 p-2.5 text-white" onClick={() => useApp.getState().back()} aria-label="Back">
          <Icon name="arrowLeft" />
        </button>
        <button className={`no-print absolute right-4 top-4 rounded-full p-2.5 ${fav ? 'bg-turmeric text-white' : 'bg-black/50 text-white'}`} onClick={toggleFav} aria-label={fav ? 'Remove favourite' : 'Add favourite'} aria-pressed={fav}>
          <Icon name="heart" />
        </button>
      </motion.div>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pt-4">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight">{r.name}</h1>
          <div className="text-muted">
            {r.localName} · {r.cuisine} · {'🌶'.repeat(r.spice)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="badge bg-surface2">⏱ {r.prepMin} + {r.cookMin} min</span>
            <span className="badge bg-surface2">{r.difficulty}</span>
            {r.equipment.map((e) => (
              <span key={e} className="badge bg-surface2">
                {e}
              </span>
            ))}
            {r.dietTags.map((t) => (
              <span key={t} className="badge bg-leaf/15 text-leaf">
                {t === 'hplc' ? 'High-protein low-carb' : t}
              </span>
            ))}
            <span className="badge bg-surface2">≈ ₹{Math.round(r.costPerServing)} / serving</span>
            {r.batchFriendly && <span className="badge bg-sky/15 text-sky">batch-friendly</span>}
          </div>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          <button className="btn-accent" onClick={() => setRoute(`/cook/${r.id}`)}>
            <Icon name="chef" /> Start cooking
          </button>
          <button
            className="btn-primary"
            onClick={async () => {
              await logRecipe(r, 1, r.mealTypes.includes('breakfast') && new Date().getHours() < 11 ? 'breakfast' : r.mealTypes[0] === 'side' ? 'dinner' : r.mealTypes[0], ibs, today());
              toast(`Logged 1 serving of ${r.name}`);
            }}
          >
            <Icon name="plus" /> Log 1 serving
          </button>
          <select className="input !w-auto" onChange={(e) => e.target.value && addToToday(e.target.value as MealType)} value="" aria-label="Add to today's plan">
            <option value="">Add to today…</option>
            {r.mealTypes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Per serving">
            <div className="grid grid-cols-4 gap-2 text-center">
              {(
                [
                  ['kcal', Math.round(n.kcal), ''],
                  ['Protein', Math.round(n.protein), 'g'],
                  ['Net carbs', Math.round(n.netCarbs), 'g'],
                  ['Fat', Math.round(n.fat), 'g']
                ] as const
              ).map(([l, v, u]) => (
                <div key={l} className="rounded-xl bg-surface2 p-2">
                  <div className="font-display text-xl font-bold">
                    {v}
                    {u}
                  </div>
                  <div className="text-[11px] font-semibold text-muted">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label={`Protein ${Math.round(split.protein)}%, carbs ${Math.round(split.carbs)}%, fat ${Math.round(split.fat)}%`}>
              <div className="bg-chilli" style={{ width: `${split.protein}%` }} />
              <div className="bg-turmeric" style={{ width: `${split.carbs}%` }} />
              <div className="bg-sky" style={{ width: `${split.fat}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>Protein {Math.round(split.protein)}%</span>
              <span>Carbs {Math.round(split.carbs)}%</span>
              <span>Fat {Math.round(split.fat)}%</span>
            </div>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Micronutrients per serving</caption>
              <tbody>
                {(
                  [
                    ['Fibre', n.fibre, 'g', micro.fibre],
                    ['Sodium', n.sodium, 'mg', micro.sodium],
                    ['Potassium', n.potassium, 'mg', micro.potassium],
                    ['Calcium', n.calcium, 'mg', micro.calcium],
                    ['Iron', n.iron, 'mg', micro.iron],
                    ['Magnesium', n.magnesium, 'mg', micro.magnesium],
                    ['Zinc', n.zinc, 'mg', micro.zinc],
                    ['Vitamin C', n.vitC, 'mg', micro.vitC],
                    ['Vitamin A', n.vitA, 'µg', micro.vitA],
                    ['Folate', n.folate, 'µg', micro.folate],
                    ['Vitamin B12', n.b12, 'µg', micro.b12]
                  ] as const
                ).map(([l, v, u, rda]) => (
                  <tr key={l} className="border-b border-line/60">
                    <td className="py-1">{l}</td>
                    <td className="py-1 text-right font-semibold">
                      {v < 10 ? v.toFixed(1) : Math.round(v)} {u}
                    </td>
                    <td className="w-16 py-1 text-right text-xs text-muted">{Math.round((v / rda) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-muted">% of daily RDA (ICMR-NIN 2020). Computed from ingredient data.</p>
          </Section>

          <Section title="Gut check">
            <div className="flex flex-wrap items-center gap-2">
              <FodmapBadge level={r.fodmapStatus} /> <span className="text-sm text-muted">as written</span>
              <span className="text-muted">→</span>
              <FodmapBadge level={r.ibsVariant.fodmapStatus} /> <span className="text-sm text-muted">IBS-safe version</span>
            </div>
            {r.fodmapFlags.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {r.fodmapFlags.map((f) => (
                  <li key={f.ingredientId}>
                    <b>{catalog!.ingredients.get(f.ingredientId)?.name}</b> — {f.perServingG} g/serving ({f.groups.join(', ')}){f.safeG !== undefined ? `, safe ≤ ${f.safeG} g` : ''}
                  </li>
                ))}
              </ul>
            )}
            {r.ibsVariant.substitutions.length > 0 && (
              <>
                <h3 className="mt-3 font-bold">Automatic swaps</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {r.ibsVariant.substitutions.map((s, i) => (
                    <li key={i}>
                      {catalog!.ingredients.get(s.from)?.name} → <b>{s.to ? catalog!.ingredients.get(s.to)?.name : 'leave out'}</b>
                      {s.note && <span className="text-muted"> · {s.note}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {r.ingredients.some((i) => i.i === 'hing' || i.i === 'hing_gf') && <p className="mt-2 text-xs text-chilli">Most Indian hing is blended with wheat flour — buy a gluten-free (rice-flour based) hing.</p>}
            <label className="mt-3 flex min-h-[44px] items-center justify-between rounded-xl bg-surface2 p-3 text-sm font-semibold">
              Show IBS-safe version
              <input type="checkbox" className="h-5 w-5" checked={ibs} onChange={(e) => setIbs(e.target.checked)} />
            </label>
          </Section>
        </div>

        <Section
          title="Ingredients"
          action={
            <div className="flex items-center gap-1">
              <button className="btn-ghost !min-h-[36px] !px-2.5" onClick={() => setServings(Math.max(1, sv - 1))} aria-label="Fewer servings">
                <Icon name="minus" size={16} />
              </button>
              <span className="w-24 text-center text-sm font-semibold">
                {sv} serving{sv > 1 ? 's' : ''}
              </span>
              <button className="btn-ghost !min-h-[36px] !px-2.5" onClick={() => setServings(Math.min(12, sv + 1))} aria-label="More servings">
                <Icon name="plus" size={16} />
              </button>
            </div>
          }
        >
          <ul className="divide-y divide-line/60">
            {ings.map((it) => {
              const ing = catalog!.ingredients.get(it.i);
              if (!ing) return null;
              const g = (it.g * sv) / r.servings;
              const swapped = ibs && r.ibsVariant.substitutions.some((s) => s.to === it.i && s.from !== s.to);
              return (
                <li key={it.i} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    <span className={swapped ? 'font-semibold text-leaf' : ''}>{ing.name}</span>
                    {it.note && <span className="text-sm text-muted"> · {it.note}</span>}
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <b>{g < 10 ? g.toFixed(1) : Math.round(g)} g</b>
                    {household(ing, g) && <span className="block text-xs text-muted">{household(ing, g)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Method">
          <ol className="space-y-3">
            {r.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-turmeric/20 font-bold text-turmeric">{i + 1}</span>
                <span>
                  {s.text}
                  {s.timerMin && <span className="ml-2 badge bg-plum/15 text-plum">⏱ {s.timerMin} min</span>}
                </span>
              </li>
            ))}
          </ol>
          {r.tips?.length ? (
            <div className="mt-4 rounded-xl bg-surface2 p-3 text-sm">
              <b>Tips</b>
              <ul className="list-disc pl-5">
                {r.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {r.makeAhead && (
            <div className="mt-2 rounded-xl bg-sky/10 p-3 text-sm">
              <b>Make ahead:</b> {r.makeAhead}
            </div>
          )}
        </Section>
        <div className="flex flex-wrap gap-2">
          {r.mealTypes.map((m) => (
            <Chip key={m}>{m}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
