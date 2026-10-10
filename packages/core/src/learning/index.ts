// Events are the source of truth; taste profiles are projections (design §5.4).
// Changing the maths here never loses data — history simply replays.
import type { FeedbackEvent, Meal, Member, TasteProfileDto, Verdict } from '../schema';
import { clamp, daysBetween } from '../util';
import type { Vocabulary } from '../vocab';

export const defaultLearningConfig = {
  explicitLike: 0.8,
  cookedDelta: 0.1,
  rejectedDelta: -0.25,
  halfLifeDays: 45,
  verdict: { likes: 0.3, dislikes: -0.3 },
};
export type LearningConfig = typeof defaultLearningConfig;

export type TasteProfile = { affinity: Map<string, number>; disliked: Set<string> };

export interface HouseholdProjection {
  profiles: Map<string, TasteProfile>;
  blockedMealIds: Set<string>;
}

export function projectHousehold(
  events: FeedbackEvent[],
  members: Member[],
  meals: Map<string, Meal>,
  vocab: Vocabulary,
  today: string,
  cfg: LearningConfig = defaultLearningConfig,
): HouseholdProjection {
  const explicit = new Map<string, Map<string, 'like' | 'dislike'>>();
  const implicit = new Map<string, Map<string, number>>();
  const blocked = new Set<string>();
  const active = members.filter((m) => m.active).map((m) => m.id);
  const bump = (memberId: string, tag: string, d: number) => {
    const m = implicit.get(memberId) ?? new Map();
    m.set(tag, (m.get(tag) ?? 0) + d);
    implicit.set(memberId, m);
  };
  const decay = (at: string) => Math.pow(0.5, Math.max(0, daysBetween(at.slice(0, 10), today)) / cfg.halfLifeDays);

  const sorted = [...events].sort((a, b) => (a.at < b.at ? -1 : 1)); // latest explicit value wins
  for (const e of sorted) {
    switch (e.type) {
      case 'taste.set': {
        const m = explicit.get(e.memberId) ?? new Map();
        if (e.value === 'none') m.delete(e.tagId);
        else m.set(e.tagId, e.value);
        explicit.set(e.memberId, m);
        break;
      }
      case 'meal.cooked': {
        const meal = meals.get(e.mealId);
        if (!meal) break;
        for (const t of vocab.tagsOf(meal)) for (const id of active) bump(id, t, cfg.cookedDelta * decay(e.at));
        break;
      }
      case 'meal.rejected': {
        // Reason-only rejections carry no taste signal in v1 (recency/time are handled by scorers).
        const meal = meals.get(e.mealId);
        if (!meal) break;
        for (const t of vocab.tagsOf(meal)) for (const id of e.memberIds) bump(id, t, cfg.rejectedDelta * decay(e.at));
        break;
      }
      case 'meal.blocked':
        blocked.add(e.mealId);
        break;
      case 'meal.swapped':
        break;
    }
  }

  const profiles = new Map<string, TasteProfile>();
  for (const m of members) {
    const affinity = new Map<string, number>();
    const disliked = new Set<string>();
    for (const [t, d] of implicit.get(m.id) ?? []) affinity.set(t, d);
    for (const [t, v] of explicit.get(m.id) ?? []) {
      if (v === 'dislike') disliked.add(t);
      else affinity.set(t, (affinity.get(t) ?? 0) + cfg.explicitLike);
    }
    for (const [t, a] of affinity) affinity.set(t, clamp(a));
    profiles.set(m.id, { affinity, disliked });
  }
  return { profiles, blockedMealIds: blocked };
}

/** -1..1. A disliked tag forces -1: heavy penalty, not exclusion (settled default). */
export function memberAffinity(p: TasteProfile | undefined, tags: Set<string>): number {
  if (!p) return 0;
  let sum = 0;
  let n = 0;
  for (const t of tags) {
    if (p.disliked.has(t)) return -1;
    const a = p.affinity.get(t);
    if (a !== undefined) {
      sum += a;
      n++;
    }
  }
  return n ? clamp(sum / Math.sqrt(n * tags.size)) : 0; // tags with no opinion dilute gently
}

export function verdict(a: number, cfg = defaultLearningConfig.verdict): Verdict {
  return a >= cfg.likes ? 'likes' : a <= cfg.dislikes ? 'dislikes' : 'okay';
}

// DTO round-trip: profiles are computed on the client and sent derived to the server.
export const toDto = (p: TasteProfile): TasteProfileDto => ({ affinity: Object.fromEntries(p.affinity), disliked: [...p.disliked] });
export const fromDto = (d: TasteProfileDto): TasteProfile => ({ affinity: new Map(Object.entries(d.affinity)), disliked: new Set(d.disliked) });

export type VerdictSummary = { likes: Member[]; okay: Member[]; dislikes: Member[]; everyoneHappy: boolean };

/** Domain rule for "who's happy with this meal". Presentation wording lives in the web layer. */
export function summarizeVerdicts(verdicts: Record<string, Verdict>, members: Member[]): VerdictSummary {
  const out: VerdictSummary = { likes: [], okay: [], dislikes: [], everyoneHappy: false };
  for (const m of members.filter((x) => x.active)) out[verdicts[m.id] ?? 'okay'].push(m);
  out.everyoneHappy = out.dislikes.length === 0 && out.likes.length >= 2;
  return out;
}
