# Fresh Market UI re-skin — design

- **Date:** 2026-10-10
- **Status:** Approved by Manish (2026-10-10)
- **Branch:** `feat/fresh-market-ui`
- **Parent design:** `2026-10-10-meal-recommender-design.md`
- **Mockups:** Design canvas "Meal App Visual Directions" (direction B · Fresh Market)

## 1. Why

The v1 POC works, but the daily user (Manish's wife, on her phone) will not find it appealing:

- One flat green on grey-white. It reads like an admin or banking app, not a kitchen.
- Meals are text only. The Today hero has no image, so nothing makes the dish appetising.
- The same pill chip is used for meal time, filters, tastes and reasons. Nothing has visual priority.
- Bottom nav is text only (12px grey), with no icons.
- Copy bugs: "You likes it" grammar. Developer labels ("Rule-based pick", "AI ranked") are shown to the end user.

Three directions were mocked (A Masala Dabba, B Fresh Market, C Family Pastel). **B was chosen**, with **real food photos**.

## 2. Scope

**In scope:** visual layer of every screen (Onboarding, Today, Not-this sheet, Week, Swap sheet, Grocery, Family, Settings); meal photos; copy fixes; Playwright journeys; AI-path and desktop verification carried over from the v1 handover.

**Out of scope:** the engine, scoring, storage (`data/store.ts`), the API route, the catalog content (beyond adding image entries), PWA or hosting.

## 3. Visual system

All colours and type are tokens in `apps/web/src/app/globals.css`, mapped onto Bootstrap variables, as today. Components never use literal colours.

| Token | Value | Use |
|---|---|---|
| `--mr-bg` | `#FFFFFF` | Page ground |
| `--mr-soft` | `#F2F7F4` | Soft panels (verdict row, selected states) |
| `--mr-ink` | `#15211B` | Primary text |
| `--mr-muted` | `#5A6B62` | Secondary text, inactive nav |
| `--mr-line` | `#E6ECE8` | Borders, dividers |
| `--mr-primary` | `#0A6B43` | Primary buttons, active nav (white text ≥ 4.5:1) |
| `--mr-highlight` | `#FFC857` on `#3B2300` text | Highlight badges only ("Everyone's happy") |
| `--mr-danger` | `#B3261E` | "Won't eat" mentions, Never-again action |

- **Type:** Manrope (500–800) via `next/font/google`, self-hosted at build time. No runtime call to Google Fonts. Replaces the DM Sans `<link>` in `layout.tsx`.
- **Shape:** 14px radius on controls and buttons, 24px on cards. One elevation (`0 8px 24px rgb(21 33 27 / 8%)`) on the Today hero only.
- **Touch targets:** at least 44px high.

## 4. Components

Layering stays as in the parent design: `ui/` = domain-free primitives (only place that imports react-bootstrap), `components/` = domain-aware shared, `features/` = screens.

| Unit | Layer | Job | Depends on |
|---|---|---|---|
| `Icon` (re-export) | `ui/` | Single import point for `lucide-react` icons used by the app, so the icon library can be swapped in one file | `lucide-react` |
| `AppNav` | `ui/` | Bottom bar with icon + label on phones, top bar at ≥ lg. Active tab in `--mr-primary` | `Icon` |
| `SlotPicker` | `ui/` | Compact "Dinner ▾" menu (react-bootstrap `Dropdown`) replacing four always-visible chips. Default slot by time of day is unchanged | react-bootstrap |
| `MealImage` | `components/` | Renders the dish photo with `next/image` from `public/meals/`. Falls back to a coloured tile with the dish initial when an entry or file is missing | `content/meal-images.json` |
| `MealCard` | `components/` | Three variants: **hero** (200px photo on top, optional "Everyone's happy" badge), **compact** (72px thumb left, Week), **option** (thumb + "Use this", Swap) | `MealImage`, `VerdictSummary` |
| `VerdictSummary` | `components/` | Avatar stack plus one sentence, e.g. "You and Wife love it · kids are fine". Anyone who won't eat it is named in `--mr-danger` | `summarizeVerdicts` |
| `summarizeVerdicts` | `packages/core/src/learning` | Pure function: `(verdicts, members) → { likes: Member[], okay: Member[], dislikes: Member[], everyoneHappy: boolean }`. `everyoneHappy` = no dislikes and at least 2 likes | — |

The sentence wording lives in the web layer (presentation). Grouping lives in core (domain rule), so it is unit-tested with the existing Vitest setup.

## 5. Meal photos

- **Manifest:** `apps/web/src/content/meal-images.json`, keyed by meal id: `{ "file": "rajma-chawal.webp", "source": "unsplash" | "pexels" | "wikimedia" | "own", "credit": "Name", "url": "https://…", "license": "…" }`.
- **Files:** `apps/web/public/meals/<meal-id>.webp`, 800px wide, quality tuned to ~60–100 KB each (~3 MB for 36).
- **Sourcing:** Unsplash or Pexels first (licences allow free use; credit kept anyway). Wikimedia only with CC BY / BY-SA, and the credit must then be shown on a Settings › Photo credits list.
- **Review gate:** Manish approves every photo on a contact sheet before it is committed. A photo must look like the home-cooked dish, not a restaurant plating of something else.
- **Validation:** a unit test fails if any catalog meal has no manifest entry, or if an entry points to a missing file.
- **Swap seam:** photos are referenced only through `MealImage` and the manifest, so moving to a CDN or blob storage later changes one component.

## 6. Copy changes

| Where | Now | New |
|---|---|---|
| Verdict reason | "You likes it." | Grammar fixed in the reason builder, `packages/core/src/engine/registry.ts` (`You like it` / `Wife likes it`), with a unit test |
| Hero badge | "Rule-based pick" / "AI ranked" | Removed from end-user view. Kept as `data-source` on the card; shown only when Settings › "Show debug info" is on |
| Today header | "Today / Saturday 10 Oct" | "Sat, 10 Oct · Dinner" eyebrow, "Tonight's pick" (or "Today's breakfast/lunch/snack") title |
| Pantry chip | "At home · 0 items" | "Use what's at home" (count shown only when > 0) |

## 7. Error handling

No new failure modes beyond images:

- Missing manifest entry or 404 on a photo → `MealImage` fallback tile; never a broken image icon (`onError` switches to fallback).
- Fonts are bundled at build; if the build machine is offline, `next/font` falls back to the system stack and the build still succeeds.

## 8. Testing

1. **Unit (Vitest):**
   - `packages/core`: `summarizeVerdicts` grouping and the `everyoneHappy` rule; reason-builder grammar.
   - `apps/web`: manifest coverage test. Vitest is added to `apps/web` as a dev dependency with a minimal `vitest.config.ts` (it is already hoisted from core, so the cost is one config file), and the root `check` script runs both.
2. **Playwright journeys (`apps/web/e2e`)**, at 390×844 and 1280×800:
   - Today: onboarding seed → pick shown → Not this (with a reason) → Show another → Cook this → cooked state.
   - Week: Generate week → Swap a slot → swapped meal shown.
   - Each saves screenshots to `apps/web/e2e/__screens__/` for visual review.
3. **AI ranking path:** run on Manish's machine with his key in `.env.local`; confirm the server route returns `source: "ai"` and the fallback still works with the key removed.
4. **Regression:** `npm run check` (typecheck + core tests) and `npm run build` pass.

## 9. Effort (estimate)

Roughly 2–3 developer-days, assuming one developer and the current 36-dish catalog:

- Visual system + components + screens: 1–1.5 days
- Photo sourcing, processing, review: 0.5–1 day (driven by review turnaround)
- Tests and verification: ~0.5 day

## 10. Risks

- **Photo quality and licensing** is the main risk. The review gate and the fallback tile contain it.
- **Bundle size:** `lucide-react` is tree-shaken per icon; `next/image` keeps photos lazy and sized.
- **Catalog growth to ~150 meals** (parent design) means ~115 more photos later. The manifest test will flag gaps; the fallback keeps the UI working meanwhile.
