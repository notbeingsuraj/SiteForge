# Webloom Deep Research Intelligence Engine — Architecture Audit Report

**Date:** 2026-09-02  
**Version:** 1.0  
**Status:** Audit Complete — Ready for Planning Phase  
**Auditor:** GSD Research Agent  

---

## 1. EXECUTIVE SUMMARY

### Current State
Webloom is a **stable, production-ready pipeline** that converts Google Maps URLs into verified business intelligence and generates personalized local websites. The existing extraction pipeline (Geoapify → WebExtraction → AI enrichment → BusinessProfile) works correctly and passes all 5 test businesses end-to-end.

### Critical Finding
The current system is a **"search + LLM summary" architecture** — not a **deep research engine**. It performs a single-pass extraction and stops, lacking the iterative, evidence-backed investigation capabilities specified in the master requirements.

### Core Gap
| Current System | Deep Research Requirement |
|----------------|---------------------------|
| Single-pass linear pipeline | Iterative research loop with gap detection |
| Flat `facts[]` array | Evidence graph with provenance, conflicts, freshness |
| No conflict detection | Cross-source verification + conflict preservation |
| No source independence | Primary vs. aggregator source tracking |
| Field-count completeness | Semantic knowledge-gap detection |
| No entity resolution | Branch/franchise/closed disambiguation |
| Shallow website research (homepage only) | Deep multi-page crawl with business-type prioritization |
| Downstream isolation (independent AI calls) | Shared Business Research Dossier |

---

## 2. CURRENT ARCHITECTURE (BASELINE)

### 2.1 Component Inventory

| Component | File | Responsibility | Status |
|-----------|------|----------------|--------|
| `GoogleMapsUrlParserProvider` | `services/GoogleMapsUrlParserProvider.js` | Parse URL → placeId, name, coordinates | ✅ Stable |
| `GeoapifyProvider` | `services/providers/GeoapifyProvider.js` | Structured places/geocode/place-details | ✅ Stable |
| `WebExtractionProvider` | `services/providers/WebExtractionProvider.js` | Wraps `BusinessDataExtractor` | ✅ Stable |
| `BusinessDataExtractor` | `services/BusinessDataExtractor.js` | Official website discovery + extraction (r.jina.ai) | ⚠️ Shallow (homepage only) |
| `BusinessResearchService` | `services/BusinessResearchService.js` | Orchestrates L1→L4 pipeline | ⚠️ Single-pass, no iteration |
| `BusinessProfile` | `services/BusinessProfile.js` | Provenance-tracked fact store | ✅ Strong provenance, ❌ No conflict detection |
| `BusinessProfileValidator` | `services/BusinessProfileValidator.js` | Field-level validation | ✅ Field-level only |
| `BrandStrategyService` | `services/BrandStrategyService.js` | Brand DNA from normalized data | ⚠️ Independent AI call |
| `DigitalAuditService` | `services/DigitalAuditService.js` | Website quality scoring | ⚠️ Independent AI call |
| `DesignIntelligenceService` | `services/DesignIntelligenceService.js` | Design system + page architecture | ⚠️ Independent AI call |
| `AIService` | `services/AIService.js` | OmniRoute abstraction + retry/fallback | ✅ Robust |

### 2.2 Current Data Flow (Linear Pipeline)

```
Google Maps URL
    ↓
[L1] GoogleMapsUrlParserProvider → Deterministic hints (IDENTIFIED)
    ↓
[L2] GeoapifyProvider → Structured data (DISCOVERED)
    ↓
[L3] WebExtractionProvider → Web fallback (DISCOVERED, onlyIfMissing when geoapifyRecord)
    ↓
[L4] AI enrichment (_enrichMissingWithAI, INFERRED, soft-fail)
    ↓
[L5] validateBusinessProfile
    ↓
BusinessProfile (authoritative verified facts)
    ↓
Parallel downstream consumers:
  → BrandStrategyService → Brand DNA
  → DigitalAuditService → Digital Audit
  → DesignIntelligenceService → Design Intelligence
    ↓
Website Generation (designed, not yet implemented)
```

### 2.3 Provenance Model (Current)

```javascript
// BusinessProfile.set(path, value, provenance, confidence, sourceInfo)
provenance ∈ ['verified', 'discovered', 'identified', 'user_provided', 'inferred']
confidence ∈ [0, 1]
sourceInfo = { sourceUrl, ... }
```

**Strength:** Every field carries provenance and confidence.  
**Critical Gap:** Silent overwrite on conflict — no conflict detection or preservation.

---

## 3. CURRENT RESEARCH FLOW ANALYSIS

### 3.1 Provider Chain (BusinessResearchService.extractBusinessIntelligenceWithProviders)

| Level | Provider | Provenance | Trigger | Key Limitation |
|-------|----------|------------|---------|----------------|
| L1 | Deterministic hints | `identified` | Always | Name/coords from URL only |
| L2 | Geoapify | `discovered` | If API key configured | Single structured provider |
| L3 | WebExtraction | `discovered` | If URL provided + `onlyIfMissing` when Geoapify ok | Homepage only, no deep crawl |
| L4 | AI Enrichment | `inferred` | If gaps remain | Single-pass, no verification |
| L5 | Validation | N/A | Always | Field-level only |

### 3.2 Evidence Representation (Current)

```javascript
// Current: flat facts array
facts: [
  { claim: "Business name is Tartine Bakery", source: "structured_provider", verified: true }
]
```

**Gap:** No evidence objects, no source independence, no freshness, no conflict tracking.

### 3.3 AI Integration Pattern (Current)

```javascript
// Each downstream service makes independent AI call:
BrandStrategyService.generateBrandDNA(business)        // Independent prompt
DigitalAuditService.auditDigitalPresence(business)     // Independent prompt  
DesignIntelligenceService.generateDesignIntelligence(...) // Independent prompt
```

**Gap:** No shared research context; each service re-invents business knowledge.

---

## 4. CURRENT PROVIDERS

| Provider | Type | Implementation | Status |
|----------|------|----------------|--------|
| `GeoapifyProvider` | Structured places/geocode | ✅ Complete with place-details enrichment | Production |
| `WebExtractionProvider` | Wraps `BusinessDataExtractor` | ✅ Homepage extraction via r.jina.ai | Production |
| `OfficialWebsiteProvider` | Deep website crawl | ⚠️ Homepage only | Shallow |
| `DiscoveryProvider` | Abstract interface | ❌ No concrete implementations | Missing |
| `UserProvidedDataProvider` | User input | ✅ Implemented | Production |

### Provider Status Details

| Provider | Implements | Key Features | Gaps |
|----------|------------|--------------|------|
| Geoapify | `BusinessDataProvider` | Geocode search + place-details enrichment, error classification, safe logging | Single provider; no source independence |
| WebExtraction | `BusinessDataExtractor` | r.jina.ai proxy, metadata extraction (JSON-LD, microdata, OpenGraph), AI extraction | Homepage only; no deep crawl |
| OfficialWebsite | `DiscoveryProvider` (not yet) | AI extraction from homepage | No sitemap/navigation discovery |
| DiscoveryProvider | Abstract base | Interface defined in `DiscoveryProvider.js` | **Zero concrete implementations** |

---

## 5. CURRENT DATA MODELS

### 5.1 BusinessProfile (Authoritative Fact Store)

```javascript
{
  identity: { name, category, business_type, description, categories },
  contact: { phone, email, website },
  location: { full_address, street, city, state, country, postal_code, coordinates },
  ratings: { rating, review_count },
  hours: { monday..sunday },
  social_links: [],
  metadata: { sources[], extractionHistory[], createdAt, updatedAt }
}
// Each field: { value, provenance, confidence, sourceInfo, updatedAt }
```

**Strengths:** Provenance per field, confidence scoring, extraction history, `getCompleteness()`, `getProvenanceBreakdown()`.

**Critical Gaps:**
- No conflict detection/preservation
- No source independence tracking
- No per-claim freshness (`retrievedAt`, `observedAt`)
- No evidence graph (claims ↔ evidence ↔ sources)
- No entity resolution (branches/franchises)

### 5.2 Intelligence Shape (Downstream Consumer Interface)

```javascript
{
  source: { query, placeId, resolvedName, resolutionStatus, resolutionConfidence, mapsUrl, providers },
  identity: { name, category, businessType, description, categories },
  contact: { phone, email, website },
  location: { address, city, state, country, postalCode, coordinates },
  digitalPresence: { googleMapsUrl, website, socialProfiles, hasWebsite, photos },
  services: [],
  trustSignals: [{ type, value, source, verified }],
  positioning: { priceLevel, category, location },
  facts: [{ claim, source, verified }],
  unknowns: [],
  rating, reviewCount, openingHours, reviews, photos,
  confidence: { overall }
}
```

### 5.3 Downstream Service Outputs

| Service | Output Shape | AI Call |
|---------|--------------|---------|
| `BrandStrategyService` | Brand DNA (positioning, audience, personality, tone, visual) | 1 × reasoning |
| `DigitalAuditService` | Audit JSON (scores, issues, recommendations) | 1 × reasoning |
| `DesignIntelligenceService` | DesignSystem + PageArchitecture + ContentStrategy + AssetPlan | 1 × reasoning |
| `WebsiteCopywritingService` | Copy (hero, services, about, FAQ, CTA) | 1 × reasoning |
| `LandingPageSpecService` | Landing spec (theme, sections, CTA) | 1 × reasoning |

---

## 6. CURRENT AI FLOW

### 6.1 AIService Architecture

```javascript
// Singleton: new AIService()
// OmniRoute wrapper with:
- Model roles: 'coding', 'reasoning', 'fast', 'copywriting'
- Retry logic (exponential backoff, maxAttempts)
- Fallback models (primary → fallback)
- Provider error classification (AUTH, QUOTA, RATE_LIMIT, PROVIDER_UNAVAILABLE, TIMEOUT, INVALID_RESPONSE)
- Schema validation (json_schema or json_object)
- Safe logging (secret redaction)
```

**Strengths:** Robust fallback, secret redaction, schema validation, provider error handling.

**Unused Capability:** `model: 'coding'` (auto/best-coding) is **never called** in codebase — clean integration point for code generation.

### 6.2 Current AI Usage Pattern

| Service | Model | Schema | Temperature | Purpose |
|---------|-------|--------|-------------|---------|
| BusinessResearch `_enrichMissingWithAI` | reasoning | category/description/services | 0.3 | Gap filling only |
| BrandStrategyService | reasoning | Full brand DNA | 0.7 | Strategy synthesis |
| DigitalAuditService | reasoning | Audit schema | 0.5 | Scoring |
| DesignIntelligenceService | reasoning | Full design intelligence | 0.5 | Design synthesis |
| WebsiteCopywritingService | copywriting | Copy schema | 0.7 | Copy generation |
| LandingPageSpecService | reasoning | Spec schema | 0.5 | Spec generation |

**Gap:** Each service calls AI independently with business data — no shared research context.

---

## 7. CURRENT FAILURE MODES

| Failure Mode | Current Handling | Gap |
|--------------|------------------|-----|
| Geoapify unavailable | `providerTrace.geoapify = 'not_configured'`; fallback to web extraction | Graceful |
| Geoapify timeout/error | Classified error status; fallback to web extraction | Graceful |
| Web extraction fails | `status: 'error'`; continue with Geoapify only | Graceful |
| AI enrichment fails | `console.error`; continue with structured data only | **Soft-fail works** |
| Brand DNA fails (D1 fix) | Caught in route; extraction preserved; `brandStrategyStatus: 'failed'` | **Fixed in aea7eb6** |
| Validation fails | Returns `issues[]`; doesn't block pipeline | Advisory only |
| No website found | Digital Audit returns zero scores with recommendations | Handled |

### Unhandled Failure Modes (Deep Research Gaps)

| Failure Mode | Current State | Required for Deep Research |
|--------------|---------------|---------------------------|
| Provider returns conflicting data | Silent overwrite (highest provenance wins) | **Conflict detection + preservation** |
| Source copies another source | Treated as independent confirmation | **Source independence analysis** |
| Critical fact missing | Field left null; downstream omits section | **Knowledge-gap detection + follow-up** |
| Stale source used | No temporal freshness tracking | **Per-claim freshness + volatility classes** |
| Entity ambiguity (branches) | Single profile merges all | **Entity resolution** |
| AI hallucination | Soft-fail only; no evidence cross-check | **Evidence-backed synthesis + validation** |

---

## 8. CURRENT HALLUCINATION RISKS

| Risk Vector | Current Mitigation | Residual Risk |
|-------------|-------------------|---------------|
| AI enrichment invents phone/address/hours | Only fills null fields; `inferred` provenance; soft-fail | Medium — confidence scoring could promote inferred over discovered |
| Brand DNA invents brand signals | Prompt instructs "base on data" but no evidence cross-check | Medium |
| Design Intelligence invents visual signals | No evidence cross-check | Medium |
| Digital Audit invents scores | Schema validation only | Low (schema constrains) |
| Website Copy invents facts | Prompt says "don't hallucinate" but no evidence enforcement | High |
| Website Generation (coding model) invents facts | Not yet implemented | Critical when implemented |

**Critical Gap:** No evidence-backed synthesis — AI receives business data but not structured evidence with conflicts/unknowns.

---

## 8. CURRENT CACHING

| Cache Layer | Implementation | TTL | Scope |
|-------------|----------------|-----|-------|
| Extraction cache | In-memory `Map` (BusinessDataExtractor) | 24 hours | Google Maps URL → extraction result |
| Geoapify | None (per-request) | None | Per-request |
| AI calls | None | None | Per-call |
| Generated sites | File system (`generated-sites/`) | Persistent | Per-site |

**Gaps for Deep Research:**
- No entity resolution cache
- No discovered URL cache
- No parsed document cache
- No evidence/claim cache
- No competitor discovery cache
- No TTL by volatility class (hours=24h, reviews=6h, identity=30d)

---

## 9. CURRENT TEST COVERAGE

### Existing Tests (apps/api/)

| Test File | Purpose | Coverage |
|-----------|---------|----------|
| `test_providers.js` | Provider integration | Provider orchestration |
| `test_v2_generation.js` | **E2E: 5 businesses** | Full pipeline (passes 5/5) |
| `test_di.mjs` | Design Intelligence deterministic | Design Intelligence |
| `test_full_pipeline*.js` | Full pipeline variants | Pipeline integration |
| `test_brand_*.js` | Brand DNA variants | Brand Strategy |
| `test_landing_page*.js` | Landing page spec | Landing Page Spec |
| `test_extraction.js` | Extraction pipeline | Extraction |
| `test_failure_cases.js` | Error handling | Failure modes |

**Coverage Gap:** No tests for:
- Conflict detection
- Source independence
- Entity resolution
- Knowledge-gap detection
- Iterative research loop
- Evidence graph
- Cross-source verification
- Temporal freshness
- Research quality metrics

---

## 10. CURRENT GENERATION DEPENDENCIES (Per WEBSITE-GENERATION-ARCHITECTURE.md)

### Already Implemented (Extraction Pipeline)
- ✅ BusinessProfile (verified facts)
- ✅ BrandStrategyService
- ✅ DigitalAuditService  
- ✅ DesignIntelligenceService
- ✅ WebsiteCopywritingService
- ✅ LandingPageSpecService
- ✅ AIService with `model:'coding'` (unused but ready)
- ✅ BusinessProfileValidator
- ✅ FactualDataValidator

### Not Implemented (Per Architecture Doc)
- ❌ `WebsiteGenerationService` — orchestrator
- ❌ `GeneratedSiteManager` — CRUD + port alloc + server lifecycle
- ❌ Renderer template (`templates/astro-site/`)
- ❌ Disk writer → `generated-sites/<slug>/`
- ❌ Local dev server runner
- ❌ `/api/website/generate` route
- ❌ UI: Generate / Open / Stop / Regenerate / Delete

---

## 11. ARCHITECTURAL GAPS (Deep Research Requirements vs. Current)

| Requirement (Master Prompt) | Current State | Gap Severity |
|----------------------------|---------------|--------------|
| Iterative research loop (Plan→Discover→Extract→Verify→Gap→FollowUp) | Single linear pipeline | **Critical** |
| Evidence graph (Question→Sources→Evidence→Claims→Verification) | Flat `facts[]` array | **Critical** |
| Multi-source verification + independence analysis | Single provider + no independence tracking | **Critical** |
| Conflict detection + preservation | Silent overwrite in `BusinessProfile.set()` | **Critical** |
| Entity resolution (branches/franchises) | None | **Critical** |
| Deep official website research (sitemap + business-type pages) | Homepage only | **Critical** |
| Knowledge-gap detection + targeted follow-up | None | **Critical** |
| Iterative research orchestration (budget-aware) | None | **Critical** |
| Customer review intelligence (themes + evidence) | None (rating only) | High |
| Competitor intelligence (semantic discovery + deep profiles) | None | High |
| Market intelligence (category norms, pricing) | None | High |
| Business Research Dossier (canonical output) | Fragmented `intelligence` shape | High |
| Brand DNA / Design Intelligence consume shared dossier | Independent AI calls | High |
| Generation safety gate (quality threshold) | None | High |
| Deterministic research quality metrics | Field-count completeness only | Medium |
| Temporal freshness per claim | None | Medium |
| Source independence / copy detection | None | Medium |
| Caching by volatility class | Single 24h TTL | Medium |
| Observability / audit trail | Basic console logging | Medium |

---

## 12. PROPOSED RESEARCH ARCHITECTURE

### 12.1 Core Research Engine (New Components)

```
┌─────────────────────────────────────────────────────────────────┐
│                      RESEARCH ENGINE                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  ENTITY     │───▶│   SOURCE     │───▶│   DEEP WEBSITE   │  │
│  │  RESOLUTION │    │  DISCOVERY   │    │   RESEARCH       │  │
│  └─────────────┘    └──────────────┘    └────────┬─────────┘  │
│           │                   │                    ▼          │
│           ▼                   ▼            ┌───────────────┐  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │        EVIDENCE EXTRACTION + NORMALIZATION             │  │
│  │  (Schema.org, Microdata, OpenGraph, Visible Text)      │  │
│  └───────────────────────────┬────────────────────────────┘  │
│                               ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │         VERIFICATION + CONFLICT RESOLUTION             │  │
│  │  (Cross-source, independence, temporal freshness)      │  │
│  └───────────────────────────┬────────────────────────────┘  │
│                               ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │       KNOWLEDGE GRAPH / RESEARCH STATE MACHINE         │  │
│  │  (Questions → Sources → Evidence → Claims → Verification)│
│  └───────────────────────────┬────────────────────────────┘  │
│                               ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │     KNOWLEDGE-GAP DETECTION + PRIORITIZATION           │  │
│  │  (Information value × Business importance × Uncertainty) │
│  └───────────────────────────┬────────────────────────────┘  │
│                               ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │         ITERATIVE RESEARCH ORCHESTRATION               │  │
│  │  (Loop: Plan → Discover → Extract → Verify → Gap → FollowUp)│
│  └───────────────────────────┬────────────────────────────┘  │
│                               ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │        SPECIALIZED INTELLIGENCE (parallel)             │  │
│  │   Customer │ Competitor │ Market │ Historical           │  │
│  └───────────────────────────┬────────────────────────────┘  │
│                               ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │            AI RESEARCH SYNTHESIS                       │  │
│  │  (Source-aware prompt with evidence/conflicts/unknowns)│  │
│  └───────────────────────────┬────────────────────────────┘  │
│                               ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │        BUSINESS RESEARCH DOSSIER (Canonical Output)    │  │
│  └───────────────────────────┬────────────────────────────┘  │
│                               ▼                               │
│         ┌───────────────────────────────────────────────┐    │
│         │         GENERATION SAFETY GATE                │    │
│         │ (HIGH→normal │ PARTIAL→conservative │ LOW→evidence-only) │
│         └─────────────────────┬─────────────────────────┘    │
│                               ▼                               │
│         ┌───────────────────────────────────────────────┐    │
│         │         WEBSITE GENERATION                    │    │
│         └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Key Architectural Changes

| Change | From | To | Rationale |
|--------|------|-----|-----------|
| **Evidence Model** | Flat `facts[]` | Structured `Evidence` ↔ `Claim` ↔ `Source` graph | Enables verification, conflicts, provenance |
| **Research Orchestration** | Linear pipeline | Iterative loop with budget guards | Enables deep investigation |
| **Conflict Handling** | Silent overwrite | Detect → Preserve → Resolution strategy | Audit trail, transparency |
| **Source Model** | URL list | Provider lineage + independence analysis | True verification |
| **Entity Model** | Single profile | Entity resolution (branches/franchises) | Accuracy |
| **Temporal Model** | None | Per-claim `retrievedAt`/`observedAt` + volatility classes | Freshness awareness |
| **Research Output** | Fragmented `intelligence` | Canonical `BusinessResearchDossier` | Single source of truth |
| **Downstream Integration** | Independent AI calls | Shared dossier consumption | Consistency, efficiency |

---

## 13. MIGRATION STRATEGY

### Phase Sequencing (20 Phases)

| Phase | Focus | Dependencies | Risk |
|-------|-------|--------------|------|
| **1** | Codebase Research + Architecture | None | Low (audit complete) |
| **2** | Canonical Evidence/Provenance Model | 1 | Medium (data model change) |
| **3** | Entity Resolution | 2 | Medium (matching logic) |
| **4** | Source Discovery (2+ providers) | 2 | High (external APIs) |
| **5** | Deep Official Website Research | 3,4 | High (crawl complexity) |
| **6** | Evidence Extraction + Normalization | 4,5 | Medium (parsers) |
| **7** | Verification + Conflict Resolution | 6 | High (core logic) |
| **8** | Knowledge Graph / Research State | 7 | Medium (state machine) |
| **9** | Knowledge-Gap Detection | 8 | High (core loop) |
| **10** | Iterative Research Orchestration | 9 | High (core loop) |
| **11** | Customer/Review Intelligence | 10 | Medium |
| **12** | Competitor Intelligence | 10 | Medium |
| **13** | Market Intelligence | 10 | Medium |
| **14** | AI Research Synthesis | 13 | Medium |
| **15** | Business Research Dossier | 14 | Medium |
| **16** | Brand DNA Integration (consume dossier) | 15 | Medium |
| **17** | Design Intelligence Integration | 16 | Medium |
| **18** | Generation Safety Gate | 17 | Medium |
| **19** | Deep E2E Testing (multi-business) | 18 | High |
| **20** | Performance/Cost Hardening | 19 | Medium |

### Migration Principles

1. **Never break existing pipeline** — All phases must keep `test_v2_generation.js` passing (5/5)
2. **Incremental commits** — Each phase completes with working code + tests
3. **Protect baseline** — `DesignIntelligenceService`, `extractSummary`, `Brand DNA fallback`, `GeneratedSiteManager`, `Astro generation`, port allocation, `Webloom branding`
4. **Incremental data model** — Extend `BusinessProfile` with evidence graph; don't create parallel schema
5. **Provider abstraction** — New providers implement `DiscoveryProvider` interface

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data model changes break downstream | Extend `BusinessProfile` in place; keep `toObject()` compatible |
| New providers break orchestration | Provider abstraction already exists; add implementations only |
| Research loop infinite | Hard budgets: `maxQueries`, `maxRuntimeMs`, `maxIterations` |
| AI costs unbounded | Model routing (fast/reasoning/coding), token budgets |
| Deep crawl too slow | Business-type page prioritization + `maxPages` budget |
| Evidence graph too complex | Start with in-memory JSON; persist to file |
| Conflict resolution too complex | Preserve conflicts; auto-resolve only with clear authority |

---

## 14. VERIFICATION CRITERIA (Definition of Done)

The Deep Research milestone is complete only when Webloom can:

1. ✅ Correctly identify the entity (with entity resolution)
2. ✅ Discover multiple relevant sources (2+ independent providers)
3. ✅ Investigate primary sources deeply (official website + structured)
4. ✅ Investigate secondary sources where useful (reviews, competitors, market)
5. ✅ Extract structured evidence (deterministic parsers + AI interpretation)
6. ✅ Normalize claims (consistent schema)
7. ✅ Track provenance (per-claim source lineage)
8. ✅ Track freshness (per-claim `retrievedAt` + volatility class)
9. ✅ Detect duplicated evidence (content hash + source lineage)
10. ✅ Detect conflicting evidence (cross-source comparison)
11. ✅ Resolve or preserve conflicts (authority_wins / preserve_all)
12. ✅ Separate facts from inference (VERIFIED vs INFERRED provenance)
13. ✅ Identify important unknowns (knowledge-gap map)
14. ✅ Generate targeted follow-up research (gap prioritization)
15. ✅ Repeat investigation when valuable (budget-aware loop)
16. ✅ Stop intelligently (threshold / diminishing returns / budget)
17. ✅ Produce deterministic research-quality metrics
18. ✅ Produce canonical Business Research Dossier
19. ✅ Prevent unsupported claims downstream (generation gate)
20. ✅ Survive provider and AI failures (graceful degradation)
21. ✅ Preserve existing Webloom generation pipeline (regression tests)
22. ✅ Demonstrate materially deeper research across 4+ business types

---

## 15. APPENDIX: FILE REFERENCE MAP

### Core Services (Modified in Migration)
| File | Current Role | Migration Impact |
|------|--------------|------------------|
| `BusinessProfile.js` | Provenance fact store | **Extend**: evidence graph, conflicts, freshness, entityId |
| `BusinessResearchService.js` | Pipeline orchestration | **Replace**: iterative ResearchOrchestrator |
| `BusinessProfileValidator.js` | Field validation | **Extend**: evidence validation, conflict checks |
| `BusinessDataExtractor.js` | Homepage extraction | **Replace**: deep crawl + sitemap discovery |
| `GeoapifyProvider.js` | Structured data | **Keep**: add to provider registry |
| `WebExtractionProvider.js` | Web fallback | **Refactor**: use DiscoveryProvider |
| `DiscoveryProvider.js` | Abstract interface | **Implement**: 2+ concrete providers |
| `BusinessProfile.js` | Fact store | **Extend**: evidence graph, conflicts, entityId |
| `BrandStrategyService.js` | Brand DNA | **Refactor**: consume dossier |
| `DesignIntelligenceService.js` | Design Intelligence | **Refactor**: consume dossier |
| `DigitalAuditService.js` | Digital Audit | **Refactor**: consume dossier |
| `AIService.js` | OmniRoute wrapper | **Keep**: add cost budgets |

### New Files to Create
| File | Purpose |
|------|---------|
| `services/ResearchOrchestrator.js` | Iterative research loop |
| `services/EvidenceGraph.js` | Evidence-Claim-Source graph |
| `services/EntityResolver.js` | Branch/franchise disambiguation |
| `services/SourceDiscoveryProvider.js` | Bing/Brave/DuckDuckGo implementations |
| `services/DeepWebsiteResearcher.js` | Sitemap + business-type page crawl |
| `services/EvidenceExtractor.js` | Deterministic parsers (Schema.org, etc.) |
| `services/VerificationEngine.js` | Cross-source verification + conflicts |
| `services/KnowledgeGapDetector.js` | Gap mapping + prioritization |
| `services/ResearchQualityCalculator.js` | Deterministic quality metrics |
| `services/CustomerIntelligence.js` | Review theme extraction |
| `services/CompetitorIntelligence.js` | Semantic competitor discovery |
| `services/MarketIntelligence.js` | Category norms, pricing patterns |
| `services/ResearchSynthesis.js` | Source-aware AI synthesis → Dossier |
| `services/BusinessResearchDossier.js` | Canonical output type |
| `services/GenerationSafetyGate.js` | Quality threshold → generation mode |

### Configuration
| File | Additions |
|------|-----------|
| `config/env.js` | `SEARCH_API_KEY`, `SEARCH_API_PROVIDER`, `REDIS_URL`, `RESEARCH_MAX_QUERIES`, `RESEARCH_MAX_PAGES`, `RESEARCH_MAX_REVIEWS`, `RESEARCH_MAX_ITERATIONS`, `RESEARCH_MAX_RUNTIME_MS`, `CACHE_TTL_*` |

---

## 16. CONCLUSION

The Webloom codebase provides an **excellent, stable foundation** for the extraction pipeline. The provenance model, provider abstraction, AI service with fallback, and deterministic validation are all production-quality.

The **deep research engine** requires building the investigation layer **on top** of this foundation — not replacing it. The migration strategy preserves all existing working code while adding the iterative, evidence-backed research capabilities specified in the master requirements.

**Recommendation:** Proceed with Phase 2 (Evidence/Provenance Model) as the foundational data model change, then Phase 3 (Entity Resolution), then Phase 4 (Source Discovery) to unlock multi-source verification. All subsequent phases build on these three pillars.

**Confidence:** HIGH — All findings grounded in actual code inspection; migration path preserves existing working pipeline.

---

*End of Architecture Audit Report*