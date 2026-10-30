import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { motion, LayoutGroup } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { MealPlan, PlannedMeal, PlanSettings } from '@/types';
import { useApp, useIbs } from '@/store/app';
import { useT } from '@/i18n';
import { useCurrentPlan, useTemplates } from '@/hooks/data';
import { create, update, mondayOf, today } from '@/db/repo';
import { Chip, Empty, Page, Section, Sheet, Slider } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { RecipeArt } from '@/components/viz';
import { dayTotals, evaluateDay } from '@/lib/planner';
import { dayIndex, generateAndSave, settingsFromProfile } from '@/lib/planActions';
import { DIET_MODES } from '@/lib/targets';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlanPage() {
  const { profile, catalog, ctx, toast, setRoute } = useApp();
  const ibs = useIbs();
  const plan = useCurrentPlan();
  const templates = useTemplates();
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PlanSettings>(() => plan?.settings ?? settingsFromProfile(profile!));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));
  const keto = (plan?.settings.dietMode ?? profile!.dietMode) === 'keto';
  const todayIdx = plan ? dayIndex(plan.weekStart) : -1;

  const regenerate = async (over: Partial<PlanSettings> = {}) => {
    if (!catalog) return;
    setBusy(true);
    const s = { ...settings, ...over, targets: profile!.targets, seed: Math.floor(Math.random() * 1e6) };
    setSettings(s);
    // yield so the spinner renders
    await new Promise((r) => setTimeout(r, 30));
    const res = await generateAndSave({ profile: profile!, catalog, ctx, ibs, settings: s, existing: plan });
    setBusy(false);
    toast(res.warnings.length ? res.warnings[0] : `Plan ready · est. ₹${res.weeklyCost}/week`, res.warnings.length ? 'warn' : 'ok');
  };

  const saveDays = (days: PlannedMeal[][]) => plan && update<MealPlan>('mealPlans', plan.id, { days });

  const onDragEnd = (e: DragEndEvent) => {
    if (!plan || !e.over) return;
    const [fromDay, key] = String(e.active.id).split('|');
    const toDay = Number(String(e.over.id).replace('day-', ''));
    const from = Number(fromDay);
    if (from === toDay) return;
    const days = plan.days.map((d) => [...d]);
    const idx = days[from].findIndex((m) => m.key === key);
    if (idx < 0) return;
    const [m] = days[from].splice(idx, 1);
    days[toDay].push(m);
    void saveDays(days);
  };

  const toggleLock = (d: number, key: string) => plan && saveDays(plan.days.map((day, i) => (i === d ? day.map((m) => (m.key === key ? { ...m, locked: !m.locked } : m)) : day)));
  const removeMeal = (d: number, key: string) => plan && saveDays(plan.days.map((day, i) => (i === d ? day.filter((m) => m.key !== key) : day)));

  const saveTemplate = async () => {
    if (!plan) return;
    await create<MealPlan>('mealPlans', { ...strip(plan), name: `Template · ${DIET_MODES[plan.settings.dietMode].label} · ${new Date().toLocaleDateString()}`, isTemplate: true });
    toast('Saved as template');
  };
  const applyTemplate = async (t: MealPlan) => {
    const days = t.days.map((d) => d.map((m) => ({ ...m, status: undefined })));
    if (plan) await update<MealPlan>('mealPlans', plan.id, { days, settings: t.settings });
    else await create<MealPlan>('mealPlans', { ...strip(t), isTemplate: false, weekStart: mondayOf(today()), name: `Week of ${mondayOf(today())}`, days });
    toast(`Applied ${t.name}`);
  };
  const duplicateLastWeek = async () => {
    if (!plan) return;
    const week = mondayOf(today());
    if (plan.weekStart === week) return toast('This week is already planned — regenerate or edit it.', 'warn');
    await create<MealPlan>('mealPlans', { ...strip(plan), weekStart: week, name: `Week of ${week}`, days: plan.days.map((d) => d.map((m) => ({ ...m, status: undefined }))) });
    toast('Copied last week');
  };

  const evals = useMemo(
    () =>
      plan && catalog
        ? plan.days.map((d) =>
            evaluateDay(
              d.map((m) => {
                const r = catalog.recipes.get(m.recipeId);
                return { n: r ? (ibs ? r.ibsVariant.perServing : r.perServing) : dayTotals([], catalog, ibs), servings: m.servings };
              }),
              profile!.targets,
              keto
            )
          )
        : [],
    [plan, catalog, ibs, profile, keto]
  );

  const weekCost = plan && catalog ? Math.round(plan.days.flat().reduce((a, m) => a + (catalog.recipes.get(m.recipeId)?.costPerServing ?? 0) * m.servings * plan.people, 0)) : 0;

  return (
    <Page
      title="Meal plan"
      subtitle={plan ? `${DIET_MODES[plan.settings.dietMode].label}${ibs ? ' · Low-FODMAP' : ''} · ${plan.people} ${plan.people > 1 ? 'people' : 'person'} · ≈ ₹${weekCost}/week` : 'Plan your week in one tap'}
      action={
        <div className="flex gap-2">
          <button className="btn-ghost !px-3" onClick={() => setShowSettings(true)} aria-label="Plan settings">
            <Icon name="settings" />
          </button>
          <button className="btn-accent" onClick={() => regenerate()} disabled={busy}>
            <motion.span animate={busy ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
              <Icon name="refresh" />
            </motion.span>
            {plan ? 'Regenerate' : 'Generate'}
          </button>
        </div>
      }
    >
      {!plan ? (
        <Empty emoji="🗓️" title="No plan yet" text="We'll build 7 days that hit your calories & macros within ±5%, all IBS-filtered and offline." action={<button className="btn-primary mt-2" onClick={() => regenerate()}>Generate my week</button>} />
      ) : (
        <>
          <div className="no-print mb-3 flex flex-wrap gap-2">
            <button className="chip" onClick={() => setRoute('/chart')}>
              <Icon name="print" size={16} /> Diet chart
            </button>
            <button className="chip" onClick={() => setRoute('/shop')}>
              <Icon name="cart" size={16} /> Shopping list
            </button>
            <button className="chip" onClick={saveTemplate}>
              <Icon name="star" size={16} /> Save as template
            </button>
            <button className="chip" onClick={duplicateLastWeek}>
              <Icon name="copy" size={16} /> Duplicate last week
            </button>
            {templates.map((t) => (
              <button key={t.id} className="chip" onClick={() => applyTemplate(t)}>
                Use: {t.name.replace('Template · ', '')}
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs text-muted">Drag meals between days · 🔒 lock meals to keep them when you regenerate.</p>
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <LayoutGroup>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {plan.days.map((day, d) => (
                  <DayColumn key={d} d={d} day={day} isToday={d === todayIdx} ev={evals[d]} keto={keto} onLock={toggleLock} onRemove={removeMeal} />
                ))}
              </div>
            </LayoutGroup>
          </DndContext>
        </>
      )}
      <Sheet open={showSettings} onClose={() => setShowSettings(false)} title="Plan settings">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['keto', 'hplc', 'balanced'] as const).map((m) => (
              <Chip key={m} on={settings.dietMode === m} onClick={() => setSettings({ ...settings, dietMode: m })}>
                {DIET_MODES[m].label}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted">Changing diet mode here only affects this plan; update targets in Settings to change macros.</p>
          <Slider label="Meals per day" value={settings.mealsPerDay} min={2} max={6} onChange={(v) => setSettings({ ...settings, mealsPerDay: v })} />
          <Slider label="People" value={settings.people} min={1} max={8} onChange={(v) => setSettings({ ...settings, people: v })} />
          <Slider label="Budget per person per day" value={settings.budgetPerDay} min={100} max={800} step={10} onChange={(v) => setSettings({ ...settings, budgetPerDay: v })} format={(v) => `₹${v}`} />
          <Slider label="Max cooking time" value={settings.maxMinutes} min={10} max={90} step={5} onChange={(v) => setSettings({ ...settings, maxMinutes: v })} format={(v) => `${v} min`} />
          {(
            [
              ['leftovers', 'Use dinner leftovers for next lunch'],
              ['batchCook', 'Batch-cook (repeat batch-friendly dishes)'],
              ['airFryerBias', 'Prefer air-fryer recipes']
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex min-h-[44px] items-center justify-between rounded-xl bg-surface p-3 text-sm font-semibold">
              {l}
              <input type="checkbox" className="h-5 w-5" checked={settings[k]} onChange={(e) => setSettings({ ...settings, [k]: e.target.checked })} />
            </label>
          ))}
          <button
            className="btn-primary w-full"
            onClick={() => {
              setShowSettings(false);
              void regenerate(settings);
            }}
          >
            Regenerate with these settings
          </button>
        </div>
      </Sheet>
    </Page>
  );
}

const strip = (p: MealPlan) => {
  const { id: _i, createdAt: _c, updatedAt: _u, deviceId: _d, ...rest } = p as MealPlan & { fieldTs?: unknown };
  delete (rest as { fieldTs?: unknown }).fieldTs;
  return rest;
};

function DayColumn({ d, day, isToday, ev, keto, onLock, onRemove }: { d: number; day: PlannedMeal[]; isToday: boolean; ev?: ReturnType<typeof evaluateDay>; keto: boolean; onLock: (d: number, k: string) => void; onRemove: (d: number, k: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${d}` });
  return (
    <div ref={setNodeRef}>
      <Section
        className={`transition ${isOver ? 'ring-2 ring-turmeric' : ''} ${isToday ? 'border-turmeric' : ''}`}
        title={`${DAY[d]}${isToday ? ' · Today' : ''}`}
        action={
          ev && (
            <span className={`badge ${ev.within ? 'bg-leaf/15 text-leaf' : 'bg-turmeric/20 text-turmeric'}`} title="Within ±5% of every target">
              {Math.round(ev.total.kcal)} kcal {ev.within ? '✓' : `${ev.dev.kcal > 0 ? '+' : ''}${Math.round(ev.dev.kcal * 100)}%`}
            </span>
          )
        }
      >
        <div className="space-y-2">
          {day.map((m) => (
            <MealRow key={m.key} d={d} m={m} onLock={onLock} onRemove={onRemove} />
          ))}
          {!day.length && <p className="py-4 text-center text-sm text-muted">Drop a meal here</p>}
        </div>
        {ev && (
          <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px] text-muted">
            <span>P {Math.round(ev.total.protein)}g</span>
            <span>{keto ? 'Net' : 'C'} {Math.round(keto ? ev.total.netCarbs : ev.total.carbs)}g</span>
            <span>F {Math.round(ev.total.fat)}g</span>
            <span>Fib {Math.round(ev.total.fibre)}g</span>
          </div>
        )}
      </Section>
    </div>
  );
}

function MealRow({ d, m, onLock, onRemove }: { d: number; m: PlannedMeal; onLock: (d: number, k: string) => void; onRemove: (d: number, k: string) => void }) {
  const { catalog, setRoute } = useApp();
  const ibs = useIbs();
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${d}|${m.key}` });
  const r = catalog?.recipes.get(m.recipeId);
  if (!r) return null;
  const n = ibs ? r.ibsVariant.perServing : r.perServing;
  return (
    <motion.div
      layout
      layoutId={m.key}
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined}
      className={`flex items-center gap-2 rounded-xl border border-line bg-surface2 p-1.5 ${isDragging ? 'shadow-soft ring-2 ring-turmeric' : ''}`}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <button {...listeners} {...attributes} className="cursor-grab touch-none rounded-lg p-1.5 text-muted" aria-label={`Drag ${r.name}`}>
        <Icon name="grip" size={18} />
      </button>
      <RecipeArt recipe={r} className="h-10 w-10 shrink-0 rounded-lg" />
      <button className="min-w-0 flex-1 text-left" onClick={() => setRoute(`/recipes/${r.id}`)}>
        <div className="text-[11px] font-bold uppercase text-muted">
          {t(m.slot)} · {m.servings}×{m.status === 'eaten' ? ' · ✓' : ''}
        </div>
        <div className="truncate text-sm font-semibold">{r.name}</div>
        <div className="text-[11px] text-muted">
          {Math.round(n.kcal * m.servings)} kcal · P {Math.round(n.protein * m.servings)}g
        </div>
      </button>
      <button className={`rounded-lg p-2 ${m.locked ? 'text-turmeric' : 'text-muted'}`} onClick={() => onLock(d, m.key)} aria-label={m.locked ? 'Unlock' : 'Lock'} aria-pressed={m.locked}>
        <Icon name={m.locked ? 'lock' : 'unlock'} size={18} />
      </button>
      <button className="rounded-lg p-2 text-muted" onClick={() => onRemove(d, m.key)} aria-label={`Remove ${r.name}`}>
        <Icon name="x" size={16} />
      </button>
    </motion.div>
  );
}
