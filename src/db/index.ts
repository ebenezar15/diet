import Dexie, { type Table } from 'dexie';
import type {
  CustomRecipe, Favourite, FastingSession, Ingredient, MealLog, MealPlan, OutboxEntry, PantryItem, PriceOverride,
  RecipeSeed, ReintroductionTest, Reminder, ShoppingCheck, SymptomLog, SyncEntity, SyncEvent, UserProfile, WaterLog,
  WeightLog, WorkoutLog
} from '@/types';

export interface KV {
  key: string;
  value: unknown;
}

export class ThaliDB extends Dexie {
  // seed data (bundled, versioned)
  ingredients!: Table<Ingredient, string>;
  recipes!: Table<RecipeSeed, string>;
  // user data (synced)
  profiles!: Table<UserProfile, string>;
  mealLogs!: Table<MealLog, string>;
  waterLogs!: Table<WaterLog, string>;
  weightLogs!: Table<WeightLog, string>;
  symptomLogs!: Table<SymptomLog, string>;
  reintroTests!: Table<ReintroductionTest, string>;
  mealPlans!: Table<MealPlan, string>;
  pantry!: Table<PantryItem, string>;
  shoppingChecks!: Table<ShoppingCheck, string>;
  priceOverrides!: Table<PriceOverride, string>;
  fastingSessions!: Table<FastingSession, string>;
  workoutLogs!: Table<WorkoutLog, string>;
  customRecipes!: Table<CustomRecipe, string>;
  reminders!: Table<Reminder, string>;
  favourites!: Table<Favourite, string>;
  // sync plumbing
  outbox!: Table<OutboxEntry, string>;
  syncLog!: Table<SyncEvent, number>;
  meta!: Table<KV, string>;

  constructor(name = 'thalifit') {
    super(name);
    this.version(1).stores({
      ingredients: 'id, category',
      recipes: 'id, cuisine, protein',
      profiles: 'id, updatedAt',
      mealLogs: 'id, date, recipeId, updatedAt',
      waterLogs: 'id, date, updatedAt',
      weightLogs: 'id, date, updatedAt',
      symptomLogs: 'id, date, at, updatedAt',
      reintroTests: 'id, status, updatedAt',
      mealPlans: 'id, weekStart, isTemplate, updatedAt',
      pantry: 'id, ingredientId, updatedAt',
      shoppingChecks: 'id, planId, updatedAt',
      priceOverrides: 'id, ingredientId, updatedAt',
      fastingSessions: 'id, start, updatedAt',
      workoutLogs: 'id, date, updatedAt',
      customRecipes: 'id, updatedAt',
      reminders: 'id, updatedAt',
      favourites: 'id, recipeId, updatedAt',
      outbox: 'id, status, entity, updatedAt',
      syncLog: '++id, at',
      meta: 'key'
    });
  }
}

export let db = new ThaliDB();

/** Test hook: swap in a fresh database. */
export function resetDb(name?: string) {
  db = new ThaliDB(name);
  return db;
}

export const SYNC_ENTITIES: SyncEntity[] = [
  'profiles', 'mealLogs', 'waterLogs', 'weightLogs', 'symptomLogs', 'reintroTests', 'mealPlans', 'pantry',
  'shoppingChecks', 'priceOverrides', 'fastingSessions', 'workoutLogs', 'customRecipes', 'reminders', 'favourites'
];

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return (row?.value as T) ?? fallback;
}
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value });
