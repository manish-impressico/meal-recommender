// Single contract layer (design §5.2): every record, payload and LLM output is defined once here.
// Types are inferred from the schemas — never hand-written twice (DRY).
import { z } from 'zod';

export const Slot = z.enum(['breakfast', 'lunch', 'snack', 'dinner']); // new slot = one enum edit
export type Slot = z.infer<typeof Slot>;
export const SLOTS = Slot.options;

export const Diet = z.enum(['veg', 'egg']); // 'nonveg' later = one enum edit
export type Diet = z.infer<typeof Diet>;

// ---------- Vocabulary (one vocabulary for chips, catalog, pantry, grocery) ----------
export const Unit = z.enum(['g', 'ml', 'pcs']);
export type Unit = z.infer<typeof Unit>;

export const Tag = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['dish', 'cuisine', 'trait', 'ingredient']),
  chip: z.boolean().default(false), // shown as a taste chip in onboarding / Family
});
export type Tag = z.infer<typeof Tag>;

export const Ingredient = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string(),
  unit: Unit,
  tag: z.string().optional(), // maps ingredient → taste tag (e.g. spinach)
  pantry: z.boolean().default(false), // offered in the "what's at home" sheet
});
export type Ingredient = z.infer<typeof Ingredient>;

export const VocabData = z.object({
  tags: z.array(Tag),
  ingredients: z.array(Ingredient),
  categories: z.array(z.object({ id: z.string(), label: z.string() })),
});
export type VocabData = z.infer<typeof VocabData>;

// ---------- Catalog ----------
export const Meal = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), // stable slug: all history keys onto it
  name: z.string().min(2),
  slots: z.array(Slot).min(1),
  diet: Diet,
  minutes: z.number().int().positive(),
  kcal: z.number().int().positive(), // approx per serving
  spice: z.number().int().min(0).max(3), // soft-scored, never filtered
  heaviness: z.enum(['light', 'medium', 'heavy']),
  cuisine: z.string(),
  tags: z.array(z.string()).default([]),
  ingredients: z.array(
    z.object({ id: z.string(), qtyPerServing: z.number().positive(), optional: z.boolean().default(false) }),
  ),
  staple: z.boolean().default(false), // cold-start prior
});
export type Meal = z.infer<typeof Meal>;

// ---------- Household ----------
export const Member = z.object({
  id: z.string(),
  name: z.string().min(1).max(30),
  color: z.string().default('#5b6b61'),
  active: z.boolean().default(true),
  hard: z.object({ diets: z.array(Diet).optional(), excludeTags: z.array(z.string()).optional() }).optional(),
});
export type Member = z.infer<typeof Member>;

export const HouseholdSettings = z.object({
  enabledSlots: z.array(Slot).default(['breakfast', 'lunch', 'snack', 'dinner']),
  maxPrepMinutes: z.number().int().positive().default(45),
  weekStartsOn: z.number().int().min(0).max(6).default(6),
  aiEnabled: z.boolean().default(true),
  noRepeatsInWeek: z.boolean().default(true),
  onboarded: z.boolean().default(false),
  showDebug: z.boolean().default(false), // shows AI/rules source on cards; off for end users
});
export type HouseholdSettings = z.infer<typeof HouseholdSettings>;

// ---------- Plan (atomic unit: (date, slot)) ----------
export const Source = z.enum(['ai', 'rules', 'manual']);
export type Source = z.infer<typeof Source>;
export const PlanEntry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: Slot,
  mealId: z.string(),
  status: z.enum(['planned', 'cooked', 'skipped']),
  source: Source,
  reason: z.string().optional(),
  updatedAt: z.string(),
});
export type PlanEntry = z.infer<typeof PlanEntry>;
export const planKey = (date: string, slot: Slot) => `${date}|${slot}`;

// ---------- Feedback events (append-only source of truth) ----------
export const RejectReason = z.enum(['recent', 'heavy', 'no-time', 'missing-ingredient']);
export type RejectReason = z.infer<typeof RejectReason>;
const base = { id: z.string(), at: z.string(), v: z.literal(1).default(1) };
export const FeedbackEvent = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('taste.set'), memberId: z.string(), tagId: z.string(), value: z.enum(['like', 'dislike', 'none']) }),
  z.object({ ...base, type: z.literal('meal.cooked'), mealId: z.string(), date: z.string(), slot: Slot }),
  z.object({ ...base, type: z.literal('meal.rejected'), mealId: z.string(), date: z.string(), slot: Slot, memberIds: z.array(z.string()), reason: RejectReason.optional() }),
  z.object({ ...base, type: z.literal('meal.blocked'), mealId: z.string() }),
  z.object({ ...base, type: z.literal('meal.swapped'), fromMealId: z.string(), toMealId: z.string(), date: z.string(), slot: Slot }),
]);
export type FeedbackEvent = z.infer<typeof FeedbackEvent>;

// ---------- Recommend API ----------
export const TasteProfileDto = z.object({ affinity: z.record(z.string(), z.number()), disliked: z.array(z.string()) });
export type TasteProfileDto = z.infer<typeof TasteProfileDto>;

export const Target = z.object({
  date: z.string(),
  slot: Slot,
  maxMinutes: z.number().int().positive().optional(),
  excludeIds: z.array(z.string()).optional(),
  backups: z.number().int().min(0).max(10).optional(),
});
export type Target = z.infer<typeof Target>;

export const RecommendRequest = z.object({
  targets: z.array(Target).min(1).max(35),
  context: z.object({
    members: z.array(Member).max(12),
    settings: HouseholdSettings,
    profiles: z.record(z.string(), TasteProfileDto),
    blockedMealIds: z.array(z.string()),
    pantry: z.array(z.string()),
    history: z.array(PlanEntry),
  }),
});
export type RecommendRequest = z.infer<typeof RecommendRequest>;

export const Verdict = z.enum(['likes', 'okay', 'dislikes']);
export type Verdict = z.infer<typeof Verdict>;
export const Suggestion = z.object({
  mealId: z.string(),
  score: z.number(),
  reason: z.string(),
  verdicts: z.record(z.string(), Verdict),
});
export type Suggestion = z.infer<typeof Suggestion>;

export const SlotResult = z.object({
  date: z.string(),
  slot: Slot,
  source: Source,
  noEligible: z.boolean().optional(),
  pick: Suggestion.nullable(),
  backups: z.array(Suggestion),
});
export type SlotResult = z.infer<typeof SlotResult>;
export const RecommendResponse = z.object({ results: z.array(SlotResult) });
export type RecommendResponse = z.infer<typeof RecommendResponse>;

// ---------- Ranker contract (what the LLM must return) ----------
export const RankOutput = z.object({
  targets: z.array(z.object({ key: z.string(), order: z.array(z.string()), reasons: z.record(z.string(), z.string()).default({}) })),
});
export type RankOutput = z.infer<typeof RankOutput>;
