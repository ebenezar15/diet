import type { Exercise, UserProfile } from '@/types';

export const kcalBurned = (met: number, kg: number, minutes: number) => Math.round((met * 3.5 * kg * minutes) / 200);

export interface WorkoutDay {
  day: string;
  title: string;
  focus: 'strength' | 'cardio' | 'recovery';
  items: { id: string; prescription: string }[];
  minutes: number;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Weekly plan: full-body strength 2–3×, cardio/NEAT on other days, daily IBS-relief routine. */
export function weeklyWorkout(p: Pick<UserProfile, 'workoutDaysPerWeek' | 'workoutLevel' | 'ibsType'>, all: Exercise[]): WorkoutDay[] {
  const lvl = p.workoutLevel;
  const has = (id: string) => all.some((e) => e.id === id);
  const pickIds = (ids: string[]) => ids.filter(has);
  const strengthA = pickIds(lvl === 'beginner' ? ['squat', 'incline-pushup', 'band-row', 'glute-bridge', 'dead-bug'] : ['goblet-squat', 'pushup', 'db-row', 'rdl', 'plank']);
  const strengthB = pickIds(lvl === 'beginner' ? ['lunge', 'pushup', 'glute-bridge', 'chair-dip', 'dead-bug'] : ['lunge', 'db-press', 'db-row', 'chair-dip', 'side-plank']);
  const cardio = pickIds(lvl === 'advanced' && p.ibsType !== 'IBS-D' ? ['hiit-circuit', 'brisk-walk'] : lvl === 'intermediate' ? ['surya-namaskar', 'cycling'] : ['brisk-walk', 'surya-namaskar']);
  const relief = pickIds(['cat-cow', 'pawanmuktasana', 'supine-twist', 'belly-breathing']);
  const n = Math.min(6, Math.max(2, p.workoutDaysPerWeek));
  const pattern: WorkoutDay['focus'][] =
    n <= 2 ? ['strength', 'recovery', 'recovery', 'strength', 'recovery', 'recovery', 'recovery']
    : n === 3 ? ['strength', 'recovery', 'strength', 'recovery', 'strength', 'cardio', 'recovery']
    : n === 4 ? ['strength', 'cardio', 'strength', 'recovery', 'strength', 'cardio', 'recovery']
    : n === 5 ? ['strength', 'cardio', 'strength', 'cardio', 'strength', 'cardio', 'recovery']
    : ['strength', 'cardio', 'strength', 'cardio', 'strength', 'cardio', 'cardio'];
  const sets = lvl === 'beginner' ? 2 : 3;
  let s = 0;
  return pattern.map((focus, i) => {
    if (focus === 'strength') {
      const list = s++ % 2 === 0 ? strengthA : strengthB;
      const items = list.map((id) => {
        const e = all.find((x) => x.id === id)!;
        return { id, prescription: `${sets} × ${e.reps ?? '10'}` };
      });
      return { day: DAYS[i], title: `Full body ${s % 2 ? 'A' : 'B'}`, focus, items: [...items, { id: 'post-meal-walk', prescription: '10 min after dinner' }], minutes: 35 };
    }
    if (focus === 'cardio') {
      return { day: DAYS[i], title: 'Cardio & steps', focus, items: cardio.map((id) => ({ id, prescription: id === 'surya-namaskar' ? '8 rounds' : '25–30 min' })), minutes: 35 };
    }
    return { day: DAYS[i], title: 'Recovery & gut care', focus, items: [...relief.map((id) => ({ id, prescription: '2–5 min' })), { id: 'brisk-walk', prescription: '20 min easy' }], minutes: 30 };
  });
}
