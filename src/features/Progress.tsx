import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WeightLog } from '@/types';
import { useApp } from '@/store/app';
import { useAllMealLogs, useSymptoms, useWeights, useWorkouts } from '@/hooks/data';
import { addDays, create, remove, today } from '@/db/repo';
import { Empty, Page, Section, Stat } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { celebrate } from '@/components/viz';
import { timeline, type TimelinePoint, bmi } from '@/lib/targets';
import { severity } from '@/lib/correlations';

export function TimelineChart({ points, goal, actual }: { points: TimelinePoint[]; goal: number; actual?: { week: number; kg: number }[] }) {
  const data = points.map((p) => ({ week: p.week, projected: p.kg, actual: actual?.find((a) => Math.round(a.week) === p.week)?.kg }));
  return (
    <figure>
      <div className="h-40">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="proj" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--turmeric))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="rgb(var(--turmeric))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="rgb(var(--muted))" tickFormatter={(w) => `W${w}`} />
            <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11 }} stroke="rgb(var(--muted))" />
            <Tooltip formatter={(v: number) => `${v} kg`} labelFormatter={(w) => `Week ${w}`} />
            <ReferenceLine y={goal} stroke="rgb(var(--leaf))" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="projected" stroke="rgb(var(--turmeric))" fill="url(#proj)" strokeWidth={2.5} isAnimationActive />
            {actual && <Line type="monotone" dataKey="actual" stroke="rgb(var(--chilli))" strokeWidth={2.5} dot />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Projected weight: {points.filter((_, i) => i % 4 === 0).map((p) => `week ${p.week} ${p.kg} kg`).join(', ')}
      </figcaption>
    </figure>
  );
}

export default function Progress() {
  const { profile, toast } = useApp();
  const weights = useWeights();
  const meals = useAllMealLogs();
  const symptoms = useSymptoms();
  const workouts = useWorkouts();
  const [kg, setKg] = useState<number>(weights.at(-1)?.kg ?? profile!.weightKg);
  const [waist, setWaist] = useState<string>('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [showTable, setShowTable] = useState(false);

  const series = useMemo(
    () =>
      weights.map((w, i) => {
        const win = weights.slice(Math.max(0, i - 6), i + 1).filter((x) => x.date >= addDays(w.date, -6));
        return { date: w.date.slice(5), kg: w.kg, avg: Math.round((win.reduce((a, x) => a + x.kg, 0) / win.length) * 10) / 10, waist: w.waistCm };
      }),
    [weights]
  );

  const start = weights[0]?.kg ?? profile!.weightKg;
  const latest = weights.at(-1)?.kg ?? profile!.weightKg;
  const plan = timeline(start, profile!.goalWeightKg, profile!.ratePct, profile!.targetDays);
  const actual = weights.map((w) => ({ week: (new Date(w.date).getTime() - new Date(weights[0].date).getTime()) / (7 * 86400000), kg: w.kg }));
  const pctToGoal = Math.max(0, Math.min(100, ((start - latest) / Math.max(0.1, start - profile!.goalWeightKg)) * 100));

  const weekly = useMemo(() => {
    const from = addDays(today(), -6);
    const wk = meals.filter((m) => m.date >= from);
    const days = new Set(wk.map((m) => m.date)).size || 1;
    const kcal = wk.reduce((a, m) => a + m.nutrition.kcal, 0) / days;
    const protein = wk.reduce((a, m) => a + m.nutrition.protein, 0) / days;
    const fibre = wk.reduce((a, m) => a + m.nutrition.fibre, 0) / days;
    const adherence = [...new Set(wk.map((m) => m.date))].filter((d) => {
      const tot = wk.filter((m) => m.date === d).reduce((a, m) => a + m.nutrition.kcal, 0);
      return Math.abs(tot - profile!.targets.kcal) / profile!.targets.kcal <= 0.1;
    }).length;
    const sym = symptoms.filter((s) => s.date >= from);
    const prevSym = symptoms.filter((s) => s.date < from && s.date >= addDays(from, -7));
    const avg = (l: typeof symptoms) => (l.length ? l.reduce((a, s) => a + severity(s), 0) / l.length : null);
    const wInWeek = weights.filter((w) => w.date >= from);
    const change = wInWeek.length >= 2 ? wInWeek.at(-1)!.kg - wInWeek[0].kg : null;
    const wkWorkouts = workouts.filter((w) => w.date >= from);
    return { kcal, protein, fibre, adherence, symSev: avg(sym), prevSev: avg(prevSym), change, workouts: wkWorkouts.length, burned: wkWorkouts.reduce((a, w) => a + w.kcal, 0) };
  }, [meals, symptoms, weights, workouts, profile]);

  const add = async () => {
    await create<WeightLog>('weightLogs', { date: today(), kg, waistCm: waist ? Number(waist) : undefined, photo });
    const prevMin = Math.min(...weights.map((w) => w.kg), Infinity);
    if (kg < prevMin) {
      celebrate();
      toast('New low! 🎉');
    } else toast('Weight logged');
    setPhoto(undefined);
    setWaist('');
  };

  const onPhoto = (f?: File) => {
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const scale = Math.min(1, 640 / img.width);
      c.width = img.width * scale;
      c.height = img.height * scale;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      setPhoto(c.toDataURL('image/webp', 0.7));
    };
    img.src = URL.createObjectURL(f);
  };

  return (
    <Page title="Progress" subtitle={`${(start - latest).toFixed(1)} kg down · ${Math.round(pctToGoal)}% to goal`}>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Log weight">
          <div className="flex items-center gap-2">
            <button className="btn-ghost !px-3" onClick={() => setKg(Math.round((kg - 0.1) * 10) / 10)} aria-label="Decrease">
              <Icon name="minus" />
            </button>
            <input className="input text-center font-display text-2xl font-bold" type="number" step="0.1" value={kg} onChange={(e) => setKg(Number(e.target.value))} aria-label="Weight in kg" />
            <button className="btn-ghost !px-3" onClick={() => setKg(Math.round((kg + 0.1) * 10) / 10)} aria-label="Increase">
              <Icon name="plus" />
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <input className="input" placeholder="Waist (cm, optional)" type="number" value={waist} onChange={(e) => setWaist(e.target.value)} aria-label="Waist in cm" />
            <label className="btn-ghost cursor-pointer !px-3" aria-label="Add progress photo (stays on this device)">
              📷
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          </div>
          {photo && <img src={photo} alt="Progress preview" className="mt-2 h-24 rounded-xl object-cover" />}
          <button className="btn-primary mt-3 w-full" onClick={add}>
            Save
          </button>
          <p className="mt-2 text-xs text-muted">Weigh daily after waking; the 7-day average smooths out water swings. Photos never leave your device.</p>
        </Section>
        <Section title="Goal timeline">
          <div className="mb-2 grid grid-cols-3 gap-2">
            <Stat label="Start" value={start} unit="kg" />
            <Stat label="Now" value={latest} unit="kg" />
            <Stat label="Goal" value={profile!.goalWeightKg} unit="kg" tone="leaf" />
          </div>
          <TimelineChart points={plan.points} goal={profile!.goalWeightKg} actual={actual} />
          <div className="mt-2 text-sm">
            ETA ≈ <b>{plan.days} days</b> at {profile!.ratePct}%/week · BMI {bmi(latest, profile!.heightCm).value} ({bmi(latest, profile!.heightCm).cls})
          </div>
          <ol className="mt-2 space-y-1 text-xs text-muted">
            {plan.phases.map((ph) => (
              <li key={ph.name}>
                <b className="text-ink">
                  {ph.name} (wk {ph.fromWeek}–{ph.toWeek}):
                </b>{' '}
                {ph.note}
              </li>
            ))}
            {plan.dietBreaks.length > 0 && <li>Planned maintenance (diet break) weeks: {plan.dietBreaks.join(', ')}</li>}
          </ol>
        </Section>
      </div>

      <Section className="mt-4" title="Weight trend" action={<button className="text-sm font-semibold text-sky" onClick={() => setShowTable(!showTable)}>{showTable ? 'Chart' : 'Table'}</button>}>
        {series.length < 2 ? (
          <Empty emoji="⚖️" title="Log a few weigh-ins" text="Your trend and 7-day moving average appear after two entries." />
        ) : showTable ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th>Date</th>
                <th>Weight</th>
                <th>7-day avg</th>
                <th>Waist</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {weights.map((w, i) => (
                <tr key={w.id} className="border-t border-line/60">
                  <td>{w.date}</td>
                  <td>{w.kg} kg</td>
                  <td>{series[i].avg} kg</td>
                  <td>{w.waistCm ? `${w.waistCm} cm` : '—'}</td>
                  <td>
                    <button className="p-2 text-muted" onClick={() => remove('weightLogs', w.id)} aria-label={`Delete ${w.date}`}>
                      <Icon name="x" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-64" role="img" aria-label={`Weight trend from ${series[0].kg} to ${series.at(-1)!.kg} kg. Switch to table for data.`}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="rgb(var(--muted))" />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11 }} stroke="rgb(var(--muted))" />
                <Tooltip />
                <ReferenceLine y={profile!.goalWeightKg} stroke="rgb(var(--leaf))" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="kg" stroke="rgb(var(--muted))" dot={{ r: 3 }} strokeWidth={1} />
                <Line type="monotone" dataKey="avg" name="7-day avg" stroke="rgb(var(--chilli))" dot={false} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {weights.some((w) => w.photo) && (
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
            {weights.filter((w) => w.photo).map((w) => (
              <figure key={w.id} className="shrink-0 text-center text-xs text-muted">
                <img src={w.photo} alt={`Progress photo ${w.date}`} className="h-32 w-24 rounded-xl object-cover" />
                {w.date}
              </figure>
            ))}
          </div>
        )}
      </Section>

      <Section className="mt-4" title="This week's report">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Avg calories" value={Math.round(weekly.kcal)} unit={`/ ${profile!.targets.kcal}`} />
          <Stat label="Avg protein" value={Math.round(weekly.protein)} unit={`/ ${profile!.targets.protein} g`} />
          <Stat label="Avg fibre" value={Math.round(weekly.fibre)} unit={`/ ${profile!.targets.fibre} g`} />
          <Stat label="Days on target" value={weekly.adherence} unit="/ 7" tone="leaf" />
          <Stat label="Weight change" value={weekly.change === null ? '—' : `${weekly.change > 0 ? '+' : ''}${weekly.change.toFixed(1)}`} unit="kg" />
          <Stat label="Gut severity" value={weekly.symSev === null ? '—' : weekly.symSev.toFixed(1)} unit={weekly.prevSev !== null && weekly.symSev !== null ? (weekly.symSev < weekly.prevSev ? '↓ better' : '↑ worse') : '/10'} />
          <Stat label="Workouts" value={weekly.workouts} unit="sessions" />
          <Stat label="Exercise burn" value={weekly.burned} unit="kcal" />
        </div>
      </Section>
    </Page>
  );
}
