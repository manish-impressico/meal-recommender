# Meal Recommender (POC)

Family meal recommender: daily pick, week plan with swaps, grocery list, per-member tastes that learn from "Cook this" / "Not this".
Design: `docs/superpowers/specs/2026-10-10-meal-recommender-design.md`.

## Run the demo (Node 20+)

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # optional: add ANTHROPIC_API_KEY for Claude ranking
npm run build && npm start                     # http://localhost:3000   (or: npm run dev)
```

No key → every pick is rule-based (badge "Rule-based pick"). With a key → Claude reorders the code-built shortlist and writes reasons (badge "AI ranked"); any failure falls back to rules automatically. Model: `ANTHROPIC_MODEL` (default `claude-haiku-4-5`).

## Layout

```
packages/core   @meal/core — framework-free TS: schema (zod), vocab, learning, engine, planner, grocery, commands
apps/web        Next.js shell: features/ (one per screen), components/ (domain-shared), ui/ (primitives), data/ (store), api/recommend
```

`npm test` runs the core suite; `npm run check` = typecheck + tests.

## POC deviations from the design (deliberate, each behind its seam)

| Design | POC | Swap later in |
|---|---|---|
| pnpm workspace | npm workspaces (no extra install) | root `package.json` |
| IndexedDB (Dexie) | localStorage, same `run(command)` write path | `apps/web/src/data/store.ts` only |
| ~150-meal catalog | 36 seed meals | `apps/web/src/content/catalog.json` (validated at load) |
| Phone over LAN | Desktop/web browser on localhost | — |
| Playwright journeys | smoke run only | — |
