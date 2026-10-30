import { create } from 'zustand';
import type { FodmapGroup, UserProfile } from '@/types';
import type { Catalog } from '@/lib/catalog';
import { buildCatalog } from '@/lib/catalog';
import type { FodmapContext } from '@/lib/fodmap';
import { db } from '@/db';
import { alive } from '@/db/repo';
import { ensureSeed } from '@/db/seed';
import { IS_ARTIFACT } from '@/lib/host';
import { engine } from '@/sync/engine';
import { ArtifactDbBackend } from '@/sync/artifactDb';

export type Theme = 'system' | 'light' | 'dark';

interface Toast {
  id: number;
  text: string;
  tone?: 'ok' | 'warn';
}

interface AppState {
  ready: boolean;
  route: string;
  profile: UserProfile | null;
  catalog: Catalog | null;
  ctx: FodmapContext;
  theme: Theme;
  toasts: Toast[];
  logOpen: boolean;
  logSlot: string | null;
  history: string[];
  /** Where saved data lives, shown in Settings. */
  storage: 'device' | 'account';
  setRoute: (r: string) => void;
  back: () => void;
  setTheme: (t: Theme) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  openLog: (slot?: string | null) => void;
  closeLog: () => void;
  bootstrap: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  rebuildCatalog: () => Promise<void>;
}

// Artifact links only carry a plain #name, so the hosted build keeps routes in memory.
const readHash = () => (IS_ARTIFACT || typeof location === 'undefined' ? '/today' : location.hash.replace(/^#/, '') || '/today');
const readTheme = (): Theme => {
  try {
    return (localStorage.getItem('theme') as Theme) || 'system';
  } catch {
    return 'system';
  }
};

export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

let toastId = 0;

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  route: readHash(),
  history: [],
  storage: 'device',
  profile: null,
  catalog: null,
  ctx: { phase: 'elimination', tolerated: [], triggers: [], allowSmallLentils: true },
  theme: readTheme(),
  toasts: [],
  logOpen: false,
  logSlot: null,
  setRoute: (r) => {
    if (IS_ARTIFACT) {
      if (r !== get().route) set((s) => ({ history: [...s.history.slice(-30), s.route], route: r }));
      window.scrollTo?.(0, 0);
      return;
    }
    if (location.hash !== '#' + r) location.hash = r;
    set({ route: r });
  },
  back: () => {
    if (!IS_ARTIFACT) return history.back();
    const h = get().history;
    set({ route: h.at(-1) ?? '/today', history: h.slice(0, -1) });
  },
  setTheme: (t) => {
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* private mode */
    }
    applyTheme(t);
    set({ theme: t });
  },
  toast: (text, tone = 'ok') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2800);
  },
  openLog: (slot = null) => set({ logOpen: true, logSlot: slot }),
  closeLog: () => set({ logOpen: false }),
  bootstrap: async () => {
    applyTheme(get().theme);
    if (!IS_ARTIFACT) window.addEventListener('hashchange', () => set({ route: readHash() }));
    await ensureSeed();
    if (IS_ARTIFACT) {
      // Restore this person's saved data from their claude.ai account before showing anything.
      const backend = await ArtifactDbBackend.connect();
      if (backend) {
        engine.setBackend(backend);
        set({ storage: 'account' });
        engine.onPulled(() => void get().reloadProfile());
        await Promise.race([engine.sync(), new Promise((r) => setTimeout(r, 8000))]);
      }
    }
    await get().reloadProfile();
    set({ ready: true });
  },
  reloadProfile: async () => {
    const profile = alive(await db.profiles.toArray())[0] ?? null;
    set({ profile });
    await get().rebuildCatalog();
  },
  rebuildCatalog: async () => {
    const p = get().profile;
    const tests = alive(await db.reintroTests.toArray());
    const tolerated = [...new Set(tests.filter((t) => t.result === 'tolerated' || t.result === 'partial').map((t) => t.group))] as FodmapGroup[];
    const ctx: FodmapContext = {
      phase: p?.fodmapPhase ?? 'elimination',
      tolerated: p?.fodmapPhase === 'elimination' ? [] : tolerated,
      triggers: p?.triggers ?? [],
      allowSmallLentils: p?.allowSmallLentils ?? true
    };
    const [ings, seeds, prices, custom] = await Promise.all([
      db.ingredients.toArray(),
      db.recipes.toArray(),
      db.priceOverrides.toArray(),
      db.customRecipes.toArray()
    ]);
    const priceMap = Object.fromEntries(alive(prices).map((p) => [p.ingredientId, p.pricePerKg]));
    const catalog = buildCatalog(ings, [...seeds, ...alive(custom).map((c) => c.seed)], priceMap, ctx);
    set({ catalog, ctx });
  }
}));

/** IBS overlay is on unless the user said they don't have IBS. */
export const useIbs = () => useApp((s) => (s.profile?.ibsType ?? 'unsure') !== 'none');
