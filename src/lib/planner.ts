import type { MacroTargets, MealType, Nutrition, PlannedMeal, PlanSettings, Recipe } from '@/types';
import { add, scale, ZERO } from './nutrition';
import { isAllowed, type FodmapContext } from './fodmap';
import type { Catalog } from './catalog';

/*
 * Deterministic, fully offline meal-plan solver.
 *
 * 1. Filter candidates (IBS phase, dislikes, time, diet mode).
 * 2. Greedy: for each day and slot pick the best-scoring recipe (variety, cuisine preference,
 *    cost, air-fryer bias, seeded jitter). Lunch/dinner get a carb side and/or veg side when the
 *    diet mode allows.
 * 3. Local search: adjust portions in 0.25-serving steps and swap recipes to bring each day within
 *    ±5% of calorie and macro targets.
 */

export const SLOT_LAYOUT: Record<number, MealType[]> = {
  1: ['dinner'],
  2: ['lunch', 'dinner'],
  3: ['breakfast', 'lunch', 'dinner'],
  4: ['breakfast', 'lunch', 'snack', 'dinner'],
  5: ['breakfast', 'snack', 'lunch', 'snack', 'dinner'],
  6: ['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'snack']
};

const SLOT_SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.33, dinner: 0.3, snack: 0.1, side: 0 };

const MIN_PORTION = 0.5;
const MAX_PORTION = 2.5;
const STEP = 0.25;

/** Seeded PRNG (mulberry32) so plans are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Candidate {
  recipe: Recipe;
  n: Nutrition; // per serving, effective (IBS variant if overlay on)
  cost: number;
  role: 'main' | 'carb' | 'veg' | 'snack' | 'breakfast';
  /** High-fat, near-zero-carb item the solver may add to close a fat gap (keto). */
  booster: boolean;
}

const isCarbSide = (r: Recipe) => r.mealTypes.includes('side') && r.perServing.netCarbs >= 20;
const isVegSide = (r: Recipe) => r.mealTypes.includes('side') && r.perServing.netCarbs < 20;

export function candidates(catalog: Catalog, s: PlanSettings, ctx: FodmapContext, ibs: boolean): Candidate[] {
  const out: Candidate[] = [];
  const dislikes = s.dislikes.map((d) => d.toLowerCase());
  for (const r of catalog.list) {
    const ings = ibs ? r.ibsVariant.ingredients : r.ingredients;
    if (ibs) {
      const ok = ings.every((it) => {
        const ing = catalog.ingredients.get(it.i);
        return !ing || isAllowed(ing, it.g / r.servings, ctx);
      });
      if (!ok) continue;
    }
    if (dislikes.some((d) => r.protein === d || ings.some((it) => it.i === d) || r.name.toLowerCase().includes(d))) continue;
    if (r.prepMin + r.cookMin > s.maxMinutes * 1.5 && !r.batchFriendly) continue;
    const n = ibs ? r.ibsVariant.perServing : r.perServing;
    if (r.course === 'drink' || n.kcal < 30) continue; // drinks & near-zero items are logged, not planned
    if (s.dietMode === 'keto' && n.netCarbs > 9) continue;
    if (s.dietMode === 'hplc' && n.netCarbs > 45) continue;
    const cost = r.costPerServing;
    const role: Candidate['role'] = r.mealTypes.includes('side')
      ? isCarbSide(r)
        ? 'carb'
        : 'veg'
      : r.mealTypes.includes('lunch') || r.mealTypes.includes('dinner')
        ? 'main'
        : r.mealTypes.includes('breakfast')
          ? 'breakfast'
          : 'snack';
    if (role === 'carb' && s.dietMode === 'keto') continue;
    if (role === 'veg' && !isVegSide(r)) continue;
    const fatShare = (n.fat * 9) / Math.max(1, n.kcal);
    const booster = fatShare >= 0.6 && n.netCarbs <= 5 && (role === 'veg' || role === 'snack');
    out.push({ recipe: r, n, cost, role, booster });
  }
  return out;
}

function fits(c: Candidate, slot: MealType) {
  return c.recipe.mealTypes.includes(slot);
}

export interface DayEval {
  total: Nutrition;
  error: number;
  within: boolean;
  dev: { kcal: number; protein: number; carbs: number; fat: number };
}

const relDev = (actual: number, target: number) => (target <= 0 ? 0 : (actual - target) / target);

export function evaluateDay(items: { n: Nutrition; servings: number }[], t: MacroTargets, keto: boolean): DayEval {
  const total = items.reduce((acc, it) => add(acc, scale(it.n, it.servings)), { ...ZERO });
  const carbs = keto ? total.netCarbs : total.carbs - total.fibre;
  const dev = {
    kcal: relDev(total.kcal, t.kcal),
    protein: relDev(total.protein, t.protein),
    carbs: keto ? Math.max(0, relDev(carbs, t.carbs)) : relDev(carbs, t.carbs),
    fat: relDev(total.fat, t.fat)
  };
  const tol = 0.05;
  const over = (d: number, w: number) => w * (Math.abs(d) <= tol ? Math.abs(d) * 0.2 : Math.abs(d) * 2 + 1);
  const error = over(dev.kcal, 3) + over(dev.protein, 2) + over(dev.carbs, keto ? 2.5 : 1.2) + over(dev.fat, 1.2);
  const within = Object.values(dev).every((d) => Math.abs(d) <= tol);
  return { total, error, within, dev };
}

interface Slot {
  slot: MealType;
  role: Candidate['role'];
  c: Candidate;
  servings: number;
  locked: boolean;
}

export interface GenerateInput {
  catalog: Catalog;
  settings: PlanSettings;
  ctx: FodmapContext;
  ibs: boolean;
  /** Existing plan to keep locked meals from. */
  previous?: PlannedMeal[][];
}

export interface GenerateResult {
  days: PlannedMeal[][];
  evals: DayEval[];
  weeklyCost: number;
  warnings: string[];
}

export function generatePlan({ catalog, settings, ctx, ibs, previous }: GenerateInput): GenerateResult {
  const rand = rng(settings.seed);
  const pool = candidates(catalog, settings, ctx, ibs);
  const byId = new Map(pool.map((c) => [c.recipe.id, c]));
  const keto = settings.dietMode === 'keto';
  const layout = SLOT_LAYOUT[Math.min(6, Math.max(1, settings.mealsPerDay))];
  const warnings: string[] = [];
  const weekUse = new Map<string, number>();
  const maxUses = settings.batchCook ? 4 : 2;
  const jitter = new Map(pool.map((c) => [c.recipe.id, rand()]));

  const t = settings.targets;
  const days: Slot[][] = [];

  for (let d = 0; d < 7; d++) {
    const daySlots: Slot[] = [];
    const proteinsToday = new Map<string, number>();
    const prevLocked = (previous?.[d] ?? []).filter((m) => m.locked && byId.has(m.recipeId));
    for (const m of prevLocked) {
      const c = byId.get(m.recipeId)!;
      daySlots.push({ slot: m.slot, role: c.role, c, servings: m.servings, locked: true });
      weekUse.set(c.recipe.id, (weekUse.get(c.recipe.id) ?? 0) + 1);
      proteinsToday.set(c.recipe.protein, (proteinsToday.get(c.recipe.protein) ?? 0) + 1);
    }

    const score = (c: Candidate, slot: MealType, kcalTarget: number) => {
      const used = weekUse.get(c.recipe.id) ?? 0;
      if (used >= maxUses) return -Infinity;
      if (c.role === 'main' || c.role === 'breakfast' || c.role === 'snack') {
        if (c.recipe.protein !== 'veg' && (proteinsToday.get(c.recipe.protein) ?? 0) >= 2) return -Infinity;
      }
      let s = 0;
      // closeness of a reasonable portion to the slot target
      const portion = Math.min(MAX_PORTION, Math.max(MIN_PORTION, kcalTarget / Math.max(50, c.n.kcal)));
      s -= Math.abs(portion - 1) * 0.8;
      // protein density helps every fat-loss mode
      s += (c.n.protein * 4) / Math.max(1, c.n.kcal);
      if (keto) s += (c.n.fat * 9) / Math.max(1, c.n.kcal) - c.n.netCarbs / 20;
      s -= used * 0.9;
      if (settings.cuisines.length && settings.cuisines.includes(c.recipe.cuisine)) s += 0.5;
      if (settings.airFryerBias && c.recipe.equipment.includes('air-fryer')) s += 0.45;
      if (settings.budgetPerDay > 0) {
        const share = settings.budgetPerDay * (SLOT_SHARE[slot] || 0.1);
        if (c.cost > share) s -= Math.min(3, (2 * (c.cost - share)) / Math.max(1, share));
        else s += 0.2;
      }
      if (settings.batchCook && c.recipe.batchFriendly) s += 0.3;
      if (settings.leftovers && d > 0 && days[d - 1].some((x) => x.c.recipe.id === c.recipe.id && x.slot === 'dinner') && slot === 'lunch') s += 0.8;
      s += jitter.get(c.recipe.id)! * 1.2 + rand() * 0.3;
      return s;
    };

    const pick = (slot: MealType, role: Candidate['role'], kcalTarget: number) => {
      let best: Candidate | null = null;
      let bestS = -Infinity;
      for (const c of pool) {
        if (c.role !== role) continue;
        if (role !== 'carb' && role !== 'veg' && !fits(c, slot)) continue;
        if (daySlots.some((x) => x.c.recipe.id === c.recipe.id)) continue;
        const s = score(c, slot, kcalTarget);
        if (s > bestS) {
          bestS = s;
          best = c;
        }
      }
      return best;
    };

    const shareTotal = layout.reduce((a, s) => a + SLOT_SHARE[s], 0);
    layout.forEach((slot, idx) => {
      if (daySlots.some((x) => x.slot === slot && x.locked && layout.indexOf(slot) === idx)) return;
      const kcalSlot = (t.kcal * SLOT_SHARE[slot]) / shareTotal;
      const isMeal = slot === 'lunch' || slot === 'dinner';
      const roles: Candidate['role'][] =
        slot === 'snack' ? ['snack'] : slot === 'breakfast' ? ['breakfast'] : ['main'];
      let mainShare = 1;
      if (isMeal) {
        if (!keto) {
          roles.push('carb');
          mainShare = 0.6;
        }
        roles.push('veg');
        mainShare -= 0.1;
      }
      for (const role of roles) {
        const target = role === 'carb' ? kcalSlot * 0.3 : role === 'veg' ? kcalSlot * 0.12 : kcalSlot * mainShare;
        let c = pick(slot, role, target);
        // fall back: breakfast/snack slots can use the other's pool
        if (!c && role === 'breakfast') c = pick(slot, 'snack', target) ?? pick('lunch', 'main', target);
        if (!c && role === 'snack') c = pick(slot, 'breakfast', target);
        if (!c) {
          if (role === 'main') warnings.push(`No ${slot} recipe fits your filters on day ${d + 1}.`);
          continue;
        }
        const servings = clampPortion(target / Math.max(50, c.n.kcal));
        daySlots.push({ slot, role: c.role, c, servings, locked: false });
        weekUse.set(c.recipe.id, (weekUse.get(c.recipe.id) ?? 0) + 1);
        proteinsToday.set(c.recipe.protein, (proteinsToday.get(c.recipe.protein) ?? 0) + 1);
      }
    });

    optimiseDay(daySlots, pool, t, keto, weekUse, maxUses, rand);
    days.push(daySlots);
  }

  const evals = days.map((ds) => evaluateDay(ds.map((s) => ({ n: s.c.n, servings: s.servings })), t, keto));
  evals.forEach((e, i) => {
    if (!e.within) warnings.push(`Day ${i + 1} is ${Math.round(e.dev.kcal * 100)}% off calories — try more meals per day or relax filters.`);
  });
  const weeklyCost = days.reduce(
    (sum, ds) => sum + ds.reduce((a, s) => a + s.c.cost * s.servings * settings.people, 0),
    0
  );
  let k = 0;
  return {
    days: days.map((ds) =>
      ds
        .sort((a, b) => order(a.slot) - order(b.slot) || roleOrder(a.role) - roleOrder(b.role))
        .map((s) => ({
          key: `${s.c.recipe.id}-${k++}-${settings.seed}`,
          slot: s.slot,
          recipeId: s.c.recipe.id,
          servings: s.servings,
          locked: s.locked
        }))
    ),
    evals,
    weeklyCost: Math.round(weeklyCost),
    warnings: [...new Set(warnings)]
  };
}

const order = (s: MealType) => ['breakfast', 'snack', 'lunch', 'side', 'dinner'].indexOf(s);
const roleOrder = (r: Candidate['role']) => ['breakfast', 'main', 'carb', 'veg', 'snack'].indexOf(r);
const clampPortion = (x: number) => Math.min(MAX_PORTION, Math.max(MIN_PORTION, Math.round(x / STEP) * STEP));

/** Coordinate descent on portions, then recipe swaps, until the day is within tolerance. */
function optimiseDay(
  slots: Slot[],
  pool: Candidate[],
  t: MacroTargets,
  keto: boolean,
  weekUse: Map<string, number>,
  maxUses: number,
  rand: () => number
) {
  const evalNow = () => evaluateDay(slots.map((s) => ({ n: s.c.n, servings: s.servings })), t, keto);
  const tunePortions = () => {
    let cur = evalNow().error;
    for (let iter = 0; iter < 60; iter++) {
      let improved = false;
      for (const s of slots) {
        if (s.locked) continue;
        for (const delta of [STEP, -STEP, 2 * STEP, -2 * STEP]) {
          const next = s.servings + delta;
          if (next < MIN_PORTION || next > MAX_PORTION) continue;
          const prev = s.servings;
          s.servings = next;
          const e = evalNow().error;
          if (e < cur - 1e-9) {
            cur = e;
            improved = true;
          } else s.servings = prev;
        }
      }
      if (!improved) break;
    }
    return cur;
  };

  let best = tunePortions();
  // Close a fat gap with up to two boosters (chutney, nuts, ghee greens) — standard keto practice.
  for (let k = 0; k < 2 && keto && evalNow().dev.fat < -0.05; k++) {
    const used = new Set(slots.map((x) => x.c.recipe.id));
    const boosters = pool
      .filter((c) => c.booster && !used.has(c.recipe.id) && (weekUse.get(c.recipe.id) ?? 0) < maxUses + 2)
      .sort((a, b) => b.n.fat / Math.max(1, b.n.protein) - a.n.fat / Math.max(1, a.n.protein) + (rand() - 0.5) * 2);
    let added = false;
    for (const c of boosters.slice(0, 4)) {
      const snap = slots.map((x) => x.servings);
      slots.push({ slot: 'side', role: c.role, c, servings: 1, locked: false });
      const e = tunePortions();
      if (e < best - 1e-9) {
        best = e;
        weekUse.set(c.recipe.id, (weekUse.get(c.recipe.id) ?? 0) + 1);
        added = true;
        break;
      }
      slots.pop();
      slots.forEach((x, i) => (x.servings = snap[i]));
    }
    if (!added) break;
  }
  for (let round = 0; round < 120 && !evalNow().within; round++) {
    const free = slots.filter((s) => !s.locked);
    if (!free.length) break;
    const s = free[Math.floor(rand() * free.length)];
    const options = pool.filter(
      (c) =>
        c.role === s.role &&
        (s.slot !== 'side' || c.booster === s.c.booster) &&
        (s.role === 'carb' || s.role === 'veg' || c.recipe.mealTypes.includes(s.slot)) &&
        !slots.some((x) => x.c.recipe.id === c.recipe.id) &&
        (weekUse.get(c.recipe.id) ?? 0) < maxUses &&
        (c.recipe.protein === 'veg' || slots.filter((x) => x !== s && x.c.recipe.protein === c.recipe.protein).length < 2)
    );
    if (!options.length) continue;
    const trial = options[Math.floor(rand() * options.length)];
    const prevC = s.c;
    const prevServings = slots.map((x) => x.servings);
    s.c = trial;
    s.servings = clampPortion(s.servings * (prevC.n.kcal / Math.max(50, trial.n.kcal)));
    const e = tunePortions();
    if (e < best - 1e-9) {
      best = e;
      weekUse.set(prevC.recipe.id, (weekUse.get(prevC.recipe.id) ?? 1) - 1);
      weekUse.set(trial.recipe.id, (weekUse.get(trial.recipe.id) ?? 0) + 1);
    } else {
      s.c = prevC;
      slots.forEach((x, i) => (x.servings = prevServings[i]));
    }
  }
}

/** Totals for a saved plan day. */
export function dayTotals(day: PlannedMeal[], catalog: Catalog, ibs: boolean): Nutrition {
  return day.reduce((acc, m) => {
    const r = catalog.recipes.get(m.recipeId);
    if (!r) return acc;
    return add(acc, scale(ibs ? r.ibsVariant.perServing : r.perServing, m.servings));
  }, { ...ZERO });
}
