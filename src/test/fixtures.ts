import { buildCatalog } from '@/lib/catalog';
import { bundledIngredients, bundledRecipes } from '@/db/seed';
import type { PlanSettings } from '@/types';

export const catalog = buildCatalog(bundledIngredients, bundledRecipes());

export const settings = (over: Partial<PlanSettings> = {}): PlanSettings => ({
  dietMode: 'keto',
  phase: 'elimination',
  targets: { kcal: 1800, protein: 120, carbs: 25, fat: 132, fibre: 25 },
  mealsPerDay: 4,
  cuisines: [],
  dislikes: [],
  budgetPerDay: 0,
  maxMinutes: 60,
  people: 1,
  leftovers: false,
  batchCook: false,
  airFryerBias: true,
  seed: 42,
  ...over
});
