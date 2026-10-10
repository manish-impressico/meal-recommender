// Plan → aggregated, categorised, pantry-aware grocery list. The list is always derived, never stored.
import type { Meal, PlanEntry, Unit } from '../schema';
import type { Vocabulary } from '../vocab';

export interface GroceryLine { ingredientId: string; label: string; qty: number; unit: Unit; display: string; inPantry: boolean; meals: string[] }
export interface GroceryGroup { category: string; label: string; lines: GroceryLine[] }

const STEP: Record<Unit, number> = { g: 50, ml: 50, pcs: 1 }; // round up to a buyable step

export function formatQty(qty: number, unit: Unit): string {
  if (unit === 'pcs') return `${Math.ceil(qty)} pcs`;
  const big = unit === 'g' ? 'kg' : 'l';
  return qty >= 1000 ? `${+(qty / 1000).toFixed(2)} ${big}` : `${Math.round(qty)} ${unit}`;
}

export function buildGroceryList(
  entries: PlanEntry[], meals: Map<string, Meal>, vocab: Vocabulary, opts: { servings: number; pantry: Set<string> },
): GroceryGroup[] {
  const lines = new Map<string, GroceryLine>();
  for (const e of entries) {
    if (e.status === 'skipped') continue;
    const meal = meals.get(e.mealId);
    if (!meal) continue;
    for (const i of meal.ingredients) {
      if (i.optional) continue;
      const ing = vocab.ingredient(i.id);
      if (!ing) continue;
      const l = lines.get(i.id) ?? { ingredientId: i.id, label: ing.label, qty: 0, unit: ing.unit, display: '', inPantry: opts.pantry.has(i.id), meals: [] };
      l.qty += i.qtyPerServing * opts.servings;
      if (!l.meals.includes(meal.name)) l.meals.push(meal.name);
      lines.set(i.id, l);
    }
  }
  const groups = vocab.data.categories.map((c) => ({ category: c.id, label: c.label, lines: [] as GroceryLine[] }));
  for (const l of lines.values()) {
    l.qty = Math.ceil(l.qty / STEP[l.unit]) * STEP[l.unit];
    l.display = formatQty(l.qty, l.unit);
    groups.find((g) => g.category === vocab.ingredient(l.ingredientId)!.category)?.lines.push(l);
  }
  for (const g of groups) g.lines.sort((a, b) => a.label.localeCompare(b.label));
  return groups.filter((g) => g.lines.length);
}
