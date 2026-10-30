import { catalog, settings } from '@/test/fixtures';
import { buildShoppingList, shoppingText, toPurchase } from './shopping';
import { generatePlan } from './planner';
import { ELIMINATION } from './fodmap';

const ing = (id: string) => catalog.ingredients.get(id)!;

describe('shopping list', () => {
  it('rounds meat to 250 g and eggs to dozens / trays', () => {
    expect(toPurchase(ing('chicken_curry_cut'), 2310).display).toBe('2.5 kg');
    expect(toPurchase(ing('chicken_curry_cut'), 600).display).toBe('750 g');
    expect(toPurchase(ing('egg'), 50 * 22).display).toBe('2 dozen');
    expect(toPurchase(ing('egg'), 50 * 28).display).toBe('1 tray (30)');
    expect(toPurchase(ing('coriander_leaves'), 150).display).toBe('2 bunches');
  });

  it('builds a 7-day list for 2 people with realistic, rounded quantities and costs', () => {
    const plan = generatePlan({ catalog, settings: settings({ people: 2 }), ctx: ELIMINATION, ibs: true });
    const lines = buildShoppingList({ days: plan.days, catalog, people: 2, ibs: true, pantry: {} });
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines.filter((l) => l.section === 'meat-fish')) expect(l.buyG % 250).toBe(0);
    expect(lines.every((l) => l.cost >= 0)).toBe(true);
    expect(shoppingText(lines)).toContain('Estimated total: ₹');
  });

  it('subtracts pantry stock', () => {
    const days = [[{ key: 'a', slot: 'breakfast' as const, recipeId: 'ad-boiled-eggs', servings: 1, locked: false }]];
    const lines = buildShoppingList({ days, catalog, people: 1, ibs: false, pantry: { egg: 500 } });
    expect(lines.find((l) => l.ingredientId === 'egg')).toBeUndefined();
  });
});
