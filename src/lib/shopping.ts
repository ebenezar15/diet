import type { Ingredient, PlannedMeal, StoreSection } from '@/types';
import type { Catalog } from './catalog';

export interface ShoppingLine {
  ingredientId: string;
  name: string;
  section: StoreSection;
  neededG: number;
  pantryG: number;
  /** Purchasable quantity in grams after rounding. */
  buyG: number;
  display: string;
  cost: number;
  perishable: boolean;
  /** Long-life pantry staple (spices, oils, grains) — bought once, lasts weeks. */
  staple: boolean;
  /** For perishables: grams needed in days 1–3 vs 4–7. */
  split?: { early: string; late: string };
  butcherNotes: string[];
}

export const SECTION_LABEL: Record<StoreSection, string> = {
  'meat-fish': 'Meat & fish',
  vegetables: 'Vegetables, fruit & herbs',
  'dairy-eggs': 'Dairy & eggs',
  grocery: 'Grocery & spices'
};

const kg = (g: number) => (g >= 1000 ? `${+(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`);
const litre = (g: number) => (g >= 1000 ? `${+(g / 1000).toFixed(2)} L` : `${Math.round(g)} ml`);

/** Rounds a needed amount to how it's actually bought in an Indian market. */
export function toPurchase(ing: Ingredient, grams: number): { buyG: number; display: string; units: number } {
  const p = ing.purchase;
  if (grams <= 0) return { buyG: 0, display: '—', units: 0 };
  switch (p.unit) {
    case 'kg': {
      const r = p.roundG ?? 250;
      const buyG = Math.ceil(grams / r - 1e-9) * r;
      return { buyG, display: kg(buyG), units: buyG / 1000 };
    }
    case 'litre': {
      const r = p.roundG ?? 500;
      const buyG = Math.ceil(grams / r - 1e-9) * r;
      return { buyG, display: litre(buyG), units: buyG / 1000 };
    }
    case 'dozen':
    case 'tray': {
      const pieces = Math.ceil(grams / (p.packG ?? 50) - 0.15);
      if (pieces > 24 && pieces <= 30) return { buyG: 30 * (p.packG ?? 50), display: '1 tray (30)', units: 30 };
      const dozens = Math.max(0.5, Math.ceil(pieces / 6) / 2); // half-dozen granularity
      const label = dozens === 0.5 ? 'half dozen' : `${dozens} dozen`;
      return { buyG: dozens * 12 * (p.packG ?? 50), display: label, units: dozens * 12 };
    }
    case 'bunch':
    case 'piece':
    case 'packet': {
      const size = p.packG ?? 100;
      const n = Math.max(1, Math.ceil(grams / size - 0.1));
      const word = p.unit === 'bunch' ? 'bunch' : p.unit === 'piece' ? (n > 1 ? 'pcs' : 'pc') : `pack${n > 1 ? 's' : ''}`;
      const sizeNote = p.unit === 'packet' ? ` × ${size >= 1000 ? `${size / 1000} kg` : `${size} g`}` : '';
      return {
        buyG: n * size,
        display: p.unit === 'bunch' ? `${n} ${n > 1 ? 'bunches' : 'bunch'}` : `${n} ${word}${sizeNote}`,
        units: n
      };
    }
  }
}

export interface ShoppingInput {
  days: PlannedMeal[][];
  catalog: Catalog;
  people: number;
  ibs: boolean;
  pantry: Record<string, number>;
}

export function buildShoppingList({ days, catalog, people, ibs, pantry }: ShoppingInput): ShoppingLine[] {
  const need = new Map<string, { early: number; late: number; notes: Set<string> }>();
  days.forEach((day, d) => {
    for (const m of day) {
      const r = catalog.recipes.get(m.recipeId);
      if (!r) continue;
      const items = ibs ? r.ibsVariant.ingredients : r.ingredients;
      const factor = (m.servings * people) / r.servings;
      for (const it of items) {
        const e = need.get(it.i) ?? { early: 0, late: 0, notes: new Set<string>() };
        if (d < 3) e.early += it.g * factor;
        else e.late += it.g * factor;
        if (it.note) e.notes.add(it.note);
        need.set(it.i, e);
      }
    }
  });

  const lines: ShoppingLine[] = [];
  for (const [id, e] of need) {
    const ing = catalog.ingredients.get(id);
    if (!ing) continue;
    const neededG = e.early + e.late;
    const pantryG = Math.min(neededG, pantry[id] ?? 0);
    const toBuy = neededG - pantryG;
    if (toBuy < 0.5 && pantryG > 0) continue;
    const { buyG, display } = toPurchase(ing, toBuy);
    const perishable = ing.shelfDays <= 3;
    const unitPrice = catalog.price(id);
    const line: ShoppingLine = {
      ingredientId: id,
      name: ing.purchase.label ?? ing.name,
      section: ing.section,
      neededG: Math.round(neededG),
      pantryG: Math.round(pantryG),
      buyG,
      display,
      cost: Math.round((buyG / 1000) * unitPrice),
      perishable,
      staple: ing.section === 'grocery' && ing.shelfDays >= 90,
      butcherNotes: ing.section === 'meat-fish' ? [...e.notes] : []
    };
    if (perishable && e.late > 0 && e.early > 0) {
      line.split = { early: toPurchase(ing, e.early).display, late: toPurchase(ing, e.late).display };
    }
    lines.push(line);
  }
  const sectionOrder: StoreSection[] = ['meat-fish', 'vegetables', 'dairy-eggs', 'grocery'];
  return lines.sort((a, b) => sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section) || a.name.localeCompare(b.name));
}

/** WhatsApp-friendly text. */
export function shoppingText(lines: ShoppingLine[], title = 'ThaliFit shopping list'): string {
  const out = [`*${title}*`];
  let total = 0;
  for (const section of Object.keys(SECTION_LABEL) as StoreSection[]) {
    const ls = lines.filter((l) => l.section === section);
    if (!ls.length) continue;
    out.push('', `*${SECTION_LABEL[section]}*`);
    for (const l of ls) {
      total += l.cost;
      const notes = l.butcherNotes.length ? ` _(${l.butcherNotes.join('; ')})_` : '';
      const split = l.split ? ` — buy ${l.split.early} now, ${l.split.late} mid-week` : '';
      out.push(`• ${l.name} — ${l.display}${notes}${split}`);
    }
  }
  out.push('', `Estimated total: ₹${total}`, '_Spices, oils & grains last several weeks._');
  return out.join('\n');
}
