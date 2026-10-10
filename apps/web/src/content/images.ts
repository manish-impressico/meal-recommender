// Photo manifest: the only place that knows where dish photos live (swap to a CDN by changing this + MealImage).
import raw from './meal-images.json';

export type MealImageEntry = { file: string; source: 'unsplash' | 'pexels' | 'wikimedia' | 'own'; credit: string; url: string; license: string };
export const imageEntries = raw as Record<string, MealImageEntry>;
export const imageFor = (mealId: string): MealImageEntry | undefined => imageEntries[mealId];
