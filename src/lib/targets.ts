import type { ActivityLevel, DietMode, IfProtocol, MacroTargets, Sex } from '@/types';

export const ACTIVITY: Record<ActivityLevel, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Sedentary', hint: 'Desk job, little walking' },
  light: { factor: 1.375, label: 'Lightly active', hint: '1–3 workouts or ~6k steps/day' },
  moderate: { factor: 1.55, label: 'Moderately active', hint: '3–5 workouts or ~9k steps/day' },
  active: { factor: 1.725, label: 'Very active', hint: '6–7 workouts or physical job' },
  'very-active': { factor: 1.9, label: 'Athlete', hint: 'Twice-a-day training' }
};

/** Mifflin–St Jeor basal metabolic rate (kcal/day). */
export function bmr(sex: Sex, kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function tdee(bmrKcal: number, activity: ActivityLevel): number {
  return bmrKcal * ACTIVITY[activity].factor;
}

export const KCAL_PER_KG_FAT = 7700;
export const MIN_RATE = 0.25;
export const MAX_RATE = 1; // % bodyweight per week — upper safe limit

export interface CalorieMath {
  bmr: number;
  tdee: number;
  rateKgPerWeek: number;
  dailyDeficit: number;
  target: number;
  floor: number;
  clampedBy: 'none' | 'floor' | 'max-deficit';
}

/** Calorie target from a weekly loss rate (% bodyweight), with safety clamps. */
export function calorieMath(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activity: ActivityLevel;
  ratePct: number;
}): CalorieMath {
  const b = bmr(input.sex, input.weightKg, input.heightCm, input.age);
  const t = tdee(b, input.activity);
  const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, input.ratePct));
  const rateKg = (rate / 100) * input.weightKg;
  let deficit = (rateKg * KCAL_PER_KG_FAT) / 7;
  let clampedBy: CalorieMath['clampedBy'] = 'none';
  const maxDeficit = t * 0.25;
  if (deficit > maxDeficit) {
    deficit = maxDeficit;
    clampedBy = 'max-deficit';
  }
  const floor = input.sex === 'male' ? 1500 : 1200;
  let target = t - deficit;
  if (target < floor) {
    target = floor;
    clampedBy = 'floor';
  }
  return {
    bmr: Math.round(b),
    tdee: Math.round(t),
    rateKgPerWeek: Math.round(((t - target) * 7 * 100) / KCAL_PER_KG_FAT) / 100,
    dailyDeficit: Math.round(t - target),
    target: Math.round(target / 10) * 10,
    floor,
    clampedBy
  };
}

export const DIET_MODES: Record<DietMode, { label: string; blurb: string; split?: { p: number; c: number; f: number } }> = {
  keto: { label: 'Keto', blurb: '≤ 25 g net carbs, moderate protein, high fat', split: { p: 25, c: 7, f: 68 } },
  hplc: { label: 'High-Protein Low-Carb', blurb: 'Protein-forward with modest carbs — easiest to sustain', split: { p: 38, c: 20, f: 42 } },
  balanced: { label: 'Balanced Fat Loss', blurb: '30 / 40 / 30 with rice or roti every day', split: { p: 30, c: 40, f: 30 } },
  custom: { label: 'Custom', blurb: 'Set your own calories and macros' }
};

/** Default macros (g) for a diet mode at a calorie target. Protein floor 1.4 g/kg goal weight (cap 2.2). */
export function macroTargets(mode: DietMode, kcal: number, goalWeightKg: number, current?: MacroTargets): MacroTargets {
  const fibre = Math.max(25, Math.round((kcal / 1000) * 14));
  if (mode === 'custom' && current) return { ...current, kcal };
  const split = DIET_MODES[mode].split ?? DIET_MODES.balanced.split!;
  let protein = (kcal * split.p) / 100 / 4;
  protein = Math.min(Math.max(protein, goalWeightKg * 1.4), goalWeightKg * 2.2);
  let carbs = (kcal * split.c) / 100 / 4;
  if (mode === 'keto') carbs = Math.min(carbs, 25);
  const fat = Math.max(0, (kcal - protein * 4 - carbs * 4) / 9);
  return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), fibre };
}

export const waterTargetMl = (kg: number) => Math.round((kg * 35) / 250) * 250;

/* --------------------------------------------------------------- fat-loss timeline */

export interface TimelinePoint {
  week: number;
  kg: number;
}

export interface TimelinePlan {
  weeks: number;
  days: number;
  points: TimelinePoint[];
  /** Rate needed to hit targetDays (% bw/week), if one was set. */
  requiredRatePct?: number;
  achievable: boolean;
  phases: { name: string; fromWeek: number; toWeek: number; note: string }[];
  dietBreaks: number[];
}

/** Projects weight week by week at a constant % rate, with planned diet breaks every 10 weeks. */
export function timeline(weightKg: number, goalKg: number, ratePct: number, targetDays?: number): TimelinePlan {
  const toLose = Math.max(0, weightKg - goalKg);
  let requiredRatePct: number | undefined;
  let achievable = true;
  if (targetDays && toLose > 0) {
    const weeks = targetDays / 7;
    requiredRatePct = Math.round(((toLose / weeks / weightKg) * 100) * 100) / 100;
    achievable = requiredRatePct <= MAX_RATE;
  }
  const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, ratePct)) / 100;
  const points: TimelinePoint[] = [{ week: 0, kg: weightKg }];
  const dietBreaks: number[] = [];
  let kg = weightKg;
  let week = 0;
  let sinceBreak = 0;
  while (kg > goalKg + 0.05 && week < 260) {
    week++;
    sinceBreak++;
    if (sinceBreak > 10) {
      dietBreaks.push(week); // maintenance week
      sinceBreak = 0;
    } else {
      kg = Math.max(goalKg, kg - kg * rate);
    }
    points.push({ week, kg: Math.round(kg * 10) / 10 });
  }
  const third = Math.max(1, Math.round(week / 3));
  const phases = toLose
    ? [
        { name: 'Kick-off', fromWeek: 0, toWeek: Math.min(week, 2), note: 'Water + glycogen drop; build habits, nail protein and steps.' },
        { name: 'Steady loss', fromWeek: Math.min(week, 2), toWeek: Math.max(2, week - third), note: 'Consistent ~0.5–1% per week. Lift 3×/week to keep muscle.' },
        { name: 'Final stretch', fromWeek: Math.max(2, week - third), toWeek: week, note: 'Recalculate targets every 2–3 kg; use diet breaks if hunger spikes.' },
        { name: 'Maintenance', fromWeek: week, toWeek: week + 4, note: 'Add back ~200 kcal/week until weight is stable.' }
      ]
    : [];
  return { weeks: week, days: week * 7, points, requiredRatePct, achievable, phases, dietBreaks };
}

/* --------------------------------------------------------------- intermittent fasting */

export const IF_PROTOCOLS: Record<IfProtocol, { label: string; fastH: number; eatH: number; note: string }> = {
  none: { label: 'No fasting', fastH: 0, eatH: 24, note: 'Regular meal timing.' },
  '12:12': { label: '12:12 Circadian', fastH: 12, eatH: 12, note: 'Gentle starter: dinner by 8 pm, breakfast at 8 am.' },
  '14:10': { label: '14:10', fastH: 14, eatH: 10, note: 'A good IBS-friendly step up.' },
  '16:8': { label: '16:8 Lean-gains', fastH: 16, eatH: 8, note: 'Most popular. Two to three meals within 8 hours.' },
  '18:6': { label: '18:6', fastH: 18, eatH: 6, note: 'Advanced. Two meals; keep protein high.' },
  omad: { label: 'OMAD', fastH: 23, eatH: 1, note: 'One meal a day — hard to meet protein/fibre; not advised with IBS flares.' }
};

/** Suggested meals per day for a fasting protocol. */
export function mealsForProtocol(p: IfProtocol, preferred: number): number {
  if (p === 'omad') return 1;
  if (p === '18:6') return Math.min(preferred, 2);
  if (p === '16:8') return Math.min(preferred, 3);
  return preferred;
}

export function bmi(kg: number, cm: number) {
  const v = kg / (cm / 100) ** 2;
  // Asian-Indian cut-offs (WHO expert consultation / ICMR)
  const cls = v < 18.5 ? 'Underweight' : v < 23 ? 'Normal' : v < 25 ? 'Overweight' : 'Obese';
  return { value: Math.round(v * 10) / 10, cls };
}
