// One vocabulary for taste chips, catalog tags, pantry and grocery (design §5.3).
// The "chips must map to catalog tags" risk is closed structurally: chips are generated from here
// and validateCatalog() fails on any unknown reference.
import { Meal, VocabData, type Ingredient, type Tag } from '../schema';
import { err, ok, type Result } from '../util';

export interface Vocabulary {
  data: VocabData;
  tag(id: string): Tag | undefined;
  ingredient(id: string): Ingredient | undefined;
  /** meal.tags ∪ cuisine ∪ ingredient-derived tags — authors never list "spinach" twice. */
  tagsOf(meal: Meal): Set<string>;
  chipTags(): Tag[];
  pantryIngredients(): Ingredient[];
}

export function createVocabulary(raw: unknown): Vocabulary {
  const data = VocabData.parse(raw);
  const tags = new Map(data.tags.map((t) => [t.id, t]));
  const ings = new Map(data.ingredients.map((i) => [i.id, i]));
  const cache = new Map<string, Set<string>>();
  return {
    data,
    tag: (id) => tags.get(id),
    ingredient: (id) => ings.get(id),
    tagsOf(meal) {
      let s = cache.get(meal.id);
      if (!s) {
        s = new Set([meal.cuisine, ...meal.tags]);
        for (const i of meal.ingredients) {
          const t = ings.get(i.id)?.tag;
          if (t) s.add(t);
        }
        cache.set(meal.id, s);
      }
      return s;
    },
    chipTags: () => data.tags.filter((t) => t.chip),
    pantryIngredients: () => data.ingredients.filter((i) => i.pantry),
  };
}

export type CatalogIssue = { mealId: string; problem: string };

export function validateCatalog(raw: unknown, vocab: Vocabulary): Result<Meal[], CatalogIssue[]> {
  if (!Array.isArray(raw)) return err([{ mealId: '*', problem: 'catalog must be an array' }]);
  const issues: CatalogIssue[] = [];
  const meals: Meal[] = [];
  const seen = new Set<string>();
  raw.forEach((r, idx) => {
    const p = Meal.safeParse(r);
    if (!p.success) {
      issues.push({ mealId: (r as { id?: string })?.id ?? `#${idx}`, problem: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
      return;
    }
    const m = p.data;
    if (seen.has(m.id)) issues.push({ mealId: m.id, problem: 'duplicate id' });
    seen.add(m.id);
    for (const t of [m.cuisine, ...m.tags]) if (!vocab.tag(t)) issues.push({ mealId: m.id, problem: `unknown tag "${t}"` });
    for (const i of m.ingredients) if (!vocab.ingredient(i.id)) issues.push({ mealId: m.id, problem: `unknown ingredient "${i.id}"` });
    meals.push(m);
  });
  for (const i of vocab.data.ingredients) if (i.tag && !vocab.tag(i.tag)) issues.push({ mealId: '*', problem: `ingredient ${i.id} maps to unknown tag ${i.tag}` });
  return issues.length ? err(issues) : ok(meals);
}
