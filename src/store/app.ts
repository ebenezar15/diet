import { create } from 'zustand';
import type { FodmapGroup, UserProfile } from '@/types';
import type { Catalog } from '@/lib/catalog';
import { buildCatalog } from '@/lib/catalog';
import type { FodmapContext } from '@/lib/fodmap';
import { db } from '@/db';
import { alive } from '@/db/repo';
import { ensureSeed } from '@/db/seed';

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
  setRoute: (r: string) => void;
  setTheme: (t: Theme) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  openLog: (slot?: string | null) => void;
  closeLog: () => void;
  bootstrap: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  rebuildCatalog: () => Promise<void>;
}

const readHash = () => (typeof location !== 'undefined' ? location.hash.replace(/^#/, '') || '/today' : '/today');
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
  profile: null,
  catalog: null,
  ctx: { phase: 'elimination', tolerated: [], triggers: [], allowSmallLentils: true },
  theme: readTheme(),
  toasts: [],
  logOpen: false,
  logSlot: null,
  setRoute: (r) => {
    if (location.hash !== '#' + r) location.hash = r;
    set({ route: r });
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
    window.addEventListener('hashchange', () => set({ route: readHash() }));
    await ensureSeed();
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
