import type { MealPlan, PlannedMeal, PlanSettings, UserProfile } from '@/types';
import { create, update, mondayOf, today } from '@/db/repo';
import type { Catalog } from './catalog';
import type { FodmapContext } from './fodmap';
import { generatePlan } from './planner';
import { mealsForProtocol } from './targets';

export function settingsFromProfile(p: UserProfile, over: Partial<PlanSettings> = {}): PlanSettings {
  return {
    dietMode: p.dietMode,
    phase: p.fodmapPhase,
    targets: p.targets,
    mealsPerDay: mealsForProtocol(p.ifProtocol, p.mealsPerDay),
    cuisines: p.cuisines,
    dislikes: [...p.dislikes, ...p.allergies],
    budgetPerDay: p.budgetPerDay,
    maxMinutes: p.minutesPerMeal,
    people: 1,
    leftovers: true,
    batchCook: false,
    airFryerBias: p.preferAirFryer,
    seed: Math.floor(Math.random() * 1e6),
    ...over
  };
}

export async function generateAndSave(opts: {
  profile: UserProfile;
  catalog: Catalog;
  ctx: FodmapContext;
  ibs: boolean;
  settings: PlanSettings;
  existing?: MealPlan | null;
}) {
  const res = generatePlan({ catalog: opts.catalog, settings: opts.settings, ctx: opts.ctx, ibs: opts.ibs, previous: opts.existing?.days });
  if (opts.existing) {
    await update<MealPlan>('mealPlans', opts.existing.id, { days: res.days, settings: opts.settings, people: opts.settings.people });
  } else {
    await create<MealPlan>('mealPlans', {
      name: `Week of ${mondayOf(today())}`,
      weekStart: mondayOf(today()),
      days: res.days,
      people: opts.settings.people,
      isTemplate: false,
      settings: opts.settings
    });
  }
  return res;
}

export const dayIndex = (weekStart: string, date = today()) => {
  const d = Math.round((new Date(date + 'T00:00:00').getTime() - new Date(weekStart + 'T00:00:00').getTime()) / 86400000);
  return ((d % 7) + 7) % 7;
};

export function setMealStatus(plan: MealPlan, day: number, key: string, status: PlannedMeal['status']) {
  const days = plan.days.map((d, i) => (i === day ? d.map((m) => (m.key === key ? { ...m, status } : m)) : d));
  return update<MealPlan>('mealPlans', plan.id, { days });
}
