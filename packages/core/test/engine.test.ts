import { describe, expect, it } from 'vitest';
import catalogRaw from '../../../apps/web/src/content/catalog.json';
import vocabRaw from '../../../apps/web/src/content/vocab.json';
import {
  createVocabulary, validateCatalog, recommend, rulesRanker, validateRank, projectHousehold, toDto, decide,
  buildGroceryList, planWeekTargets, HouseholdSettings, type Member, type RecommendRequest, type Ranker, type FeedbackEvent,
} from '../src';

const vocab = createVocabulary(vocabRaw);
const v = validateCatalog(catalogRaw, vocab);
if (!v.ok) throw new Error(JSON.stringify(v.error));
const meals = v.value;
const mealMap = new Map(meals.map((m) => [m.id, m]));
const members: Member[] = [
  { id: 'a', name: 'Manish', color: '#1f7a4d', active: true },
  { id: 'b', name: 'Wife', color: '#5b6b61', active: true },
  { id: 'c', name: 'Son', color: '#7a4a00', active: true },
  { id: 'd', name: 'Daughter', color: '#8c1d18', active: true },
];
let n = 0;
const ev = (e: object) => ({ id: `e${n++}`, at: '2026-10-01T10:00:00Z', v: 1, ...e }) as FeedbackEvent;
const events: FeedbackEvent[] = [
  ev({ type: 'taste.set', memberId: 'd', tagId: 'spicy-gravy', value: 'dislike' }),
  ev({ type: 'taste.set', memberId: 'd', tagId: 'spinach', value: 'dislike' }),
  ev({ type: 'taste.set', memberId: 'c', tagId: 'egg', value: 'like' }),
  ev({ type: 'taste.set', memberId: 'a', tagId: 'rajma', value: 'like' }),
];
const proj = projectHousehold(events, members, mealMap, vocab, '2026-10-10');
const req = (targets: RecommendRequest['targets'], over: Partial<RecommendRequest['context']> = {}): RecommendRequest => ({
  targets,
  context: {
    members, settings: HouseholdSettings.parse({}), history: [], pantry: ['eggs', 'tomato', 'onion'],
    profiles: Object.fromEntries([...proj.profiles].map(([k, p]) => [k, toDto(p)])), blockedMealIds: [...proj.blockedMealIds], ...over,
  },
});
const deps = { meals, vocab, ranker: rulesRanker };

describe('catalog', () => {
  it('every tag and ingredient resolves against the vocabulary', () => expect(v.ok).toBe(true));
});

describe('recommend', () => {
  it('returns a dinner pick that respects the slot rule', async () => {
    const r = await recommend(req([{ date: '2026-10-10', slot: 'dinner' }]), deps);
    const pick = mealMap.get(r.results[0].pick!.mealId)!;
    expect(pick.slots).toContain('dinner');
    expect(r.results[0].backups.length).toBe(3);
  });

  it('never returns excluded, blocked or too-slow meals', async () => {
    const r = await recommend(req([{ date: '2026-10-10', slot: 'dinner', maxMinutes: 30, excludeIds: ['egg-fried-rice'] }], { blockedMealIds: ['veg-hakka-noodles'] }), deps);
    for (const s of [r.results[0].pick!, ...r.results[0].backups]) {
      expect(mealMap.get(s.mealId)!.minutes).toBeLessThanOrEqual(30);
      expect(['egg-fried-rice', 'veg-hakka-noodles']).not.toContain(s.mealId);
    }
  });

  it("a member's dislike is a heavy penalty: disliked meals don't win", async () => {
    const r = await recommend(req([{ date: '2026-10-10', slot: 'dinner' }]), deps);
    expect(r.results[0].pick!.verdicts.d).not.toBe('dislikes');
  });

  it('week mode never repeats a meal', async () => {
    const targets = planWeekTargets('2026-10-10', ['breakfast', 'lunch', 'snack', 'dinner'], []);
    const r = await recommend(req(targets), deps);
    const ids = r.results.filter((x) => x.pick).map((x) => x.pick!.mealId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.results.length).toBe(28);
  });

  it('falls back to rules when the AI ranker throws, and repairs bad output', async () => {
    const boom: Ranker = { name: 'ai', rank: async () => { throw new Error('down'); } };
    const r = await recommend(req([{ date: '2026-10-10', slot: 'lunch' }]), { ...deps, ranker: boom });
    expect(r.results[0].source).toBe('rules');
    const bad: Ranker = { name: 'ai', rank: async (i) => ({ targets: [{ key: i.targets[0].key, order: ['made-up', i.targets[0].candidates[3].id], reasons: {} }] }) };
    const r2 = await recommend(req([{ date: '2026-10-10', slot: 'lunch' }]), { ...deps, ranker: bad });
    expect(r2.results[0].source).toBe('ai');
    expect(mealMap.has(r2.results[0].pick!.mealId)).toBe(true);
    expect(validateRank('garbage', { members: [], targets: [] })).toBeNull();
  });
});

describe('commands + grocery', () => {
  it('cookThis emits an event and a cooked plan entry', () => {
    const e = decide({ type: 'cookThis', date: '2026-10-10', slot: 'dinner', mealId: 'rajma-chawal', source: 'rules' }, { now: new Date(), newId: () => 'x' });
    expect(e.events?.[0].type).toBe('meal.cooked');
    expect(e.plan?.[0].status).toBe('cooked');
  });
  it('aggregates quantities across meals and marks pantry items', () => {
    const plan = ['rajma-chawal', 'chole-jeera-rice'].map((mealId) => ({ date: '2026-10-10', slot: 'lunch' as const, mealId, status: 'planned' as const, source: 'rules' as const, updatedAt: '' }));
    const g = buildGroceryList(plan, mealMap, vocab, { servings: 4, pantry: new Set(['onion']) });
    const rice = g.flatMap((x) => x.lines).find((l) => l.ingredientId === 'rice')!;
    expect(rice.qty).toBe(650); // 80*4*2 = 640 → rounded up to 650
    expect(g.flatMap((x) => x.lines).find((l) => l.ingredientId === 'onion')!.inPantry).toBe(true);
  });
});
