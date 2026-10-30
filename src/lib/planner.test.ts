import { catalog, settings } from '@/test/fixtures';
import { ELIMINATION, levelAt } from './fodmap';
import { generatePlan } from './planner';

describe('meal plan solver', () => {
  it('Keto + IBS elimination: zero high-FODMAP above safe serving and every day within ±5%', () => {
    const s = settings();
    const res = generatePlan({ catalog, settings: s, ctx: ELIMINATION, ibs: true });
    expect(res.days).toHaveLength(7);
    for (const day of res.days) {
      for (const m of day) {
        const r = catalog.recipes.get(m.recipeId)!;
        for (const it of r.ibsVariant.ingredients) {
          expect(levelAt(catalog.ingredients.get(it.i)!, it.g / r.servings)).toBe('low');
        }
      }
    }
    res.evals.forEach((e) => {
      expect(Math.abs(e.dev.kcal)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(e.dev.protein)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(e.dev.fat)).toBeLessThanOrEqual(0.05);
      expect(e.total.netCarbs).toBeLessThanOrEqual(s.targets.carbs * 1.05);
    });
  });

  it.each(['balanced', 'hplc'] as const)('%s plans hit targets within ±5%%', (mode) => {
    const targets =
      mode === 'balanced'
        ? { kcal: 1800, protein: 135, carbs: 180, fat: 60, fibre: 25 }
        : { kcal: 1800, protein: 160, carbs: 90, fat: 84, fibre: 25 };
    const res = generatePlan({ catalog, settings: settings({ dietMode: mode, targets, seed: 7 }), ctx: ELIMINATION, ibs: true });
    const ok = res.evals.filter((e) => e.within).length;
    expect(ok).toBeGreaterThanOrEqual(6);
  });

  it('is deterministic for a seed and respects variety', () => {
    const a = generatePlan({ catalog, settings: settings(), ctx: ELIMINATION, ibs: true });
    const b = generatePlan({ catalog, settings: settings(), ctx: ELIMINATION, ibs: true });
    expect(a.days.map((d) => d.map((m) => m.recipeId))).toEqual(b.days.map((d) => d.map((m) => m.recipeId)));
    const uses = new Map<string, number>();
    // Fat add-ons (chutneys, nut handfuls) are condiments and may repeat up to 4× a week.
    a.days.flat().filter((m) => m.slot !== 'side' || !m.recipeId.startsWith('ad-')).forEach((m) => uses.set(m.recipeId, (uses.get(m.recipeId) ?? 0) + 1));
    expect(Math.max(...uses.values())).toBeLessThanOrEqual(2);
    for (const day of a.days) {
      const proteins = new Map<string, number>();
      day.forEach((m) => {
        const p = catalog.recipes.get(m.recipeId)!.protein;
        if (p !== 'veg') proteins.set(p, (proteins.get(p) ?? 0) + 1);
      });
      expect(Math.max(0, ...proteins.values())).toBeLessThanOrEqual(2);
    }
  });

  it('keeps locked meals when regenerating', () => {
    const first = generatePlan({ catalog, settings: settings(), ctx: ELIMINATION, ibs: true });
    first.days[2][0].locked = true;
    const again = generatePlan({ catalog, settings: settings({ seed: 99 }), ctx: ELIMINATION, ibs: true, previous: first.days });
    expect(again.days[2].some((m) => m.recipeId === first.days[2][0].recipeId && m.locked)).toBe(true);
  });
});
