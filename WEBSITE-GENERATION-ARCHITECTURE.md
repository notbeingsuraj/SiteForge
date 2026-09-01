# WEBLOOM — WEBSITE GENERATION ARCHITECTURE REPORT (READ-ONLY)

> Design pass only. No files modified, no packages installed, no servers started, nothing committed.
> Goal: personal, local-only generation of a real, browser-viewable website from a Google Maps URL.

---

## 1. EXISTING ARCHITECTURE

The repository is an npm workspace (`webloom`):
```
package.json                 # workspaces: ["apps/*","packages/*"]; scripts dev:api / dev:web
apps/
  api/    # Node + Express ESM backend (@webloom/api), port 5001
  web/    # React 18 + Vite 5 + TS + Tailwind control-panel UI (@webloom/web), port 5173
packages/
  config/ # (empty of runtime logic in this space)
```

### Extraction pipeline (backend, PROVEN — do not redesign)
```
Google Maps URL
 → GoogleMapsUrlParserProvider (deterministic hints: IDENTIFIED)
 → GeoapifyProvider (DISCOVERED)            [L2]
 → WebExtractionProvider (DISCOVERED, onlyIfMissing when geoapifyRecord)  [L3]
 → AI fill-only enrichment (_enrichMissingWithAI, INFERRED, soft-fail)    [L4]
 → validateBusinessProfile (L5)
 → BusinessProfile  (provenance-tracked; verified facts only)
 → optional Brand DNA (non-fatal since D1 fix)
```
- `BusinessProfile` (in `apps/api/src/services/BusinessProfile.js`) is the **authoritative verified-facts store**: `identity`, `contact`, `location`, `ratings`, `hours`, `social_links`, each field carrying `{value, provenance, confidence}`. Only IDENTIFIED/DISCOVERED/VERIFIED facts enter it — INFERRED never.
- Endpoint: `POST /api/business/analyze` (and `/research` alias).

### Existing "website" layer (STRATEGY ONLY — no code generation yet)
These services generate **structured JSON**, never source files:
| Service | Produces |
|---|---|
| `BrandStrategyService` | Brand DNA (positioning, audience, personality, tone, colors…) |
| `DigitalAuditService` | Digital-audit JSON |
| `WebsiteStrategyService` | Website strategy JSON (`websiteGoal`, `pages`, `homepageSections`, `visualDirection`, `trustStrategy`, `conversionStrategy`, `seoStrategy`) |
| `WebsiteCopywritingService` | Website copy JSON (`hero`, `services`, `about`, `faq`, `finalCTA`, `metadata`) |
| `LandingPageSpecService` | Landing-page spec JSON (`pageTitle`, `sections[]`, `theme{colorPalette,typography,style}`, `primaryCTA`) |

### AI / model layer
- `AIService` (`apps/api/src/services/AIService.js`) — singleton export `new AIService()`; wraps OmniRoute `/chat/completions` with retries + fallback + a **`coding` model role**.
- `config.omniroute.models`: `coding: 'auto/best-coding'` (also `reasoning`, `fast`, `copywriting`).
- `AIService.generate({prompt, model, schema, temperature, maxTokens, systemPrompt})`:
  - If `schema` → returns **parsed JSON**.
  - If **no `schema`** → returns the raw `content` **string** (⇒ this is the hook for emitting source code).
- **`model:'coding'` is currently NEVER used anywhere in the codebase** — `grep` for `'coding'` returned no call sites. It is a clean, ready, unused integration point.

### Control-panel UI (`apps/web`)
- React + Vite + Tailwind + Zustand + React-Query + axios (`baseURL http://localhost:5001/api`).
- Pages: `Dashboard.tsx`, `LeadDetail.tsx`, `NewLead.tsx`; services `api.ts`, `leadService.ts`.
- **The current UI is a lead-management console. There is NO website-generation workflow, page, or "Open Website" action in the UI today.**

### Confirmed ABSENT (missing subsystems)
- No `WebsiteGenerationService` (nowhere do generated source files get written).
- No `generated-sites/` directory, no `templates/`, no AST-based renderer, no component library for generated sites.
- No `website/generate` route; no port management; no local dev-server orchestration for generated sites.
- `models/` dir is empty.

---

## 2. MISSING SUBSYSTEMS

To go from `BusinessProfile → real local website`, the following do **not** exist and must be added:

1. **`WebsiteGenerationService`** — orchestrates: gather `BusinessProfile` + strategy + copy + page-spec → call OmniRoute **coding** model → receive source code → write files to disk.
2. **A generated-site project "scaffold"/template** — the minimal renderer project that each generated site is based on.
3. **A disk writer** — maps AI output (or template-evaluated output) to a real directory tree under a `generated-sites/` root.
4. **A local dev-server runner** — `npm install` (once), `npm run dev`/`build`, bind a chosen port, serve to browser.
5. **A backend route** — `POST /api/website/generate` (and control ops: `list`, `start`, `stop`, `delete`).
6. **UI additions** — Dashboard actions: Generate → Open Website → Stop → Regenerate → Delete; the Browser opens `http://localhost:<port>`.
7. **Port registry** — choose the next free local port per generated site.
8. **State** — a simple on-disk manifest (`generated-sites/.webloom.json` or per-site JSON) mapping site → slug → port → status. No database.

---

## 3. RECOMMENDED ARCHITECTURE

The intended architecture is **correct and verified against the repo**; only the bottom half is missing:

```
BusinessProfile (verified facts)
   │
   ▼
WebsiteStrategyService ─┐
WebsiteCopywritingService ┼── all already exist, produce structured JSON
LandingPageSpecService ───┘
   │
   ▼
WebsiteGenerationService   ← NEW
   │   merges verified facts + strategy + copy + spec
   │   calls AIService.generate({ model:'coding', schema:false })  → source code string(s)
   ▼
write to disk: generated-sites/<slug>/…   (NEW)
   │
   ▼
local renderer (Astro or Vite+React — see §9)   ← NEW
   │  npm install (once/if needed) → npm run dev → localhost
   ▼
browser: http://localhost:<port>
```

**Integration point (cleanest):** `BusinessProfile` is already the single normalized source of verified facts. `WebsiteGenerationService` sits *after* the existing JSON services and *before* the disk writer. It consumes the already-proven strategy/copy/spec JSONs and the verified `BusinessProfile`; it emits code through the **unused `model:'coding'` path** of the existing `AIService` singleton. No change to extraction/Geoapify/AIService internals required.

**Critical rule (non-negotiable):** Only the verified `BusinessProfile` fields (and strategy/copy JSON derived from them) may become *factual* page content. Never let the AI invent phone numbers, addresses, hours, prices, or reviews. `BusinessProfile.Metadata.sources` already records where each fact came from — the generator must render **only** non-null, known-provenance fields.

---

## 4. EXACT FILES THAT WOULD NEED TO BE CREATED

```
generated-sites/                                  # root for generated artifacts (gitignored)
  .gitignore
  .webloom.json                                  # manifest: { slug: { port, status, updatedAt } } (simple, no DB)

apps/api/src/services/WebsiteGenerationService.js   # orchestrator: strategy→code→disk
apps/api/src/services/GeneratedSiteManager.js       # CRUD + port alloc + server start/stop (child_process)
apps/api/src/services/GeneratedSiteRenderer.js      # scaffold + install + dev-server lifecycle (or fold into manager)
apps/api/src/prompts/websiteCode.js                 # coding-model prompt (Option-2 config-driven — see §9)
apps/api/src/routes/website.js                      # POST /generate, GET /list, POST /:slug/start|stop|regenerate, DELETE /:slug

apps/web/src/services/websiteService.ts             # API client for the new routes
apps/web/src/pages/GeneratedSites.tsx               # or extend Dashboard: Generate / Open / Stop / Regenerate / Delete
apps/web/src/store/websiteStore.ts                  # (tiny) UI state for the current site + status

# Renderer (Option 2 recommendation) — ONE reusable, checked-in template project:
templates/astro-site/                               # or templates/react-vite-site — see §9 decision
  package.json
  astro.config.mjs   (or vite.config.ts)
  src/
    pages/index.astro  (or src/main.tsx + App)
    lib/site.config.json.ts   # the WebsiteStrategy/config the generator writes
    styles/global.css
    components/…             # small fixed set of presentational components
  public/

# (Option 1 alternative — AI full project, only if Option 2 is rejected)
generated-sites/<slug>/{package.json, src/pages/index.astro, src/components/…, src/styles/…, public/}
```

---

## 5. EXISTING FILES THAT WOULD NEED TO BE MODIFIED

| File | Modification | Necessity |
|---|---|---|
| `apps/api/src/app.js` | Mount the new `website` routes (`app.use('/api/website', websiteRoutes)`) | Required |
| `apps/api/src/config/env.js` | Add `generatedSitesDir` (default `<repo>/generated-sites`), `websiteHost/BasePort`, maybe `WEBSITE_DEV_TOOL` | Recommended |
| `apps/api/src/services/AIService.js` | **No change required** — `model:'coding'`, `schema:false`, raw-string return all already supported | Optional (maybe export code model helper) |
| `apps/api/src/prompts/websiteStrategy.js` / `websiteCopy.js` / `landingPageSpec.js` | Minor: add a "render constraints / no-fabrication" re-emphasis and a "components/config" output hint | Recommended |
| `apps/web/src/services/api.ts` | (Already generic) — no change needed | None |
| `apps/web/src/App.tsx` / `Navbar.tsx` / `Dashboard.tsx` | Add navigation + page for generated sites | Recommended |
| `package.json` (root) | Add `generated-sites` to a workspace-ignore or `.gitignore` at root (it lives outside the core app source) | Required (storage isolation) |
| `.gitignore` | Exclude `generated-sites/` from the core repo | Required |

No changes are needed to `BusinessResearchService`, the providers, `BusinessProfile`, `GeoapifyProvider`, or the D1/D2 fixes.

---

## 6. AI MODEL ROLE

`AIService.generate({ model: 'coding' /* => auto/best-coding */, schema: false })` returns the raw content string — this is the **code-emitting** path.

Clear separation of what is AI vs. what is verified:

| Layer | Producer | Content | Fabrication allowed? |
|---|---|---|---|
| **1. Business facts** | `BusinessProfile` (providers) | name, category, phone, website, address, hours, rating | **NO — verified only** |
| **2. Website strategy** | `WebsiteStrategyService` | pages, section order, CTAs, conversion plan | AI may *propose*, but must reference facts only |
| **3. Copy** | `WebsiteCopywritingService` | headlines, body, FAQ wording | AI may *write copy*, but must not invent facts |
| **4. Visual/design** | `LandingPageSpecService` (`theme`) | colors, typography, layout, imagery style | Yes — pure design |
| **5. Actual source code** | NEW `WebsiteGenerationService` → `model:'coding'` | components, CSS, markup, sections | Yes — code only; facts injected from earlier layers |

**Hard rule:** The coding-model prompt gets the verified `BusinessProfile` **as the only source for factual values**, plus the JSON strategy/copy/spec. It is instructed to substitute fact values from the profile and render `null`/unknown fields as empty/omitted, never fabricated. All AI output is code/design, never new factual claims.

---

## 7. LOCAL RENDERING MECHANISM

**Recommended:** Node-based framework (no new runtime — Node is already present).

Two viable mechanisms (see §9 for the selection):
- **Astro** (`npx create-astro` style static/SSG): `generated-sites/<slug>/` → `npm install` → `npm run dev` binds `localhost:<port>`; static HTML → trivially served. Great for content/marketing sites (matches the strategy/copy page model: hero, services, about, location, CTA, footer).
- **Vite + React** (mirrors `apps/web` stack): `npm run dev` → `localhost:<port>`.

The renderer just runs a framework's standard dev command as a **child process** (Node `child_process.spawn`), scrapes stdout for the actual bound port, and reports it. No custom server, no reverse proxy needed for personal local use — one site per port.

---

## 8. USER VIEWING FLOW

```
1. User pastes Google Maps URL in Dashboard
2. POST /api/business/analyze  → validated BusinessProfile (+ strategy/copy/spec on demand)
3. User clicks "Generate Website"
4. POST /api/website/generate
   → WebsiteGenerationService writes generated-sites/<slug>/ (code via model:'coding')
5. GeneratedSiteManager runs `npm install` (once) + starts the dev server on a free port
6. UI flips to "Open Website" button
7. Browser window opens  http://localhost:<port>
```
Server-side flow (single request does all of it, keeps the user workflow to one click):
`analyze data → strategy → copy → spec → code → write disk → install → start server → return {url}`.
A `GET /api/website/list` shows all generated sites with status/port; each has Open / Stop / Regenerate / Delete.

---

## 9. TEMPLATE VS FULL AI GENERATION DECISION

### OPTION 1 — AI generates an entire frontend project from scratch
- AI writes `package.json`, config, all components, all CSS each time.
- **Reliability:** LOW — variability in framework syntax, config, and module versions; high chance of broken builds.
- **Visual quality:** HIGH ceiling but HIGHLY variable between runs.
- **Regeneration:** Poor — each regen is a fresh gamble; not idempotent.
- **Maintainability:** Poor — no shared foundation; you debug `node_modules` drifts per site.
- **Code safety:** Low — AI-authored config/scripts run `npm install`/`npm run dev`; more surface for injected/odd commands.
- **Dev complexity:** High — need to validate/repair arbitrary projects.

### OPTION 2 — Webloom owns a reusable renderer/template; AI generates a **structured config** that drives it (RECOMMENDED)
- Webloom checks in ONE thin renderer project (Astro or Vite+React). The generator writes a **`site.config.json`** (theme tokens, sections with content, page order, CTA) derived from verified profile + strategy + copy + spec. The AI may (a) fill the config directly, and/or (b) emit fine-grained per-section `{component, props, styles}` blocks. The template's fixed components render that config.
- **Reliability:** HIGH — framework/build are fixed and known-good; AI only produces config/JSON (or small scoped code blocks).
- **Visual quality:** GOOD and consistent — themed components guarantee a coherent look with per-site color/type.
- **Regeneration:** Excellent — editing `site.config.json` + restart/`vite dev` = clean regenerate; idempotent.
- **Maintainability:** Excellent — one template to upgrade.
- **Code safety:** High — AI output is config/JSON (or narrowly-scoped component code), not arbitrary project config/scripts.
- **Dev complexity:** Low — write the template once; the generator is mostly a JSON writer.

### Recommendation
For a **personal, local tool** that must "just work," **OPTION 2** is the smallest architecture that reliably delivers. Concretely I recommend a **single-page + a few sections Astro (or Vite+React) site driven by `site.config.json`**, with the AI filling the config and (optionally) extra CSS/component snippets. As a pragmatic middle ground for the first slice: the AI emits one well-scoped `index.astro` (or a small React tree) **from a fixed shared scaffold**, i.e., Option 2 with light AI-authored styling within a locked template — not a from-scratch project.

> Astro is singled out because the existing `LandingPageSpecService` and copy/strategy layers are already organized as **sections/pages** (hero, services, about, location, CTA, footer) — a natural fit for Astro's page/component model and zero-client-JS needs. Vite+React is the fallback if team familiarity with React (the existing UI) outweighs Astro's simplicity.

---

## 10. FIRST END-TO-END TEST (Tartine Bakery)

**Acceptance test (manual, local):**
```
Input:  Google Maps URL for Tartine Bakery
        https://www.google.com/maps/place/Tartine+Bakery/@37.7615,-122.4227,17z
Steps:  analyze → generate → (install) → start
Expected output:
  P1  generated-sites/tartine-bakery/ exists with real source files (package.json, src/, public/)
  P2  `npm install` succeeds (or is skipped after first global/cached install)
  P3  `npm run dev` binds a local port; GET /health or the page returns 200
  P4  browser opens http://localhost:<port> and renders the site
  P5  The rendered page contains (where available from the VERIFIED profile and NOT fabricated):
        - business name           "Tartine Bakery"
        - category                (e.g. bakery)
        - description             (from profile/strategy copy, derived)
        - phone                   (from verified profile)
        - website link            (official site)
        - address / city / state
        - opening hours
        - services/categories
        - a CTA (call visit / contact / directions)
        - a map/location section
        - responsive layout (mobile-first)
  P6  NO fabricated business facts: render only non-null, official-profile fields.
      (Automated check: assert that every factual string on the page equals a BusinessProfile
       value, or that missing fields are omitted.)
  P7  "Open Website" action in the UI opens the browser.
  P8  Stop kills the dev server and frees the port; Regenerate rebuilds from new data; Delete removes the folder.
```

---

## 11. RISKS / FAILURE MODES

1. **Fact fabrication (highest risk, violates core rule).** Mitigate: verified-only injection; render omitted for null; post-generation lint that every factual token on the page matches a `BusinessProfile` value.
2. **AI code doesn't compile.** Option 2 largely eliminates this; for emitted snippets, wrap in try/build + show a "regenerate" retry with error feedback.
3. **Port collisions.** Managed via a simple manifest + free-port allocation; always read the actual bound port from dev-server stdout.
4. **`npm install` in generated dirs** (network, slowness, node_modules bloat). Mitigate: workspace-level shared node_modules / one-time install; treat `generated-sites/node_modules` as cacheable + gitignored; `npm install --no-audit --no-fund`.
5. **Long-running dev servers / orphaned processes.** Personal tool risk: cap concurrent servers, auto-stop on App/generation-manager idle, kill by port on delete.
6. **Token cost/time of the coding model** (large generated projects). Option 2 keeps AI output small (config + scoped snippets), bounding cost.
7. **Security of running arbitrary generated code.** Local-only, single-user, but still: do not auto-execute untrusted scripts with elevated privileges; renderer is our own template so attack surface is small.
8. **`.env`/secret hygiene** — never write the real OmniRoute/Geoapify keys into generated sites (reuse the existing redaction helpers; keep keys in `apps/api/.env`).
9. **Astro/React version drift** between the template and the generated project — pin the template's package.json (devDeps exact).
10. **Repo growth / artifact isolation** — `generated-sites/` must be gitignored so it never enters the core app history.

---

## 12. IMPLEMENTATION PLAN (PROPOSED — awaiting approval; no code written)

**Phase W1 — Foundation (skeleton + storage)**
- `.gitignore` add `generated-sites/`; root `generated-sites/.webloom.json` manifest.
- `WebsiteGenerationService.js` + `GeneratedSiteManager.js` (port alloc, spawn/stop dev server, status).
- `config/env.js`: `generatedSitesDir`, `websiteHost`, `websiteBasePort`.
- `routes/website.js` + mount in `app.js`: `POST /generate`, `GET /list`, `POST /:slug/start|stop|regenerate`, `DELETE /:slug`.

**Phase W2 — Renderer template (Option 2)**
- Create `templates/astro-site/` (one known-good site project: `package.json`, `astro.config.mjs`, `src/pages/index.astro`, `components/`, `styles/`, `public/`).
- The template renders `src/lib/site.config.json` (theme + sections + facts).

**Phase W3 — Code generation**
- `prompts/websiteCode.js`; `WebsiteGenerationService`:
  - Assemble `BusinessProfile` (verified) + strategy + copy + spec.
  - Validate facts; build the `site.config.json`.
  - Call `AIService.generate({model:'coding', schema:false})` for the config/scoped component + CSS.
  - Write `generated-sites/<slug>/…` (copy template, overlay config, optional AI styling block).

**Phase W4 — Local render + UI**
- `websiteService.ts`, `websiteStore.ts`, `GeneratedSites` page + Navbar entry.
- Dashboard: Generate / Open / Stop / Regenerate / Delete; open `http://localhost:<port>`.

**Phase W5 — E2E acceptance (Tartine) + verification**
- Run the §10 acceptance test end-to-end; assert no fabricated facts (P6); verify Open/Stop/Regenerate/Delete (P8); confirm no regressions in `npm test` (22/22).

---

*This is a design document. No code was changed. Awaiting your approval of the implementation plan before any implementation begins.*
