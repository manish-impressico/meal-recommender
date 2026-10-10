'use client';
// Data layer seam (design §7). POC persists to localStorage; swapping to Dexie/IndexedDB changes only this file.
// Single write path: run(command) → core decide() → applyEffects() → save → notify (SESE for writes).
import { useMemo, useSyncExternalStore } from 'react';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  decide, FeedbackEvent, HouseholdSettings, Member, PlanEntry, planKey, projectHousehold, toDto, toISODate,
  type Command, type Effects, type RecommendRequest,
} from '@meal/core';
import { mealById, vocab } from '@/content';

const KEY = 'meal-recommender:v1';
const AppData = z.object({
  schemaVersion: z.literal(1),
  members: z.array(Member),
  settings: HouseholdSettings,
  plan: z.record(z.string(), PlanEntry),
  events: z.array(FeedbackEvent),
  pantry: z.array(z.string()),
});
export type AppData = z.infer<typeof AppData>;

const empty = (): AppData => ({ schemaVersion: 1, members: [], settings: HouseholdSettings.parse({}), plan: {}, events: [], pantry: [] });

let cache: AppData | null = null;
const listeners = new Set<() => void>();

function load(): AppData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? AppData.safeParse(JSON.parse(raw)) : null;
    cache = p?.success ? p.data : empty();
  } catch {
    cache = empty(); // storage blocked or corrupt → app still works for the session
  }
  return cache;
}

function save(next: AppData) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* best effort */ }
  listeners.forEach((l) => l());
}

function applyEffects(d: AppData, e: Effects): AppData {
  const next: AppData = { ...d, plan: { ...d.plan }, events: [...d.events], members: [...d.members] };
  if (e.events) next.events.push(...e.events);
  for (const p of e.plan ?? []) next.plan[planKey(p.date, p.slot)] = p;
  for (const m of e.members ?? []) {
    const i = next.members.findIndex((x) => x.id === m.id);
    if (i >= 0) next.members[i] = m; else next.members.push(m);
  }
  if (e.removeMemberIds) next.members = next.members.filter((m) => !e.removeMemberIds!.includes(m.id));
  if (e.settings) next.settings = { ...next.settings, ...e.settings };
  if (e.pantry) next.pantry = e.pantry;
  return next;
}

export function run(...cmds: Command[]) {
  let d = load();
  for (const c of cmds) d = applyEffects(d, decide(c, { now: new Date(), newId: () => nanoid() }));
  save(d);
}

export function resetAll() { save(empty()); }
export function exportBackup(): string { return JSON.stringify({ app: 'meal-recommender', exportedAt: new Date().toISOString(), data: load() }, null, 1); }
export function importBackup(text: string): boolean {
  const p = AppData.safeParse(JSON.parse(text)?.data);
  if (p.success) save(p.data);
  return p.success;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
/** null during SSR / before hydration — views render a skeleton. */
export function useAppData(): AppData | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

/** Taste profiles are a projection over events, recomputed when events change. */
export function useProjection(d: AppData | null) {
  return useMemo(() => (d ? projectHousehold(d.events, d.members, mealById, vocab, toISODate(new Date())) : null), [d?.events, d?.members]);
}

/** Builds the request context the engine needs — one function, used by every screen (DRY). */
export function buildContext(d: AppData, proj: NonNullable<ReturnType<typeof useProjection>>): RecommendRequest['context'] {
  return {
    members: d.members,
    settings: d.settings,
    profiles: Object.fromEntries([...proj.profiles].map(([k, p]) => [k, toDto(p)])),
    blockedMealIds: [...proj.blockedMealIds],
    pantry: d.pantry,
    history: Object.values(d.plan),
  };
}
