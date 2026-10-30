import type { MealLog, SymptomLog } from '@/types';
import type { Catalog } from './catalog';

export const severity = (s: SymptomLog) => (s.bloating + s.pain + s.gas + s.urgency) / 4;

export interface SuspectScore {
  ingredientId: string;
  name: string;
  exposures: number;
  avgSeverity: number;
  /** avgSeverity minus overall baseline; > 0 means worse than usual. */
  score: number;
}

const H = 3600_000;

/**
 * Per-ingredient "suspect score": average symptom severity reported 2–24 h after eating
 * an ingredient, compared with the overall average severity.
 */
export function suspectScores(meals: MealLog[], symptoms: SymptomLog[], catalog: Catalog, minExposures = 2): SuspectScore[] {
  if (!symptoms.length) return [];
  const baseline = symptoms.reduce((a, s) => a + severity(s), 0) / symptoms.length;
  const acc = new Map<string, { sum: number; n: number }>();
  for (const meal of meals) {
    const ids = new Set<string>();
    if (meal.ingredientId) ids.add(meal.ingredientId);
    const r = meal.recipeId ? catalog.recipes.get(meal.recipeId) : undefined;
    if (r) (meal.ibsVariant ? r.ibsVariant.ingredients : r.ingredients).forEach((it) => ids.add(it.i));
    const window = symptoms.filter((s) => s.at >= meal.loggedAt + 2 * H && s.at <= meal.loggedAt + 24 * H);
    if (!window.length) continue;
    const sev = Math.max(...window.map(severity));
    for (const id of ids) {
      const ing = catalog.ingredients.get(id);
      if (!ing || ['spice', 'condiment', 'oil'].includes(ing.category)) continue;
      const e = acc.get(id) ?? { sum: 0, n: 0 };
      e.sum += sev;
      e.n++;
      acc.set(id, e);
    }
  }
  return [...acc.entries()]
    .filter(([, e]) => e.n >= minExposures)
    .map(([id, e]) => ({
      ingredientId: id,
      name: catalog.ingredients.get(id)?.name ?? id,
      exposures: e.n,
      avgSeverity: Math.round((e.sum / e.n) * 10) / 10,
      score: Math.round((e.sum / e.n - baseline) * 10) / 10
    }))
    .sort((a, b) => b.score - a.score);
}

/** Daily max severity, keyed by date, for the heatmap. */
export function dailySeverity(symptoms: SymptomLog[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of symptoms) out[s.date] = Math.max(out[s.date] ?? 0, severity(s));
  return out;
}

/** A gentle one-line insight comparing bloating on days with vs. without the top suspect. */
export function dailyInsight(meals: MealLog[], symptoms: SymptomLog[], catalog: Catalog): string | null {
  const top = suspectScores(meals, symptoms, catalog).find((s) => s.score >= 1);
  if (top) {
    const cat = catalog.ingredients.get(top.ingredientId);
    return `Your symptoms averaged ${top.avgSeverity}/10 after meals with ${cat?.name.toLowerCase() ?? top.name} — about ${top.score} points above your usual. Worth a closer look.`;
  }
  const best = suspectScores(meals, symptoms, catalog).filter((s) => s.score <= -1).pop();
  if (best) return `Good news: days with ${best.name.toLowerCase()} tend to be calmer for your gut.`;
  return null;
}
