// Small shared helpers. Dates are local calendar days as 'YYYY-MM-DD' strings — no timezone math elsewhere.
export const clamp = (x: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, x));

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return toISODate(dt);
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Start of the week containing `iso`, given the household's first weekday (0=Sun … 6=Sat). */
export function weekStart(iso: string, startsOn: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return addDays(iso, -((dow - startsOn + 7) % 7));
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Deterministic sort: score desc, then id asc — "why this one?" always has one answer. */
export const byScoreThenId = <T extends { score: number; id: string }>(a: T, b: T) =>
  b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** "A", "A and B", "A, B and C" — shared by engine reasons and UI sentences (one grammar rule, one place). */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Verb agreement: plural for several people or for "You" ("You like it", "Wife likes it"). */
export function agree(names: string[], singular: string, plural: string): string {
  return names.length > 1 || names[0]?.toLowerCase() === 'you' ? plural : singular;
}
