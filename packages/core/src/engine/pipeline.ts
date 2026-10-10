// The single read entry (design §6): Today, Week and Swap all call recommend().
// normalize → hard filter → soft score → shortlist → rank (port) → validate/repair/fallback → reconcile.
import { RankOutput, type Meal, type PlanEntry, type RecommendRequest, type RecommendResponse, type SlotResult, type Suggestion } from '../schema';
import { fromDto, verdict, memberAffinity } from '../learning';
import type { Vocabulary } from '../vocab';
import { byScoreThenId } from '../util';
import { defaultEngineConfig, rules, scorers, type EngineConfig, type TargetContext } from './registry';

export interface Candidate {
  id: string;
  name: string;
  tags: string[];
  minutes: number;
  kcal: number;
  spice: number;
  score: number;
  verdicts: Record<string, string>;
  why: string[]; // template reasons from scorers (used by rules ranker / repair)
}

export interface RankInput {
  members: { id: string; name: string }[];
  targets: { key: string; slot: string; date: string; candidates: Candidate[] }[];
}

/** The only async port in core. Returns unknown on purpose: output is validated, never trusted. */
export interface Ranker {
  name: 'ai' | 'rules';
  rank(input: RankInput, opts: { signal: AbortSignal }): Promise<unknown>;
}

export interface EngineDeps {
  meals: Meal[];
  vocab: Vocabulary;
  ranker: Ranker;
  config?: EngineConfig;
}

const reasonFrom = (why: string[]) => {
  if (!why.length) return 'A good fit for everyone today.';
  const s = why.slice(0, 2).join(', and it ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
};

/** Deterministic ranker: keeps score order, writes template reasons. Also the offline/fallback path. */
export const rulesRanker: Ranker = {
  name: 'rules',
  async rank(input) {
    return {
      targets: input.targets.map((t) => ({
        key: t.key,
        order: t.candidates.map((c) => c.id),
        reasons: Object.fromEntries(t.candidates.map((c) => [c.id, reasonFrom(c.why)])),
      })),
    };
  },
};

/** The model may only reorder ids it was given. Repair keeps valid ids, refills in score order. */
export function validateRank(raw: unknown, input: RankInput): { output: RankOutput; repaired: boolean } | null {
  const p = RankOutput.safeParse(raw);
  if (!p.success) return null;
  let repaired = false;
  const byKey = new Map(p.data.targets.map((t) => [t.key, t]));
  const targets = input.targets.map((t) => {
    const allowed = new Map(t.candidates.map((c) => [c.id, c]));
    const got = byKey.get(t.key);
    if (!got) repaired = true;
    const seen = new Set<string>();
    const order: string[] = [];
    for (const id of got?.order ?? []) {
      if (allowed.has(id) && !seen.has(id)) {
        order.push(id);
        seen.add(id);
      } else repaired = true;
    }
    for (const c of t.candidates) if (!seen.has(c.id)) order.push(c.id);
    const reasons: Record<string, string> = {};
    for (const id of order) {
      const r = got?.reasons?.[id];
      reasons[id] = typeof r === 'string' && r.trim() && r.length <= 160 ? r.trim() : reasonFrom(allowed.get(id)!.why);
    }
    return { key: t.key, order, reasons };
  });
  return { output: { targets }, repaired };
}

async function rankWithFallback(ranker: Ranker, input: RankInput, timeoutMs: number) {
  if (ranker.name === 'rules') return { out: validateRank(await rulesRanker.rank(input, { signal: new AbortController().signal }), input)!.output, source: 'rules' as const };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const raw = await ranker.rank(input, { signal: ac.signal });
    const v = validateRank(raw, input);
    if (v) return { out: v.output, source: 'ai' as const };
  } catch {
    /* fall through to deterministic ranking — failure degrades quality, never correctness */
  } finally {
    clearTimeout(timer);
  }
  return { out: validateRank(await rulesRanker.rank(input, { signal: ac.signal }), input)!.output, source: 'rules' as const };
}

export async function recommend(req: RecommendRequest, deps: EngineDeps): Promise<RecommendResponse> {
  const config = deps.config ?? defaultEngineConfig;
  const { context } = req;
  const mealMap = new Map(deps.meals.map((m) => [m.id, m]));
  const members = context.members.filter((m) => m.active);
  const profiles = new Map(Object.entries(context.profiles).map(([k, v]) => [k, fromDto(v)]));
  const blocked = new Set(context.blockedMealIds);
  const pantry = new Set(context.pantry);
  const provisional: PlanEntry[] = [...context.history];

  // 1–4: per target, slot by slot; each target's deterministic top pick becomes provisional day context.
  const perTarget = req.targets.map((t) => {
    const ctx: TargetContext = {
      date: t.date,
      slot: t.slot,
      maxMinutes: t.maxMinutes ?? context.settings.maxPrepMinutes,
      excludeIds: new Set(t.excludeIds ?? []),
      members,
      profiles,
      blockedMealIds: blocked,
      pantry,
      history: provisional,
      vocab: deps.vocab,
      config,
      meals: mealMap,
    };
    const eligible = deps.meals.filter((m) => rules.every((r) => r.allows(m, ctx)));
    const scored: Candidate[] = eligible
      .map((m) => {
        let score = 0;
        const why: string[] = [];
        for (const s of scorers) {
          score += config.weights[s.id] * s.score(m, ctx);
          const e = s.explain?.(m, ctx);
          if (e) why.push(e);
        }
        const tags = deps.vocab.tagsOf(m);
        const verdicts = Object.fromEntries(members.map((mem) => [mem.id, verdict(memberAffinity(profiles.get(mem.id), tags))]));
        return { id: m.id, name: m.name, tags: [...tags], minutes: m.minutes, kcal: m.kcal, spice: m.spice, score: +score.toFixed(3), verdicts, why };
      })
      .sort(byScoreThenId)
      .slice(0, config.shortlistSize);
    if (scored[0]) provisional.push({ date: t.date, slot: t.slot, mealId: scored[0].id, status: 'planned', source: 'rules', updatedAt: '' });
    return { target: t, key: `${t.date}|${t.slot}`, shortlist: scored };
  });

  // 5–6: one batched rank call for all targets, validated, with fallback.
  const input: RankInput = {
    members: members.map((m) => ({ id: m.id, name: m.name })),
    targets: perTarget.filter((p) => p.shortlist.length).map((p) => ({ key: p.key, slot: p.target.slot, date: p.target.date, candidates: p.shortlist })),
  };
  const timeout = req.targets.length > 1 ? config.ranker.timeoutMs.batch : config.ranker.timeoutMs.single;
  const { out, source } = input.targets.length
    ? await rankWithFallback(context.settings.aiEnabled ? deps.ranker : rulesRanker, input, timeout)
    : { out: { targets: [] }, source: 'rules' as const };
  const ranked = new Map(out.targets.map((t) => [t.key, t]));

  // 7: reconcile week — no meal twice across the request when noRepeatsInWeek.
  const used = new Set<string>();
  const results: SlotResult[] = perTarget.map((p) => {
    const r = ranked.get(p.key);
    const cand = new Map(p.shortlist.map((c) => [c.id, c]));
    const toSug = (id: string): Suggestion => ({ mealId: id, score: cand.get(id)!.score, reason: r?.reasons[id] ?? '', verdicts: cand.get(id)!.verdicts as Suggestion['verdicts'] });
    const order = (r?.order ?? []).filter((id) => !(context.settings.noRepeatsInWeek && req.targets.length > 1 && used.has(id)));
    if (!order.length) return { date: p.target.date, slot: p.target.slot, source, noEligible: true, pick: null, backups: [] };
    used.add(order[0]);
    const n = p.target.backups ?? config.backups;
    return { date: p.target.date, slot: p.target.slot, source, pick: toSug(order[0]), backups: order.slice(1, 1 + n).map(toSug) };
  });
  return { results };
}
