# Fresh Market UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the meal recommender POC to the approved "Fresh Market" look (direction B) with real dish photos, without touching the engine.

**Architecture:** Colours, type and shape stay as tokens in `apps/web/src/app/globals.css`, so the look changes in one place. New presentation units (`MealImage`, `VerdictSummary`, `SlotPicker`, icon `AppNav`) sit in the existing `ui/` and `components/` layers. Two small domain helpers (`listNames`/verb agreement, `summarizeVerdicts`) and one setting (`showDebug`) are added to `packages/core` with unit tests. Photos are static WebP files plus a JSON manifest, reached only through `MealImage`.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, react-bootstrap 2 / Bootstrap 5.3, `next/font/google` (Manrope), `lucide-react`, `next/image`, `sharp` (photo processing script), Vitest 3, Playwright 1.56, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-10-fresh-market-ui-design.md`

## Global Constraints

- No changes to the engine, scoring, `data/store.ts` write path, or `app/api/recommend`. Exceptions: the reason-builder grammar in `packages/core/src/engine/registry.ts`, and adding `showDebug` to `HouseholdSettings`.
- Colour tokens (verbatim): `--mr-bg #FFFFFF`, `--mr-soft #F2F7F4`, `--mr-ink #15211B`, `--mr-muted #5A6B62`, `--mr-line #E6ECE8`, `--mr-primary #0A6B43`, `--mr-highlight #FFC857` with text `#3B2300`, `--mr-danger #B3261E`.
- Font: Manrope 500–800 via `next/font/google`; no runtime `<link>` to Google Fonts.
- Radius: 14px controls/buttons, 24px cards. Only the Today hero has the shadow `0 8px 24px rgb(21 33 27 / 8%)`.
- Touch targets ≥ 44px high.
- `ui/` is the only layer that imports react-bootstrap or `lucide-react`.
- Components never use literal colours; they use the tokens.
- Photos: `apps/web/public/meals/<meal-id>.webp`, 800px wide, ~60–100 KB; manifest `apps/web/src/content/meal-images.json`. Every photo approved by Manish before commit.
- End-user view never shows "Rule-based pick" / "AI ranked"; source is shown only when Settings › "Show debug info" is on.
- Commits end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01P154KFoTUa8hC7CEx2LMuV`.
  Author on Manish's machine: `-c user.name="Manish Sharma" -c user.email="sharma-manish@aramark.com"`.

## File map

| File | Status | Responsibility |
|---|---|---|
| `packages/core/src/util/index.ts` | modify | add `listNames`, `agree` (name list + verb agreement) |
| `packages/core/src/engine/registry.ts` | modify | taste reason uses `listNames`/`agree` |
| `packages/core/src/learning/index.ts` | modify | add `summarizeVerdicts` |
| `packages/core/src/schema/index.ts` | modify | `showDebug` in `HouseholdSettings` |
| `packages/core/test/presentation.test.ts` | create | tests for the three helpers |
| `apps/web/vitest.config.ts` | create | web unit tests (`src/**/*.test.ts`) |
| `apps/web/src/content/images.ts` | create | manifest loader + `imageFor(mealId)` |
| `apps/web/src/content/meal-images.json` | create | photo manifest |
| `apps/web/src/content/images.test.ts` | create | manifest coverage + file-exists test |
| `apps/web/src/components/verdictText.ts` | create | sentence from `summarizeVerdicts` output |
| `apps/web/src/components/verdictText.test.ts` | create | sentence tests |
| `apps/web/src/app/globals.css` | rewrite | tokens + Fresh Market classes |
| `apps/web/src/app/layout.tsx` | modify | Manrope via `next/font` |
| `apps/web/src/ui/icons.ts` | create | the only `lucide-react` import |
| `apps/web/src/ui/AppNav.tsx` | modify | icon + label tabs |
| `apps/web/src/ui/index.tsx` | modify | `SlotPicker`, `PageHeader` title sizes |
| `apps/web/src/components/MealImage.tsx` | create | photo with fallback tile |
| `apps/web/src/components/index.tsx` | modify | `MealCard` variants, `VerdictSummary`, remove `VerdictChips` |
| `apps/web/src/features/today/TodayView.tsx` | modify | new header, SlotPicker, hero card, filter buttons |
| `apps/web/src/features/week/WeekView.tsx` | modify | day strip, compact cards, swap options with photos |
| `apps/web/src/features/settings/SettingsView.tsx` | modify | "Show debug info" switch + photo credits |
| `apps/web/scripts/process-photos.mjs` | create | raw → 800px WebP + contact sheet |
| `apps/web/playwright.config.ts`, `apps/web/e2e/*.spec.ts` | create | journeys at 390 and 1280 |
| `package.json` (root), `apps/web/package.json` | modify | scripts and dev deps |

Onboarding, Grocery and Family keep their structure and pick up the new look through the tokens and shared classes; they get copy-level touches only in Task 6.

---

### Task 1: Core presentation helpers and `showDebug` setting

**Files:**
- Modify: `packages/core/src/util/index.ts` (append)
- Modify: `packages/core/src/engine/registry.ts:91`
- Modify: `packages/core/src/learning/index.ts` (append)
- Modify: `packages/core/src/schema/index.ts:70-77`
- Test: `packages/core/test/presentation.test.ts`

**Interfaces:**
- Produces:
  - `listNames(names: string[]): string` → `"A"`, `"A and B"`, `"A, B and C"`, `""` for empty.
  - `agree(names: string[], singular: string, plural: string): string` → `plural` when more than one name or the single name is `"You"` (case-insensitive), else `singular`.
  - `summarizeVerdicts(verdicts: Record<string, Verdict>, members: Member[]): VerdictSummary` where `type VerdictSummary = { likes: Member[]; okay: Member[]; dislikes: Member[]; everyoneHappy: boolean }`. Only `active` members count. Missing verdict = `okay`. `everyoneHappy = dislikes.length === 0 && likes.length >= 2`.
  - `HouseholdSettings.showDebug: boolean` (default `false`).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/test/presentation.test.ts
import { describe, expect, it } from 'vitest';
import { agree, listNames, summarizeVerdicts, HouseholdSettings, type Member } from '../src';

const m = (id: string, name: string, active = true): Member => ({ id, name, color: '#000000', active });
const fam = [m('a', 'You'), m('b', 'Wife'), m('c', 'Son'), m('d', 'Daughter')];

describe('listNames / agree', () => {
  it('joins names naturally', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['You'])).toBe('You');
    expect(listNames(['You', 'Wife'])).toBe('You and Wife');
    expect(listNames(['You', 'Wife', 'Son'])).toBe('You, Wife and Son');
  });
  it('agrees the verb with the subject', () => {
    expect(agree(['Wife'], 'likes', 'like')).toBe('likes');
    expect(agree(['You'], 'likes', 'like')).toBe('like');
    expect(agree(['you'], 'likes', 'like')).toBe('like');
    expect(agree(['Son', 'Daughter'], 'likes', 'like')).toBe('like');
  });
});

describe('summarizeVerdicts', () => {
  it('groups active members and treats missing verdicts as okay', () => {
    const s = summarizeVerdicts({ a: 'likes', b: 'likes', c: 'okay' }, fam);
    expect(s.likes.map((x) => x.id)).toEqual(['a', 'b']);
    expect(s.okay.map((x) => x.id)).toEqual(['c', 'd']);
    expect(s.dislikes).toEqual([]);
    expect(s.everyoneHappy).toBe(true);
  });
  it('is not everyone-happy with a dislike or fewer than two likes', () => {
    expect(summarizeVerdicts({ a: 'likes', b: 'likes', d: 'dislikes' }, fam).everyoneHappy).toBe(false);
    expect(summarizeVerdicts({ a: 'likes' }, fam).everyoneHappy).toBe(false);
  });
  it('ignores inactive members', () => {
    const s = summarizeVerdicts({ a: 'dislikes', b: 'likes' }, [m('a', 'You', false), m('b', 'Wife')]);
    expect(s.dislikes).toEqual([]);
    expect(s.likes.map((x) => x.id)).toEqual(['b']);
  });
});

describe('settings', () => {
  it('defaults showDebug to false', () => expect(HouseholdSettings.parse({}).showDebug).toBe(false));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w packages/core`
Expected: FAIL — `agree`/`listNames`/`summarizeVerdicts` are not exported.

- [ ] **Step 3: Implement**

Append to `packages/core/src/util/index.ts`:

```ts
/** "A", "A and B", "A, B and C" — shared by engine reasons and UI sentences (one grammar rule, one place). */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Verb agreement: plural for several people or for "You" ("You like it", "Wife likes it"). */
export function agree(names: string[], singular: string, plural: string): string {
  return names.length > 1 || names[0]?.toLowerCase() === 'you' ? plural : singular;
}
```

In `packages/core/src/engine/registry.ts`, add `listNames, agree` to the existing `'../util'` import and replace line 91:

```ts
      if (fans.length) return `${listNames(fans)} ${agree(fans, 'likes', 'like')} it`;
```

Append to `packages/core/src/learning/index.ts` (add `Member` and `Verdict` to its schema import if not already there — both are):

```ts
export type VerdictSummary = { likes: Member[]; okay: Member[]; dislikes: Member[]; everyoneHappy: boolean };

/** Domain rule for "who's happy with this meal". Presentation wording lives in the web layer. */
export function summarizeVerdicts(verdicts: Record<string, Verdict>, members: Member[]): VerdictSummary {
  const out: VerdictSummary = { likes: [], okay: [], dislikes: [], everyoneHappy: false };
  for (const m of members.filter((x) => x.active)) out[verdicts[m.id] ?? 'okay'].push(m);
  out.everyoneHappy = out.dislikes.length === 0 && out.likes.length >= 2;
  return out;
}
```

In `packages/core/src/schema/index.ts`, add to `HouseholdSettings` after `onboarded`:

```ts
  showDebug: z.boolean().default(false), // shows AI/rules source on cards; off for end users
```

- [ ] **Step 4: Run tests**

Run: `npm test -w packages/core`
Expected: PASS — 8 existing + 6 new.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): name/verb helpers, summarizeVerdicts, showDebug setting; fix 'You likes it'"
```

---

### Task 2: Web unit-test harness, photo manifest loader and verdict sentence

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/content/images.ts`
- Create: `apps/web/src/content/meal-images.json` (empty object `{}` for now)
- Create: `apps/web/src/components/verdictText.ts`
- Test: `apps/web/src/components/verdictText.test.ts`
- Modify: `apps/web/package.json` (scripts + devDeps), root `package.json` (`test`, `check`)

**Interfaces:**
- Consumes: `summarizeVerdicts`, `listNames`, `agree`, `VerdictSummary` from Task 1.
- Produces:
  - `type MealImageEntry = { file: string; source: 'unsplash' | 'pexels' | 'wikimedia' | 'own'; credit: string; url: string; license: string }`
  - `imageFor(mealId: string): MealImageEntry | undefined`
  - `imageEntries: Record<string, MealImageEntry>`
  - `verdictSentence(s: VerdictSummary): { text: string; warn?: string }`

- [ ] **Step 1: Add Vitest to the web app**

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
// Unit tests for pure web-layer helpers only; UI is covered by Playwright journeys.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
```

In `apps/web/package.json` scripts add `"test": "vitest run"`; devDependencies add `"vitest": "^3.2.4"`. In root `package.json` set:

```json
"test": "npm test -w packages/core && npm test -w apps/web",
```

Run: `npm install`

- [ ] **Step 2: Write the failing sentence test**

```ts
// apps/web/src/components/verdictText.test.ts
import { describe, expect, it } from 'vitest';
import { summarizeVerdicts, type Member } from '@meal/core';
import { verdictSentence } from './verdictText';

const m = (id: string, name: string): Member => ({ id, name, color: '#000000', active: true });
const fam = [m('a', 'You'), m('b', 'Wife'), m('c', 'Son'), m('d', 'Daughter')];
const say = (v: Record<string, 'likes' | 'okay' | 'dislikes'>) => verdictSentence(summarizeVerdicts(v, fam));

describe('verdictSentence', () => {
  it('names fans and the rest', () => expect(say({ a: 'likes', b: 'likes' })).toEqual({ text: 'You and Wife love it · Son and Daughter are okay' }));
  it('uses singular agreement', () => expect(say({ b: 'likes' }).text).toBe('Wife loves it · You, Son and Daughter are okay'));
  it('handles everyone', () => expect(say({ a: 'likes', b: 'likes', c: 'likes', d: 'likes' }).text).toBe('Everyone loves it'));
  it('handles nobody keen', () => expect(say({}).text).toBe('Everyone is okay with it'));
  it('calls out dislikes separately', () => expect(say({ a: 'likes', d: 'dislikes' })).toEqual({ text: 'You love it · Wife and Son are okay', warn: "Daughter won't like it" }));
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -w apps/web`
Expected: FAIL — cannot find `./verdictText`.

- [ ] **Step 4: Implement**

```ts
// apps/web/src/components/verdictText.ts
import { agree, listNames, type VerdictSummary } from '@meal/core';

const names = (ms: { name: string }[]) => ms.map((m) => m.name);

/** One readable line for the card; dislikes returned separately so the UI can colour them. */
export function verdictSentence(s: VerdictSummary): { text: string; warn?: string } {
  const total = s.likes.length + s.okay.length + s.dislikes.length;
  const parts: string[] = [];
  if (s.likes.length === total && total > 0) parts.push('Everyone loves it');
  else if (s.okay.length === total) parts.push('Everyone is okay with it');
  else {
    if (s.likes.length) parts.push(`${listNames(names(s.likes))} ${agree(names(s.likes), 'loves', 'love')} it`);
    if (s.okay.length) parts.push(`${listNames(names(s.okay))} ${agree(names(s.okay), 'is', 'are')} okay`);
  }
  const out: { text: string; warn?: string } = { text: parts.join(' · ') };
  if (s.dislikes.length) out.warn = `${listNames(names(s.dislikes))} won't like it`;
  return out;
}
```

```ts
// apps/web/src/content/images.ts
// Photo manifest: the only place that knows where dish photos live (swap to a CDN by changing this + MealImage).
import raw from './meal-images.json';

export type MealImageEntry = { file: string; source: 'unsplash' | 'pexels' | 'wikimedia' | 'own'; credit: string; url: string; license: string };
export const imageEntries = raw as Record<string, MealImageEntry>;
export const imageFor = (mealId: string): MealImageEntry | undefined => imageEntries[mealId];
```

`apps/web/src/content/meal-images.json`: `{}`

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS — core 14, web 5.

- [ ] **Step 6: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/src/content/images.ts apps/web/src/content/meal-images.json apps/web/src/components/verdictText.* apps/web/package.json package.json package-lock.json
git commit -m "test(web): vitest harness, photo manifest loader, verdict sentence"
```

---

### Task 3: Visual system — tokens, Manrope, icons, AppNav

**Files:**
- Rewrite: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/ui/icons.ts`
- Modify: `apps/web/src/ui/AppNav.tsx`
- Modify: `apps/web/package.json` (dependency `lucide-react`)

**Interfaces:**
- Produces CSS classes used by later tasks: `.mr-shell`, `.mr-eyebrow`, `.mr-card`, `.mr-hero`, `.mr-chip`, `.mr-btn-quiet`, `.mr-pill`, `.mr-avatar`, `.mr-avatars`, `.mr-badge(.ok|.warn|.highlight)`, `.mr-nav`, `.mr-sheet`, `.mr-row`, `.mr-list`, `.mr-thumb`, `.mr-daystrip`, `.mr-day`.
- Produces `ui/icons.ts` exports: `IconToday, IconWeek, IconGrocery, IconFamily, IconSettings, IconClock, IconFlame, IconHome, IconChevronDown, IconCheck`.

- [ ] **Step 1: Install icons**

Run: `npm install lucide-react@^0.469.0 -w apps/web`

- [ ] **Step 2: Icons module**

```ts
// apps/web/src/ui/icons.ts
// Single import point for icons: swapping the icon library is a one-file change.
export {
  Utensils as IconToday, CalendarDays as IconWeek, ShoppingBasket as IconGrocery, Users as IconFamily,
  Settings2 as IconSettings, Clock as IconClock, Flame as IconFlame, House as IconHome, ChevronDown as IconChevronDown, Check as IconCheck,
} from 'lucide-react';
```

- [ ] **Step 3: Font in layout**

```tsx
// apps/web/src/app/layout.tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { AppNav } from '@/ui/AppNav';

// Bundled at build (no runtime Google call); exposed as a CSS variable the tokens read.
const manrope = Manrope({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--mr-font', display: 'swap' });

export const metadata: Metadata = { title: 'Meal Recommender', description: 'What should we cook today?' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FFFFFF' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <AppNav />
        <main className="mr-shell">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Rewrite tokens and shared classes**

```css
/* apps/web/src/app/globals.css
   Fresh Market tokens (spec §3), mapped onto Bootstrap variables. Components use these, never literals. */
:root {
  --mr-bg: #FFFFFF; --mr-soft: #F2F7F4; --mr-ink: #15211B; --mr-muted: #5A6B62; --mr-line: #E6ECE8;
  --mr-primary: #0A6B43; --mr-primary-hover: #085A38; --mr-primary-soft: #E3F1EA;
  --mr-highlight: #FFC857; --mr-highlight-ink: #3B2300;
  --mr-danger: #B3261E; --mr-danger-soft: #FDECEA;
  --mr-r-ctl: 14px; --mr-r-card: 24px; --mr-shadow: 0 8px 24px rgb(21 33 27 / 8%);
  --bs-body-bg: var(--mr-bg); --bs-body-color: var(--mr-ink); --bs-border-color: var(--mr-line);
  --bs-primary: var(--mr-primary); --bs-primary-rgb: 10, 107, 67; --bs-secondary-color: var(--mr-muted);
  --bs-body-font-family: var(--mr-font), system-ui, -apple-system, 'Segoe UI', sans-serif;
  --bs-border-radius: var(--mr-r-ctl); --bs-border-radius-lg: var(--mr-r-ctl);
}
body { background: var(--mr-bg); -webkit-font-smoothing: antialiased; }
h1, h2, h3 { letter-spacing: -0.02em; font-weight: 800; }
.text-secondary { color: var(--mr-muted) !important; }

.btn { border-radius: var(--mr-r-ctl); font-weight: 700; min-height: 44px; }
.btn-lg { min-height: 50px; font-size: 16px; }
.btn-primary { --bs-btn-bg: var(--mr-primary); --bs-btn-border-color: var(--mr-primary); --bs-btn-hover-bg: var(--mr-primary-hover); --bs-btn-hover-border-color: var(--mr-primary-hover); --bs-btn-active-bg: var(--mr-primary-hover); --bs-btn-disabled-bg: var(--mr-primary); font-weight: 800; }
.btn-outline-primary { --bs-btn-color: var(--mr-primary); --bs-btn-border-color: var(--mr-line); --bs-btn-hover-bg: var(--mr-primary-soft); --bs-btn-hover-color: var(--mr-primary); --bs-btn-hover-border-color: var(--mr-primary); }
.btn-outline-secondary, .mr-btn-quiet { --bs-btn-color: var(--mr-ink); --bs-btn-border-color: var(--mr-line); --bs-btn-bg: var(--mr-bg); --bs-btn-hover-bg: var(--mr-soft); --bs-btn-hover-color: var(--mr-ink); --bs-btn-hover-border-color: var(--mr-line); }

.mr-shell { max-width: 1100px; margin: 0 auto; padding: 0 16px 96px; }
.mr-eyebrow { font-size: 13px; font-weight: 600; color: var(--mr-muted); }
.mr-card { background: var(--mr-bg); border: 1px solid var(--mr-line); border-radius: var(--mr-r-card); padding: 16px; }
.mr-hero { border-radius: var(--mr-r-card); border: 1px solid var(--mr-line); overflow: hidden; box-shadow: var(--mr-shadow); background: var(--mr-bg); }
.mr-hero-body { display: flex; flex-direction: column; gap: 10px; padding: 16px; }

.mr-chip { min-height: 44px; padding: 0 14px; border: 1px solid var(--mr-line); border-radius: var(--mr-r-ctl); background: var(--mr-bg); color: var(--mr-ink); font-weight: 700; font-size: 14px; }
.mr-chip[aria-pressed='true'], .mr-chip[data-state='like'] { border-color: var(--mr-primary); background: var(--mr-primary-soft); color: var(--mr-primary); }
.mr-chip[data-state='dislike'] { border: 2px solid var(--mr-danger); background: var(--mr-danger-soft); color: var(--mr-danger); }

.mr-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; background: var(--mr-soft); color: var(--mr-ink); }
.mr-avatar { width: 28px; height: 28px; border-radius: 14px; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex: none; }
.mr-avatars { display: flex; }
.mr-avatars .mr-avatar { border: 2px solid var(--mr-soft); }
.mr-avatars .mr-avatar + .mr-avatar { margin-left: -6px; }
.mr-badge { font-size: 12px; font-weight: 800; border-radius: 999px; padding: 4px 10px; background: var(--mr-soft); color: var(--mr-ink); }
.mr-badge.ok { background: var(--mr-primary-soft); color: var(--mr-primary); }
.mr-badge.warn { background: var(--mr-danger-soft); color: var(--mr-danger); }
.mr-badge.highlight { background: var(--mr-highlight); color: var(--mr-highlight-ink); }

.mr-thumb { position: relative; flex: none; overflow: hidden; border-radius: 12px; background: var(--mr-soft); }
.mr-daystrip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.mr-day { display: flex; flex-direction: column; align-items: center; padding: 8px 0; min-height: 56px; border: 0; border-radius: var(--mr-r-ctl); background: var(--mr-soft); color: var(--mr-ink); font-size: 12px; font-weight: 600; }
.mr-day b { font-size: 18px; font-weight: 800; line-height: 1.1; }
.mr-day[aria-pressed='true'] { background: var(--mr-primary); color: #FFFFFF; }

.mr-nav { position: fixed; left: 0; right: 0; bottom: 0; height: 68px; padding-bottom: env(safe-area-inset-bottom, 0px); background: var(--mr-bg); border-top: 1px solid var(--mr-line); display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); z-index: 1000; }
.mr-nav a { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; text-decoration: none; font-size: 12px; font-weight: 600; color: var(--mr-muted); }
.mr-nav a.active { color: var(--mr-primary); font-weight: 800; }
.mr-sheet.offcanvas-bottom { height: auto; max-height: 85vh; border-radius: var(--mr-r-card) var(--mr-r-card) 0 0; max-width: 640px; margin: 0 auto; }
.mr-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 8px 14px; border-bottom: 1px solid var(--mr-line); }
.mr-row:last-child { border-bottom: 0; }
.mr-list { background: var(--mr-bg); border: 1px solid var(--mr-line); border-radius: 18px; overflow: hidden; }

@media (min-width: 992px) {
  .mr-nav { top: 0; bottom: auto; height: 60px; display: flex; justify-content: center; gap: 8px; border-top: 0; border-bottom: 1px solid var(--mr-line); }
  .mr-nav a { flex-direction: row; gap: 8px; padding: 0 16px; font-size: 14px; }
  .mr-shell { padding: 84px 24px 32px; }
}
```

- [ ] **Step 5: AppNav with icons**

```tsx
// apps/web/src/ui/AppNav.tsx
'use client';
// Bottom bar on phones, top bar ≥ lg (one component, breakpoint handled in CSS).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconFamily, IconGrocery, IconSettings, IconToday, IconWeek } from './icons';

const TABS = [
  { href: '/', label: 'Today', Icon: IconToday },
  { href: '/week', label: 'Week', Icon: IconWeek },
  { href: '/grocery', label: 'Grocery', Icon: IconGrocery },
  { href: '/family', label: 'Family', Icon: IconFamily },
  { href: '/settings', label: 'Settings', Icon: IconSettings },
];

export function AppNav() {
  const path = usePathname();
  if (path.startsWith('/onboarding')) return null;
  return (
    <nav className="mr-nav" aria-label="Primary">
      {TABS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className={path === href ? 'active' : ''} aria-current={path === href ? 'page' : undefined}>
          <Icon size={22} strokeWidth={path === href ? 2.4 : 2} aria-hidden="true" />{label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run build`
Expected: both succeed; build output lists the same 8 routes.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app apps/web/src/ui apps/web/package.json package-lock.json
git commit -m "feat(web): Fresh Market tokens, Manrope via next/font, icon nav"
```

---

### Task 4: Shared UI — `SlotPicker`, `MealImage`, `VerdictSummary`, `MealCard`

**Files:**
- Modify: `apps/web/src/ui/index.tsx` (add `SlotPicker`; `PageHeader` size)
- Create: `apps/web/src/components/MealImage.tsx`
- Modify: `apps/web/src/components/index.tsx`

**Interfaces:**
- Consumes: `imageFor` (Task 2), `verdictSentence` (Task 2), `summarizeVerdicts` (Task 1), icons (Task 3).
- Produces:
  - `SlotPicker<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void })`
  - `MealImage({ meal, height, width?, rounded? }: { meal: Meal; height: number; width?: number | '100%'; rounded?: number })`
  - `VerdictSummary({ s, members }: { s: Suggestion; members: Member[] })`
  - `MealCard` props unchanged except new optional `showSource?: boolean` and `badge?: ReactNode`; variants `hero | compact | option`.

- [ ] **Step 1: `SlotPicker` and `PageHeader` in `ui/index.tsx`**

Add import `import Dropdown from 'react-bootstrap/Dropdown';` and `import { IconChevronDown } from './icons';`, change `PageHeader`'s `h1` class to `m-0 fw-bold` with `style={{ fontSize: 26, lineHeight: 1.15 }}`, and append:

```tsx
/** Compact single-select menu ("Dinner ▾"). Replaces rows of chips where only one value matters. */
export function SlotPicker<T extends string>({ value, options, onChange, label = 'Meal' }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label?: string;
}) {
  const current = options.find((o) => o.id === value)?.label ?? value;
  return (
    <Dropdown align="end" onSelect={(k) => k && onChange(k as T)}>
      <Dropdown.Toggle as="button" type="button" className="mr-chip d-inline-flex align-items-center gap-2" aria-label={`${label}: ${current}`} bsPrefix="mr-noarrow">
        {current}<IconChevronDown size={16} aria-hidden="true" />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {options.map((o) => <Dropdown.Item key={o.id} eventKey={o.id} active={o.id === value}>{o.label}</Dropdown.Item>)}
      </Dropdown.Menu>
    </Dropdown>
  );
}
```

Add to `globals.css`: `.dropdown-item.active, .dropdown-item:active { background: var(--mr-primary); }`

- [ ] **Step 2: `MealImage`**

```tsx
// apps/web/src/components/MealImage.tsx
'use client';
// Photo from the manifest; deterministic colour tile when the entry or file is missing (never a broken image).
import Image from 'next/image';
import { useState } from 'react';
import type { Meal } from '@meal/core';
import { imageFor } from '@/content/images';

const TILE = ['#F2C94C', '#D69A4A', '#A23E22', '#5BA34B', '#E7A72F', '#8E6BBF', '#2F8F83', '#D9480F'];
const tileFor = (id: string) => TILE[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TILE.length];

export function MealImage({ meal, height, width = '100%', rounded = 0 }: { meal: Meal; height: number; width?: number | '100%'; rounded?: number }) {
  const entry = imageFor(meal.id);
  const [failed, setFailed] = useState(false);
  const box = { position: 'relative' as const, width, height, borderRadius: rounded, overflow: 'hidden', flex: 'none' as const };
  if (!entry || failed) {
    return (
      <div style={{ ...box, background: tileFor(meal.id), display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
        <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: Math.round(height * 0.4), opacity: 0.9 }}>{meal.name.charAt(0)}</span>
      </div>
    );
  }
  const sizes = typeof width === 'number' ? `${width}px` : '(min-width: 992px) 640px, 100vw';
  return (
    <div style={box}>
      <Image src={`/meals/${entry.file}`} alt={meal.name} fill sizes={sizes} style={{ objectFit: 'cover' }} onError={() => setFailed(true)} />
    </div>
  );
}
```

- [ ] **Step 3: `VerdictSummary` and `MealCard` in `components/index.tsx`**

Replace `VERDICT_TEXT`/`VerdictChips` and `MealCard` with:

```tsx
import { summarizeVerdicts, type Meal, type Member, type Suggestion } from '@meal/core';
import { MealImage } from './MealImage';
import { verdictSentence } from './verdictText';
// keep existing imports for Badge, Chip, ChipGroup, ChipState, vocab, ReactNode

export function VerdictSummary({ s, members }: { s: Suggestion; members: Member[] }) {
  const sum = summarizeVerdicts(s.verdicts, members);
  const line = verdictSentence(sum);
  const ordered = [...sum.likes, ...sum.okay, ...sum.dislikes];
  return (
    <div className="d-flex align-items-center gap-2" style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--mr-soft)' }}>
      <div className="mr-avatars">{ordered.map((m) => <MemberAvatar key={m.id} m={m} />)}</div>
      <div className="d-flex flex-column" style={{ minWidth: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
        <span>{line.text}</span>
        {line.warn && <span style={{ color: 'var(--mr-danger)', fontWeight: 700 }}>{line.warn}</span>}
      </div>
    </div>
  );
}

/** One meal card, three placements: hero (Today), compact (Week), option (Swap). */
export function MealCard({ meal, eyebrow, variant, suggestion, members, source, actions, showSource = false, badge }: {
  meal: Meal; eyebrow: string; variant: 'hero' | 'compact' | 'option'; suggestion?: Suggestion; members?: Member[];
  source?: 'ai' | 'rules' | 'manual'; actions?: ReactNode; showSource?: boolean; badge?: ReactNode;
}) {
  const debug = showSource && source ? <Badge>{source === 'ai' ? 'AI ranked' : source === 'rules' ? 'Rule-based' : 'Manual'}</Badge> : null;
  if (variant === 'hero') {
    return (
      <section className="mr-hero" data-source={source}>
        <div style={{ position: 'relative' }}>
          <MealImage meal={meal} height={200} />
          {badge && <div style={{ position: 'absolute', top: 12, left: 12 }}>{badge}</div>}
        </div>
        <div className="mr-hero-body">
          <div className="d-flex justify-content-between align-items-center gap-2"><span className="mr-eyebrow">{eyebrow}</span>{debug}</div>
          <h2 className="m-0" style={{ fontSize: 24 }}>{meal.name}</h2>
          <MealMeta meal={meal} />
          {suggestion?.reason && <p className="m-0">{suggestion.reason}</p>}
          {suggestion && members && <VerdictSummary s={suggestion} members={members} />}
          {actions && <div className="d-flex gap-2">{actions}</div>}
        </div>
      </section>
    );
  }
  const thumb = variant === 'compact' ? 72 : 56;
  return (
    <section className="d-flex align-items-center gap-3 mr-card" style={{ padding: 12, borderRadius: 20 }} data-source={source}>
      <MealImage meal={meal} height={thumb} width={thumb} rounded={14} />
      <div className="flex-fill d-flex flex-column" style={{ minWidth: 0 }}>
        <span className="mr-eyebrow text-capitalize">{eyebrow}</span>
        <span className="fw-bold" style={{ fontSize: 16, lineHeight: 1.25 }}>{meal.name}</span>
        <MealMeta meal={meal} />
        {variant === 'option' && suggestion?.reason && <span className="small text-secondary">{suggestion.reason}</span>}
        {debug}
      </div>
      {actions}
    </section>
  );
}
```

Change `MealMeta` to `${meal.minutes} min · ${SPICE[meal.spice].toLowerCase()} spice · ~${meal.kcal} kcal` and `SPICE` to `['Mild', 'Mild', 'Medium', 'Hot']` (unchanged values). `MemberAvatar` keeps its API and now uses `.mr-avatar` sizing from CSS.

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: errors only in `TodayView.tsx` / `WeekView.tsx` where `VerdictChips` or old props were used (fixed in Task 5). If any other file errors, fix it here.

- [ ] **Step 5: Commit** (after Task 5 makes typecheck green; Tasks 4 and 5 are reviewed together but committed as two commits)

```bash
git add apps/web/src/ui apps/web/src/components apps/web/src/app/globals.css
git commit -m "feat(web): SlotPicker, MealImage with fallback, VerdictSummary, MealCard variants"
```

---

### Task 5: Today and Week screens

**Files:**
- Modify: `apps/web/src/features/today/TodayView.tsx`
- Modify: `apps/web/src/features/week/WeekView.tsx`

**Interfaces:**
- Consumes: `SlotPicker`, `MealCard` (`badge`, `showSource`), `summarizeVerdicts`, icons `IconClock`, `IconHome`.

- [ ] **Step 1: Today — header, picker, filters, hero**

In `TodayView.tsx`:
- imports: add `SlotPicker` from `@/ui`, `summarizeVerdicts` from `@meal/core`, `IconClock, IconHome` from `@/ui/icons`.
- Replace the `<PageHeader …/>` and both chip rows with:

```tsx
const TITLE: Record<Slot, string> = { breakfast: "Today's breakfast", lunch: "Today's lunch", snack: "Today's snack", dinner: "Tonight's pick" };
// …inside return:
<PageHeader
  eyebrow={`${new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${SLOT_LABEL[slot]}`}
  title={TITLE[slot]}
  action={<SlotPicker value={slot} options={data.settings.enabledSlots.map((s) => ({ id: s, label: SLOT_LABEL[s] }))} onChange={(s) => { setSlot(s); setExclude([]); }} />}
/>
<div className="d-flex gap-2 flex-wrap">
  <Chip state={quick ? 'on' : 'off'} onClick={() => setQuick(!quick)} label={<span className="d-inline-flex align-items-center gap-2"><IconClock size={16} aria-hidden="true" />Under 30 min</span>} />
  <Chip state={data.pantry.length ? 'on' : 'off'} onClick={() => { setPantryDraft(data.pantry); setSheet('pantry'); }}
    label={<span className="d-inline-flex align-items-center gap-2"><IconHome size={16} aria-hidden="true" />{data.pantry.length ? `At home · ${data.pantry.length}` : "Use what's at home"}</span>} />
</div>
```

  (`TITLE` sits beside `SLOT_LABEL` at module level.)
- In the suggested-meal `MealCard`, add `showSource={data.settings.showDebug}` and
  `badge={current && summarizeVerdicts(current.verdicts, members).everyoneHappy ? <span className="mr-badge highlight">Everyone's happy</span> : undefined}`; change the eyebrow to `` `${SLOT_LABEL[slot]} ${slot === 'dinner' ? 'tonight' : 'today'}` `` (unchanged) and the primary button label stays "Cook this"; the secondary button variant stays `outline-secondary`.
- Cooked state `MealCard`: replace `actions={<Badge tone="ok">Cooked — enjoy!</Badge>}` with `badge={<span className="mr-badge ok">Cooked</span>}` and `actions={<span className="small text-secondary">Enjoy! Tap Week to plan ahead.</span>}`.
- "Also today" rows: replace each `mr-row` body with `<MealCard variant="compact" …>` using `meal={mealById.get(e!.mealId)!}`, `eyebrow={`${SLOT_LABEL[s]} · ${e!.status}`}` — drop the `mr-list` wrapper and use `d-flex flex-column gap-2`.

- [ ] **Step 2: Week — day strip, compact cards, swap options**

In `WeekView.tsx`:
- Replace the chip day row with:

```tsx
<div className="mr-daystrip" role="group" aria-label="Day">
  {dates.map((d) => (
    <button key={d} type="button" className="mr-day" aria-pressed={d === day} onClick={() => setDay(d)}>
      {fmt(d, { weekday: 'short' })}<b>{fmt(d, { day: 'numeric' })}</b>
    </button>
  ))}
</div>
```

- Header button: `{busy ? 'Planning…' : week.length ? 'Plan again' : 'Plan my week'}` with `variant={week.length ? 'outline-primary' : 'primary'}`.
- Grid → `d-flex flex-column gap-2` with `style={{ maxWidth: 640 }}` on the page wrapper; each `MealCard variant="compact"` gets `showSource={data.settings.showDebug}`, and `actions` = `<Button variant="outline-secondary" onClick={() => openSwap(e)}>Swap</Button>` (cooked: `<IconCheck size={22} color="var(--mr-primary)" aria-label="Cooked" />`).
- Swap sheet: render each option as `<MealCard variant="option" meal={m} eyebrow={swap!.entry.slot} suggestion={s!} actions={<Button size="sm" onClick={…same handler…}>Use this</Button>} />`.
- Empty state copy: "No plan yet. Plan the week and every meal will follow your house rules."

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: all pass.

Run the app (`npm run build && npx next start -p 3100` in `apps/web`) and take phone-width screenshots of `/` and `/week` with the existing smoke script; compare against `B-Today` on the design canvas. Fix spacing that differs by more than ~8px.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/today apps/web/src/features/week
git commit -m "feat(web): Today and Week in the Fresh Market look"
```

---

### Task 6: Remaining screens and debug switch

**Files:**
- Modify: `apps/web/src/features/settings/SettingsView.tsx`
- Modify: `apps/web/src/features/onboarding/OnboardingView.tsx` (copy + colours only)
- Modify: `apps/web/src/features/family/FamilyView.tsx` (copy only)
- Modify: `apps/web/src/features/grocery/GroceryView.tsx` (copy only)

**Interfaces:**
- Consumes: `HouseholdSettings.showDebug` (Task 1), `imageEntries` (Task 2).

- [ ] **Step 1: Settings — debug switch and photo credits**

In the "Planning" card add:

```tsx
<Form.Check type="switch" id="debug" label="Show debug info on meal cards (AI or rule-based pick)" checked={s.showDebug} onChange={(e) => run({ type: 'updateSettings', patch: { showDebug: e.target.checked } })} />
```

Add a card after it (import `imageEntries` from `@/content/images`, `mealById` from `@/content`):

```tsx
<details className="mr-card">
  <summary className="fw-bold">Photo credits</summary>
  <ul className="small mt-2 mb-0 ps-3">
    {Object.entries(imageEntries).map(([id, e]) => (
      <li key={id}>{mealById.get(id)?.name ?? id}: <a href={e.url} target="_blank" rel="noreferrer">{e.credit}</a> ({e.source}, {e.license})</li>
    ))}
  </ul>
</details>
```

- [ ] **Step 2: Onboarding colours and copy**

Replace `COLORS` with the avatar palette used in the mocks (distinct in lightness as well as hue):

```ts
const COLORS = ['#2F6FD0', '#B4235A', '#2F7D4F', '#B45309', '#6B4C9A', '#2F8F83'];
```

Step 1 helper text → "Everyone eats vegetarian + eggs. Edit names, or clear one to remove it."

- [ ] **Step 3: Family / Grocery copy**

- Family: "Likes (learned + set): " → "Likes: "; "Won’t eat: " unchanged; badge `tone="warn"` on "Mild base, heat on the side" → no tone (neutral), since warn is now red.
- Grocery: eyebrow "Planned meals this week" → "For this week's plan"; empty state "Plan the week first. The list is built from it."

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run build`
Expected: pass. Toggle the debug switch in the running app and confirm the source badge appears on the Today hero and Week cards, and disappears when off.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features
git commit -m "feat(web): debug switch, photo credits, copy and avatar colours"
```

---

### Task 7: Dish photos

**Files:**
- Create: `apps/web/scripts/process-photos.mjs`
- Create: `apps/web/public/meals/*.webp` (36 files)
- Modify: `apps/web/src/content/meal-images.json`
- Create: `apps/web/src/content/images.test.ts`
- Modify: `.gitignore` (add `apps/web/photos-raw/`, `apps/web/photos-review/`)

**Interfaces:**
- Consumes: `MealImageEntry` (Task 2), catalog via `@/content`.

- [ ] **Step 1: Write the failing coverage test**

```ts
// apps/web/src/content/images.test.ts
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import catalog from './catalog.json';
import { imageEntries } from './images';

const pub = (f: string) => fileURLToPath(new URL(`../../public/meals/${f}`, import.meta.url));

describe('meal photos', () => {
  it('every catalog meal has a manifest entry', () => {
    const missing = (catalog as { id: string }[]).map((m) => m.id).filter((id) => !imageEntries[id]);
    expect(missing).toEqual([]);
  });
  it('every manifest entry points to an existing file with a credit', () => {
    for (const [id, e] of Object.entries(imageEntries)) {
      expect(existsSync(pub(e.file)), `${id}: ${e.file}`).toBe(true);
      expect(e.credit && e.url && e.license, id).toBeTruthy();
    }
  });
});
```

Run: `npm test -w apps/web` — Expected: FAIL, 36 missing ids.

- [ ] **Step 2: Processing script**

```js
// apps/web/scripts/process-photos.mjs
// Usage: node scripts/process-photos.mjs  (reads photos-raw/<meal-id>.<jpg|jpeg|png|webp>)
// Writes public/meals/<meal-id>.webp (800px wide, ≤ ~100 KB) and photos-review/contact-sheet.html.
import sharp from 'sharp';
import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const rawDir = path.join(root, 'photos-raw');
const outDir = path.join(root, 'public/meals');
const reviewDir = path.join(root, 'photos-review');
await mkdir(outDir, { recursive: true });
await mkdir(reviewDir, { recursive: true });

const rows = [];
for (const f of (await readdir(rawDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()) {
  const id = f.replace(/\.[^.]+$/, '');
  const out = path.join(outDir, `${id}.webp`);
  // Step quality down until the file is under ~100 KB; 800px covers the 390px hero at 2x.
  for (const q of [78, 70, 62, 55]) {
    await sharp(path.join(rawDir, f)).rotate().resize({ width: 800, height: 600, fit: 'cover', position: 'attention' }).webp({ quality: q }).toFile(out);
    if ((await stat(out)).size <= 100_000) break;
  }
  rows.push({ id, kb: Math.round((await stat(out)).size / 1024) });
}
const cell = (r) => `<figure><img src="../public/meals/${r.id}.webp" alt=""><figcaption>${r.id} · ${r.kb} KB</figcaption></figure>`;
await writeFile(path.join(reviewDir, 'contact-sheet.html'),
  `<!doctype html><meta charset="utf-8"><title>Meal photos review</title><style>body{font:14px system-ui;margin:16px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px}</style><main>${rows.map(cell).join('')}</main>`);
console.log(`processed ${rows.length} photos`);
```

- [ ] **Step 3: Source candidates**

For each of the 36 meal ids in `apps/web/src/content/catalog.json`, find one photo on Unsplash or Pexels (Wikimedia only if CC BY / BY-SA) that looks like the home-cooked dish, top-down or 45° view, no text overlays, no people's faces. Save as `apps/web/photos-raw/<meal-id>.jpg` and record `{ file: "<meal-id>.webp", source, credit, url, license }` in a working copy of `meal-images.json`. Licence strings: `"Unsplash License"`, `"Pexels License"`, or the exact CC licence.

Run: `node apps/web/scripts/process-photos.mjs`
Expected: `processed 36 photos`.

- [ ] **Step 4: Review gate (Manish)**

Publish `photos-review/contact-sheet.html` (or its screenshot) to Manish. Replace any rejected photo, re-run Step 3's script, repeat until all 36 are approved. Do not commit photos before approval.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS, including both photo tests.

- [ ] **Step 6: Commit**

```bash
git add .gitignore apps/web/scripts apps/web/public/meals apps/web/src/content/meal-images.json apps/web/src/content/images.test.ts
git commit -m "feat(web): approved dish photos, manifest and coverage test"
```

---

### Task 8: Playwright journeys at phone and desktop width

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/helpers.ts`, `apps/web/e2e/today.spec.ts`, `apps/web/e2e/week.spec.ts`
- Modify: `apps/web/package.json` (`"e2e": "playwright test"`, devDep `@playwright/test@1.56.0`), `.gitignore` (`apps/web/test-results/`, `apps/web/playwright-report/`)

- [ ] **Step 1: Config**

```ts
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
// Runs against a production build; AI is forced off in tests (no key needed, deterministic rules path).
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3100' },
  webServer: { command: 'npx next start -p 3100', port: 3100, reuseExistingServer: true },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
```

- [ ] **Step 2: Helpers (onboard through the real UI, AI off)**

```ts
// apps/web/e2e/helpers.ts
import { expect, type Page } from '@playwright/test';

export async function onboard(page: Page) {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Next: tastes' }).click();
  await page.getByRole('button', { name: /Rajma/ }).click(); // You: likes rajma
  for (const n of ['Wife', 'Son', 'Daughter']) await page.getByRole('button', { name: `Next: ${n}` }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'See my first pick' }).click();
  // AI off so journeys never depend on a key or network.
  await page.goto('/settings');
  const ai = page.getByLabel(/Use AI to rank/);
  if (await ai.isChecked()) await ai.uncheck();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Cook this' })).toBeVisible();
}

const widthName = (page: Page) => (page.viewportSize()!.width < 600 ? 'phone' : 'desktop');
export const shot = (page: Page, name: string) =>
  page.screenshot({ path: `e2e/__screens__/${widthName(page)}-${name}.png`, fullPage: true });
```

If the onboarding chip label is not "Rajma" in `vocab.json`, use the first chip label listed under Dishes there.

- [ ] **Step 3: Today journey**

```ts
// apps/web/e2e/today.spec.ts
import { expect, test } from '@playwright/test';
import { onboard, shot } from './helpers';

test('today: not this → show another → cook this', async ({ page }) => {
  await onboard(page);
  const title = page.locator('.mr-hero h2');
  await shot(page, 'today');
  const first = await title.textContent();
  await page.getByRole('button', { name: 'Not this' }).click();
  await page.getByRole('button', { name: 'Too heavy' }).click();
  await shot(page, 'not-this');
  await page.getByRole('button', { name: 'Show another' }).click();
  await expect(title).not.toHaveText(first!);
  await page.getByRole('button', { name: 'Cook this' }).click();
  await expect(page.locator('.mr-hero .mr-badge.ok')).toHaveText('Cooked');
  await expect(page.locator('.mr-hero')).not.toContainText(/Rule-based|AI ranked/);
});
```

- [ ] **Step 4: Week journey**

```ts
// apps/web/e2e/week.spec.ts
import { expect, test } from '@playwright/test';
import { onboard, shot } from './helpers';

test('week: plan → swap a slot', async ({ page }) => {
  await onboard(page);
  await page.goto('/week');
  await page.getByRole('button', { name: 'Plan my week' }).click();
  const swap = page.getByRole('button', { name: 'Swap' }).first();
  await expect(swap).toBeVisible({ timeout: 20_000 });
  await shot(page, 'week');
  const card = page.locator('section.mr-card', { has: swap });
  const before = await card.locator('.fw-bold').first().textContent();
  await swap.click();
  const use = page.getByRole('button', { name: 'Use this' }).first();
  await expect(use).toBeVisible({ timeout: 20_000 });
  await shot(page, 'swap');
  await use.click();
  await expect(card.locator('.fw-bold').first()).not.toHaveText(before!);
});
```

- [ ] **Step 5: Run**

Run: `cd apps/web && npm run build && npx playwright test`
Expected: 4 passed (2 journeys × phone, desktop). Screenshots in `apps/web/e2e/__screens__/`. On Manish's Mac first run `npx playwright install chromium`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e apps/web/package.json package-lock.json .gitignore
git commit -m "test(web): Playwright journeys for Today and Week at phone and desktop width"
```

---

### Task 9: Final verification on Manish's machine

**Files:** none new (fixes only, if a check fails).

- [ ] **Step 1: Full checks**

Run (repo root): `npm install && npm run check && npm run build`
Expected: typecheck clean; core and web unit tests pass; build lists 8 routes.

- [ ] **Step 2: AI ranking path with the real key**

With `apps/web/.env.local` holding `ANTHROPIC_API_KEY` and Settings › AI on, start the app (`npm run start`) and run:

```bash
curl -s localhost:3000/api/recommend -H 'content-type: application/json' --data @apps/web/e2e/fixtures/recommend-request.json | head -c 400
```

where `recommend-request.json` is captured once from the browser's network tab (Today page load). Expected: JSON with `"source":"ai"` and a reason per pick. Then rename `.env.local` temporarily and repeat: expected `"source":"rules"` (fallback works). Restore the file.

- [ ] **Step 3: Desktop layout check**

Open `apps/web/e2e/__screens__/desktop-*.png`; confirm the top nav, a centred column of max 640px on Today/Week, and no horizontal scroll.

- [ ] **Step 4: Commit any fixes and summarise**

```bash
git add -A && git commit -m "fix(web): verification follow-ups"   # only if there were fixes
git log --oneline main..feat/fresh-market-ui
```
