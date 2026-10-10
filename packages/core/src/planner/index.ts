// Planner = thin wrappers that build targets; all decisions stay in recommend() (DRY, design §5.6).
import type { PlanEntry, RecommendRequest, Slot, Target } from '../schema';
import { addDays } from '../util';

export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Targets for every enabled slot of the week, skipping cooked or manually chosen entries. */
export function planWeekTargets(start: string, slots: Slot[], existing: PlanEntry[]): Target[] {
  const keep = new Set(existing.filter((e) => e.status === 'cooked' || e.source === 'manual').map((e) => `${e.date}|${e.slot}`));
  return weekDates(start).flatMap((date) => slots.filter((slot) => !keep.has(`${date}|${slot}`)).map((slot) => ({ date, slot })));
}

/** Swap = one target, the rest of the week excluded, more backups. */
export function swapTarget(entry: PlanEntry, week: PlanEntry[], backups = 6): Target {
  return { date: entry.date, slot: entry.slot, excludeIds: week.map((w) => w.mealId), backups };
}

export const withTargets = (base: Omit<RecommendRequest, 'targets'>, targets: Target[]): RecommendRequest => ({ ...base, targets });
