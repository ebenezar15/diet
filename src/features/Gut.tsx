import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import type { FodmapGroup, ReintroductionTest, SymptomLog, UserProfile } from '@/types';
import { useApp } from '@/store/app';
import { useAllMealLogs, useSymptoms } from '@/hooks/data';
import { db } from '@/db';
import { addDays, alive, create, today, update } from '@/db/repo';
import { Chip, Empty, Page, Section, Slider } from '@/components/ui';
import { BRISTOL, BristolIcon, celebrate } from '@/components/viz';
import { dailySeverity, severity, suspectScores } from '@/lib/correlations';
import { GROUP_INFO } from '@/lib/fodmap';

const CHALLENGE_DOSES: Record<FodmapGroup, { food: string; doses: number[]; how: string }> = {
  fructans: { food: 'atta', doses: [25, 50, 75], how: '½ → 1 → 1½ small wheat rotis' },
  GOS: { food: 'masoor_dal', doses: [20, 40, 60], how: '¼ → ½ → ¾ katori masoor dal' },
  lactose: { food: 'milk', doses: [60, 125, 250], how: '¼ → ½ → 1 cup regular milk' },
  fructose: { food: 'honey', doses: [7, 14, 21], how: '1 → 2 → 3 tsp honey' },
  polyols: { food: 'mushroom', doses: [40, 75, 120], how: 'Small → medium → large serving of mushrooms' }
};

export default function Gut() {
  const [tab, setTab] = useState<'log' | 'insights' | 'reintro'>('log');
  const { profile } = useApp();
  return (
    <Page title="Gut journal" subtitle={profile!.ibsType !== 'none' ? `${profile!.ibsType} · ${profile!.fodmapPhase} phase` : 'Track how food makes you feel'}>
      <div className="mb-4 flex gap-2">
        <Chip on={tab === 'log'} onClick={() => setTab('log')}>
          ✍️ Log
        </Chip>
        <Chip on={tab === 'insights'} onClick={() => setTab('insights')}>
          🔍 Patterns
        </Chip>
        <Chip on={tab === 'reintro'} onClick={() => setTab('reintro')}>
          🧪 Reintroduction
        </Chip>
      </div>
      {tab === 'log' && <LogSymptoms />}
      {tab === 'insights' && <Insights />}
      {tab === 'reintro' && <Reintro />}
    </Page>
  );
}

function LogSymptoms() {
  const { toast } = useApp();
  const [s, setS] = useState({ bloating: 0, pain: 0, gas: 0, urgency: 0, stress: 3, sleep: 7, bristol: 4 as number | undefined, note: '' });
  const symptoms = useSymptoms();
  const save = async () => {
    await create<SymptomLog>('symptomLogs', { date: today(), at: Date.now(), ...s, note: s.note || undefined });
    toast(severity(s as SymptomLog) <= 2 ? 'Logged — calm gut day 🌿' : 'Logged. Be gentle with yourself today.');
    setS({ ...s, note: '' });
  };
  const faces = ['😌', '🙂', '😐', '😕', '😣', '😫'];
  const face = (v: number) => faces[Math.min(5, Math.floor(v / 2))];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="How's your gut right now?">
        <div className="space-y-2">
          {(['bloating', 'pain', 'gas', 'urgency'] as const).map((k) => (
            <Slider key={k} label={`${face(s[k])} ${k[0].toUpperCase() + k.slice(1)}`} value={s[k]} min={0} max={10} onChange={(v) => setS({ ...s, [k]: v })} format={(v) => `${v}/10`} />
          ))}
          <Slider label="😤 Stress" value={s.stress} min={0} max={10} onChange={(v) => setS({ ...s, stress: v })} format={(v) => `${v}/10`} />
          <Slider label="😴 Sleep last night" value={s.sleep} min={0} max={12} step={0.5} onChange={(v) => setS({ ...s, sleep: v })} format={(v) => `${v} h`} />
        </div>
      </Section>
      <Section title="Stool (Bristol scale)">
        <div className="grid gap-1.5" role="radiogroup" aria-label="Bristol stool type">
          {BRISTOL.map((b) => (
            <button
              key={b.type}
              role="radio"
              aria-checked={s.bristol === b.type}
              onClick={() => setS({ ...s, bristol: s.bristol === b.type ? undefined : b.type })}
              className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-2 text-left transition ${s.bristol === b.type ? 'border-turmeric bg-turmeric/10' : 'border-line'}`}
            >
              <span className="w-6 text-center font-display font-bold">{b.type}</span>
              <BristolIcon type={b.type} />
              <span className="flex-1 text-sm">
                {b.label}
                <span className={`block text-xs ${b.type === 3 || b.type === 4 ? 'text-leaf' : 'text-muted'}`}>{b.note}</span>
              </span>
            </button>
          ))}
        </div>
        <textarea className="input mt-3 min-h-[60px] py-2" placeholder="Notes (optional) — e.g. ate out, period, travel" value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} aria-label="Notes" />
        <button className="btn-primary mt-3 w-full" onClick={save}>
          Save entry
        </button>
      </Section>
      {symptoms.length > 0 && (
        <Section title="Recent" className="md:col-span-2">
          <ul className="divide-y divide-line/60 text-sm">
            {symptoms.slice(-6).reverse().map((x) => (
              <li key={x.id} className="flex justify-between py-2">
                <span>{new Date(x.at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-muted">
                  Severity {severity(x).toFixed(1)} · Bristol {x.bristol ?? '—'} · stress {x.stress}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Insights() {
  const { catalog } = useApp();
  const symptoms = useSymptoms();
  const meals = useAllMealLogs();
  const sev = useMemo(() => dailySeverity(symptoms), [symptoms]);
  const scores = useMemo(() => (catalog ? suspectScores(meals, symptoms, catalog) : []), [meals, symptoms, catalog]);
  const days = Array.from({ length: 56 }, (_, i) => addDays(today(), i - 55));
  const color = (v?: number) => (v === undefined ? 'rgb(var(--line))' : v < 2 ? 'rgb(var(--leaf))' : v < 4 ? 'rgb(var(--turmeric))' : v < 6 ? '#e07b39' : 'rgb(var(--chilli))');
  const stressCorr = useMemo(() => {
    const hi = symptoms.filter((s) => s.stress >= 6);
    const lo = symptoms.filter((s) => s.stress < 6);
    if (hi.length < 2 || lo.length < 2) return null;
    const avg = (l: SymptomLog[]) => l.reduce((a, s) => a + severity(s), 0) / l.length;
    return { hi: avg(hi), lo: avg(lo) };
  }, [symptoms]);

  if (symptoms.length < 3) return <Empty emoji="📓" title="Keep logging" text="After a few days of meals + symptom entries, we'll highlight patterns and suspect foods here." />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="8-week symptom heatmap">
        <div className="grid grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Daily symptom severity over the last 8 weeks">
          {days.map((d) => (
            <motion.div key={d} initial={{ scale: 0 }} animate={{ scale: 1 }} className="aspect-square rounded" style={{ background: color(sev[d]) }} title={`${d}: ${sev[d]?.toFixed(1) ?? 'no entry'}`} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          Calm <span className="h-3 w-3 rounded bg-leaf" /> <span className="h-3 w-3 rounded bg-turmeric" /> <span className="h-3 w-3 rounded bg-chilli" /> Rough
        </div>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted">Show as table</summary>
          <table className="mt-1 w-full">
            <tbody>
              {Object.entries(sev).slice(-14).map(([d, v]) => (
                <tr key={d}>
                  <td>{d}</td>
                  <td className="text-right">{v.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Section>
      <Section title="Suspect foods">
        <p className="mb-2 text-xs text-muted">Average symptoms 2–24 h after eating, compared with your usual. Correlation ≠ causation — confirm with a reintroduction test.</p>
        {!scores.length ? (
          <p className="text-sm text-muted">Not enough overlap between meals and symptom logs yet.</p>
        ) : (
          <ul className="space-y-2">
            {scores.slice(0, 8).map((s) => (
              <li key={s.ingredientId}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{s.name}</span>
                  <span className={s.score > 0.5 ? 'text-chilli' : s.score < -0.5 ? 'text-leaf' : 'text-muted'}>
                    {s.score > 0 ? '+' : ''}
                    {s.score} ({s.exposures}×)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <motion.div className={`h-full ${s.score > 0 ? 'bg-chilli' : 'bg-leaf'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.abs(s.score) * 20)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {stressCorr && (
        <Section title="Stress & your gut" className="md:col-span-2">
          <p className="text-sm">
            On high-stress entries your symptoms averaged <b>{stressCorr.hi.toFixed(1)}</b> vs <b>{stressCorr.lo.toFixed(1)}</b> on calmer ones.
            {stressCorr.hi > stressCorr.lo + 1 && ' Try the belly-breathing and yoga routines in the Fit tab on stressful days.'}
          </p>
        </Section>
      )}
    </div>
  );
}

function Reintro() {
  const { profile, catalog, reloadProfile, toast } = useApp();
  const tests = useLiveQuery(async () => alive(await db.reintroTests.toArray()), []) ?? [];
  const symptoms = useSymptoms();
  const active = tests.find((t) => t.status === 'active');
  const [group, setGroup] = useState<FodmapGroup>(profile!.reintroGroup ?? 'lactose');

  const start = async () => {
    const c = CHALLENGE_DOSES[group];
    await create<ReintroductionTest>('reintroTests', { group, foodId: c.food, startDate: today(), doses: c.doses, status: 'active' });
    await update<UserProfile>('profiles', profile!.id, { fodmapPhase: 'reintroduction', reintroGroup: group });
    await reloadProfile();
    toast(`Day 1 of the ${GROUP_INFO[group].label} challenge`);
  };
  const finish = async (result: ReintroductionTest['result']) => {
    if (!active) return;
    await update<ReintroductionTest>('reintroTests', active.id, { result, status: 'done' });
    await reloadProfile();
    if (result === 'tolerated') celebrate();
    toast(result === 'tolerated' ? `${GROUP_INFO[active.group].label} tolerated — planner will now allow it` : 'Result saved. Planner filters updated.');
  };

  if (profile!.ibsType === 'none') return <Empty emoji="🌿" title="IBS overlay is off" text="Turn it on in Settings if you want FODMAP filtering and reintroduction tests." />;

  if (active) {
    const day = Math.min(3, Math.floor((new Date(today()).getTime() - new Date(active.startDate).getTime()) / 86400000) + 1);
    const c = CHALLENGE_DOSES[active.group];
    const ing = catalog?.ingredients.get(active.foodId);
    const daySym = (d: number) => symptoms.filter((s) => s.date === addDays(active.startDate, d));
    return (
      <Section title={`🧪 ${GROUP_INFO[active.group].label} challenge · day ${day} of 3`}>
        <ol className="space-y-3">
          {active.doses.map((g, i) => {
            const syms = daySym(i);
            const worst = syms.length ? Math.max(...syms.map(severity)) : null;
            return (
              <li key={i} className={`flex items-center gap-3 rounded-xl p-3 ${i + 1 === day ? 'bg-turmeric/15 ring-2 ring-turmeric' : 'bg-surface2'}`}>
                <span className="font-display text-2xl font-bold">D{i + 1}</span>
                <span className="flex-1 text-sm">
                  Eat <b>{g} g {ing?.name.toLowerCase()}</b> with one meal; keep everything else low-FODMAP.
                </span>
                <span className="text-sm">{worst === null ? '—' : `sev ${worst.toFixed(1)}`}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-muted">Doses: {c.how}. Log symptoms each evening. Stop early if symptoms are clearly worse. Then take 2–3 washout days before the next group.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button className="btn-ghost !bg-leaf/15" onClick={() => finish('tolerated')}>
            Tolerated
          </button>
          <button className="btn-ghost !bg-turmeric/20" onClick={() => finish('partial')}>
            Partial
          </button>
          <button className="btn-ghost !bg-chilli/15" onClick={() => finish('not-tolerated')}>
            Not tolerated
          </button>
        </div>
        <button className="mt-2 w-full text-sm text-muted underline" onClick={() => update<ReintroductionTest>('reintroTests', active.id, { status: 'abandoned' })}>
          Abandon test
        </button>
      </Section>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="Start a 3-day challenge">
        <p className="mb-3 text-sm text-muted">Test one FODMAP group at a time, after 2–6 weeks of elimination and when symptoms are settled. Ideally with your dietitian.</p>
        <div className="space-y-2">
          {(Object.keys(GROUP_INFO) as FodmapGroup[]).map((g) => {
            const done = tests.find((t) => t.group === g && t.status === 'done');
            return (
              <button key={g} onClick={() => setGroup(g)} className={`card flex w-full items-center justify-between p-3 text-left ${group === g ? 'ring-2 ring-turmeric' : ''}`}>
                <span>
                  <b>{GROUP_INFO[g].label}</b>
                  <span className="block text-xs text-muted">{GROUP_INFO[g].foods}</span>
                </span>
                {done && <span className={`badge ${done.result === 'tolerated' ? 'bg-leaf/15 text-leaf' : done.result === 'partial' ? 'bg-turmeric/20 text-turmeric' : 'bg-chilli/15 text-chilli'}`}>{done.result}</span>}
              </button>
            );
          })}
        </div>
        <button className="btn-primary mt-3 w-full" onClick={start}>
          Start {GROUP_INFO[group].label} test
        </button>
      </Section>
      <Section title="How it works">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Day 1–3: eat an increasing portion of one test food ({CHALLENGE_DOSES[group].how}).</li>
          <li>Keep the rest of your diet low-FODMAP and log symptoms daily.</li>
          <li>Record the result. Tolerated groups are unlocked in your meal plans once you move to personalization.</li>
          <li>Wash out for 2–3 days, then test the next group.</li>
        </ol>
        <button
          className="btn-ghost mt-4 w-full"
          onClick={async () => {
            await update<UserProfile>('profiles', profile!.id, { fodmapPhase: 'personalization' });
            await reloadProfile();
            toast('Personalization phase: planner now uses your tolerated groups');
          }}
        >
          Move to personalization phase
        </button>
      </Section>
    </div>
  );
}
