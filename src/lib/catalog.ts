import type { Ingredient, Recipe, RecipeSeed, RecipeIngredientSeed } from '@/types';
import { dietTagsFor, recipeNutrition } from './nutrition';
import { flagsFor, ibsVariant, type FodmapContext, ELIMINATION } from './fodmap';

export interface Catalog {
  ingredients: Map<string, Ingredient>;
  recipes: Map<string, Recipe>;
  list: Recipe[];
  price: (id: string) => number;
}

export function costOf(items: RecipeIngredientSeed[], servings: number, price: (id: string) => number) {
  const total = items.reduce((s, it) => s + (it.g / 1000) * price(it.i), 0);
  return Math.round((total / servings) * 10) / 10;
}

export function deriveRecipe(
  seed: RecipeSeed,
  lookup: (id: string) => Ingredient | undefined,
  price: (id: string) => number,
  ctx: FodmapContext = ELIMINATION
): Recipe {
  const perServing = recipeNutrition(seed.ingredients, seed.servings, lookup);
  const { status, flags } = flagsFor(seed.ingredients, seed.servings, lookup);
  return {
    ...seed,
    perServing,
    dietTags: dietTagsFor(perServing),
    fodmapStatus: status,
    fodmapFlags: flags,
    costPerServing: costOf(seed.ingredients, seed.servings, price),
    ibsVariant: ibsVariant(seed.ingredients, seed.servings, lookup, ctx)
  };
}

export function buildCatalog(
  ingredients: Ingredient[],
  seeds: RecipeSeed[],
  priceOverrides: Record<string, number> = {},
  ctx: FodmapContext = ELIMINATION
): Catalog {
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));
  const lookup = (id: string) => ingMap.get(id);
  const price = (id: string) => priceOverrides[id] ?? ingMap.get(id)?.pricePerKg ?? 0;
  const list: Recipe[] = [];
  for (const s of seeds) {
    if (s.ingredients.some((it) => !ingMap.has(it.i))) continue;
    list.push(deriveRecipe(s, lookup, price, ctx));
  }
  return { ingredients: ingMap, recipes: new Map(list.map((r) => [r.id, r])), list, price };
}

/** Ingredients & nutrition to use for a recipe given whether the IBS overlay is on. */
export function effective(recipe: Recipe, ibs: boolean) {
  return ibs
    ? { ingredients: recipe.ibsVariant.ingredients, perServing: recipe.ibsVariant.perServing, status: recipe.ibsVariant.fodmapStatus }
    : { ingredients: recipe.ingredients, perServing: recipe.perServing, status: recipe.fodmapStatus };
}
