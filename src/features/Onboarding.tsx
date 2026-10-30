import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { DietMode, FodmapGroup, IfProtocol, UserProfile } from '@/types';
import { useApp } from '@/store/app';
import { update } from '@/db/repo';
import { Chip, Slider } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ACTIVITY, bmi, calorieMath, DIET_MODES, IF_PROTOCOLS, macroTargets, MAX_RATE, timeline } from '@/lib/targets';
import { GROUP_INFO } from '@/lib/fodmap';
import { generateAndSave, settingsFromProfile } from '@/lib/planActions';
import { celebrate } from '@/components/viz';
import { TimelineChart } from './Progress';

const STEPS = ['About you', 'Your goal', 'Activity', 'Diet style', 'Gut health', 'Food & budget', 'Your plan'];
const CUISINES = ['Chettinad', 'Tamil Nadu', 'Kerala', 'Andhra', 'Hyderabadi', 'Karnataka', 'Goan', 'Bengali', 'Punjabi', 'Mughlai', 'Indo-Chinese'];
const DISLIKES = ['mutton', 'fish', 'prawns', 'crab', 'egg', 'paneer', 'chicken_liver', 'brinjal', 'okra', 'bottle_gourd', 'mushroom', 'coconut'];
const DAY_PRESETS = [30, 60, 90, 120, 180];

export default function Onboarding() {
  const { profile, reloadProfile, catalog, ctx, setRoute, toast } = useApp();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [p, setP] = useState<UserProfile>(profile!);
  const set = (patch: Partial<UserProfile>) => setP((cur) => ({ ...cur, ...patch }));

  const math = useMemo(() => calorieMath(p), [p]);
  const tl = useMemo(() => timeline(p.weightKg, p.goalWeightKg, p.ratePct, p.targetDays), [p.weightKg, p.goalWeightKg, p.ratePct, p.targetDays]);
  const auto = useMemo(() => macroTargets(p.dietMode, math.target, p.goalWeightKg, p.targets), [p.dietMode, math.target, p.goalWeightKg, p.targets]);
  const targets = p.targetsCustom ? p.targets : auto;

  const go = (d: number) => {
    setDir(d);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + d)));
  };

  const chooseDays = (days: number | undefined) => {
    if (!days) return set({ targetDays: undefined });
    const plan = timeline(p.weightKg, p.goalWeightKg, p.ratePct, days);
    set({ targetDays: days, ratePct: Math.min(MAX_RATE, Math.max(0.25, plan.requiredRatePct ?? p.ratePct)) });
  };

  const finish = async () => {
    const final: UserProfile = { ...p, targets, onboarded: true };
    await update<UserProfile>('profiles', p.id, final);
    await reloadProfile();
    const st = useApp.getState();
    if (catalog) {
      await generateAndSave({ profile: final, catalog: st.catalog ?? catalog, ctx: st.ctx ?? ctx, ibs: final.ibsType !== 'none', settings: settingsFromProfile(final) });
    }
    celebrate();
    toast('Your first week is planned 🎉');
    setRoute('/today');
  };

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-coconut to-bg">
      <div className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-6">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-muted">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <div className="mb-6 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <motion.div className="h-full bg-turmeric" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} initial={{ x: dir * 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -dir * 40, opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-5">
            {step === 0 && (
              <>
                <h1 className="text-3xl font-extrabold">Let's get to know you 👋</h1>
                <label className="block">
                  <span className="label">Your name</span>
                  <input className="input mt-1" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ebenezar" />
                </label>
                <div className="flex gap-2">
                  {(['male', 'female'] as const).map((s) => (
                    <Chip key={s} on={p.sex === s} onClick={() => set({ sex: s })}>
                      {s === 'male' ? '♂ Male' : '♀ Female'}
                    </Chip>
                  ))}
                </div>
                <Slider label="Age" value={p.age} min={16} max={80} onChange={(v) => set({ age: v })} format={(v) => `${v} yrs`} />
                <Slider label="Height" value={p.heightCm} min={135} max={210} onChange={(v) => set({ heightCm: v })} format={(v) => `${v} cm`} />
                <Slider label="Current weight" value={p.weightKg} min={35} max={180} step={0.5} onChange={(v) => set({ weightKg: v, goalWeightKg: Math.min(p.goalWeightKg, v) })} format={(v) => `${v} kg`} />
                <div className="card p-3 text-sm">
                  BMI <b>{bmi(p.weightKg, p.heightCm).value}</b> — {bmi(p.weightKg, p.heightCm).cls} <span className="text-muted">(Asian-Indian cut-offs)</span>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h1 className="text-3xl font-extrabold">Where do you want to be? 🎯</h1>
                <Slider label="Goal weight" value={p.goalWeightKg} min={35} max={p.weightKg} step={0.5} onChange={(v) => set({ goalWeightKg: v })} format={(v) => `${v} kg (−${(p.weightKg - v).toFixed(1)})`} />
                <div>
                  <div className="label mb-2">In how many days? (optional)</div>
                  <div className="flex flex-wrap gap-2">
                    <Chip on={!p.targetDays} onClick={() => chooseDays(undefined)}>
                      At a safe pace
                    </Chip>
                    {DAY_PRESETS.map((d) => (
                      <Chip key={d} on={p.targetDays === d} onClick={() => chooseDays(d)}>
                        {d} days
                      </Chip>
                    ))}
                  </div>
                </div>
                <Slider
                  label="Weekly loss rate"
                  value={p.ratePct}
                  min={0.25}
                  max={1}
                  step={0.05}
                  onChange={(v) => set({ ratePct: v })}
                  format={(v) => `${v.toFixed(2)}% · ${((v / 100) * p.weightKg).toFixed(2)} kg/wk`}
                  hint="0.5–1% of bodyweight per week is the safe range that protects muscle."
                />
                {p.targetDays && !tl.achievable && (
                  <div className="rounded-xl bg-chilli/10 p-3 text-sm text-chilli">
                    Losing {(p.weightKg - p.goalWeightKg).toFixed(1)} kg in {p.targetDays} days needs {tl.requiredRatePct}%/week — above the safe 1% limit. At the
                    safest fast pace it will take about <b>{tl.days} days</b>. We've capped it for you.
                  </div>
                )}
                <div className="card p-3">
                  <div className="mb-1 text-sm font-semibold">
                    Projected: reach {p.goalWeightKg} kg in ~{tl.weeks} weeks ({tl.days} days)
                  </div>
                  <TimelineChart points={tl.points} goal={p.goalWeightKg} />
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h1 className="text-3xl font-extrabold">How active are you? 🏃</h1>
                <div className="space-y-2">
                  {Object.entries(ACTIVITY).map(([k, a]) => (
                    <button key={k} onClick={() => set({ activity: k as UserProfile['activity'] })} className={`card flex w-full items-center justify-between p-3 text-left ${p.activity === k ? 'ring-2 ring-turmeric' : ''}`}>
                      <span>
                        <b>{a.label}</b>
                        <div className="text-sm text-muted">{a.hint}</div>
                      </span>
                      <span className="text-sm text-muted">×{a.factor}</span>
                    </button>
                  ))}
                </div>
                <Slider label="Workout days per week" value={p.workoutDaysPerWeek} min={2} max={6} onChange={(v) => set({ workoutDaysPerWeek: v })} />
                <div className="flex gap-2">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((l) => (
                    <Chip key={l} on={p.workoutLevel === l} onClick={() => set({ workoutLevel: l })}>
                      {l}
                    </Chip>
                  ))}
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <h1 className="text-3xl font-extrabold">Pick your eating style 🍽️</h1>
                <div className="grid gap-2">
                  {(Object.keys(DIET_MODES) as DietMode[]).map((m) => (
                    <button key={m} onClick={() => set({ dietMode: m, targetsCustom: m === 'custom' })} className={`card p-3 text-left ${p.dietMode === m ? 'ring-2 ring-turmeric' : ''}`}>
                      <b>{DIET_MODES[m].label}</b>
                      <div className="text-sm text-muted">{DIET_MODES[m].blurb}</div>
                    </button>
                  ))}
                </div>
                <div>
                  <div className="label mb-2">Intermittent fasting</div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(IF_PROTOCOLS) as IfProtocol[]).map((k) => (
                      <Chip key={k} on={p.ifProtocol === k} onClick={() => set({ ifProtocol: k })}>
                        {IF_PROTOCOLS[k].label}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-muted">{IF_PROTOCOLS[p.ifProtocol].note}</p>
                </div>
                {p.ifProtocol !== 'none' && (
                  <Slider label="Eating window starts" value={p.ifStartHour} min={5} max={16} onChange={(v) => set({ ifStartHour: v })} format={(v) => `${v}:00 → ${(v + IF_PROTOCOLS[p.ifProtocol].eatH) % 24}:00`} />
                )}
                <Slider label="Meals per day" value={p.mealsPerDay} min={2} max={6} onChange={(v) => set({ mealsPerDay: v })} />
                <label className="flex min-h-[44px] items-center justify-between rounded-xl bg-surface p-3 font-semibold">
                  Prefer air-fryer recipes
                  <input type="checkbox" className="h-5 w-5" checked={p.preferAirFryer} onChange={(e) => set({ preferAirFryer: e.target.checked })} />
                </label>
              </>
            )}
            {step === 4 && (
              <>
                <h1 className="text-3xl font-extrabold">Your gut 🌿</h1>
                <div>
                  <div className="label mb-2">IBS type</div>
                  <div className="flex flex-wrap gap-2">
                    {(['IBS-C', 'IBS-D', 'IBS-M', 'unsure', 'none'] as const).map((t) => (
                      <Chip key={t} on={p.ibsType === t} onClick={() => set({ ibsType: t })}>
                        {t === 'none' ? "I don't have IBS" : t === 'unsure' ? 'Not sure' : t}
                      </Chip>
                    ))}
                  </div>
                </div>
                {p.ibsType !== 'none' && (
                  <>
                    <div>
                      <div className="label mb-2">Low-FODMAP phase</div>
                      <div className="grid gap-2">
                        {(
                          [
                            ['elimination', 'Elimination', '2–6 weeks: strict low-FODMAP with automatic swaps'],
                            ['reintroduction', 'Reintroduction', 'Testing one FODMAP group at a time'],
                            ['personalization', 'Personalization', 'Eat freely what you tolerate']
                          ] as const
                        ).map(([k, l, h]) => (
                          <button key={k} onClick={() => set({ fodmapPhase: k })} className={`card p-3 text-left ${p.fodmapPhase === k ? 'ring-2 ring-turmeric' : ''}`}>
                            <b>{l}</b>
                            <div className="text-sm text-muted">{h}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    {p.fodmapPhase === 'reintroduction' && (
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(GROUP_INFO) as FodmapGroup[]).map((g) => (
                          <Chip key={g} on={p.reintroGroup === g} onClick={() => set({ reintroGroup: g })}>
                            Testing {GROUP_INFO[g].label}
                          </Chip>
                        ))}
                      </div>
                    )}
                    <div>
                      <div className="label mb-2">Known trigger foods</div>
                      <div className="flex flex-wrap gap-2">
                        {['onion', 'garlic', 'rajma', 'toor_dal', 'milk', 'curd', 'atta', 'cauliflower', 'cabbage', 'green_chilli', 'coconut_milk', 'apple'].map((id) => (
                          <Chip key={id} on={p.triggers.includes(id)} onClick={() => set({ triggers: p.triggers.includes(id) ? p.triggers.filter((x) => x !== id) : [...p.triggers, id] })}>
                            {id.replace(/_/g, ' ')}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <label className="flex min-h-[44px] items-center justify-between rounded-xl bg-surface p-3 text-sm font-semibold">
                      Allow small portions of canned, rinsed lentils
                      <input type="checkbox" className="h-5 w-5" checked={p.allowSmallLentils} onChange={(e) => set({ allowSmallLentils: e.target.checked })} />
                    </label>
                    <p className="text-sm text-muted">
                      In elimination we automatically swap onion → spring-onion greens, garlic → garlic-infused oil, regular hing → gluten-free hing, curd/milk → lactose-free, cashew → peanuts.
                    </p>
                  </>
                )}
              </>
            )}
            {step === 5 && (
              <>
                <h1 className="text-3xl font-extrabold">Food & budget 🛒</h1>
                <div>
                  <div className="label mb-2">Favourite cuisines</div>
                  <div className="flex flex-wrap gap-2">
                    {CUISINES.map((c) => (
                      <Chip key={c} on={p.cuisines.includes(c)} onClick={() => set({ cuisines: p.cuisines.includes(c) ? p.cuisines.filter((x) => x !== c) : [...p.cuisines, c] })}>
                        {c}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label mb-2">Don't want</div>
                  <div className="flex flex-wrap gap-2">
                    {DISLIKES.map((c) => (
                      <Chip key={c} on={p.dislikes.includes(c)} onClick={() => set({ dislikes: p.dislikes.includes(c) ? p.dislikes.filter((x) => x !== c) : [...p.dislikes, c] })}>
                        {c.replace(/_/g, ' ')}
                      </Chip>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="label">Allergies (comma-separated ingredient names)</span>
                  <input className="input mt-1" value={p.allergies.join(', ')} onChange={(e) => set({ allergies: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. peanuts, prawns" />
                </label>
                <div className="flex gap-2">
                  {(['beginner', 'intermediate', 'expert'] as const).map((l) => (
                    <Chip key={l} on={p.cookingSkill === l} onClick={() => set({ cookingSkill: l })}>
                      {l} cook
                    </Chip>
                  ))}
                </div>
                <Slider label="Time per meal" value={p.minutesPerMeal} min={10} max={90} step={5} onChange={(v) => set({ minutesPerMeal: v })} format={(v) => `${v} min`} />
                <Slider label="Food budget per day" value={p.budgetPerDay} min={100} max={800} step={10} onChange={(v) => set({ budgetPerDay: v })} format={(v) => `₹${v}`} hint="We prefer cheaper proteins (eggs, chicken, mackerel, sardine) when the budget is tight." />
              </>
            )}
            {step === 6 && (
              <>
                <h1 className="text-3xl font-extrabold">Your numbers{p.name ? `, ${p.name}` : ''} ✨</h1>
                <div className="card space-y-1 p-4 text-sm">
                  <Row k="BMR (Mifflin–St Jeor)" v={`10×${p.weightKg} + 6.25×${p.heightCm} − 5×${p.age} ${p.sex === 'male' ? '+ 5' : '− 161'} = ${math.bmr} kcal`} />
                  <Row k="TDEE" v={`${math.bmr} × ${ACTIVITY[p.activity].factor} = ${math.tdee} kcal`} />
                  <Row k="Deficit" v={`${math.dailyDeficit} kcal/day → ~${math.rateKgPerWeek} kg/week`} />
                  {math.clampedBy !== 'none' && <div className="text-xs text-chilli">{math.clampedBy === 'floor' ? `Held at the ${math.floor} kcal safety floor.` : 'Deficit capped at 25% of TDEE.'}</div>}
                  <div className="pt-2 font-display text-2xl font-bold">{targets.kcal} kcal / day</div>
                </div>
                <div className="card space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <b>{DIET_MODES[p.dietMode].label} macros</b>
                    <button className="text-sm font-semibold text-sky" onClick={() => set({ targetsCustom: !p.targetsCustom, targets })}>
                      {p.targetsCustom ? 'Use defaults' : 'Edit'}
                    </button>
                  </div>
                  {(['protein', 'carbs', 'fat', 'fibre'] as const).map((k) =>
                    p.targetsCustom ? (
                      <Slider key={k} label={k} value={targets[k]} min={k === 'fibre' ? 15 : 10} max={k === 'carbs' ? 300 : 250} onChange={(v) => set({ targets: { ...targets, [k]: v } })} format={(v) => `${v} g`} />
                    ) : (
                      <Row key={k} k={k[0].toUpperCase() + k.slice(1)} v={`${targets[k]} g`} />
                    )
                  )}
                  {p.targetsCustom && <Slider label="Calories" value={targets.kcal} min={1200} max={3500} step={10} onChange={(v) => set({ targets: { ...targets, kcal: v } })} format={(v) => `${v} kcal`} />}
                </div>
                <p className="text-sm text-muted">You can change any of this later in Settings. We'll now build your first 7-day plan offline.</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          {step > 0 && (
            <button className="btn-ghost" onClick={() => go(-1)} aria-label="Back">
              <Icon name="arrowLeft" />
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="btn-primary flex-1" onClick={() => go(1)}>
              Continue <Icon name="arrowRight" />
            </button>
          ) : (
            <button className="btn-accent flex-1" onClick={finish}>
              Build my plan 🍛
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted">{k}</span>
    <span className="text-right font-semibold">{v}</span>
  </div>
);
