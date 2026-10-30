import type { UserProfile } from '@/types';
import { calorieMath, macroTargets } from './targets';

type Draft = Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'deviceId' | 'userId'>;

export function defaultProfile(): Draft {
  const base: Draft = {
    name: '',
    age: 30,
    sex: 'male',
    heightCm: 170,
    weightKg: 80,
    goalWeightKg: 70,
    activity: 'light',
    ratePct: 0.75,
    mealsPerDay: 3,
    cuisines: [],
    dislikes: [],
    allergies: [],
    cookingSkill: 'intermediate',
    minutesPerMeal: 40,
    budgetPerDay: 250,
    dietMode: 'hplc',
    ifProtocol: 'none',
    ifStartHour: 11,
    ibsType: 'unsure',
    fodmapPhase: 'elimination',
    triggers: [],
    allowSmallLentils: true,
    preferAirFryer: true,
    workoutDaysPerWeek: 3,
    workoutLevel: 'beginner',
    targets: { kcal: 1800, protein: 130, carbs: 90, fat: 80, fibre: 25 },
    targetsCustom: false,
    language: 'en',
    disclaimerAcceptedAt: null,
    onboarded: false
  };
  return { ...base, targets: computeTargets(base) };
}

export function computeTargets(p: Pick<UserProfile, 'sex' | 'weightKg' | 'heightCm' | 'age' | 'activity' | 'ratePct' | 'dietMode' | 'goalWeightKg' | 'targets'>) {
  const m = calorieMath(p);
  return macroTargets(p.dietMode, m.target, p.goalWeightKg, p.targets);
}
