/* Validates bundled seed data; fails the build on missing fields or inconsistent macros. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingredientSchema, recipeFileSchema, exerciseSchema } from '../src/data/schema';
import { recipeNutrition } from '../src/lib/nutrition';
import type { Ingredient } from '../src/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'seed');
const errors: string[] = [];
const warn: string[] = [];

const ingFile = JSON.parse(readFileSync(join(root, 'ingredients.json'), 'utf8'));
const ingredients: Ingredient[] = [];
for (const raw of ingFile.ingredients) {
  const r = ingredientSchema.safeParse(raw);
  if (!r.success) errors.push(`ingredient ${raw.id}: ${r.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
  else ingredients.push(r.data as Ingredient);
}
const byId = new Map(ingredients.map((i) => [i.id, i]));
if (byId.size !== ingredients.length) errors.push('duplicate ingredient ids');

for (const ing of ingredients) {
  const [kcal, p, c, f, fib] = ing.n;
  const atwater = p * 4 + Math.max(0, c - fib) * 4 + fib * 2 + f * 9;
  if (kcal > 20 && Math.abs(atwater - kcal) / kcal > 0.2)
    errors.push(`ingredient ${ing.id}: kcal ${kcal} inconsistent with macros (≈${atwater.toFixed(0)})`);
  if (fib > c) errors.push(`ingredient ${ing.id}: fibre > carbs`);
  if (ing.swap && !byId.has(ing.swap.to)) errors.push(`ingredient ${ing.id}: swap target ${ing.swap.to} missing`);
  if (ing.fodmap.level !== 'low' && ing.fodmap.safeG === undefined)
    errors.push(`ingredient ${ing.id}: non-low FODMAP needs safeG`);
}

const recipeDir = join(root, 'recipes');
const ids = new Set<string>();
let count = 0;
for (const file of readdirSync(recipeDir).filter((f) => f.endsWith('.json'))) {
  const parsed = recipeFileSchema.safeParse(JSON.parse(readFileSync(join(recipeDir, file), 'utf8')));
  if (!parsed.success) {
    errors.push(`${file}: ${parsed.error.issues.slice(0, 5).map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
    continue;
  }
  for (const r of parsed.data.recipes) {
    count++;
    if (ids.has(r.id)) errors.push(`${file}: duplicate recipe id ${r.id}`);
    ids.add(r.id);
    const missing = r.ingredients.filter((it) => !byId.has(it.i)).map((it) => it.i);
    if (missing.length) {
      errors.push(`${file} ${r.id}: unknown ingredients ${missing.join(', ')}`);
      continue;
    }
    const n = recipeNutrition(r.ingredients, r.servings, (id) => byId.get(id));
    if (n.kcal < 40 || n.kcal > 1100) errors.push(`${file} ${r.id}: implausible kcal/serving ${n.kcal}`);
    if (r.mealTypes.some((m) => m !== 'side' && m !== 'snack') && n.protein < 8 && r.protein !== 'veg')
      warn.push(`${r.id}: low protein main (${n.protein} g)`);
  }
}
if (count < 120) errors.push(`expected ≥ 120 recipes, found ${count}`);

const ex = JSON.parse(readFileSync(join(root, 'exercises.json'), 'utf8'));
for (const e of ex.exercises) {
  const r = exerciseSchema.safeParse(e);
  if (!r.success) errors.push(`exercise ${e.id}: ${r.error.issues[0].message}`);
}

warn.forEach((w) => console.warn('warn:', w));
if (errors.length) {
  console.error(`Seed validation failed (${errors.length}):\n - ` + errors.join('\n - '));
  process.exit(1);
}
console.log(`Seed OK: ${ingredients.length} ingredients, ${count} recipes, ${ex.exercises.length} exercises.`);
