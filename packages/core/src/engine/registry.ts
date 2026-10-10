// Rules (hard) and scorers (soft) are plain registries (design §5.5).
// Adding behaviour = adding one object to an array; the pipeline never changes.
import type { Meal, Member, PlanEntry, Slot } from '../schema';
import { memberAffinity, type TasteProfile } from '../learning';
import { agree, daysBetween, listNames } from '../util';
import type { Vocabulary } from '../vocab';

export const defaultEngineConfig = {
  weights: { taste: 1.0, recency: 0.6, pantry: 0.4, timeFit: 0.3, spice: 0.3, dayBalance: 0.3, staple: 0.15 },
  fairness: 1.0, // λ: how hard one member's dislike drags a meal down
  shortlistSize: 10,
  backups: 3,
  recencyWindowDays: 14,
  ranker: { timeoutMs: { single: 8_000, batch: 25_000 } },
};
export type EngineConfig = typeof defaultEngineConfig;
export type ScorerId = keyof EngineConfig['weights'];

export interface TargetContext {
  date: string;
  slot: Slot;
  maxMinutes: number;
  excludeIds: Set<string>;
  members: Member[]; // active only
  profiles: Map<string, TasteProfile>;
  blockedMealIds: Set<string>;
  pantry: Set<string>;
  history: PlanEntry[]; // past + provisional picks
  vocab: Vocabulary;
  config: EngineConfig;
  meals: Map<string, Meal>;
}

export interface Rule {
  id: string;
  allows(meal: Meal, ctx: TargetContext): boolean;
}

export interface Scorer {
  id: ScorerId; // doubles as the weight key — no second mapping
  score(meal: Meal, ctx: TargetContext): number; // -1..1
  explain?(meal: Meal, ctx: TargetContext): string | undefined; // template reason for rules-only mode
}

// ---------------- Hard rules ----------------
const DIET_RANK = { veg: 0, egg: 1 } as const;

export const rules: Rule[] = [
  { id: 'slot', allows: (m, c) => m.slots.includes(c.slot) },
  { id: 'maxMinutes', allows: (m, c) => m.minutes <= c.maxMinutes },
  { id: 'blocked', allows: (m, c) => !c.blockedMealIds.has(m.id) },
  { id: 'exclude', allows: (m, c) => !c.excludeIds.has(m.id) },
  {
    // "Strictest member wins": intersection of allowed diets, union of excluded tags.
    id: 'memberHard',
    allows: (m, c) =>
      c.members.every((mem) => {
        const h = mem.hard;
        if (!h) return true;
        if (h.diets && !h.diets.some((d) => DIET_RANK[d] >= DIET_RANK[m.diet])) return false;
        if (h.excludeTags?.some((t) => c.vocab.tagsOf(m).has(t))) return false;
        return true;
      }),
  },
];

// ---------------- Soft scorers ----------------
export function householdTaste(meal: Meal, ctx: TargetContext) {
  const tags = ctx.vocab.tagsOf(meal);
  const per = ctx.members.map((m) => ({ id: m.id, a: memberAffinity(ctx.profiles.get(m.id), tags) }));
  if (!per.length) return { score: 0, per };
  const mean = per.reduce((s, p) => s + p.a, 0) / per.length;
  const worst = Math.min(...per.map((p) => p.a));
  // Please-everyone maths: one strong dislike pulls the meal down by λ on top of the average.
  return { score: Math.max(-1, mean - ctx.config.fairness * Math.max(0, -worst)), per };
}

const lastCooked = (meal: Meal, ctx: TargetContext) =>
  ctx.history.filter((h) => h.mealId === meal.id && h.date < ctx.date).map((h) => h.date).sort().pop();

const sameDay = (ctx: TargetContext) => ctx.history.filter((h) => h.date === ctx.date && h.slot !== ctx.slot);
const HEAVY = { light: 0, medium: 1, heavy: 2 } as const;

export const scorers: Scorer[] = [
  {
    id: 'taste',
    score: (m, c) => householdTaste(m, c).score,
    explain: (m, c) => {
      const { per } = householdTaste(m, c);
      const fans = per.filter((p) => p.a >= 0.3).map((p) => c.members.find((x) => x.id === p.id)!.name);
      if (fans.length) return `${listNames(fans)} ${agree(fans, 'likes', 'like')} it`;
      if (per.length && per.every((p) => p.a > -0.3)) return 'Nobody vetoes it';
      return undefined;
    },
  },
  {
    id: 'recency',
    score: (m, c) => {
      const last = lastCooked(m, c);
      if (!last) return 0.3;
      const d = daysBetween(last, c.date);
      return d >= c.config.recencyWindowDays ? 0.3 : -1 + (d / c.config.recencyWindowDays) * 1.3;
    },
  },
  {
    id: 'pantry',
    score: (m, c) => {
      const req = m.ingredients.filter((i) => !i.optional);
      if (!req.length || !c.pantry.size) return 0;
      return req.filter((i) => c.pantry.has(i.id)).length / req.length;
    },
    explain: (m, c) => {
      const have = m.ingredients.filter((i) => c.pantry.has(i.id)).map((i) => c.vocab.ingredient(i.id)?.label.toLowerCase());
      return have.length ? `uses the ${have.slice(0, 3).join(', ')} you have` : undefined;
    },
  },
  { id: 'timeFit', score: (m, c) => 1 - m.minutes / Math.max(c.maxMinutes, 1) }, // quicker within the limit scores higher
  { id: 'spice', score: (m) => [0.4, 0.4, -0.2, -0.8][m.spice] }, // "mild base, heat on the side"
  {
    id: 'dayBalance',
    score: (m, c) => {
      const others = sameDay(c).map((h) => c.meals.get(h.mealId)).filter(Boolean) as Meal[];
      if (!others.length) return 0;
      const heavyCount = others.filter((o) => o.heaviness === 'heavy').length;
      return heavyCount ? (HEAVY[m.heaviness] === 0 ? 0.6 : HEAVY[m.heaviness] === 2 ? -0.6 : 0) : 0;
    },
    explain: (m, c) =>
      m.heaviness === 'light' && sameDay(c).some((h) => c.meals.get(h.mealId)?.heaviness === 'heavy')
        ? "balances today's heavier meal"
        : undefined,
  },
  { id: 'staple', score: (m) => (m.staple ? 1 : 0) },
];
