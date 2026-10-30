import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '@/db';
import { alive, mondayOf, today } from '@/db/repo';
import { engine, type SyncState } from '@/sync/engine';
import type { MealPlan } from '@/types';

export const useMealLogs = (date: string) =>
  useLiveQuery(async () => alive(await db.mealLogs.where('date').equals(date).toArray()).sort((a, b) => a.loggedAt - b.loggedAt), [date]) ?? [];

export const useAllMealLogs = () => useLiveQuery(async () => alive(await db.mealLogs.toArray()), []) ?? [];

export const useWater = (date: string) =>
  useLiveQuery(async () => alive(await db.waterLogs.where('date').equals(date).toArray()).reduce((a, w) => a + w.ml, 0), [date]) ?? 0;

export const useWeights = () => useLiveQuery(async () => alive(await db.weightLogs.toArray()).sort((a, b) => a.date.localeCompare(b.date)), []) ?? [];

export const useSymptoms = () => useLiveQuery(async () => alive(await db.symptomLogs.toArray()).sort((a, b) => a.at - b.at), []) ?? [];

export const useWorkouts = () => useLiveQuery(async () => alive(await db.workoutLogs.toArray()), []) ?? [];

export const useFavourites = () => useLiveQuery(async () => new Set(alive(await db.favourites.toArray()).map((f) => f.recipeId)), []) ?? new Set<string>();

export const useActiveFast = () =>
  useLiveQuery(async () => alive(await db.fastingSessions.toArray()).sort((a, b) => b.start - a.start)[0] ?? null, []);

/** The plan covering the current week (or the most recent non-template plan). */
export function useCurrentPlan(): MealPlan | null | undefined {
  return useLiveQuery(async () => {
    const plans = alive(await db.mealPlans.toArray()).filter((p) => !p.isTemplate);
    const week = mondayOf(today());
    return plans.find((p) => p.weekStart === week) ?? plans.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  }, []);
}

export const useTemplates = () => useLiveQuery(async () => alive(await db.mealPlans.toArray()).filter((p) => p.isTemplate), []) ?? [];

export function useSync() {
  const [s, set] = useState<{ state: SyncState; pending: number; lastSyncedAt: number | null }>({ state: 'local', pending: 0, lastSyncedAt: null });
  useEffect(() => {
    const unsub = engine.subscribe(set);
    return () => void unsub();
  }, []);
  return s;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}
