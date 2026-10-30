import type { Ingredient, RecipeSeed } from '@/types';
import { db, getMeta, setMeta } from './index';
import ingredientsFile from '@/data/seed/ingredients.json';

/** Bump when bundled seed data changes; the loader merges it in on next start. */
export const SEED_VERSION = 1;

const recipeModules = import.meta.glob<{ recipes: RecipeSeed[] }>('../data/seed/recipes/*.json', { eager: true, import: 'default' });

export const bundledIngredients = (ingredientsFile as unknown as { ingredients: Ingredient[] }).ingredients;
export const bundledRecipes = (): RecipeSeed[] => Object.values(recipeModules).flatMap((m) => m.recipes);

/**
 * Versioned seed migration: bundled ingredients and recipes are upserted into IndexedDB when the
 * bundled version is newer. User edits are never stored in seed tables (prices live in
 * `priceOverrides`, user recipes in `customRecipes`), so re-seeding cannot overwrite them.
 */
export async function ensureSeed(): Promise<{ migrated: boolean; version: number }> {
  const current = await getMeta<number>('seedVersion', 0);
  if (current >= SEED_VERSION && (await db.recipes.count()) > 0) return { migrated: false, version: current };
  const recipes = bundledRecipes();
  await db.transaction('rw', db.ingredients, db.recipes, db.meta, async () => {
    await db.ingredients.bulkPut(bundledIngredients);
    await db.recipes.bulkPut(recipes);
    const keep = new Set(recipes.map((r) => r.id));
    const stale = (await db.recipes.toCollection().primaryKeys()).filter((k) => !keep.has(k));
    if (stale.length) await db.recipes.bulkDelete(stale);
    await setMeta('seedVersion', SEED_VERSION);
  });
  return { migrated: true, version: SEED_VERSION };
}
