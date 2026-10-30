import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { Exercise, IfProtocol, UserProfile, WorkoutLog } from '@/types';
import exercisesFile from '@/data/seed/exercises.json';
import { useApp } from '@/store/app';
import { useWorkouts } from '@/hooks/data';
import { create, today, update } from '@/db/repo';
import { Chip, Page, Section, Sheet, Slider } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { celebrate } from '@/components/viz';
import { kcalBurned, weeklyWorkout } from '@/lib/exercise';
import { IF_PROTOCOLS } from '@/lib/targets';
import { FastingCard } from './Fasting';

const EXERCISES = (exercisesFile as { exercises: Exercise[] }).exercises;
const KIND_LABEL: Record<Exercise['kind'], string> = { cardio: '🏃 Cardio', strength: '💪 Strength', mobility: '🧘 Mobility', 'ibs-relief': '🌿 Gut relief' };

export default function Fit() {
  const [tab, setTab] = useState<'plan' | 'library' | 'fasting'>('plan');
  return (
    <Page title="Fit" subtitle="Workouts, gut-calming movement & intermittent fasting">
      <div className="mb-4 flex gap-2">
        <Chip on={tab === 'plan'} onClick={() => setTab('plan')}>
          📅 My week
        </Chip>
        <Chip on={tab === 'library'} onClick={() => setTab('library')}>
          📚 Exercise guide
        </Chip>
        <Chip on={tab === 'fasting'} onClick={() => setTab('fasting')}>
          ⏳ Fasting guide
        </Chip>
      </div>
      {tab === 'plan' && <WeekPlan />}
      {tab === 'library' && <Library />}
      {tab === 'fasting' && <FastingGuide />}
    </Page>
  );
}

function WeekPlan() {
  const { profile, toast } = useApp();
  const workouts = useWorkouts();
  const plan = useMemo(() => weeklyWorkout(profile!, EXERCISES), [profile]);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [open, setOpen] = useState<number | null>(todayIdx);
  const [logging, setLogging] = useState<{ ids: string[]; minutes: number } | null>(null);
  const doneToday = workouts.some((w) => w.date === today());

  const save = async () => {
    if (!logging) return;
    const met = logging.ids.reduce((a, id) => a + (EXERCISES.find((e) => e.id === id)?.met ?? 4), 0) / Math.max(1, logging.ids.length);
    const kcal = kcalBurned(met, profile!.weightKg, logging.minutes);
    await create<WorkoutLog>('workoutLogs', { date: today(), exerciseIds: logging.ids, minutes: logging.minutes, kcal });
    setLogging(null);
    celebrate();
    toast(`Workout logged · ~${kcal} kcal 💪`);
  };

  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between p-3">
        <div>
          <div className="text-xs font-semibold uppercase text-muted">This week</div>
          <div className="font-display text-xl font-bold">
            {workouts.filter((w) => w.date >= mondayIso()).length} / {profile!.workoutDaysPerWeek} sessions
          </div>
        </div>
        <div className="flex gap-1">
          {(['beginner', 'intermediate', 'advanced'] as const).map((l) => (
            <Chip key={l} on={profile!.workoutLevel === l} onClick={() => update<UserProfile>('profiles', profile!.id, { workoutLevel: l }).then(() => useApp.getState().reloadProfile())}>
              {l[0].toUpperCase()}
            </Chip>
          ))}
        </div>
      </div>
      {plan.map((d, i) => (
        <div key={d.day} className={`card overflow-hidden ${i === todayIdx ? 'ring-2 ring-turmeric' : ''}`}>
          <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold ${d.focus === 'strength' ? 'bg-chilli/15 text-chilli' : d.focus === 'cardio' ? 'bg-sky/15 text-sky' : 'bg-leaf/15 text-leaf'}`}>{d.day}</span>
            <span className="flex-1">
              <b>{d.title}</b>
              <span className="block text-xs text-muted">
                ~{d.minutes} min · {d.items.length} moves{i === todayIdx && doneToday ? ' · done ✓' : ''}
              </span>
            </span>
            <motion.span animate={{ rotate: open === i ? 90 : 0 }}>
              <Icon name="arrowRight" size={18} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <ul className="space-y-2 px-3 pb-3">
                  {d.items.map((it) => {
                    const e = EXERCISES.find((x) => x.id === it.id);
                    if (!e) return null;
                    return (
                      <li key={it.id} className="rounded-xl bg-surface2 p-2.5">
                        <div className="flex justify-between gap-2">
                          <b className="text-sm">{e.name}</b>
                          <span className="text-sm font-semibold text-turmeric">{it.prescription}</span>
                        </div>
                        <div className="text-xs text-muted">{e.cues[0]}</div>
                        {e.ibsNote && <div className="mt-1 text-xs text-leaf">🌿 {e.ibsNote}</div>}
                      </li>
                    );
                  })}
                </ul>
                <div className="px-3 pb-3">
                  <button className="btn-primary w-full" onClick={() => setLogging({ ids: d.items.map((x) => x.id), minutes: d.minutes })}>
                    <Icon name="check" /> Log this session
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      <Section title="Fat-loss essentials">
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          {[
            ['👣', 'Steps', '7,000–10,000 a day. Walking burns more over a week than most workouts.'],
            ['🍗', 'Protein', `Hit ~${profile!.targets.protein} g daily to keep muscle while losing fat.`],
            ['💪', 'Lift 2–3×/week', 'Strength training tells your body to keep muscle in a deficit.'],
            ['😴', 'Sleep 7–9 h', 'Short sleep raises hunger hormones and worsens IBS.'],
            ['🥦', 'Fibre', `Aim for ${profile!.targets.fibre} g from low-FODMAP veg, oats, chia, kiwi.`],
            ['🧘', 'Stress', 'Gut and brain are linked: 5 min belly breathing daily helps IBS.']
          ].map(([e, t, d]) => (
            <li key={t} className="flex gap-2 rounded-xl bg-surface2 p-2.5">
              <span className="text-xl">{e}</span>
              <span>
                <b>{t}</b> — {d}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Sheet open={!!logging} onClose={() => setLogging(null)} title="Log workout">
        {logging && (
          <div className="space-y-3">
            <Slider label="Duration" value={logging.minutes} min={5} max={120} step={5} onChange={(v) => setLogging({ ...logging, minutes: v })} format={(v) => `${v} min`} />
            <div className="flex flex-wrap gap-2">
              {EXERCISES.map((e) => (
                <Chip key={e.id} on={logging.ids.includes(e.id)} onClick={() => setLogging({ ...logging, ids: logging.ids.includes(e.id) ? logging.ids.filter((x) => x !== e.id) : [...logging.ids, e.id] })}>
                  {e.name}
                </Chip>
              ))}
            </div>
            <button className="btn-primary w-full" onClick={save}>
              Save
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

const mondayIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

function Library() {
  const { profile } = useApp();
  const [kind, setKind] = useState<Exercise['kind'] | null>(null);
  const [open, setOpen] = useState<Exercise | null>(null);
  const list = EXERCISES.filter((e) => !kind || e.kind === kind);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as Exercise['kind'][]).filter((k) => EXERCISES.some((e) => e.kind === k)).map((k) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(kind === k ? null : k)}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((e) => (
          <motion.button key={e.id} whileTap={{ scale: 0.98 }} className="card p-3 text-left" onClick={() => setOpen(e)}>
            <div className="flex items-center justify-between">
              <b>{e.name}</b>
              <span className="badge bg-surface2">{e.level}</span>
            </div>
            <div className="text-xs text-muted">
              {KIND_LABEL[e.kind]} · {e.equipment === 'none' ? 'no equipment' : e.equipment} · ~{kcalBurned(e.met, profile!.weightKg, e.durationMin ?? 10)} kcal / {e.durationMin ?? 10} min
            </div>
          </motion.button>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <span className="badge bg-surface2">{KIND_LABEL[open.kind]}</span>
              <span className="badge bg-surface2">{open.level}</span>
              <span className="badge bg-surface2">{open.muscles.join(', ')}</span>
              <span className="badge bg-surface2">MET {open.met}</span>
            </div>
            <div className="rounded-xl bg-turmeric/15 p-3 font-semibold">{open.sets ? `${open.sets} sets × ${open.reps}` : `${open.durationMin} minutes`}</div>
            <ol className="list-decimal space-y-1 pl-5">
              {open.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
            {open.ibsNote && <p className="rounded-xl bg-leaf/10 p-3 text-sm text-leaf">🌿 {open.ibsNote}</p>}
          </div>
        )}
      </Sheet>
    </>
  );
}

function FastingGuide() {
  const { profile, reloadProfile } = useApp();
  const setProto = async (p: IfProtocol) => {
    await update<UserProfile>('profiles', profile!.id, { ifProtocol: p });
    await reloadProfile();
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        {profile!.ifProtocol !== 'none' && <FastingCard />}
        <Section title="Choose a protocol">
          <div className="space-y-2">
            {(Object.keys(IF_PROTOCOLS) as IfProtocol[]).map((k) => (
              <button key={k} onClick={() => setProto(k)} className={`card w-full p-3 text-left ${profile!.ifProtocol === k ? 'ring-2 ring-turmeric' : ''}`}>
                <div className="flex justify-between">
                  <b>{IF_PROTOCOLS[k].label}</b>
                  {k !== 'none' && (
                    <span className="text-sm text-muted">
                      {IF_PROTOCOLS[k].fastH} h fast · {IF_PROTOCOLS[k].eatH} h eat
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted">{IF_PROTOCOLS[k].note}</div>
              </button>
            ))}
          </div>
        </Section>
      </div>
      <Section title="Fasting with IBS — what works">
        <ul className="space-y-2 text-sm">
          <li>✅ <b>Water, black coffee, plain tea, jeera/saunf water</b> don't break a fast. Peppermint tea can ease bloating.</li>
          <li>✅ Break the fast gently: eggs or fish with cooked low-FODMAP veg beats a heavy biryani.</li>
          <li>✅ Fasting gives the gut's cleansing wave (MMC) time to work — some people with IBS-C and bloating feel better.</li>
          <li>⚠️ Big post-fast meals can trigger IBS-D urgency — split into two meals in the window.</li>
          <li>⚠️ Fit your protein ({profile!.targets.protein} g) and fibre ({profile!.targets.fibre} g) into fewer meals — the planner adjusts portions automatically.</li>
          <li>⛔ Not advised if pregnant, breastfeeding, diabetic on insulin/sulfonylureas, underweight or with a history of eating disorders. Check with your doctor.</li>
          <li>🕗 Start with 12:12 for a week, then 14:10, then 16:8 if you feel good.</li>
        </ul>
      </Section>
    </div>
  );
}
