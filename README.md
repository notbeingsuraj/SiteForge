<div align="center">

```text
███████╗██╗████████╗███████╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗
██╔════╝██║╚══██╔══╝██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
███████╗██║   ██║   █████╗  █████╗  ██║   ██║██████╔╝██║  ███╗█████╗
╚════██║██║   ██║   ██╔══╝  ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝
███████║██║   ██║   ███████╗███████╗╚██████╔╝██║  ██║╚██████╔╝███████╗
╚══════╝╚═╝   ╚═╝   ╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
```

### `turn a business listing into a sales-ready website opportunity.`

SiteForge takes messy, incomplete real-world business data and forges it into a validated website — through a pipeline where AI reasons, but never decides alone. Every AI output is treated as untrusted input until it survives schema validation, normalization, and isolation checks.

```text
╔══════════════════════════════════════╗
║  SITEFORGE // BUSINESS → OPPORTUNITY  ║
║  STATUS: ██████████ ONLINE            ║
╚══════════════════════════════════════╝
```

<img src="https://img.shields.io/badge/STATUS-ACTIVE%20DEVELOPMENT-00ffcc?style=for-the-badge&labelColor=050505">
<img src="https://img.shields.io/badge/AI-ORCHESTRATED-ff00ff?style=for-the-badge&labelColor=050505">
<img src="https://img.shields.io/badge/ARCHITECTURE-MODULAR-00e5ff?style=for-the-badge&labelColor=050505">
<img src="https://img.shields.io/badge/ENGINEERING-CONTRACT--DRIVEN-aaff00?style=for-the-badge&labelColor=050505">

</div>

---

### `// WHAT IT DOES`

```text
BUSINESS DATA → INTELLIGENCE → BRAND DNA → STRATEGY → SPEC → VALIDATION → WEBSITE
```

Most AI site-builders collapse this into one prompt and hope. That produces hallucinated business info, cross-contaminated state between businesses, and malformed output that quietly breaks the pipeline. SiteForge treats those as **engineering problems**, not prompting problems — hence the pipeline above, not a single LLM call.

```text
PROBABILISTIC AI  +  DETERMINISTIC SOFTWARE  +  EXPLICIT CONTRACTS  =  RELIABLE GENERATION
```

---

### `// WHERE BUSINESS DATA COMES FROM`

Business evidence is layered from most- to least-trusted. Deterministic structured data always wins; AI only fills the gaps and never overwrites verified facts.

```text
LEVEL 1  INPUT HINTS        identified  (name / city / coords from the URL or user)
LEVEL 2  GEOAPIFY PLACES    discovered  (phone, website, address, hours, category)
LEVEL 3  WEB EXTRACTION     discovered  (fallback HTML extraction)
LEVEL 4  AI ENRICHMENT      inferred    (fills only missing description/services)
LEVEL 5  VALIDATION                    (schema + structure checks before use)
```

Every provider sits behind a single abstraction so the rest of SiteForge never learns provider details:

```text
ROUTE → BusinessResearchService → BusinessDataProvider
                                      ├── GeoapifyProvider       (geocode → place-details)
                                      ├── WebExtractionProvider  (HTML fallback)
                                      └── GooglePlacesProvider   (future)
```

**Geoapify** is the structured evidence source: a name + coordinates search returns the place, then a `place-details` lookup enriches it with `contact.phone`, `website`, `opening_hours`, and hierarchical `categories`. If the key is missing, auth fails, the API is rate-limited, times out, or returns nothing usable, the pipeline silently falls back to web extraction and AI — a single business lookup never hard-fails because one provider hiccuped.

> The Geoapify provider is backend-only. The API key lives in `apps/api/.env` (git-ignored) and is never exposed to the frontend or response payloads. Provider responses are mapped into SiteForge's canonical profile by `ProviderAdapter` and normalized/validated by `BusinessProfileValidator` before any downstream stage sees them.

---

### `// AI OUTPUT IS UNTRUSTED INPUT`

Every model response goes through the same gauntlet before it's allowed anywhere near a website:

```text
AI PROVIDER → RAW RESPONSE → PARSER → SCHEMA VALIDATOR → STRUCTURE VALIDATOR → NORMALIZER → CONTRACT → NEXT STAGE
```

Invalid JSON, missing fields, or a wrong section shape doesn't propagate — it gets rejected, retried, or fails loudly. A landing page spec isn't "valid" just because it parses; it has to match the section contract the generator actually expects (`spec.sections[]`, not `spec.hero`).

**Business isolation** is enforced the same way: a request sequence like `A → B → A → C` is explicitly tested to guarantee Business A's data can never leak into Business B's output, even across shared service instances and AI providers.

---

### `// ENGINEERING PRINCIPLES`

| Principle | What it means here |
|---|---|
| Separation of concerns | `DATA ≠ STRATEGY ≠ UI` — extraction never touches generation |
| Fail fast | Invalid data doesn't silently continue downstream |
| Defensive parsing | AI responses are never trusted by default |
| State isolation | One business can never contaminate another |
| Provider independence | Core logic isn't wired to one AI provider |
| Observability | A failure should say *why*, not just *that* |

---

### `// PROJECT STRUCTURE`

```text
SiteForge/
├── apps/
│   ├── api/            → services, controllers, routes, tests
│   └── web/             → frontend
├── packages/
│   ├── schemas/         → shared validation contracts
│   └── core/             → shared logic
├── docs/                 → architecture & pipeline decisions
└── .env.example
```

Core services worth knowing: `BusinessDataExtractor`, `BrandDNAService`, `BrandStrategyService`, `WebsiteStrategyService`, `LandingPageSpecService` — each with its own input/output contract, validation, and test coverage.

Business-data providers live under `apps/api/src/services/providers/`: `BusinessDataProvider` (abstraction), `GeoapifyProvider`, `WebExtractionProvider`, and `ProviderAdapter` — plus `BusinessProfileValidator` for the final normalized profile.

---

### `// RUN IT`

```bash
git clone https://github.com/notbeingsuraj/SiteForge.git
cd SiteForge
npm install
cp .env.example .env
npm run dev
```

```bash
npm test        # pipeline + isolation + contract tests
```

> Exact scripts are defined per-package in `package.json` — check `apps/api` and `apps/web` if a command above doesn't match.

---

### `// STATUS`

```text
Business extraction ........... ACTIVE
Structured data (Geoapify) .... ACTIVE
Provider fallback chain ....... ACTIVE
Identity resolution ........... ACTIVE
Isolation guarantees .......... VERIFIED
Brand DNA / strategy layers ... ACTIVE
Contract validation ........... ACTIVE
Website generation ............ IN PROGRESS
Production deployment ......... ROADMAP
```

---

<div align="center">

```text
AI IS A COMPONENT, NOT THE ARCHITECT.
THE SYSTEM MUST BE ABLE TO SAY "I DON'T KNOW"
INSTEAD OF INVENTING AN ANSWER.
```

`BUILD → VALIDATE → DEPLOY → OBSERVE → IMPROVE`

**[github.com/notbeingsuraj/SiteForge](https://github.com/notbeingsuraj/SiteForge)**

</div>
