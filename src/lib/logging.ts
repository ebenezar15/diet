import type { Ingredient, MealLog, MealType, Nutrition, Recipe } from '@/types';
import { create } from '@/db/repo';
import { nutritionFor, round, scale } from './nutrition';

export function logRecipe(r: Recipe, servings: number, slot: MealType, ibs: boolean, date: string) {
  const n = ibs ? r.ibsVariant.perServing : r.perServing;
  return create<MealLog>('mealLogs', {
    date,
    slot,
    recipeId: r.id,
    label: r.name,
    servings,
    nutrition: round(scale(n, servings)),
    ibsVariant: ibs,
    loggedAt: Date.now()
  });
}

export function logIngredient(ing: Ingredient, grams: number, slot: MealType, date: string) {
  return create<MealLog>('mealLogs', {
    date,
    slot,
    ingredientId: ing.id,
    label: `${ing.name} (${Math.round(grams)} g)`,
    servings: 1,
    nutrition: round(nutritionFor(ing, grams)),
    ibsVariant: false,
    loggedAt: Date.now()
  });
}

export function logQuick(label: string, n: Partial<Nutrition>, slot: MealType, date: string) {
  const full: Nutrition = {
    kcal: 0, protein: 0, carbs: 0, netCarbs: 0, fat: 0, fibre: 0, sodium: 0, potassium: 0, calcium: 0, iron: 0,
    magnesium: 0, zinc: 0, vitC: 0, vitA: 0, folate: 0, b12: 0, ...n
  };
  full.netCarbs = Math.max(0, full.carbs - full.fibre);
  return create<MealLog>('mealLogs', { date, slot, label, servings: 1, nutrition: full, ibsVariant: false, loggedAt: Date.now() });
}

export function slotForNow(): MealType {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
}
