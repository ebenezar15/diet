# ThaliFit 🍛

An offline-first, animated meal planner and tracker for **Indian non-vegetarian fat loss with IBS** (low-FODMAP). It works fully without an account and without a connection after first load. Sync across devices is optional.

> ⚠️ **Medical disclaimer.** ThaliFit gives general nutrition information. It is **not medical advice** and does not diagnose or treat anything. IBS needs a proper diagnosis, and the low-FODMAP diet is meant to be done in phases with a registered dietitian. Keto, fasting or aggressive deficits combined with any medical condition (diabetes, thyroid, kidney disease, pregnancy, eating disorders, medication) need your doctor's supervision. Nutrition values are estimates.

## What's inside

| Area | Highlights |
|---|---|
| **Onboarding** | 7 animated steps. BMR (Mifflin–St Jeor) → TDEE → deficit, with the maths shown. Pick a **target duration (30–180 days)** and the app checks it against the safe 0.25–1 %/week range and gives a realistic ETA. Diet mode, intermittent fasting, IBS type and FODMAP phase, triggers, cuisines, budget. |
| **Diet modes** | Keto, High-Protein Low-Carb, Balanced, Custom. The low-FODMAP overlay works with every mode, and IF (12:12 → OMAD) sits on top of any of them. |
| **Recipes** | **172 recipes**: 142 Indian non-veg mains, sides and staples across 11 regional cuisines (**53 air-fryer recipes**), plus **30 light bites** (13 zero/low-calorie drinks, 9 desserts, 8 snacks and soups). Nutrition, diet tags, FODMAP status, IBS-safe variant and ₹ cost per serving are all **computed from ingredient data**. |
| **IBS overlay** | 129 ingredients, each with FODMAP level, group and safe serving. Automatic Indian swaps: onion → spring-onion greens, garlic → garlic-infused oil, hing → gluten-free hing, curd/milk → lactose-free, cashew → peanuts, rajma/dal → small rinsed canned lentils, cauliflower → broccoli, and more. |
| **Plan generator** | Deterministic offline solver (greedy + local search). Each day lands within ±5 % of kcal/protein/carbs/fat, with variety rules, budget and air-fryer preference, leftovers and batch-cooking. Lock meals and regenerate the rest, drag meals between days, save templates, duplicate last week. |
| **Today** | Animated calorie and macro rings, a "thali" that fills as you eat, fibre and 9 micronutrients vs ICMR-NIN RDAs, swipeable meal cards (right = eaten, left = skip, tap = swap), water glass, fasting countdown, streaks, gut insight, low-calorie "craving" picks. |
| **Logging** | Log from plan, recipe with portion slider, food search (English/Tamil/Hindi names), quick-add, recents and favourites, copy yesterday, Indian portion helpers (katori, roti, curry-cut piece…). |
| **Cooking mode** | Full-screen steps with swipe or arrow keys, wake lock, multiple named timers with sound and vibration, scaled ingredient checklist, voice "next"/"back" where the browser supports it. |
| **Shopping & pantry** | Aggregated, scaled to people, minus pantry stock. Rounded to market units (meat 250 g steps, eggs by dozen or tray of 30, herbs by bunch, spices by packet). Butcher/fishmonger notes, perishables split into buy-now vs mid-week, ₹ estimate with an editable price list, WhatsApp share. Pantry has expiry dates, "use it up" suggestions and auto-deduct when you cook. |
| **Gut journal** | Bloating/pain/gas/urgency/stress/sleep sliders, illustrated Bristol chart, 8-week heatmap, per-food suspect score (symptoms 2–24 h after eating), stress correlation, and a 3-day **reintroduction wizard** whose results update the planner. |
| **Fit** | Weekly workout plan by level and days (full-body strength, cardio, recovery), 32 exercises with cues and MET-based kcal, IBS-relief yoga and breathing, logging, intermittent-fasting guide for IBS. |
| **Progress** | Weight with 7-day moving average, waist, local-only progress photos, goal timeline projection with phases and diet breaks, weekly report. |
| **Diet chart** | Printable weekly chart with meal timings (respects the IF window), portions and macros, optional Tamil/Hindi labels, PDF or PNG export. |
| **Offline & sync** | Dexie (IndexedDB) is the source of truth. Every write goes to an outbox. Optional Supabase sync with per-field last-write-wins and soft deletes. Animated sync badge, sync log, JSON export/import. |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # validates seed data, type-checks, builds the PWA into dist/
npm run preview    # serve the production build (service worker active)
```

### Tests

```bash
npm test           # Vitest: calculators, FODMAP overlay, plan solver, shopping rounding, sync merge/engine
npm run test:e2e   # Playwright: onboarding → plan → shopping list → log meal offline → reload offline
npm run lint
```

The Playwright config uses the Chromium at `/opt/pw-browsers/chromium` by default. Set `CHROMIUM_PATH` to point at another browser, or run `npx playwright install` and set `CI=1`.

## Optional: cross-device sync with Supabase

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor. It creates one `records` table with Row Level Security and a server sequence used as the pull cursor.
2. Enable **Email (magic link)** auth.
3. Copy `.env.example` to `.env.local` and set:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. Rebuild. Settings → *Sync & sync log* → sign in with your email.

Without these variables the app runs local-only, and the sync badge shows "On this device". The backend sits behind the `SyncBackend` interface (`src/sync/backend.ts`), so another backend can be swapped in.

## Updating seed data

Seed data is typed JSON in `src/data/seed/`:

- `ingredients.json`: nutrients per 100 g in a fixed order: `[kcal, protein, carbs (total incl. fibre), fat, fibre, sodium mg, potassium mg, calcium mg, iron mg, magnesium mg, zinc mg, vitamin C mg, vitamin A µg RAE, folate µg, B12 µg]`. Each entry also has FODMAP info, an optional low-FODMAP swap, purchase unit, store section, shelf life, ₹/kg and source.
- `recipes/*.json`: amounts in grams for the whole recipe. Never type in nutrition; it is computed.
- `exercises.json`.

`npm run validate:seed` runs before every build and fails on:
- schema errors
- unknown ingredient ids
- missing swap targets
- kcal that doesn't match the macros
- implausible per-serving calories
- fewer than 120 recipes

After changing seed data, bump `SEED_VERSION` in `src/db/seed.ts`. Existing installs then merge the new data on next launch. User data lives in separate tables (custom recipes, price overrides), so it is never overwritten.

## Project layout

```
src/
  data/seed/      bundled JSON + Zod schema (src/data/schema.ts)
  db/             Dexie schema, repo (writes + outbox), versioned seed loader
  lib/            nutrition, fodmap, targets, planner, shopping, correlations, exercise, units…
  sync/           merge (per-field LWW), engine (outbox push/pull + backoff), Supabase adapter
  features/       screens (Today, Plan, Recipes, Cooking, Shop, Gut, Fit, Progress, DietChart, Settings…)
  components/     UI kit, animated rings/plate/water glass, procedural recipe art
supabase/schema.sql
e2e/              Playwright tests
```

See [DECISIONS.md](DECISIONS.md) for design decisions and known limitations.
