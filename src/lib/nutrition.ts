import type { Ingredient, Nutrition, RecipeIngredientSeed, DietTag } from '@/types';

export const ZERO: Nutrition = {
  kcal: 0, protein: 0, carbs: 0, netCarbs: 0, fat: 0, fibre: 0, sodium: 0, potassium: 0,
  calcium: 0, iron: 0, magnesium: 0, zinc: 0, vitC: 0, vitA: 0, folate: 0, b12: 0
};

export const NUTRIENT_KEYS = Object.keys(ZERO) as (keyof Nutrition)[];

/** Nutrition for `grams` of an ingredient. */
export function nutritionFor(ing: Ingredient, grams: number): Nutrition {
  const f = grams / 100;
  const [kcal, p, c, fat, fib, na, k, ca, fe, mg, zn, vc, va, fol, b12] = ing.n;
  return {
    kcal: kcal * f,
    protein: p * f,
    carbs: c * f,
    netCarbs: Math.max(0, c - fib) * f,
    fat: fat * f,
    fibre: fib * f,
    sodium: na * f,
    potassium: k * f,
    calcium: ca * f,
    iron: fe * f,
    magnesium: mg * f,
    zinc: zn * f,
    vitC: vc * f,
    vitA: va * f,
    folate: fol * f,
    b12: b12 * f
  };
}

export function add(a: Nutrition, b: Nutrition): Nutrition {
  const out = { ...a };
  for (const k of NUTRIENT_KEYS) out[k] = a[k] + b[k];
  return out;
}

export function scale(a: Nutrition, factor: number): Nutrition {
  const out = { ...a };
  for (const k of NUTRIENT_KEYS) out[k] = a[k] * factor;
  return out;
}

export function sum(list: Nutrition[]): Nutrition {
  return list.reduce(add, { ...ZERO });
}

export function round(a: Nutrition, digits = 1): Nutrition {
  const m = 10 ** digits;
  const out = { ...a };
  for (const k of NUTRIENT_KEYS) out[k] = Math.round(a[k] * m) / m;
  return out;
}

/** Whole-recipe nutrition divided by servings. Pure function of ingredient data. */
export function recipeNutrition(
  items: RecipeIngredientSeed[],
  servings: number,
  lookup: (id: string) => Ingredient | undefined
): Nutrition {
  const total = sum(
    items.map((it) => {
      const ing = lookup(it.i);
      if (!ing) throw new Error(`Unknown ingredient "${it.i}"`);
      return nutritionFor(ing, it.g);
    })
  );
  return round(scale(total, 1 / servings));
}

/** Macro energy split in percent (Atwater 4/4/9). */
export function macroSplit(n: Pick<Nutrition, 'protein' | 'carbs' | 'fat' | 'fibre'>) {
  const p = n.protein * 4;
  const c = Math.max(0, n.carbs - n.fibre) * 4;
  const f = n.fat * 9;
  const total = p + c + f || 1;
  return { protein: (p / total) * 100, carbs: (c / total) * 100, fat: (f / total) * 100 };
}

/** Diet tags derived from per-serving macros. */
export function dietTagsFor(n: Nutrition): DietTag[] {
  const s = macroSplit(n);
  const tags: DietTag[] = [];
  if (s.carbs <= 12 && n.netCarbs <= 10) tags.push('keto');
  if (s.protein >= 30 && s.carbs <= 30) tags.push('hplc');
  if (s.protein >= 18 && s.carbs >= 15 && s.carbs <= 55) tags.push('balanced');
  return tags;
}

/** Recommended daily micronutrient intakes (ICMR-NIN 2020 RDAs, adult). */
export function microTargets(sex: 'male' | 'female') {
  return sex === 'male'
    ? { fibre: 30, potassium: 3500, calcium: 1000, iron: 19, magnesium: 440, zinc: 17, vitC: 80, vitA: 1000, folate: 300, b12: 2.5, sodium: 2000 }
    : { fibre: 25, potassium: 3500, calcium: 1000, iron: 29, magnesium: 370, zinc: 13, vitC: 65, vitA: 840, folate: 220, b12: 2.5, sodium: 2000 };
}
