# The Fridge — Machine-Enforceable Rewrite Spec

## ROLE

You are rewriting this repository into a **single active production-grade Progressive Web App** called **The Fridge**.

You must deliver a **complete working product**, not a scaffold, not a partial refactor, and not a legacy port.

When legacy code conflicts with product quality, domain coherence, or delivery reliability, **replace it**.

---

## PRIMARY GOAL

Build **The Fridge**, an **offline-first modern PWA** for:

- pantry inventory management
- recipes
- meal planning
- meal consumption
- shopping list generation
- import/export/reset
- inventory movement history

The app must work **without a backend** and remain usable **offline after first successful load**.

---

## MUST

### 1. Product identity
- The product name must be **The Fridge** everywhere.
- `document.title` must be `The Fridge`.
- `manifest.name` must be `The Fridge`.
- `manifest.short_name` must be `The Fridge`.
- The visible app shell branding must be `The Fridge`.
- The active app must use coherent cooking/pantry-related terminology only.

### 2. One active app only
- The repository must contain **one active app only**.
- The default developer workflow must clearly build and run **The Fridge**.
- If legacy material is retained, it must be archived and non-executed.
- Archived material must not affect build, routing, assets, package naming, or search in active code.

### 3. Required stack
- React
- TypeScript
- Vite
- React Router
- IndexedDB
- Dexie or equivalent IndexedDB abstraction
- vite-plugin-pwa or equivalent
- Zod
- date-fns
- Vitest
- React Testing Library

### 4. Required architecture
- Separate UI, domain logic, persistence, validation, and PWA/runtime concerns.
- Keep database access behind a dedicated data layer.
- Keep critical business logic outside large page components.
- Use stable serializable entities with timestamps.
- Support schema/data versioning.
- Keep future auth/sync extension points isolated from core product logic.

### 5. OAuth readiness
- Prepare architecture for future OAuth/OpenID Connect integration.
- Create a clear auth abstraction/interface.
- Reserve an extensible settings/account area for future sign-in.
- Avoid anonymous-only assumptions deeply embedded in domain logic.
- Future providers must remain feasible: Google, Apple, GitHub, generic OAuth 2.1 / OIDC.

### 6. Sync readiness
- Prepare architecture for future cloud sync.
- Keep local persistence separate from future remote sync concerns.
- Use stable record IDs and timestamps.
- Keep export/import versioned and migration-friendly.
- Do not hardwire assumptions that block future multi-device sync.

### 7. Required routes
The active app must provide at least these routes:
- `/`
- `/pantry`
- `/recipes`
- `/recipes/new`
- `/recipes/:id`
- `/recipes/:id/edit`
- `/planner`
- `/shopping-list`
- `/settings`

### 8. Required data collections
The data layer must contain at least:
- `pantryItems`
- `recipes`
- `mealPlans`
- `shoppingItems`
- `inventoryMovements`
- `appSettings`

### 9. Required pantry functionality
The app must allow the user to:
- create pantry items
- edit pantry items
- delete pantry items
- search pantry items by ingredient name
- filter pantry items by:
  - all
  - below threshold
  - expiring soon
  - expired
  - depleted

Every pantry item must include:
- `id`
- `displayName`
- `normalizedName`
- `quantity`
- `unit`
- `createdAt`
- `updatedAt`

Optional pantry fields may include:
- `category`
- `minThreshold`
- `expirationDate`
- `notes`

### 10. Required recipe functionality
The app must allow the user to:
- create recipes
- edit recipes
- delete recipes
- duplicate recipes
- search recipes by title
- filter by category and/or tags
- dynamically add/remove ingredients
- dynamically add/remove/reorder steps
- scale ingredients by servings
- inspect recipe detail

Every recipe must include:
- `id`
- `title`
- `servings`
- `ingredients`
- `steps`
- `createdAt`
- `updatedAt`

Optional recipe fields may include:
- `description`
- `category`
- `tags`
- `prepTimeMinutes`
- `cookTimeMinutes`
- `notes`

Every recipe ingredient must include:
- `id`
- `displayName`
- `normalizedName`
- `quantity`
- `unit`

Optional recipe ingredient field:
- `optional`

### 11. Required planner functionality
The app must allow the user to:
- plan a recipe on a date
- choose a meal slot
- choose servings for that plan
- edit a plan
- delete a plan
- view daily planning
- view weekly planning

Canonical meal slot values must be:
- `breakfast`
- `lunch`
- `dinner`
- `snack`

Italian UI labels may map these to:
- `colazione`
- `pranzo`
- `cena`
- `snack`

Every meal plan entry must include:
- `id`
- `date`
- `slot`
- `recipeId`
- `servings`
- `status`
- `createdAt`
- `updatedAt`

Allowed `status` values:
- `planned`
- `consumed`

### 12. Required meal consumption workflow
Marking a meal as consumed must:
1. load the recipe
2. scale the recipe ingredients based on servings
3. compare required ingredients with pantry stock
4. subtract available stock
5. never reduce pantry stock below zero
6. create deficits for missing required ingredients
7. add or merge deficits into shopping list
8. mark the meal as consumed
9. create inventory movement history records

Additional rules:
- optional recipe ingredients must not generate deficits
- already consumed meals must not consume stock again
- the operation must be logically atomic
- the UI must show clear success feedback

### 13. Required shopping list functionality
The app must allow the user to:
- add shopping items manually
- edit shopping items
- delete shopping items
- mark shopping items as purchased
- filter by:
  - to buy
  - purchased
  - all
- create shopping items from recipe missing ingredients
- create shopping items from meal consumption deficits
- transfer purchased shopping items into pantry

Every shopping item must include:
- `id`
- `displayName`
- `normalizedName`
- `quantity`
- `unit`
- `checked`
- `sourceType`
- `createdAt`
- `updatedAt`

Optional fields:
- `sourceRefId`
- `notes`

Allowed `sourceType` values:
- `manual`
- `recipe-missing`
- `consumption-deficit`

### 14. Required movement history
The app must track at least:
- manual pantry add
- manual pantry edit
- manual pantry delete if implemented
- meal consumption
- shopping-to-pantry transfer
- import
- reset

Every movement must include:
- `id`
- `ingredientNormalizedName`
- `ingredientDisplayName`
- `delta`
- `unit`
- `reason`
- `createdAt`

Optional fields:
- `referenceId`
- `metadata`

### 15. Required import/export/reset
The app must allow the user to:
- export all app data as JSON
- import previously exported JSON
- reset all data to demo seed data

Import/export rules:
- export format must be versioned
- import payload must be schema-validated
- invalid import must not crash the app
- invalid import must not partially corrupt app data
- reset must restore a coherent demo state

### 16. Required units
The product must support at least:
- `g`
- `kg`
- `ml`
- `l`
- `pcs`
- `tbsp`
- `tsp`

Italian UI labels may render as:
- `g`
- `kg`
- `ml`
- `l`
- `pz`
- `cucchiaio`
- `cucchiaino`

### 17. Required conversions
The product must support at least:
- `g <-> kg`
- `ml <-> l`

Rules:
- incompatible units must remain separate
- do not invent unsafe conversions between count, mass, and volume

### 18. Required UX quality
The app must be:
- mobile-first
- responsive from 320px width to desktop
- touch-friendly
- coherent
- polished enough to feel like a real product

The app must include:
- clear primary navigation
- useful empty states
- readable form validation
- destructive action confirmation
- success/error feedback
- no dead-end core flows
- no broken placeholder screens in active product areas

### 19. Required accessibility
The app must include:
- semantic headings
- form labels
- keyboard accessibility
- visible focus states
- readable contrast
- correct button/link semantics
- accessible error/validation messaging
- adequate touch target sizes

### 20. Required PWA quality
The app must include:
- a valid `manifest.webmanifest`
- app icons
- maskable icons
- installability on compatible browsers
- a working service worker
- app shell offline caching
- route navigation offline after first load
- local data usability offline after first load

The app should also include if feasible:
- update-available UI
- install hint UI
- standalone-safe layout
- safe-area aware layout

### 21. Required demo seed
The app must ship with coherent demo data including at least:
- 8–12 pantry items
- 5–8 realistic recipes
- 2 planned meals
- 1 or more shopping items

### 22. Required testing
Automated tests must exist for at least:
- ingredient normalization
- compatible unit conversion
- recipe scaling
- meal consumption pantry subtraction
- shopping deficit generation
- import/export validation roundtrip
- protection against double consumption

---

## SHOULD

- Use Zustand or Context + reducer for state, whichever keeps the implementation simplest and most robust.
- Lazy-load route-level code where appropriate.
- Provide a clear dashboard summary.
- Show low-stock and expiring items on the dashboard.
- Show today’s planned meals on the dashboard.
- Merge compatible duplicate shopping items where sensible.
- Present movement history newest first.
- Use human-readable history labels.
- Add route(s) such as `/history` if they improve clarity without complicating navigation.
- Provide a future-friendly `auth/` and `sync/` boundary even if only stub interfaces are implemented.
- Keep seed data realistic and household-oriented.
- Use Italian UI copy consistently.
- Use English for code, types, schemas, and comments.
- Add a small update notification when a new service worker version is available.
- Add PWA shortcuts for actions like Add Ingredient, Add Recipe, Open Shopping List if it is easy and stable.

---

## MUST NOT

- Must not ship a scaffold instead of a complete app.
- Must not do a 1:1 Android port.
- Must not use React Native as the implementation base.
- Must not use Flutter as the implementation base.
- Must not keep active off-domain screens, routes, or features.
- Must not require a backend for core product behavior.
- Must not require login in the MVP.
- Must not include hardcoded API keys or secrets.
- Must not depend on external APIs for core functionality.
- Must not place critical business rules only inside page components.
- Must not allow pantry quantities to display below zero.
- Must not let optional recipe ingredients create automatic shopping deficits.
- Must not allow consuming the same meal twice to subtract stock twice.
- Must not crash on empty local database.
- Must not crash on malformed import payload.
- Must not rely on hover-only interactions for core actions.
- Must not leave domain-incoherent branding in active product code.
- Must not leave blocking TODOs in core flows.
- Must not break offline navigation after first successful load.
- Must not degrade local-first behavior in order to add decorative non-essential features.

---

## SHORT EXECUTION PROMPT

```text
Rewrite this repository into a single production-grade offline-first PWA called “The Fridge”.

Deliver a complete product, not a scaffold.

MUST:
- one active app only
- product name everywhere: The Fridge
- Italian user-facing UI
- React + TypeScript + Vite
- React Router
- IndexedDB with Dexie or equivalent
- vite-plugin-pwa or equivalent
- Zod
- date-fns
- Vitest + React Testing Library
- installable PWA
- working offline after first load
- no backend required
- no hardcoded secrets
- no active off-domain legacy remnants
- architecture ready for future OAuth/OIDC and future sync, but no auth required in MVP

MUST implement:
- dashboard
- pantry CRUD with search/filters/threshold/expiration
- recipes CRUD with duplication, ingredients, steps, serving scaling
- planner with daily/weekly views
- meal consumption transaction flow
- shopping list CRUD with generated deficits
- movement history
- import/export/reset
- coherent demo seed data

MUST enforce:
- normalizedName for ingredients
- units: g, kg, ml, l, pcs, tbsp, tsp
- safe conversion only for g<->kg and ml<->l
- no negative pantry quantities
- optional recipe ingredients do not generate shopping deficits
- consuming the same meal twice does not subtract stock twice

MUST provide routes:
- /
- /pantry
- /recipes
- /recipes/new
- /recipes/:id
- /recipes/:id/edit
- /planner
- /shopping-list
- /settings

MUST provide collections:
- pantryItems
- recipes
- mealPlans
- shoppingItems
- inventoryMovements
- appSettings

MUST remove active references to:
- TheWeather
- Weather
- OpenWeatherMap
- Nutrition Point
- ahmux
- Ahmux
- supportnutritionpoit
- books
- seats
- socialgames
- unrelated React Native / Android legacy artifacts

MUST pass:
- npm install
- npm run dev
- npm run build
- npm run preview
- automated tests for normalization, conversion, scaling, meal consumption, shopping deficits, import/export, and double-consumption protection

Prefer replacement over preserving broken legacy code.
Prioritize correctness, coherence, offline reliability, and polish.