import { bmr, calorieMath, macroTargets, timeline } from './targets';

describe('targets', () => {
  it('computes Mifflin–St Jeor BMR', () => {
    expect(bmr('male', 80, 175, 30)).toBeCloseTo(1748.75);
    expect(bmr('female', 65, 160, 35)).toBeCloseTo(1314);
  });

  it('caps the weekly rate at 1% bodyweight and floors calories', () => {
    const m = calorieMath({ sex: 'female', weightKg: 60, heightCm: 155, age: 40, activity: 'sedentary', ratePct: 3 });
    expect(m.target).toBeGreaterThanOrEqual(1200);
    expect(m.clampedBy).not.toBe('none');
  });

  it('keto macros keep carbs ≤ 25 g and add up to calories', () => {
    const t = macroTargets('keto', 1800, 70);
    expect(t.carbs).toBeLessThanOrEqual(25);
    expect(t.protein * 4 + t.carbs * 4 + t.fat * 9).toBeCloseTo(1800, -1);
  });

  it('flags an unsafe target duration', () => {
    const plan = timeline(90, 70, 0.75, 60);
    expect(plan.achievable).toBe(false);
    expect(plan.requiredRatePct).toBeGreaterThan(1);
    expect(plan.points.at(-1)!.kg).toBeCloseTo(70, 0);
  });
});
