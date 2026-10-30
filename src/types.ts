// Core domain types for ThaliFit. Seed data (ingredients, recipes, exercises) is typed JSON
// validated by Zod in src/data/schema.ts; user data lives in Dexie (src/db).

export type FodmapLevel = 'low' | 'moderate' | 'high';
export type FodmapGroup = 'fructans' | 'GOS' | 'lactose' | 'fructose' | 'polyols';

export type IngredientCategory =
  | 'meat'
  | 'fish'
  | 'egg'
  | 'dairy'
  | 'veg'
  | 'fruit'
  | 'grain'
  | 'pulse'
  | 'nut'
  | 'spice'
  | 'herb'
  | 'oil'
  | 'condiment'
  | 'protein';

export type StoreSection = 'meat-fish' | 'vegetables' | 'dairy-eggs' | 'grocery';

/**
 * Nutrient vector per 100 g edible portion, in this fixed order:
 * [kcal, protein g, carbs g (total, incl. fibre), fat g, fibre g, sodium mg, potassium mg,
 *  calcium mg, iron mg, magnesium mg, zinc mg, vitamin C mg, vitamin A µg RAE, folate µg, vitamin B12 µg]
 */
export type NutrientVector = [
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number
];

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  netCarbs: number;
  fat: number;
  fibre: number;
  sodium: number;
  potassium: number;
  calcium: number;
  iron: number;
  magnesium: number;
  zinc: number;
  vitC: number;
  vitA: number;
  folate: number;
  b12: number;
}

export interface PurchaseInfo {
  /** How it is sold in an Indian market. */
  unit: 'kg' | 'dozen' | 'bunch' | 'piece' | 'packet' | 'litre' | 'tray';
  /** Round purchased quantity up to this many grams (kg/litre units). */
  roundG?: number;
  /** Weight of one piece / bunch / packet in grams. */
  packG?: number;
  /** Display label override, e.g. "Lemon". */
  label?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  nameTa?: string;
  nameHi?: string;
  category: IngredientCategory;
  n: NutrientVector;
  fodmap: {
    level: FodmapLevel;
    groups: FodmapGroup[];
    /** Max grams per serving that stays low-FODMAP. Omit for "no known limit". */
    safeG?: number;
    note?: string;
  };
  /** Low-FODMAP swap used in the IBS-safe variant. */
  swap?: { to: string; ratio: number; note?: string };
  /** Household unit weights in grams. */
  units?: { tsp?: number; tbsp?: number; cup?: number; piece?: number; pieceName?: string };
  purchase: PurchaseInfo;
  section: StoreSection;
  /** Days it stays fresh once bought. */
  shelfDays: number;
  /** ₹ per kg (or per litre). Editable via price list. */
  pricePerKg: number;
  source: 'IFCT2017' | 'USDA' | 'Label';
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'side';
export type Cuisine =
  | 'Chettinad'
  | 'Tamil Nadu'
  | 'Kerala'
  | 'Andhra'
  | 'Hyderabadi'
  | 'Karnataka'
  | 'Goan'
  | 'Bengali'
  | 'Punjabi'
  | 'Mughlai'
  | 'Indo-Chinese'
  | 'Pan-Indian';
export type Equipment =
  | 'air-fryer'
  | 'pressure-cooker'
  | 'kadai'
  | 'tawa'
  | 'pan'
  | 'oven'
  | 'steamer'
  | 'grill'
  | 'blender'
  | 'pot';
export type MainProtein = 'chicken' | 'mutton' | 'fish' | 'prawns' | 'crab' | 'egg' | 'paneer' | 'veg';

export interface RecipeIngredientSeed {
  /** Ingredient id. */
  i: string;
  /** Grams (ml treated as grams) for the whole recipe. */
  g: number;
  /** Optional prep / butcher note, e.g. "curry cut", "finely chopped". */
  note?: string;
}

export interface RecipeStep {
  text: string;
  timerMin?: number;
}

export interface RecipeSeed {
  id: string;
  name: string;
  localName?: string;
  cuisine: Cuisine;
  mealTypes: MealType[];
  protein: MainProtein;
  servings: number;
  prepMin: number;
  cookMin: number;
  difficulty: 'easy' | 'medium' | 'hard';
  equipment: Equipment[];
  spice: 1 | 2 | 3;
  ingredients: RecipeIngredientSeed[];
  steps: RecipeStep[];
  tips?: string[];
  makeAhead?: string;
  batchFriendly?: boolean;
  /** Light courses — drinks are never auto-planned; desserts can fill snack slots. */
  course?: 'drink' | 'dessert';
}

export type DietTag = 'keto' | 'hplc' | 'balanced';

/** Recipe with derived data — computed from ingredients, never hand-typed. */
export interface Recipe extends RecipeSeed {
  perServing: Nutrition;
  dietTags: DietTag[];
  fodmapStatus: FodmapLevel;
  fodmapFlags: FodmapFlag[];
  costPerServing: number;
  ibsVariant: IbsVariant;
}

export interface FodmapFlag {
  ingredientId: string;
  level: FodmapLevel;
  groups: FodmapGroup[];
  perServingG: number;
  safeG?: number;
}

export interface IbsVariant {
  ingredients: RecipeIngredientSeed[];
  substitutions: { from: string; to: string; note?: string }[];
  perServing: Nutrition;
  fodmapStatus: FodmapLevel;
  fodmapFlags: FodmapFlag[];
}

export interface Exercise {
  id: string;
  name: string;
  kind: 'cardio' | 'strength' | 'mobility' | 'ibs-relief';
  level: 'beginner' | 'intermediate' | 'advanced';
  equipment: 'none' | 'dumbbells' | 'resistance-band' | 'chair' | 'mat';
  muscles: string[];
  met: number;
  cues: string[];
  /** Default prescription. */
  sets?: number;
  reps?: string;
  durationMin?: number;
  ibsNote?: string;
}

/* ------------------------------------------------------------------ user data */

export interface SyncFields {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  deviceId: string;
  userId: string | null;
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
export type DietMode = 'keto' | 'hplc' | 'balanced' | 'custom';
export type IfProtocol = 'none' | '12:12' | '14:10' | '16:8' | '18:6' | 'omad';
export type IbsType = 'IBS-C' | 'IBS-D' | 'IBS-M' | 'unsure' | 'none';
export type FodmapPhase = 'elimination' | 'reintroduction' | 'personalization';

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface UserProfile extends SyncFields {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  activity: ActivityLevel;
  /** Weekly loss as % of bodyweight (0.25–1). */
  ratePct: number;
  /** Optional target in days — planner shows if it is achievable safely. */
  targetDays?: number;
  mealsPerDay: number;
  cuisines: string[];
  dislikes: string[];
  allergies: string[];
  cookingSkill: 'beginner' | 'intermediate' | 'expert';
  minutesPerMeal: number;
  /** ₹ per day food budget per person. */
  budgetPerDay: number;
  dietMode: DietMode;
  ifProtocol: IfProtocol;
  /** Eating window start hour (0–23). */
  ifStartHour: number;
  ibsType: IbsType;
  fodmapPhase: FodmapPhase;
  reintroGroup?: FodmapGroup;
  triggers: string[];
  allowSmallLentils: boolean;
  preferAirFryer: boolean;
  workoutDaysPerWeek: number;
  workoutLevel: 'beginner' | 'intermediate' | 'advanced';
  targets: MacroTargets;
  /** Whether targets were hand-edited (then we don't auto-recompute). */
  targetsCustom: boolean;
  language: 'en' | 'ta' | 'hi';
  disclaimerAcceptedAt: number | null;
  onboarded: boolean;
}

export interface MealLog extends SyncFields {
  date: string; // YYYY-MM-DD
  slot: MealType;
  recipeId?: string;
  ingredientId?: string;
  label: string;
  servings: number;
  /** Nutrition for the logged amount. */
  nutrition: Nutrition;
  ibsVariant: boolean;
  loggedAt: number;
}

export interface WaterLog extends SyncFields {
  date: string;
  ml: number;
}

export interface WeightLog extends SyncFields {
  date: string;
  kg: number;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  photo?: string; // data URL stored locally only
}

export interface SymptomLog extends SyncFields {
  date: string;
  at: number;
  bloating: number; // 0–10
  pain: number;
  gas: number;
  urgency: number;
  stress: number;
  sleep: number; // hours
  bristol?: number; // 1–7
  note?: string;
}

export interface ReintroductionTest extends SyncFields {
  group: FodmapGroup;
  foodId: string;
  startDate: string;
  /** Day doses in grams — small, medium, large. */
  doses: number[];
  result?: 'tolerated' | 'partial' | 'not-tolerated';
  status: 'active' | 'done' | 'abandoned';
}

export interface PlannedMeal {
  key: string;
  slot: MealType;
  recipeId: string;
  servings: number;
  locked: boolean;
  status?: 'eaten' | 'skipped' | 'cooked';
}

export interface MealPlan extends SyncFields {
  name: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  days: PlannedMeal[][];
  people: number;
  isTemplate: boolean;
  settings: PlanSettings;
}

export interface PlanSettings {
  dietMode: DietMode;
  phase: FodmapPhase;
  targets: MacroTargets;
  mealsPerDay: number;
  cuisines: string[];
  dislikes: string[];
  budgetPerDay: number;
  maxMinutes: number;
  people: number;
  leftovers: boolean;
  batchCook: boolean;
  airFryerBias: boolean;
  seed: number;
}

export interface PantryItem extends SyncFields {
  ingredientId: string;
  grams: number;
  expiresOn?: string;
}

export interface ShoppingCheck extends SyncFields {
  planId: string;
  ingredientId: string;
  checked: boolean;
}

export interface PriceOverride extends SyncFields {
  ingredientId: string;
  pricePerKg: number;
}

export interface FastingSession extends SyncFields {
  start: number;
  end: number | null;
  targetHours: number;
}

export interface WorkoutLog extends SyncFields {
  date: string;
  exerciseIds: string[];
  minutes: number;
  kcal: number;
  note?: string;
}

export interface CustomRecipe extends SyncFields {
  seed: RecipeSeed;
}

export interface Reminder extends SyncFields {
  kind: 'meal' | 'water' | 'fasting' | 'shopping' | 'workout';
  time: string; // HH:mm
  days: number[]; // 0=Sun
  enabled: boolean;
  label: string;
}

export interface Favourite extends SyncFields {
  recipeId: string;
}

export type SyncEntity =
  | 'profiles'
  | 'mealLogs'
  | 'waterLogs'
  | 'weightLogs'
  | 'symptomLogs'
  | 'reintroTests'
  | 'mealPlans'
  | 'pantry'
  | 'shoppingChecks'
  | 'priceOverrides'
  | 'fastingSessions'
  | 'workoutLogs'
  | 'customRecipes'
  | 'reminders'
  | 'favourites';

export interface OutboxEntry {
  id: string;
  entity: SyncEntity;
  op: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  updatedAt: number;
  deviceId: string;
  status: 'pending' | 'sent' | 'error';
  attempts: number;
  error?: string;
}

export interface SyncEvent {
  id?: number;
  at: number;
  kind: 'push' | 'pull' | 'error' | 'info';
  message: string;
  count?: number;
}
