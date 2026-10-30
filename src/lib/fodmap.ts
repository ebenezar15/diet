import type {
  FodmapFlag, FodmapGroup, FodmapLevel, FodmapPhase, Ingredient, IbsVariant, RecipeIngredientSeed
} from '@/types';
import { recipeNutrition } from './nutrition';

const RANK: Record<FodmapLevel, number> = { low: 0, moderate: 1, high: 2 };
export const worst = (a: FodmapLevel, b: FodmapLevel): FodmapLevel => (RANK[a] >= RANK[b] ? a : b);

export interface FodmapContext {
  phase: FodmapPhase;
  /** Groups the user has confirmed they tolerate (reintroduction results). */
  tolerated: FodmapGroup[];
  /** Ingredient ids the user marked as personal triggers. */
  triggers: string[];
  /** Whether small canned-lentil portions are allowed. */
  allowSmallLentils: boolean;
}

export const ELIMINATION: FodmapContext = { phase: 'elimination', tolerated: [], triggers: [], allowSmallLentils: true };

/** Effective FODMAP level of an ingredient at a given per-serving amount. */
export function levelAt(ing: Ingredient, perServingG: number): FodmapLevel {
  if (ing.fodmap.level === 'low') {
    return ing.fodmap.safeG !== undefined && perServingG > ing.fodmap.safeG * 1.5 ? 'moderate' : 'low';
  }
  if (ing.fodmap.safeG !== undefined && perServingG <= ing.fodmap.safeG) return 'low';
  return ing.fodmap.level;
}

export function flagsFor(
  items: RecipeIngredientSeed[],
  servings: number,
  lookup: (id: string) => Ingredient | undefined
): { status: FodmapLevel; flags: FodmapFlag[] } {
  let status: FodmapLevel = 'low';
  const flags: FodmapFlag[] = [];
  for (const it of items) {
    const ing = lookup(it.i);
    if (!ing) continue;
    const per = it.g / servings;
    const level = levelAt(ing, per);
    if (level !== 'low') {
      flags.push({ ingredientId: ing.id, level, groups: ing.fodmap.groups, perServingG: Math.round(per), safeG: ing.fodmap.safeG });
      status = worst(status, level);
    }
  }
  return { status, flags };
}

/** Is this ingredient amount acceptable for the user's phase? */
export function isAllowed(ing: Ingredient, perServingG: number, ctx: FodmapContext): boolean {
  if (ctx.triggers.includes(ing.id)) return false;
  const level = levelAt(ing, perServingG);
  if (level === 'low') return true;
  if (ctx.phase === 'elimination') return false;
  // Reintroduction / personalization: allow if every FODMAP group present is tolerated.
  return ing.fodmap.groups.length > 0 && ing.fodmap.groups.every((g) => ctx.tolerated.includes(g));
}

/**
 * Builds the IBS-safe variant: every ingredient that isn't allowed at its per-serving amount is
 * swapped for its low-FODMAP alternative (scaled by the swap ratio and capped at the swap's safe
 * serving). Ingredients with no swap are reduced to their safe serving, or dropped.
 */
export function ibsVariant(
  items: RecipeIngredientSeed[],
  servings: number,
  lookup: (id: string) => Ingredient | undefined,
  ctx: FodmapContext = ELIMINATION
): IbsVariant {
  const out: RecipeIngredientSeed[] = [];
  const substitutions: IbsVariant['substitutions'] = [];
  for (const it of items) {
    const ing = lookup(it.i);
    if (!ing) continue;
    const per = it.g / servings;
    if (isAllowed(ing, per, ctx)) {
      out.push(it);
      continue;
    }
    const isPulse = ing.category === 'pulse';
    if (ing.swap && !(isPulse && !ctx.allowSmallLentils)) {
      const target = lookup(ing.swap.to);
      if (target && !ctx.triggers.includes(target.id)) {
        let g = it.g * ing.swap.ratio;
        if (target.fodmap.safeG !== undefined) g = Math.min(g, target.fodmap.safeG * servings);
        g = Math.max(1, Math.round(g));
        const existing = out.find((o) => o.i === target.id);
        if (existing) existing.g += g;
        else out.push({ i: target.id, g, note: it.note });
        substitutions.push({ from: ing.id, to: target.id, note: ing.swap.note });
        continue;
      }
    }
    if (ing.fodmap.safeG && ing.fodmap.safeG > 0) {
      out.push({ ...it, g: Math.round(ing.fodmap.safeG * servings) });
      substitutions.push({ from: ing.id, to: ing.id, note: `Reduced to safe serving (${ing.fodmap.safeG} g)` });
    } else {
      substitutions.push({ from: ing.id, to: '', note: 'Omitted' });
    }
  }
  const { status, flags } = flagsFor(out, servings, lookup);
  return { ingredients: out, substitutions, perServing: recipeNutrition(out, servings, lookup), fodmapStatus: status, fodmapFlags: flags };
}

export const GROUP_INFO: Record<FodmapGroup, { label: string; foods: string; challenge: string }> = {
  fructans: { label: 'Fructans', foods: 'Wheat, onion, garlic, rava', challenge: 'atta' },
  GOS: { label: 'GOS (galacto-oligosaccharides)', foods: 'Dals, rajma, chana, cashew', challenge: 'masoor_dal' },
  lactose: { label: 'Lactose', foods: 'Milk, curd, soft paneer', challenge: 'milk' },
  fructose: { label: 'Excess fructose', foods: 'Honey, mango, apple', challenge: 'honey' },
  polyols: { label: 'Polyols (sorbitol / mannitol)', foods: 'Mushroom, cauliflower, sweet potato', challenge: 'mushroom' }
};
