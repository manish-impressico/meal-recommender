// The pure half of every user action (design §5.6). The app persists Effects atomically via one run().
import type { FeedbackEvent, HouseholdSettings, Member, PlanEntry, RejectReason, Slot, Source } from '../schema';

export type Command =
  | { type: 'cookThis'; date: string; slot: Slot; mealId: string; source: Source; reason?: string }
  | { type: 'notThis'; date: string; slot: Slot; mealId: string; memberIds: string[]; reason?: RejectReason }
  | { type: 'blockMeal'; mealId: string }
  | { type: 'acceptPlan'; entries: Omit<PlanEntry, 'updatedAt'>[] }
  | { type: 'swap'; date: string; slot: Slot; fromMealId: string; toMealId: string; reason?: string; source: Source }
  | { type: 'setTaste'; memberId: string; tagId: string; value: 'like' | 'dislike' | 'none' }
  | { type: 'upsertMember'; member: Member }
  | { type: 'removeMember'; memberId: string }
  | { type: 'updateSettings'; patch: Partial<HouseholdSettings> }
  | { type: 'setPantry'; ingredientIds: string[] };

export interface Effects {
  events?: FeedbackEvent[];
  plan?: PlanEntry[];
  members?: Member[];
  removeMemberIds?: string[];
  settings?: Partial<HouseholdSettings>;
  pantry?: string[];
}

export interface Deps { now: Date; newId: () => string }

export function decide(cmd: Command, d: Deps): Effects {
  const at = d.now.toISOString();
  const ev = <T extends Omit<FeedbackEvent, 'id' | 'at' | 'v'>>(e: T) => ({ ...e, id: d.newId(), at, v: 1 }) as unknown as FeedbackEvent;
  switch (cmd.type) {
    case 'cookThis':
      return {
        events: [ev({ type: 'meal.cooked', mealId: cmd.mealId, date: cmd.date, slot: cmd.slot })],
        plan: [{ date: cmd.date, slot: cmd.slot, mealId: cmd.mealId, status: 'cooked', source: cmd.source, reason: cmd.reason, updatedAt: at }],
      };
    case 'notThis':
      return { events: [ev({ type: 'meal.rejected', mealId: cmd.mealId, date: cmd.date, slot: cmd.slot, memberIds: cmd.memberIds, reason: cmd.reason })] };
    case 'blockMeal':
      return { events: [ev({ type: 'meal.blocked', mealId: cmd.mealId })] };
    case 'acceptPlan':
      return { plan: cmd.entries.map((e) => ({ ...e, updatedAt: at })) };
    case 'swap':
      return {
        events: [ev({ type: 'meal.swapped', fromMealId: cmd.fromMealId, toMealId: cmd.toMealId, date: cmd.date, slot: cmd.slot })],
        plan: [{ date: cmd.date, slot: cmd.slot, mealId: cmd.toMealId, status: 'planned', source: cmd.source, reason: cmd.reason, updatedAt: at }],
      };
    case 'setTaste':
      return { events: [ev({ type: 'taste.set', memberId: cmd.memberId, tagId: cmd.tagId, value: cmd.value })] };
    case 'upsertMember':
      return { members: [cmd.member] };
    case 'removeMember':
      return { removeMemberIds: [cmd.memberId] };
    case 'updateSettings':
      return { settings: cmd.patch };
    case 'setPantry':
      return { pantry: cmd.ingredientIds };
  }
}
