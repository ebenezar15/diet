import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { MealPlan, PlannedMeal, Recipe, WaterLog } from '@/types';
import { useApp, useIbs } from '@/store/app';
import { useT } from '@/i18n';
import { useAllMealLogs, useCurrentPlan, useMealLogs, useSymptoms, useWater } from '@/hooks/data';
import { create, remove, today, addDays } from '@/db/repo';
import { Page, Section, Sheet, Empty, FodmapBadge } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { MacroBar, Plate, Ring, RecipeArt, WaterGlass, celebrate } from '@/components/viz';
import { sum, microTargets } from '@/lib/nutrition';
import { waterTargetMl } from '@/lib/targets';
import { dayIndex, setMealStatus } from '@/lib/planActions';
import { logRecipe } from '@/lib/logging';
import { dailyInsight } from '@/lib/correlations';
import { FastingCard } from './Fasting';
import { db } from '@/db';
import { alive } from '@/db/repo';

export default function Today() {
  const { profile, catalog, openLog, setRoute, toast } = useApp();
  const ibs = useIbs();
  const t = useT();
  const date = today();
  const logs = useMealLogs(date);
  const water = useWater(date);
  const plan = useCurrentPlan();
  const allLogs = useAllMealLogs();
  const symptoms = useSymptoms();
  const [swap, setSwap] = useState<PlannedMeal | null>(null);

  const totals = useMemo(() => sum(logs.map((l) => l.nutrition)), [logs]);
  const tg = profile!.targets;
  const waterTarget = waterTargetMl(profile!.weightKg);
  const di = plan ? dayIndex(plan.weekStart) : 0;
  const todays = plan?.days[di] ?? [];
  const insight = useMemo(() => (catalog ? dailyInsight(allLogs, symptoms, catalog) : null), [allLogs, symptoms, catalog]);
  const streak = useMemo(() => {
    const days = new Set(allLogs.map((l) => l.date));
    let s = 0;
    let d = days.has(date) ? date : addDays(date, -1);
    while (days.has(d)) {
      s++;
      d = addDays(d, -1);
    }
    return s;
  }, [allLogs, date]);
  const micros = microTargets(profile!.sex);

  const addWater = async (ml: number) => {
    if (ml > 0) {
      await create<WaterLog>('waterLogs', { date, ml });
      if (water < waterTarget && water + ml >= waterTarget) {
        celebrate();
        toast('Hydration goal hit 💧');
      }
    } else {
      const last = alive(await db.waterLogs.where('date').equals(date).toArray()).sort((a, b) => b.createdAt - a.createdAt)[0];
      if (last) await remove('waterLogs', last.id);
    }
  };

  const eat = async (m: PlannedMeal) => {
    const r = catalog?.recipes.get(m.recipeId);
    if (!r || !plan) return;
    await logRecipe(r, m.servings, m.slot === 'side' ? 'dinner' : m.slot, ibs, date);
    await setMealStatus(plan, di, m.key, 'eaten');
    const after = totals.kcal + (ibs ? r.ibsVariant.perServing.kcal : r.perServing.kcal) * m.servings;
    if (totals.protein < tg.protein && totals.protein + r.perServing.protein * m.servings >= tg.protein) celebrate();
    toast(`Logged ${r.name} · ${Math.round(after)} kcal today`);
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Page
      title={`${greet}${profile!.name ? `, ${profile!.name.split(' ')[0]}` : ''}`}
      subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      action={
        <button className="btn-accent" onClick={() => openLog()}>
          <Icon name="plus" /> Log
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Section>
          <div className="flex flex-wrap items-center justify-around gap-4">
            <Ring value={totals.kcal} max={tg.kcal} size={168} stroke={16} label={t('calories')}>
              <div className="font-display text-3xl font-extrabold">{Math.round(Math.max(0, tg.kcal - totals.kcal))}</div>
              <div className="text-xs font-semibold text-muted">kcal left</div>
              <div className="text-xs text-muted">
                {Math.round(totals.kcal)} / {tg.kcal}
              </div>
            </Ring>
            <div className="flex flex-col items-center">
              <Plate pct={totals.kcal / tg.kcal} />
              <span className="text-xs font-semibold text-muted">Your thali today</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(
              [
                ['protein', 'rgb(var(--chilli))'],
                ['carbs', 'rgb(var(--turmeric))'],
                ['fat', 'rgb(var(--sky))']
              ] as const
            ).map(([k, c]) => (
              <div key={k} className="flex flex-col items-center">
                <Ring value={k === 'carbs' && profile!.dietMode === 'keto' ? totals.netCarbs : totals[k]} max={tg[k]} size={76} stroke={8} color={c} label={t(k)}>
                  <span className="text-sm font-bold">{Math.round(k === 'carbs' && profile!.dietMode === 'keto' ? totals.netCarbs : totals[k])}g</span>
                </Ring>
                <span className="mt-1 text-xs font-semibold text-muted">
                  {t(k)} / {tg[k]}g
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <MacroBar label={t('fibre')} value={totals.fibre} max={tg.fibre} color="rgb(var(--leaf))" />
            <details className="text-sm">
              <summary className="cursor-pointer py-2 font-semibold text-muted">Micronutrients today</summary>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {(
                  [
                    ['iron', 'Iron', 'mg'],
                    ['calcium', 'Calcium', 'mg'],
                    ['magnesium', 'Magnesium', 'mg'],
                    ['potassium', 'Potassium', 'mg'],
                    ['zinc', 'Zinc', 'mg'],
                    ['vitC', 'Vitamin C', 'mg'],
                    ['vitA', 'Vitamin A', 'µg'],
                    ['folate', 'Folate', 'µg'],
                    ['b12', 'Vitamin B12', 'µg']
                  ] as const
                ).map(([k, l, u]) => (
                  <div key={k}>
                    <div className="flex justify-between text-xs">
                      <span>{l}</span>
                      <span className="text-muted">
                        {totals[k] < 10 ? totals[k].toFixed(1) : Math.round(totals[k])}/{micros[k]} {u}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-plum" style={{ width: `${Math.min(100, (totals[k] / micros[k]) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </Section>

        <div className="space-y-4">
          <Section title={t('water')}>
            <div className="flex items-center gap-4">
              <WaterGlass ml={water} target={waterTarget} />
              <div className="flex-1">
                <div className="font-display text-2xl font-bold">
                  {(water / 1000).toFixed(2)} <span className="text-base text-muted">/ {(waterTarget / 1000).toFixed(1)} L</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="btn-ghost !px-3" onClick={() => addWater(-250)} aria-label="Remove a glass">
                    <Icon name="minus" />
                  </button>
                  <button className="btn-primary flex-1" onClick={() => addWater(250)}>
                    <Icon name="drop" size={18} /> +250 ml
                  </button>
                </div>
              </div>
            </div>
          </Section>
          {profile!.ifProtocol !== 'none' && <FastingCard />}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3">
              <div className="text-xs font-semibold uppercase text-muted">Streak</div>
              <div className="font-display text-2xl font-bold">🔥 {streak} day{streak === 1 ? '' : 's'}</div>
            </div>
            <button className="card p-3 text-left" onClick={() => setRoute('/gut')}>
              <div className="text-xs font-semibold uppercase text-muted">Gut check</div>
              <div className="font-display text-lg font-bold">🌿 Log symptoms</div>
            </button>
          </div>
          {insight && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card border-l-4 border-l-leaf p-3 text-sm">
              <b>Insight · </b>
              {insight}
            </motion.div>
          )}
        </div>
      </div>

      <Section
        className="mt-4"
        title="Today's plan"
        action={
          <button className="text-sm font-semibold text-sky" onClick={() => setRoute('/plan')}>
            Edit week
          </button>
        }
      >
        {!plan || !todays.length ? (
          <Empty emoji="🍽️" title="No plan yet" text="Generate a 7-day plan tailored to your targets — fully offline." action={<button className="btn-primary mt-2" onClick={() => setRoute('/plan')}>Plan my week</button>} />
        ) : (
          <>
            <p className="mb-2 text-xs text-muted">Swipe right = eaten · left = skip · tap = swap</p>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {todays.map((m) => {
                  const r = catalog?.recipes.get(m.recipeId);
                  if (!r) return null;
                  return <MealCard key={m.key} m={m} r={r} ibs={ibs} onEat={() => eat(m)} onSkip={() => plan && setMealStatus(plan, di, m.key, 'skipped')} onSwap={() => setSwap(m)} onOpen={() => setRoute(`/recipes/${r.id}`)} />;
                })}
              </AnimatePresence>
            </div>
          </>
        )}
      </Section>

      <Cravings />
      <LoggedList logs={logs} />
      {swap && plan && <SwapSheet plan={plan} day={di} meal={swap} onClose={() => setSwap(null)} />}
    </Page>
  );
}

function MealCard({ m, r, ibs, onEat, onSkip, onSwap, onOpen }: { m: PlannedMeal; r: Recipe; ibs: boolean; onEat: () => void; onSkip: () => void; onSwap: () => void; onOpen: () => void }) {
  const t = useT();
  const x = useMotionValue(0);
  const bg = useTransform(x, [-120, 0, 120], ['rgb(196 46 32 / 0.25)', 'rgb(0 0 0 / 0)', 'rgb(46 125 50 / 0.25)']);
  const n = ibs ? r.ibsVariant.perServing : r.perServing;
  const done = m.status === 'eaten' || m.status === 'skipped';
  const onEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) onEat();
    else if (info.offset.x < -100) onSkip();
  };
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 80 }} className="relative overflow-hidden rounded-2xl" style={{ background: bg }}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-5 font-bold">
        <span className="text-leaf">✓ Eaten</span>
        <span className="text-chilli">Skip ✕</span>
      </div>
      <motion.div
        drag={done ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={onEnd}
        style={{ x }}
        className={`relative flex items-center gap-3 border border-line bg-surface p-2 ${done ? 'opacity-60' : ''}`}
        onTap={() => !done && onSwap()}
        role="button"
        tabIndex={0}
        aria-label={`${t(m.slot)}: ${r.name}. Press E to mark eaten, S to skip, Enter to swap.`}
        onKeyDown={(e) => {
          if (e.key === 'e') onEat();
          else if (e.key === 's') onSkip();
          else if (e.key === 'Enter') onSwap();
        }}
      >
        <RecipeArt recipe={r} className="h-16 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">
            {t(m.slot)} · {m.servings} serving{m.servings === 1 ? '' : 's'}
            {m.status === 'eaten' && <span className="ml-1 text-leaf">· eaten ✓</span>}
            {m.status === 'skipped' && <span className="ml-1 text-chilli">· skipped</span>}
          </div>
          <div className="truncate font-semibold">{r.name}</div>
          <div className="text-xs text-muted">
            {Math.round(n.kcal * m.servings)} kcal · P {Math.round(n.protein * m.servings)} · C {Math.round(n.netCarbs * m.servings)} · F {Math.round(n.fat * m.servings)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {ibs && <FodmapBadge level={r.ibsVariant.fodmapStatus} />}
          <button
            className="rounded-full p-2 text-muted hover:bg-surface2"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            aria-label={`Open ${r.name}`}
          >
            <Icon name="arrowRight" size={18} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SwapSheet({ plan, day, meal, onClose }: { plan: MealPlan; day: number; meal: PlannedMeal; onClose: () => void }) {
  const { catalog, toast } = useApp();
  const ibs = useIbs();
  const cur = catalog!.recipes.get(meal.recipeId)!;
  const curN = ibs ? cur.ibsVariant.perServing : cur.perServing;
  const options = catalog!.list
    .filter((r) => r.id !== cur.id && (meal.slot === 'side' ? r.mealTypes.includes('side') : r.mealTypes.includes(meal.slot)) && (!ibs || r.ibsVariant.fodmapStatus === 'low'))
    .map((r) => ({ r, d: Math.abs((ibs ? r.ibsVariant.perServing : r.perServing).protein - curN.protein) + Math.abs((ibs ? r.ibsVariant.perServing : r.perServing).kcal - curN.kcal) / 20 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 12);
  const choose = async (r: Recipe) => {
    const n = ibs ? r.ibsVariant.perServing : r.perServing;
    const servings = Math.max(0.5, Math.min(2.5, Math.round(((curN.kcal * meal.servings) / Math.max(50, n.kcal)) * 4) / 4));
    const { update } = await import('@/db/repo');
    await update<MealPlan>('mealPlans', plan.id, {
      days: plan.days.map((d, i) => (i === day ? d.map((m) => (m.key === meal.key ? { ...m, recipeId: r.id, servings } : m)) : d))
    });
    toast(`Swapped to ${r.name}`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Swap ${cur.name}`}>
      <p className="mb-3 text-sm text-muted">Similar calories and protein, portion auto-adjusted.</p>
      <div className="space-y-2">
        {options.map(({ r }) => {
          const n = ibs ? r.ibsVariant.perServing : r.perServing;
          return (
            <button key={r.id} className="card flex w-full items-center gap-3 p-2 text-left" onClick={() => choose(r)}>
              <RecipeArt recipe={r} className="h-12 w-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.name}</div>
                <div className="text-xs text-muted">
                  {r.cuisine} · {Math.round(n.kcal)} kcal · P {Math.round(n.protein)}g · ₹{Math.round(r.costPerServing)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function LoggedList({ logs }: { logs: ReturnType<typeof useMealLogs> }) {
  const t = useT();
  if (!logs.length) return null;
  return (
    <Section className="mt-4" title="Logged today">
      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {logs.map((l) => (
            <motion.li key={l.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{l.label}</div>
                <div className="text-xs text-muted">
                  {t(l.slot)} · {Math.round(l.nutrition.kcal)} kcal · P {Math.round(l.nutrition.protein)}g
                </div>
              </div>
              <button className="rounded-full p-2 text-muted hover:bg-surface2" onClick={() => remove('mealLogs', l.id)} aria-label={`Delete ${l.label}`}>
                <Icon name="x" size={18} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Section>
  );
}

/** Low / zero-calorie picks for cravings — drinks, desserts and light snacks. */
function Cravings() {
  const { catalog, setRoute } = useApp();
  const ibs = useIbs();
  const picks = useMemo(() => {
    const list = (catalog?.list ?? []).filter((r) => (r.course || r.mealTypes.includes('snack')) && (ibs ? r.ibsVariant.perServing : r.perServing).kcal <= 120 && (!ibs || r.ibsVariant.fodmapStatus === 'low'));
    const day = new Date().getDate();
    return [...list].sort((a, b) => ((a.id.length * 7 + day) % 13) - ((b.id.length * 7 + day) % 13)).slice(0, 8);
  }, [catalog, ibs]);
  if (!picks.length) return null;
  return (
    <Section className="mt-4" title="Craving something? 🪶" action={<button className="text-sm font-semibold text-sky" onClick={() => setRoute('/recipes')}>More</button>}>
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {picks.map((r) => {
          const n = ibs ? r.ibsVariant.perServing : r.perServing;
          return (
            <motion.button key={r.id} whileTap={{ scale: 0.96 }} className="w-32 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface text-left" onClick={() => setRoute(`/recipes/${r.id}`)}>
              <RecipeArt recipe={r} className="h-20 w-full" />
              <div className="p-2">
                <div className="line-clamp-2 text-xs font-bold leading-tight">{r.name}</div>
                <div className="text-[11px] text-muted">
                  {r.course === 'drink' ? '🥤' : r.course === 'dessert' ? '🍮' : '🥒'} {Math.round(n.kcal)} kcal
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </Section>
  );
}
