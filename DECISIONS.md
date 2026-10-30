# Decisions & known limitations

## Stack choices
- **Stack as specified:** React 18 + TS + Vite, Tailwind with CSS-variable tokens (light/dark), Framer Motion, Recharts, Dexie + `useLiveQuery`, Zustand, Vitest/RTL, Playwright, vite-plugin-pwa (Workbox).
- **Tailwind 3.4** rather than v4, for its stable `@apply`/config workflow.
- **No router library.** A ~20-line hash router in the Zustand store keeps routes offline-safe on static hosting.
- **dnd-kit** handles drag between days, combined with Framer `layout` for animated reordering.
- **No Lottie.** Hand-authoring Lottie JSON adds weight without benefit. Celebrations use `canvas-confetti` (skipped under `prefers-reduced-motion`). Empty states use animated emoji/SVG.
- **Procedural recipe art instead of photo WebPs.** We have no licensed food photography. `RecipeArt` draws a cuisine-coloured gradient with a protein or course glyph, costs zero bytes to precache and stays consistent across 172 recipes. Real photos can be dropped in later.
- **Supabase is loaded lazily**, so it never weighs on the offline shell.

## Nutrition & FODMAP data
- Ingredient values were compiled from **IFCT 2017 (NIN)** where an Indian entry exists, and **USDA FoodData Central** otherwise. A few product items (lactose-free dairy, whey isolate, gluten-free hing, stevia, cocoa, agar) use typical label values. The source is stored on every ingredient. **The values were transcribed as approximations and have not been audited line by line against the official tables.** Verify them before relying on exact numbers.
- Carbohydrate is stored as *total including fibre*; net carbs = carbs − fibre. The validator checks kcal against Atwater factors (±20 %).
- FODMAP levels and safe servings follow published Monash guidance where available. Foods with thin evidence (e.g. ragi) are marked conservatively with a note. **FODMAP stacking across a meal is not modelled.** Each ingredient is judged on its own per-serving amount.
- "IBS-safe variant" = per-serving amounts above the safe serving are swapped (ratio-scaled and capped at the swap's own safe serving), or reduced, or omitted. In reintroduction/personalization, ingredients are allowed only when **all** their FODMAP groups are marked tolerated.

## Targets
- Mifflin–St Jeor BMR × activity factor. Deficit comes from the weekly rate (0.25–1 % bodyweight, 7,700 kcal/kg), capped at 25 % of TDEE. Calorie floor is 1,200 (female) or 1,500 (male).
- Protein floor is 1.4 g/kg goal weight (cap 2.2). Keto carbs ≤ 25 g. Fibre 14 g/1,000 kcal (min 25 g).
- A target duration that would need more than 1 %/week is flagged, and the ETA is recomputed at the safe maximum.
- BMI uses Asian-Indian cut-offs (23 / 25).

## Plan solver
- Slots depend on meals/day. Lunch/dinner = main + carb side (not keto) + veg side.
- Scoring covers portion fit, protein density, fat share (keto), cuisine preference, budget, air-fryer bias, batch/leftovers and seeded jitter. Coordinate descent on 0.25-serving portions (0.5–2.5) is followed by random swaps.
- **Keto fat gap.** The seed recipes are lean, as they're written for fat loss. For keto the solver may add up to two "fat add-ons" (coconut/peanut chutney, nut handful, ghee greens, butter beans). These condiment-type add-ons may repeat up to 4× per week; every other recipe follows the ≤ 2×/week rule (4× with batch cooking).
- **Results:** keto/HPLC/balanced at 3–5 meals/day land within ±5 % on ~97–100 % of days in tests. **Two-meal keto days miss ±5 % on roughly 1 day in 4.** The app shows a warning when that happens.
- Drinks and near-zero-calorie items are never auto-planned. They're for logging and cravings. Desserts can fill snack slots.

## Shopping
- Purchase rounding is per ingredient (`purchase.unit`, `roundG`, `packG`). Eggs: half-dozen steps, with a tray of 30 for 25–30 eggs.
- Costs are the price of the purchased quantity. Long-life staples (spices, oils, grains) are labelled separately, and the "food actually eaten" cost is shown so the weekly bill isn't misleading.

## Sync
- One generic `records` table (entity, id, jsonb data) keeps the backend trivial.
- Per-field LWW uses a `fieldTs` map written on every local update. Ties go to the larger `deviceId`. Deletes are soft.
- Push: collapse the outbox to the latest per record, fetch remote copies, merge, upsert, write the merged copy back locally.
- Pull: by server sequence (immune to clock skew).
- Retries: exponential backoff (2 s → 5 min) plus the `online` event. **The Background Sync API is not used.** The generated Workbox service worker has no custom sync handler, so syncing happens while the app is open.
- Progress photos are **local-only** and stripped before upload.
- **The Supabase adapter has not been exercised against a live project in this environment.** The engine is covered by unit tests with an in-memory backend, including offline queueing, reconnect, pull and field-level merge. The E2E test verifies offline writes persist and are queued in the outbox, but cannot verify the server round trip.

## Other limitations
- Reminders fire while the app is open or backgrounded. Notifications for a closed PWA would need a push server.
- i18n: navigation, meal labels and the diet chart support Tamil/Hindi. Recipe text is English with local dish names.
- Lighthouse scores have not been measured yet. The app shell is code-split (largest eager chunk ≈ 66 kB gzip). Charts and PDF export are lazy.
- Voice commands depend on the Web Speech API, which needs a network connection in Chrome. Big tap targets remain the offline fallback.
