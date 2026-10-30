import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MealPlan } from '@/types';
import { useApp, useIbs } from '@/store/app';
import { useCurrentPlan, useNow } from '@/hooks/data';
import { Icon } from '@/components/Icon';
import { Empty, Slider } from '@/components/ui';
import { household } from '@/lib/units';
import { celebrate } from '@/components/viz';
import { update } from '@/db/repo';
import { deductPantryForRecipe } from './Shop';
import { dayIndex } from '@/lib/planActions';

interface Timer {
  id: number;
  name: string;
  endsAt: number;
  total: number;
  done: boolean;
  pausedLeft?: number;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.3, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    /* audio unavailable */
  }
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function Cooking({ id }: { id: string }) {
  const { catalog, toast, setRoute } = useApp();
  const ibs = useIbs();
  const plan = useCurrentPlan();
  const r = catalog?.recipes.get(id);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [servings, setServings] = useState(r?.servings ?? 2);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [timers, setTimers] = useState<Timer[]>([]);
  const [listening, setListening] = useState(false);
  const [showIngs, setShowIngs] = useState(true);
  const now = useNow(250);
  const timerId = useRef(0);

  // Screen wake lock while cooking
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null;
      } catch {
        /* not supported */
      }
    };
    void acquire();
    const vis = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      void lock?.release();
    };
  }, []);

  // Fire finished timers
  useEffect(() => {
    const due = timers.filter((t) => !t.done && t.pausedLeft === undefined && t.endsAt <= now);
    if (due.length) {
      beep();
      due.forEach((t) => toast(`⏰ ${t.name} is done!`));
      setTimers((ts) => ts.map((t) => (due.includes(t) ? { ...t, done: true } : t)));
    }
  }, [now, timers, toast]);

  const steps = r?.steps ?? [];
  const go = useCallback(
    (d: number) => {
      setDir(d);
      setStep((s) => Math.min(steps.length, Math.max(0, s + d)));
    },
    [steps.length]
  );

  // Hands-free voice commands
  useEffect(() => {
    if (!listening) return;
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!SR) {
      toast('Voice commands are not supported on this browser', 'warn');
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.lang = 'en-IN';
    rec.onresult = (e) => {
      const said = e.results[e.results.length - 1][0].transcript.toLowerCase();
      if (/next|aage|adutha/.test(said)) go(1);
      else if (/back|previous|peeche/.test(said)) go(-1);
      else if (/timer|start/.test(said)) startStepTimer();
    };
    rec.onend = () => listening && rec.start();
    rec.start();
    return () => {
      rec.onend = null;
      rec.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (!r) return <Empty emoji="🍳" title="Recipe not found" text="" />;
  const ings = ibs ? r.ibsVariant.ingredients : r.ingredients;
  const cur = steps[step];

  function startStepTimer(minutes?: number, name?: string) {
    const m = minutes ?? cur?.timerMin ?? 5;
    setTimers((ts) => [...ts, { id: ++timerId.current, name: name ?? `Step ${step + 1}`, endsAt: Date.now() + m * 60000, total: m * 60000, done: false }]);
  }

  const finish = async () => {
    celebrate();
    if (plan) {
      const d = dayIndex(plan.weekStart);
      const meal = plan.days[d]?.find((m) => m.recipeId === r.id && !m.status);
      if (meal) await update<MealPlan>('mealPlans', plan.id, { days: plan.days.map((day, i) => (i === d ? day.map((m) => (m.key === meal.key ? { ...m, status: 'cooked' as const } : m)) : day)) });
    }
    const n = await deductPantryForRecipe(ings, servings / r.servings);
    toast(n ? `Cooked! Pantry updated (${n} items)` : 'Cooked! Enjoy 🍛');
    setRoute(`/recipes/${r.id}`);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -80) go(1);
    else if (info.offset.x > 80) go(-1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line p-3">
        <button className="btn-ghost !px-3" onClick={() => useApp.getState().back()} aria-label="Exit cooking mode">
          <Icon name="x" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{r.name}</div>
          <div className="text-xs text-muted">
            Step {Math.min(step + 1, steps.length)} of {steps.length}
          </div>
        </div>
        <button className={`btn-ghost !px-3 ${listening ? '!bg-chilli text-white' : ''}`} onClick={() => setListening(!listening)} aria-pressed={listening} aria-label="Voice commands: say next or back">
          <Icon name="mic" />
        </button>
        <button className="btn-ghost !px-3" onClick={() => setShowIngs(!showIngs)} aria-label="Toggle ingredient checklist">
          <Icon name="book" />
        </button>
      </header>
      <div className="h-1.5 bg-line">
        <motion.div className="h-full bg-turmeric" animate={{ width: `${(Math.min(step, steps.length) / steps.length) * 100}%` }} />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 md:flex-row">
        {showIngs && (
          <aside className="card max-h-[40vh] overflow-y-auto p-3 md:max-h-none md:w-80">
            <Slider label="Servings" value={servings} min={1} max={12} onChange={setServings} />
            <ul className="mt-2 space-y-1">
              {ings.map((it) => {
                const ing = catalog!.ingredients.get(it.i)!;
                const g = (it.g * servings) / r.servings;
                const on = checked.has(it.i);
                return (
                  <li key={it.i}>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface2">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={on}
                        onChange={() => setChecked((s) => {
                          const n = new Set(s);
                          if (on) n.delete(it.i);
                          else n.add(it.i);
                          return n;
                        })}
                      />
                      <span className={`flex-1 text-sm ${on ? 'text-muted line-through' : ''}`}>
                        {ing.name} <span className="text-muted">{household(ing, g) || `${Math.round(g)} g`}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
        <section className="flex flex-1 flex-col">
          <div className="relative flex flex-1 items-center overflow-hidden">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={onDragEnd}
                initial={{ x: dir * 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -dir * 80, opacity: 0 }}
                className="w-full"
                aria-live="polite"
              >
                {cur ? (
                  <div>
                    <div className="mb-3 font-display text-6xl font-extrabold text-turmeric">{step + 1}</div>
                    <p className="text-2xl font-medium leading-relaxed md:text-3xl">{cur.text}</p>
                    {cur.timerMin && (
                      <button className="btn-accent mt-6 !min-h-[56px] text-lg" onClick={() => startStepTimer()}>
                        <Icon name="timer" /> Start {cur.timerMin}-min timer
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-7xl">🍛</div>
                    <h2 className="mt-2 text-3xl font-extrabold">All done!</h2>
                    <p className="text-muted">Mark it cooked to update today's plan and your pantry.</p>
                    <button className="btn-accent mt-4 !min-h-[56px]" onClick={finish}>
                      Mark as cooked
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          {timers.length > 0 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {timers.map((t) => {
                const left = t.pausedLeft ?? t.endsAt - now;
                return (
                  <motion.div key={t.id} layout initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`flex items-center gap-3 rounded-2xl p-3 ${t.done ? 'animate-pulse bg-chilli text-white' : 'bg-plum/15'}`}>
                    <Icon name="timer" />
                    <input className="min-w-0 flex-1 bg-transparent font-semibold outline-none" value={t.name} onChange={(e) => setTimers((ts) => ts.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} aria-label="Timer name" />
                    <span className="font-mono text-xl font-bold">{t.done ? 'Done' : mmss(left)}</span>
                    {!t.done && (
                      <button
                        className="rounded-full p-2"
                        onClick={() => setTimers((ts) => ts.map((x) => (x.id === t.id ? (x.pausedLeft !== undefined ? { ...x, endsAt: Date.now() + x.pausedLeft, pausedLeft: undefined } : { ...x, pausedLeft: x.endsAt - Date.now() }) : x)))}
                        aria-label={t.pausedLeft !== undefined ? 'Resume' : 'Pause'}
                      >
                        <Icon name={t.pausedLeft !== undefined ? 'play' : 'pause'} size={18} />
                      </button>
                    )}
                    <button className="rounded-full p-2" onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Remove timer">
                      <Icon name="x" size={18} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-ghost !min-h-[64px] flex-1 text-lg" onClick={() => go(-1)} disabled={step === 0}>
              <Icon name="arrowLeft" /> Back
            </button>
            <button className="btn-ghost !min-h-[64px] !px-4" onClick={() => startStepTimer(5, 'Custom timer')} aria-label="Add a 5-minute timer">
              +⏱
            </button>
            <button className="btn-primary !min-h-[64px] flex-[2] text-lg" onClick={() => go(1)} disabled={step >= steps.length}>
              Next <Icon name="arrowRight" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

interface SpeechRec {
  continuous: boolean;
  lang: string;
  onresult: (e: { results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }) => void;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
