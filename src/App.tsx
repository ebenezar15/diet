import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { lazy, Suspense, useEffect } from 'react';
import { useApp } from '@/store/app';
import { useT } from '@/i18n';
import { Icon } from '@/components/Icon';
import { Skeleton, Toasts } from '@/components/ui';
import { SyncBadge } from '@/features/SyncBadge';
import { Disclaimer } from '@/features/Disclaimer';
import { onLocalWrite } from '@/db/repo';
import { engine } from '@/sync/engine';
import { startReminders } from '@/lib/reminders';

const Onboarding = lazy(() => import('@/features/Onboarding'));
const Today = lazy(() => import('@/features/Today'));
const PlanPage = lazy(() => import('@/features/Plan'));
const Recipes = lazy(() => import('@/features/Recipes'));
const RecipeDetail = lazy(() => import('@/features/RecipeDetail'));
const Cooking = lazy(() => import('@/features/Cooking'));
const Shop = lazy(() => import('@/features/Shop'));
const Progress = lazy(() => import('@/features/Progress'));
const Gut = lazy(() => import('@/features/Gut'));
const Fit = lazy(() => import('@/features/Fit'));
const Settings = lazy(() => import('@/features/Settings'));
const DietChart = lazy(() => import('@/features/DietChart'));
const LogSheet = lazy(() => import('@/features/LogSheet'));

const TABS = [
  { path: '/today', key: 'today', icon: 'home' },
  { path: '/plan', key: 'plan', icon: 'calendar' },
  { path: '/recipes', key: 'recipes', icon: 'book' },
  { path: '/shop', key: 'shop', icon: 'cart' },
  { path: '/progress', key: 'progress', icon: 'chart' }
];
const EXTRA = [
  { path: '/gut', key: 'gut', icon: 'gut' },
  { path: '/fit', key: 'fit', icon: 'dumbbell' },
  { path: '/settings', key: 'settings', icon: 'settings' }
];

function route(path: string) {
  const [, a, b] = path.split('/');
  switch (a) {
    case 'plan':
      return <PlanPage />;
    case 'recipes':
      return b ? <RecipeDetail id={decodeURIComponent(b)} /> : <Recipes />;
    case 'cook':
      return <Cooking id={decodeURIComponent(b ?? '')} />;
    case 'shop':
      return <Shop />;
    case 'progress':
      return <Progress />;
    case 'gut':
      return <Gut />;
    case 'fit':
      return <Fit />;
    case 'settings':
      return <Settings />;
    case 'chart':
      return <DietChart />;
    default:
      return <Today />;
  }
}

function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-3 p-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40" />
      <Skeleton className="h-24" />
    </div>
  );
}

export default function App() {
  const { ready, profile, route: path, setRoute, bootstrap, logOpen } = useApp();
  const t = useT();
  const reduce = useReducedMotion();

  useEffect(() => {
    void bootstrap();
    const off = onLocalWrite(() => engine.schedule());
    const online = () => void engine.sync();
    window.addEventListener('online', online);
    window.addEventListener('offline', () => void engine.refresh());
    navigator.serviceWorker?.addEventListener('message', (e) => e.data === 'run-sync' && void engine.sync());
    void engine.sync();
    const stop = startReminders();
    return () => {
      off();
      stop();
      window.removeEventListener('online', online);
    };
  }, [bootstrap]);

  if (!ready) return <Loading />;
  if (!profile?.disclaimerAcceptedAt) return <Disclaimer />;
  if (!profile.onboarded)
    return (
      <Suspense fallback={<Loading />}>
        <Onboarding />
      </Suspense>
    );

  const top = '/' + (path.split('/')[1] ?? 'today');
  const fullscreen = top === '/cook';

  return (
    <div className="flex min-h-full">
      {!fullscreen && (
        <nav className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex" aria-label="Main">
          <div className="mb-4 flex items-center gap-2 px-2">
            <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" className="h-9 w-9" />
            <span className="font-display text-2xl font-extrabold">ThaliFit</span>
          </div>
          {[...TABS, ...EXTRA].map((tab) => (
            <button
              key={tab.path}
              onClick={() => setRoute(tab.path)}
              aria-current={top === tab.path ? 'page' : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 font-semibold transition ${top === tab.path ? 'bg-ink text-bg' : 'text-muted hover:bg-surface2'}`}
            >
              <Icon name={tab.icon} />
              {t(tab.key)}
            </button>
          ))}
          <div className="mt-auto">
            <SyncBadge />
          </div>
        </nav>
      )}
      <main className="min-w-0 flex-1">
        {!fullscreen && (
          <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line/60 bg-bg/85 px-4 py-2 backdrop-blur md:hidden">
            <span className="flex items-center gap-2 font-display text-xl font-extrabold">
              <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" className="h-7 w-7" /> ThaliFit
            </span>
            <div className="flex items-center gap-1">
              <SyncBadge compact />
              {EXTRA.map((e) => (
                <button key={e.path} className={`rounded-full p-2.5 ${top === e.path ? 'bg-ink text-bg' : ''}`} onClick={() => setRoute(e.path)} aria-label={t(e.key)}>
                  <Icon name={e.icon} />
                </button>
              ))}
            </div>
          </div>
        )}
        <Suspense fallback={<Loading />}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={path}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {route(path)}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>
      {!fullscreen && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Tabs">
          {TABS.map((tab) => {
            const on = top === tab.path;
            return (
              <button key={tab.path} onClick={() => setRoute(tab.path)} aria-current={on ? 'page' : undefined} className="relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold">
                {on && <motion.span layoutId="tab-pill" className="absolute inset-x-3 top-1.5 h-8 rounded-full bg-turmeric/20" transition={{ type: 'spring', damping: 26, stiffness: 300 }} />}
                <Icon name={tab.icon} className={`relative ${on ? 'text-ink' : 'text-muted'}`} />
                <span className={on ? 'text-ink' : 'text-muted'}>{t(tab.key)}</span>
              </button>
            );
          })}
        </nav>
      )}
      <Suspense fallback={null}>{logOpen && <LogSheet />}</Suspense>
      <Toasts />
    </div>
  );
}
