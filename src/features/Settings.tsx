import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { DietMode, Reminder, UserProfile } from '@/types';
import { useApp, type Theme } from '@/store/app';
import { useSync } from '@/hooks/data';
import { db } from '@/db';
import { alive, create, remove, update } from '@/db/repo';
import { Chip, Page, Section, Slider } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { computeTargets } from '@/lib/profile';
import { calorieMath, DIET_MODES } from '@/lib/targets';
import { exportAll, importAll, resetAll } from '@/lib/backup';
import { askNotificationPermission } from '@/lib/reminders';
import { engine } from '@/sync/engine';
import { DISCLAIMER_POINTS } from './Disclaimer';

export default function Settings() {
  const { profile, reloadProfile, theme, setTheme, toast } = useApp();
  const p = profile!;
  const save = async (patch: Partial<UserProfile>, recompute = true) => {
    const next = { ...p, ...patch };
    if (recompute && !next.targetsCustom) patch.targets = computeTargets(next);
    await update<UserProfile>('profiles', p.id, patch);
    await reloadProfile();
  };
  const math = calorieMath(p);

  return (
    <Page title="Settings">
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Body & goal">
          <div className="space-y-3">
            <label className="block">
              <span className="label">Name</span>
              <input className="input mt-1" defaultValue={p.name} onBlur={(e) => save({ name: e.target.value }, false)} />
            </label>
            <Slider label="Current weight" value={p.weightKg} min={35} max={180} step={0.5} onChange={(v) => save({ weightKg: v })} format={(v) => `${v} kg`} />
            <Slider label="Goal weight" value={p.goalWeightKg} min={35} max={p.weightKg} step={0.5} onChange={(v) => save({ goalWeightKg: v })} format={(v) => `${v} kg`} />
            <Slider label="Weekly loss rate" value={p.ratePct} min={0.25} max={1} step={0.05} onChange={(v) => save({ ratePct: v })} format={(v) => `${v.toFixed(2)}%`} />
            <Slider label="Age" value={p.age} min={16} max={80} onChange={(v) => save({ age: v })} />
            <Slider label="Height" value={p.heightCm} min={135} max={210} onChange={(v) => save({ heightCm: v })} format={(v) => `${v} cm`} />
            <div className="text-sm text-muted">
              BMR {math.bmr} · TDEE {math.tdee} · target {math.target} kcal
            </div>
          </div>
        </Section>
        <Section title="Diet & targets">
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(DIET_MODES) as DietMode[]).map((m) => (
              <Chip key={m} on={p.dietMode === m} onClick={() => save({ dietMode: m, targetsCustom: m === 'custom' })}>
                {DIET_MODES[m].label}
              </Chip>
            ))}
          </div>
          <label className="mb-2 flex min-h-[44px] items-center justify-between rounded-xl bg-surface2 p-3 text-sm font-semibold">
            Edit macros manually
            <input type="checkbox" className="h-5 w-5" checked={p.targetsCustom} onChange={(e) => save({ targetsCustom: e.target.checked }, !e.target.checked)} />
          </label>
          <div className="space-y-2">
            {(['kcal', 'protein', 'carbs', 'fat', 'fibre'] as const).map((k) =>
              p.targetsCustom ? (
                <Slider key={k} label={k} value={p.targets[k]} min={k === 'kcal' ? 1200 : 10} max={k === 'kcal' ? 3500 : 300} step={k === 'kcal' ? 10 : 1} onChange={(v) => save({ targets: { ...p.targets, [k]: v } }, false)} format={(v) => (k === 'kcal' ? `${v} kcal` : `${v} g`)} />
              ) : (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-muted">{k}</span>
                  <b>
                    {p.targets[k]} {k === 'kcal' ? 'kcal' : 'g'}
                  </b>
                </div>
              )
            )}
          </div>
        </Section>
        <Section title="Gut / IBS">
          <div className="mb-3 flex flex-wrap gap-2">
            {(['IBS-C', 'IBS-D', 'IBS-M', 'unsure', 'none'] as const).map((t) => (
              <Chip key={t} on={p.ibsType === t} onClick={() => save({ ibsType: t }, false)}>
                {t === 'none' ? 'No IBS (overlay off)' : t}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['elimination', 'reintroduction', 'personalization'] as const).map((ph) => (
              <Chip key={ph} on={p.fodmapPhase === ph} onClick={() => save({ fodmapPhase: ph }, false)}>
                {ph}
              </Chip>
            ))}
          </div>
          <label className="mt-3 flex min-h-[44px] items-center justify-between rounded-xl bg-surface2 p-3 text-sm font-semibold">
            Allow small canned-lentil portions
            <input type="checkbox" className="h-5 w-5" checked={p.allowSmallLentils} onChange={(e) => save({ allowSmallLentils: e.target.checked }, false)} />
          </label>
        </Section>
        <Section title="Appearance & language">
          <div className="mb-3 flex gap-2">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => (
              <Chip key={t} on={theme === t} onClick={() => setTheme(t)}>
                {t}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            {(
              [
                ['en', 'English'],
                ['ta', 'தமிழ்'],
                ['hi', 'हिन्दी']
              ] as const
            ).map(([k, l]) => (
              <Chip key={k} on={p.language === k} onClick={() => save({ language: k }, false)}>
                {l}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Navigation and meal labels are translated; full Tamil/Hindi translation is in progress.</p>
        </Section>
        <Reminders />
        <SyncPanel />
        <Section title="Your data">
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-ghost"
              onClick={async () => {
                const blob = new Blob([await exportAll()], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `thalifit-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
              }}
            >
              <Icon name="download" size={18} /> Export JSON
            </button>
            <label className="btn-ghost cursor-pointer">
              <Icon name="upload" size={18} /> Import JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const n = await importAll(await f.text());
                    await reloadProfile();
                    toast(`Imported ${n} records`);
                  } catch (err) {
                    toast(String(err), 'warn');
                  }
                }}
              />
            </label>
            <button
              className="btn-ghost !text-chilli"
              onClick={async () => {
                if (!confirm('Delete all your logs, plans and profile from this device? Export a backup first if you want to keep them.')) return;
                await resetAll();
                await reloadProfile();
              }}
            >
              Reset everything
            </button>
          </div>
        </Section>
        <Section title="Medical disclaimer & help">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {DISCLAIMER_POINTS.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            Find a dietitian: <a className="font-semibold text-sky underline" href="https://www.iaponline.in/" target="_blank" rel="noreferrer">Indian Dietetic Association</a> · Learn about FODMAPs: <a className="font-semibold text-sky underline" href="https://www.monashfodmap.com/" target="_blank" rel="noreferrer">Monash University</a>
          </p>
        </Section>
      </div>
    </Page>
  );
}

function Reminders() {
  const { toast } = useApp();
  const rows = useLiveQuery(async () => alive(await db.reminders.toArray()), []) ?? [];
  const add = async (kind: Reminder['kind'], time: string, label: string) => {
    const perm = await askNotificationPermission();
    if (perm !== 'granted') toast('Notifications are blocked — reminders will not show', 'warn');
    await create<Reminder>('reminders', { kind, time, days: [0, 1, 2, 3, 4, 5, 6], enabled: true, label });
  };
  const presets: [Reminder['kind'], string, string][] = [
    ['meal', '08:00', 'Breakfast time 🍳'],
    ['meal', '13:00', 'Lunch time 🍛'],
    ['meal', '20:00', 'Dinner time 🍽️'],
    ['water', '11:00', 'Drink a glass of water 💧'],
    ['fasting', '20:00', 'Eating window closing ⏳'],
    ['workout', '18:30', "Time for today's workout 💪"],
    ['shopping', '09:30', 'Weekly shopping day 🛒']
  ];
  return (
    <Section title="Reminders">
      <ul className="mb-3 space-y-1">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <input className="input !w-28" type="time" value={r.time} onChange={(e) => update<Reminder>('reminders', r.id, { time: e.target.value })} aria-label="Time" />
            <span className="flex-1 text-sm">{r.label}</span>
            <input type="checkbox" className="h-5 w-5" checked={r.enabled} onChange={(e) => update<Reminder>('reminders', r.id, { enabled: e.target.checked })} aria-label="Enabled" />
            <button className="p-2 text-muted" onClick={() => remove('reminders', r.id)} aria-label="Delete reminder">
              <Icon name="x" size={16} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {presets.filter((p) => !rows.some((r) => r.label === p[2])).map((p) => (
          <button key={p[2]} className="chip" onClick={() => add(...p)}>
            + {p[2]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Reminders show while ThaliFit is open or running in the background.</p>
    </Section>
  );
}

function SyncPanel() {
  const { toast } = useApp();
  const sync = useSync();
  const log = useLiveQuery(() => db.syncLog.orderBy('at').reverse().limit(30).toArray(), []) ?? [];
  const [email, setEmail] = useState('');
  const [uid, setUid] = useState<string | null>(null);
  const configured = engine.backend.isConfigured();
  void engine.backend.currentUserId().then(setUid);
  return (
    <Section title="Sync & sync log">
      <p className="mb-2 text-sm">
        Status: <b>{sync.state}</b>
        {sync.pending ? ` · ${sync.pending} pending` : ''}
        {sync.lastSyncedAt ? ` · last ${new Date(sync.lastSyncedAt).toLocaleString()}` : ''}
      </p>
      {!configured ? (
        <p className="text-sm text-muted">Cross-device sync is optional. Everything is saved on this device. To enable sync, deploy with Supabase credentials (see README).</p>
      ) : uid ? (
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => engine.sync()}>
            <Icon name="refresh" size={18} /> Sync now
          </button>
          <button className="btn-ghost" onClick={() => engine.backend.signOut().then(() => setUid(null))}>
            Sign out
          </button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await engine.backend.signIn(email);
              toast('Check your email for the sign-in link');
            } catch (err) {
              toast(String(err), 'warn');
            }
          }}
        >
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" />
          <button className="btn-primary">Sign in</button>
        </form>
      )}
      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
        {log.map((l) => (
          <li key={l.id} className={l.kind === 'error' ? 'text-chilli' : 'text-muted'}>
            {new Date(l.at).toLocaleTimeString()} · {l.kind} · {l.message}
          </li>
        ))}
        {!log.length && <li className="text-muted">No sync events yet.</li>}
      </ul>
    </Section>
  );
}
