import { catalog } from '@/test/fixtures';
import { ibsVariant, isAllowed, levelAt, ELIMINATION } from './fodmap';

const ing = (id: string) => catalog.ingredients.get(id)!;
const lookup = (id: string) => catalog.ingredients.get(id);

describe('fodmap overlay', () => {
  it('treats high-FODMAP within safe serving as low', () => {
    expect(levelAt(ing('atta'), 20)).toBe('low');
    expect(levelAt(ing('atta'), 60)).toBe('high');
    expect(levelAt(ing('garlic'), 1)).toBe('high');
  });

  it('swaps onion, garlic, curd, cashew and regular hing', () => {
    const v = ibsVariant(
      [
        { i: 'chicken_curry_cut', g: 500 },
        { i: 'onion', g: 200 },
        { i: 'garlic', g: 15 },
        { i: 'curd', g: 300 },
        { i: 'cashew', g: 20 },
        { i: 'hing', g: 1 }
      ],
      4,
      lookup
    );
    const ids = v.ingredients.map((i) => i.i);
    expect(ids).toEqual(expect.arrayContaining(['spring_onion_greens', 'garlic_oil', 'lf_curd', 'peanuts', 'hing_gf']));
    expect(ids).not.toEqual(expect.arrayContaining(['onion']));
    expect(v.fodmapStatus).toBe('low');
  });

  it('allows tolerated groups in personalization', () => {
    const ctx = { ...ELIMINATION, phase: 'personalization' as const, tolerated: ['lactose' as const] };
    expect(isAllowed(ing('curd'), 100, ctx)).toBe(true);
    expect(isAllowed(ing('onion'), 50, ctx)).toBe(false);
  });

  it('every seed recipe yields a computed IBS variant', () => {
    for (const r of catalog.list) expect(r.ibsVariant.perServing.kcal).toBeGreaterThan(0);
  });
});
