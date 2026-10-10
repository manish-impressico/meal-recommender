// Static content: validated once at load against core schemas. A bad catalog fails fast, not silently.
import { createVocabulary, validateCatalog, type Meal } from '@meal/core';
import catalogRaw from './catalog.json';
import vocabRaw from './vocab.json';

export const vocab = createVocabulary(vocabRaw);
const parsed = validateCatalog(catalogRaw, vocab);
if (!parsed.ok) throw new Error('Catalog invalid: ' + JSON.stringify(parsed.error.slice(0, 5)));
export const meals: Meal[] = parsed.value;
export const mealById = new Map(meals.map((m) => [m.id, m]));
