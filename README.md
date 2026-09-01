<div align="center">

# ▚▚ WEBLOOM

### AUTONOMOUS BUSINESS → WEBSITE INTELLIGENCE RUNTIME

*The model decides what the website should be. The compiler decides how it gets built.*

[![status](https://img.shields.io/badge/status-in--development-39FF14?style=flat-square&labelColor=0d0d0d)](#current-status)
[![type](https://img.shields.io/badge/type-personal--project-00E5FF?style=flat-square&labelColor=0d0d0d)](#current-status)
[![architecture](https://img.shields.io/badge/architecture-intelligence--pipeline-FF00E5?style=flat-square&labelColor=0d0d0d)](#architecture)
[![license](https://img.shields.io/badge/license-undefined-8892b0?style=flat-square&labelColor=0d0d0d)](#license)

</div>

```text
┌──────────────────────────────────────────────────────────┐
│ WEBLOOM // INTELLIGENCE RUNTIME                           │
├──────────────────────────────────────────────────────────┤
│ STATUS      : IN DEVELOPMENT                              │
│ FORMER NAME : SITEFORGE (deprecated)                      │
│ MODE        : ZERO-BUDGET / SINGLE-DEVELOPER              │
│                                                            │
│ INPUT   → BUSINESS SIGNALS                                │
│ THINK   → INTELLIGENCE PIPELINE                           │
│ DESIGN  → BRAND DNA + DESIGN SYSTEM                        │
│ COMPILE → DETERMINISTIC ASTRO OUTPUT                       │
└──────────────────────────────────────────────────────────┘
```

---

## `>_` WHAT IS WEBLOOM

Webloom is not a prompt-to-website generator. It is an **intelligence pipeline** that converts raw, unstructured business signals into a validated, structured specification — and then *compiles* that specification into a production website.

```
RAW BUSINESS DATA
      │
      ▼
   RESEARCH
      │
      ▼
BUSINESS INTELLIGENCE
      │
      ▼
    BRAND DNA
      │
      ▼
DESIGN INTELLIGENCE
      │
      ▼
CONTENT / UX STRATEGY
      │
      ▼
STRUCTURED WEBSITE SPEC
      │
      ▼
DETERMINISTIC COMPILATION
      │
      ▼
PRODUCTION WEBSITE
```

Every stage above the compilation boundary is **probabilistic** — driven by model reasoning. Every stage below it is **deterministic** — driven by code. Webloom is the system that sits at that boundary and enforces it.

---

## `>_` WHY WEBLOOM IS DIFFERENT

The obvious approach to "AI builds websites" looks like this:

```
Prompt → LLM → Raw HTML/CSS/JS
```

This is fast to demo and unreliable in practice:

- output varies run to run — no reproducibility
- models hallucinate markup, copy, and structure
- generated code is fragile and hard to debug
- every regeneration re-invokes the full model, at full cost
- there is no clean point to validate or evaluate output
- the system is locked to whatever provider/model wrote the code

Webloom draws a hard line between **reasoning** and **rendering**:

```
Business
   │
   ▼
Structured Intelligence   ← AI reasons here
   │
   ▼
Design Specification      ← AI reasons here
   │
   ▼
Schema Validation          ← deterministic
   │
   ▼
Deterministic Compiler     ← deterministic
   │
   ▼
Astro Output                ← deterministic
```

The model never writes frontend code. It produces structured, schema-validated **decisions** — layout family, tone, color strategy, section composition. A separate, deterministic compiler interprets those decisions and emits the actual website. This is the same relationship source code has to a compiler: the compiler doesn't guess.

This gives Webloom:

| Property | Why it matters |
|---|---|
| Reproducibility | same intelligence in → same website out |
| Observability | every stage produces inspectable, structured output |
| Validation | schema enforcement catches malformed reasoning before it reaches rendering |
| Model portability | swapping the underlying model doesn't touch the renderer |
| Debuggability | failures are attributable to a specific pipeline stage |
| Cost control | intelligence is cached; rendering is cheap and repeatable |

---

## `>_` ARCHITECTURE

```
                    ┌───────────────────────┐
                    │        WEBLOOM         │
                    │  Intelligence Runtime  │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │  Research / Digital     │
                    │        Audit            │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │  Business Intelligence │
                    │  (verified facts vs.   │
                    │      inference)         │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │       Brand DNA         │
                    │ (personality, tone,     │
                    │  positioning, audience) │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │  Design Intelligence    │
                    │ (layout, typography,    │
                    │  color, motion, CTA)    │
                    └────────────┬───────────┘
                                 │
                          JSON / SCHEMA
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │   Schema Validation     │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │   Design Compiler       │
                    │ (component tree build)  │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │    Astro Renderer       │
                    └────────────┬───────────┘
                                 │
                                 ▼
                       PRODUCTION WEBSITE
```

Every arrow above the "JSON / SCHEMA" line is AI reasoning. Every arrow below it is code with no model in the loop.

---

## `>_` AI RUNTIME — MODEL & PROVIDER INDEPENDENCE

Webloom's AI layer is architected so the application never talks to a specific model or provider directly.

```
                     Webloom Application
                            │
                            ▼
                        AIService
                            │
                            ▼
                  AI Provider Abstraction
                            │
                            ▼
                       AI Gateway
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          Ollama          vLLM        Remote API
        (local, dev)   (cloud GPU)   (fallback /
             │              │         experimentation)
             ▼              ▼              ▼
        Open-weight     Open-weight    Provider-hosted
           model            model           model
```

**Current state:** early inference calls have been routed through **OmniRoute**, an external inference gateway, largely as a pragmatic bootstrap. Reliability and availability of any single external route is not something Webloom wants to depend on long-term.

**Direction:** the `AIService → AI Provider Abstraction → AI Gateway` layers exist specifically so that provider or model changes are isolated to the gateway boundary and never leak into business logic, prompt orchestration, or the compiler.

> No specific inference backend is treated as permanent. The abstraction is the point.

---

## `>_` MODEL PHILOSOPHY

Webloom does not assume one model has to do everything. The long-term shape is role-specialized inference:

```
Business extraction        →  small / fast model
Business reasoning         →  reasoning model
Brand strategy              →  strategy-oriented model
Design intelligence         →  reasoning + structured output
Code / component generation →  coding model
```

| | Status |
|---|---|
| Role-specialized model routing | **PLANNED** |
| Current implementation | fewer models, less specialization |
| Foundation model training | **not happening** — Webloom uses existing open-weight models |
| Webloom-specific fine-tuned model | **FUTURE**, contingent on eventual dataset + evaluation loop |

Nothing above should be read as already running in production. It is the target architecture the current implementation is being built toward.

---

## `>_` AI + DETERMINISTIC LOGIC

Webloom deliberately does not ask a model to make a decision that code can make reliably.

**Deterministic (code) handles:**
- schema enforcement and required-field validation
- section eligibility (e.g. "does this business have a physical address → is a location section eligible")
- routing and component selection constraints
- data integrity checks
- rendering itself

**AI (model) handles:**
- interpretation of raw business signals
- positioning and brand personality
- tone and voice
- visual direction and design reasoning
- content and UX strategy

A concrete example: if a business record contains a verified address, code determines a location section is *eligible*. The model is never asked to reason about whether the address field exists — that's a lookup, not a judgment call. The model's job starts once eligibility is established: how should that section be framed, positioned, and styled.

---

## `>_` STRUCTURED OUTPUT

Every AI stage in Webloom is expected to emit structured, contract-bound output rather than free-form text.

```
   LLM
    │
    ▼
   JSON
    │
    ▼
  Parser
    │
    ▼
Schema Validator
    │
    ▼
Validated Intelligence
    │
    ▼
  Renderer
```

Design Intelligence, for example, is expected to resolve to a **controlled vocabulary** rather than arbitrary invented values:

```json
{
  "layoutFamily": "editorial",
  "typography": "serif + grotesk",
  "motion": "restrained",
  "imageTreatment": "cinematic"
}
```

The compiler only knows how to interpret tokens from this controlled vocabulary — it does not attempt to interpret arbitrary free-text design descriptions. This is what keeps the AI ↔ renderer boundary reliable.

*Schema/validation tooling (e.g. Zod, JSON Schema, TypeScript types) is part of the intended stack; only technologies confirmed in the working codebase should be treated as final.*

---

## `>_` BRAND DNA

Brand DNA sits between Business Intelligence and Design Intelligence, translating "what the business *is*" into "how the business should *feel*":

```
Business Intelligence
        │
        ▼
     Brand DNA
        │
        ▼
Design Intelligence
```

Dimensions under consideration: personality, tone, positioning, audience, emotional direction, visual personality, communication style, differentiation. Brand DNA output is meant to directly constrain Design Intelligence — the pipeline is never "business → random template."

---

## `>_` BUSINESS & DESIGN INTELLIGENCE

**Business Intelligence** is the system's attempt to actually understand the business before designing anything: business profile, existing website (if any), research signals, services, location, category, and other verifiable digital presence data. A core rule here: **verified facts and model inference are kept separate.** Webloom should never present an inferred claim as a confirmed fact.

**Digital Audit / Research** (where present) looks at an existing web presence to surface: current site quality, missing information, positioning gaps, content opportunities, conversion weaknesses, and competitive signals. Where this subsystem is not yet implemented for a given deployment, it should be treated as **planned**, not assumed.

**Design Intelligence** takes Business Intelligence + Brand DNA and resolves them into concrete, renderer-consumable decisions: layout family, visual hierarchy, typography direction, color strategy, spacing philosophy, imagery strategy, section composition, CTA and conversion hierarchy, responsive behavior, and motion philosophy — always expressed through the controlled vocabulary described above, never as free-form frontend code.

---

## `>_` DETERMINISTIC WEBSITE COMPILATION

```
Webloom Intelligence JSON
         │
         ▼
   Design Compiler
         │
         ▼
   Component Tree
         │
         ▼
       Astro
         │
         ▼
CSS / Tokens / Components
         │
         ▼
   Production Site
```

This stage is intentionally boring, in the best sense. Given the same validated intelligence input, the compiler should produce the same output. There is no model call inside the compiler — it's a translation layer from structured decisions to Astro components, styles, and content. Reliability here comes from the compiler being ordinary, testable code, not from prompting.

---

## `>_` CACHING & COST CONTROL

Because inference is the expensive, latency-heavy part of the pipeline, Webloom is designed so it never has to be repeated unnecessarily:

```
Business
   │
   ▼
Research
   │
   ▼
AI Intelligence
   │
   ▼
  CACHE
   │
   ▼
Brand DNA → Design Intelligence
```

On a repeat run for the same business:

```
Business → Cached Intelligence → Deterministic Renderer
```

Regeneration only touches the compiler, not the model. Given the project's zero-budget constraints (see below), avoiding redundant inference calls is a first-order design concern, not an optimization for later.

---

## `>_` RELIABILITY

Failure modes the architecture is designed around: model timeout, malformed JSON, provider or inference-server unavailability, schema mismatch, incomplete input data.

Architectural responses under consideration: retries, fallback providers/models, schema validation gates, deterministic fallback behavior, caching, timeouts, provider abstraction, health checks, structured logging, and stage-level (rather than pipeline-level) failure handling.

| Mechanism | Status |
|---|---|
| Schema validation gate | **planned / partial** |
| Provider abstraction layer | **in development** |
| Retry / fallback routing | **planned** |
| Stage-level failure isolation | **planned** |
| Health checks / logging | **planned** |

None of the above should be assumed present until confirmed against the running implementation.

---

## `>_` EVALUATION

Webloom is meant to eventually score its own output rather than assuming every generation is good:

```
Generated Website
       │
       ├── Brand Coherence
       ├── Design Quality
       ├── Business Fit
       ├── Factual Accuracy
       ├── Hallucination Rate
       ├── JSON Validity
       └── Generation Latency
                 │
                 ▼
        Webloom Evaluation
```

This is currently a **future/architectural** section — not an implemented feature. Its purpose is twofold: catching quality regressions, and producing a feedback signal that can eventually be used for fine-tuning (below).

---

## `>_` FUTURE: SPECIALIZATION LOOP

```
Business
   │
   ▼
Webloom Intelligence
   │
   ▼
Generated Website
   │
   ▼
Evaluation
   │
   ▼
Human Feedback
   │
   ▼
Dataset
   │
   ▼
Fine-Tuning (LoRA / QLoRA)
   │
   ▼
Specialized Webloom Model
```

This is the long-term direction, **not a current capability.** Webloom does not currently train any model. The near-term goal is provider-independent inference over existing open-weight models; the long-term goal is a domain-specialized model tuned on Webloom's own evaluation data.

```
OPEN-WEIGHT MODEL → WEBLOOM DATASET → DOMAIN FINE-TUNING → WEBLOOM MODEL
```

---

## `>_` ZERO-BUDGET CONSTRAINT

Webloom is a single-developer personal project, built on:

```
MacBook Air — Apple M3 — 8 GB unified memory — 256 GB storage
```

There is no GPU cluster, no proprietary foundation model, and no enterprise inference budget behind this project. The architecture is designed to compensate for that with efficiency rather than pretend the constraint doesn't exist:

**Developer machine handles:** frontend, backend, orchestration, renderer, database, and lightweight local development/inference where feasible.

**Cloud / temporary compute handles:** heavier open-weight model inference, opportunistically using free or student-tier GPU resources where available, with optional paid cloud GPU as a future option.

The governing principle: **maximum intelligence, minimum compute** — achieved through model specialization, caching, deterministic rendering (no per-request model calls for compilation), and avoiding regeneration of unchanged intelligence.

---

## `>_` TECH STACK

> Listed only where the technology is established by the project itself. Anything not yet confirmed in the working codebase is marked **planned**.

| Layer | Technology |
|---|---|
| Rendering target | Astro |
| UI | React |
| Runtime | Node.js |
| Language | TypeScript / JavaScript |
| Local inference | Ollama *(planned/in development)* |
| Cloud inference | vLLM *(planned)* |
| Schema validation | Zod / JSON Schema *(planned)* |
| Build tooling | Vite |
| Containerization | Docker *(planned)* |

Do not treat this table as exhaustive infrastructure — it reflects what's architecturally intended, filtered against what the source project actually confirms.

---

## `>_` PROJECT STRUCTURE

```
webloom/
├── services/
│   ├── ai-service/            # AIService — provider-agnostic inference entrypoint
│   ├── business-intelligence/ # research → verified facts
│   ├── brand-strategy/        # Brand DNA generation
│   └── design-intelligence/   # design token / spec generation
├── compiler/                  # deterministic spec → Astro compilation
├── renderer/                  # Astro output layer
└── ...
```

> Directory names above reflect the conceptual service boundaries described in this document. Treat this as an intended structure map, not a guaranteed 1:1 reflection of the current repository layout.

---

## `>_` DEVELOPMENT PHILOSOPHY

1. Intelligence before rendering
2. Structured output over free-form generation
3. Deterministic compilation over arbitrary code generation
4. Provider independence
5. Model independence
6. Verified facts over hallucinated assumptions
7. Cache expensive intelligence
8. AI for reasoning, code for guarantees
9. Small models where the task allows it
10. Evaluate before fine-tuning

---

## `>_` CURRENT STATUS

```
┌────────────────────────────────────────────────────┐
│ WEBLOOM // AI RUNTIME                               │
├────────────────────────────────────────────────────┤
│ [01] RESEARCH               IN DEVELOPMENT          │
│ [02] BUSINESS INTELLIGENCE  IN DEVELOPMENT          │
│ [03] BRAND DNA               IN DEVELOPMENT          │
│ [04] DESIGN INTELLIGENCE    IN DEVELOPMENT          │
│ [05] SCHEMA VALIDATION      PLANNED                 │
│ [06] COMPILER                PLANNED                 │
│ [07] ASTRO RENDERER          IN DEVELOPMENT          │
│ [08] AI PROVIDER ABSTRACTION IN DEVELOPMENT          │
│ [09] EVALUATION FRAMEWORK    PLANNED                 │
│ [10] SPECIALIZED MODEL       FUTURE                  │
│                                                      │
│ SYSTEM STATUS: ACTIVE DEVELOPMENT                    │
└────────────────────────────────────────────────────┘
```

Webloom is an actively developed personal project, not a finished product. Sections of this document describe target architecture; only what's explicitly labeled otherwise should be assumed to be running today.

---

## `>_` ROADMAP

**PHASE 01 — FOUNDATION**
- [ ] AI provider abstraction
- [ ] Structured output validation

**PHASE 02 — INTELLIGENCE**
- [ ] Business Intelligence pipeline
- [ ] Brand DNA generation
- [ ] Design Intelligence + controlled vocabulary

**PHASE 03 — INFERENCE**
- [ ] Local inference support (Ollama)
- [ ] Cloud inference support (vLLM)
- [ ] Model routing / specialization

**PHASE 04 — EVALUATION**
- [ ] Evaluation framework
- [ ] Model benchmarking
- [ ] Feedback dataset collection

**PHASE 05 — SPECIALIZATION**
- [ ] LoRA / QLoRA experiments
- [ ] Webloom specialized model

---

## `>_` SECURITY

Principles the project is built around:

- never log API keys or credentials
- redact Authorization headers from logs
- secrets via environment variables, not source
- validate model output before it reaches the renderer
- sanitize external/researched business data before ingestion
- never blindly execute model-generated code
- isolate inference calls from the rendering path

This list reflects design intent. It should not be read as a completed security audit.

---

## `>_` SETUP

```bash
# clone
git clone https://github.com/<you>/webloom.git
cd webloom

# install
npm install

# environment
cp .env.example .env
```

**Local model workflow (where applicable):**

```bash
ollama pull <model-name>
ollama run <model-name>
```

> No specific model is guaranteed to run comfortably on 8 GB of unified memory — model choice for local development should be validated on the target machine before relying on it.

```bash
# run backend
npm run dev:server

# run frontend
npm run dev:client

# tests
npm run test
```

---

## `>_` CONFIGURATION

**Proposed / in-progress configuration:**

```env
AI_PROVIDER=
AI_MODEL=
OLLAMA_BASE_URL=
AI_STRATEGY_MODEL=
AI_DESIGN_MODEL=
AI_CODING_MODEL=
```

These variables reflect the intended provider-abstraction architecture described above. Which of these are wired up in the current codebase versus reserved for the planned routing layer should be confirmed against the actual `.env.example` in the repository.

---

## `>_` CONTRIBUTING

This is a single-developer project, so contribution is lightweight by design:

1. Fork the repository
2. Install dependencies and get local dev running (see [Setup](#-setup))
3. Create a branch scoped to one subsystem (e.g. `feat/design-intelligence-vocab`)
4. Make your change, keeping the AI-reasoning / deterministic-code boundary intact
5. Run tests
6. Open a PR describing what stage of the pipeline it touches

---

## `>_` LICENSE

Licensing is currently **undefined**. Do not assume MIT, Apache, or any other license applies until this section is updated.

---

<div align="center">

```
WEBLOOM // AUTONOMOUS BUSINESS INTELLIGENCE RUNTIME
```

</div>
