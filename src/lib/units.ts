import type { Ingredient } from '@/types';

const DEFAULT_SPOON: Partial<Record<Ingredient['category'], { tsp: number; tbsp: number }>> = {
  spice: { tsp: 2.5, tbsp: 7.5 },
  oil: { tsp: 4.5, tbsp: 13.5 },
  condiment: { tsp: 5, tbsp: 15 },
  herb: { tsp: 1, tbsp: 3 }
};

const fmt = (n: number) => {
  const q = Math.round(n * 4) / 4;
  const whole = Math.floor(q);
  const frac = q - whole;
  const f = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : '';
  return whole === 0 ? f || '¼' : `${whole}${f}`;
};

/** Human-friendly household measure for an amount, e.g. "2 tsp", "1½ cup", "3 eggs". */
export function household(ing: Ingredient, grams: number): string {
  const u = { ...DEFAULT_SPOON[ing.category], ...ing.units };
  if (u.piece && u.pieceName && grams >= u.piece * 0.5) {
    const n = grams / u.piece;
    return `${fmt(n)} ${u.pieceName}${n > 1.25 && !u.pieceName.includes('(') ? 's' : ''}`;
  }
  if (u.tsp && grams <= u.tsp * 2.5) return `${fmt(grams / u.tsp)} tsp`;
  if (u.tbsp && grams <= u.tbsp * 5) return `${fmt(grams / u.tbsp)} tbsp`;
  if (u.cup && grams >= u.cup * 0.25) return `${fmt(grams / u.cup)} cup`;
  return '';
}

export function gramsLabel(ing: Ingredient, grams: number): string {
  const liquid = ['dairy', 'oil'].includes(ing.category) && /milk|oil|juice/i.test(ing.name);
  const g = Math.round(grams);
  return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 ? 2 : 0)} ${liquid ? 'L' : 'kg'}` : `${g} ${liquid ? 'ml' : 'g'}`;
}

/** Indian portion helpers used by the logger. */
export const PORTION_HELPERS: { label: string; grams: number; hint: string }[] = [
  { label: '1 katori', grams: 150, hint: 'Small steel bowl of curry / dal / sabzi' },
  { label: '1 medium roti', grams: 40, hint: '~25 g atta' },
  { label: '1 cup cooked rice', grams: 160, hint: 'Packed steel cup' },
  { label: '1 piece curry-cut chicken', grams: 60, hint: 'Bone-in, ~45 g meat' },
  { label: '1 fish steak', grams: 100, hint: 'Palm-sized, 1 cm thick' },
  { label: '1 egg', grams: 50, hint: 'Large hen egg' },
  { label: '1 ladle', grams: 60, hint: 'Serving ladle of gravy' },
  { label: '1 tsp oil / ghee', grams: 4.5, hint: '≈ 40 kcal' }
];
