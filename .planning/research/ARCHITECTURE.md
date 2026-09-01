# Architecture Patterns

**Domain:** AI-powered Business Research & Website Generation
**Researched:** 2026-09-01

## Current Architecture (Baseline)

```
Google Maps URL
    ↓
GoogleMapsUrlParserProvider (deterministic hints: IDENTIFIED)
    ↓
GeoapifyProvider (DISCOVERED) [L2]
    ↓
WebExtractionProvider (DISCOVERED, onlyIfMissing when geoapifyRecord) [L3]
    ↓
AI fill-only enrichment (_enrichMissingWithAI, INFERRED, soft-fail) [L4]
    ↓
validateBusinessProfile (L5)
    ↓
BusinessProfile (provenance-tracked; verified facts only)
    ↓
optional Brand DNA (non-fatal)
    ↓
Digital Audit / Design Intelligence / Brand DNA (parallel)
    ↓
Website Generation (designed, not implemented)
```

### Component Boundaries (Current)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `GoogleMapsUrlParserProvider` | Extract placeId, name, coordinates from URL | Input to all providers |
| `GeoapifyProvider` | Structured business data (places, geocode, place-details) | `BusinessResearchService` |
| `WebExtractionProvider` | Wraps `BusinessDataExtractor` for Google Maps page scraping | `BusinessResearchService` (fallback) |
| `BusinessDataExtractor` | Official website discovery + extraction via r.jina.ai | `WebExtractionProvider` |
| `BusinessResearchService` | Orchestrates L1→L4 pipeline, returns `intelligence` | Routes (`/analyze`), `BrandStrategyService` |
| `BusinessProfile` | Provenance-tracked fact store (value, provenance, confidence) | `BusinessResearchService`, validators |
| `BusinessProfileValidator` | Field-level validation (phone, URL, address, coords) | `BusinessResearchService` |
| `BrandStrategyService` | Brand DNA from normalized business data | `/analyze` route |
| `DigitalAuditService` | Website quality scoring | Downstream |
| `DesignIntelligenceService` | Design system + page architecture | Website Generation |
| `AIService` | OmniRoute abstraction with retries/fallback | All AI consumers |

### Data Flow (Current)

```
Input (Google Maps URL)
    ↓
[L1] Deterministic hints (name, coords from URL)
    ↓
[L2] Geoapify search → place-details enrichment
    ↓
[L3] WebExtraction fallback (only missing fields if Geoapify ok)
    ↓
[L4] AI enrichment (fill gaps only, soft-fail)
    ↓
[L5] validateBusinessProfile
    ↓
BusinessProfile (authoritative verified facts)
    ↓
Downstream consumers (Brand DNA, Digital Audit, Design Intelligence)
```

## Recommended Architecture (Deep Research Engine)

```
┌─────────────────────────────────────────────────────────────┐
│                    RESEARCH ENGINE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  ENTITY      │    │  SOURCE      │    │  DEEP        │  │
│  │  RESOLUTION  │───▶│  DISCOVERY   │───▶│  WEBSITE     │  │
│  │  (Phase 3)   │    │  (Phase 4)   │    │  RESEARCH    │  │
│  └──────────────┘    └──────────────┘    │  (Phase 5)   │  │
│          │                  │            └──────┬───────┘  │
│          ▼                  ▼                   ▼          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           EVIDENCE EXTRACTION + NORMALIZATION        │  │
│  │  (Schema.org, Microdata, OpenGraph, Visible Text)    │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            VERIFICATION + CONFLICT RESOLUTION        │  │
│  │  (Cross-source, independence, temporal freshness)    │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         KNOWLEDGE GRAPH / RESEARCH STATE             │  │
│  │  (Questions → Sources → Evidence → Claims → Verif)   │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       KNOWLEDGE-GAP DETECTION + PRIORITIZATION       │  │
│  │  (Information value × Business importance × Uncertainty) │
│  └──────────────────────┬───────────────────────────────┘  │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           ITERATIVE RESEARCH ORCHESTRATION           │  │
│  │  (Loop until budget/threshold/gaps resolved)         │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      SPECIALIZED INTELLIGENCE (parallel)             │  │
│  │  Customer │ Competitor │ Market │ Historical          │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           AI RESEARCH SYNTHESIS                      │  │
│  │  (Source-aware prompt with evidence/conflicts/unknowns)│
│  └──────────────────────┬───────────────────────────────┘  │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         BUSINESS RESEARCH DOSSIER (Canonical)        │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         ▼                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ BRAND DNA    │ │ DESIGN INTEL │ │ COPY STRATEGY│       │
│  │ (consumes    │ │ (consumes    │ │ (consumes    │       │
│  │  dossier)    │ │  dossier)    │ │  dossier)    │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘       │
│         └───────────────┼────────────────┘                 │
│                         ▼                                   │
│         ┌───────────────────────────────┐                  │
│         │   GENERATION SAFETY GATE      │                  │
│         │ (quality threshold → mode)    │                  │
│         └───────────────┬───────────────┘                  │
│                         ▼                                   │
│         ┌───────────────────────────────┐                  │
│         │   WEBSITE GENERATION          │                  │
│         └───────────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Patterns to Follow

#### Pattern 1: Provider Abstraction (Already Established)
**What:** Abstract interface for data providers with standardized output shape
**When:** Adding new data sources (search, review APIs, competitor APIs)
**Example:**
```javascript
// ProviderAdapter.js pattern
export function mapProviderResponseToProfile(providerResponse) {
  // Convert provider-specific → canonical flat profile
  return { business: {...}, contact: {...}, location: {...}, confidence: {...} };
}
```

#### Pattern 2: Provenance-Tracked Data (BusinessProfile)
**What:** Every field carries `{value, provenance, confidence, sourceInfo}`
**When:** Any factual data entering the system
**Example:**
```javascript
profile.set('identity.name', 'Tartine Bakery', 'discovered', 0.95, { sourceUrl: 'https://tartinebakery.com' });
```

#### Pattern 3: Soft-Fail AI Enrichment (Already Established)
**What:** AI fills gaps only; never overwrites high-confidence data; soft-fail never breaks pipeline
**When:** Any AI enrichment step
**Example:**
```javascript
try {
  const result = await AIService.generate({...});
  if (result.category && !profile.get('identity.category')) {
    profile.set('identity.category', result.category, 'inferred', 0.6);
  }
} catch { /* log, continue */ }
```

#### Pattern 4: Deterministic Validation (BusinessProfileValidator)
**What:** Pure functions validate factual fields; no AI involved
**When:** Before data enters pipeline or leaves for generation
**Example:**
```javascript
const result = validateBusinessProfile(profile);
if (!result.valid) { /* handle issues */ }
```

#### Pattern 5: Deterministic Quality Metrics (Not AI)
**What:** Quality scores computed from evidence, not LLM self-assessment
**When:** Research quality reporting
**Example:**
```javascript
{
  completeness: verifiedClaims / totalClaims,
  sourceAuthority: avgSourceAuthority,
  verificationRate: verifiedClaims / totalClaims,
  freshness: weightedAvgAgeOfSources
}
```

### Anti-Patterns to Avoid

#### Anti-Pattern 1: Silent Overwrites (Current Bug)
**What:** `BusinessProfile.set()` overwrites based on provenance priority alone, losing conflict information
**Why bad:** Loses evidence of source disagreement; creates false confidence
**Instead:** Detect conflicts → preserve with `conflict: { values: [...], sources: [...], resolution: 'authority_wins' }`

#### Anti-Pattern 2: LLM Self-Assessment
**What:** Asking LLM "How confident are you?" or "Rate your research quality"
**Why bad:** Models systematically overestimate; no ground truth
**Instead:** Deterministic metrics from evidence (verification rate, source independence, freshness)

#### Anti-Pattern 3: Single-Pass Research
**What:** One search → one LLM call → done
**Why bad:** Misses conflicts, gaps, independent verification
**Instead:** Iterative loop with gap detection → targeted follow-up → re-verify

#### Anti-Pattern 4: Fabrication for Completeness
**What:** AI fills missing fields with plausible guesses
**Why bad:** Destroys trust; downstream systems treat as fact
**Instead:** Return `null`/`UNKNOWN`; downstream renders omission; generation gate checks completeness

#### Anti-Pattern 5: LLM Self-Validation
**What:** "Validate this JSON" prompt to same model
**Why bad:** Same failure modes; circular
**Instead:** Deterministic schema validation + evidence cross-check

#### Anti-Pattern 6: Flat Search Results
**What:** Return raw search results to LLM
**Why bad:** No structure for verification, gap detection, iteration
**Instead:** Research question → sources → evidence → claims → verification graph

#### Anti-Pattern 6: Ignoring Temporal Freshness
**What:** Treat 5-year-old source same as yesterday's official page
**Why bad:** Hours/pricing/menu change frequently; identity changes rarely
**Instead:** Per-claim freshness scoring; volatility classification per field type

#### Anti-Pattern 7: Single Search Provider
**What:** Only Google/Bing for discovery
**Why bad:** No independence; copied results count as one
**Instead:** Minimum 2 independent providers; track source lineage to detect copying

## Scalability Considerations

| Concern | At 100 runs | At 10K runs | At 1M runs |
|---------|-------------|-------------|------------|
| **Evidence cache** | In-memory Map OK | Redis required | Redis cluster + TTL policies |
| **Provider orchestration** | Sequential OK | Parallel with semaphore | Circuit breakers + priority queue |
| **AI costs** | Negligible | Budget guards critical | Model routing (fast/reasoning/coding) |
| **Research state** | In-memory | Redis + persistence | Distributed state machine |
| **Generated sites** | Local disk | Object storage + CDN | Multi-region + cleanup policies |

## Sources

- `BusinessResearchService.js` - Current pipeline orchestration
- `BusinessProfile.js` - Provenance model
- `BusinessProfileValidator.js` - Validation
- `GeoapifyProvider.js` / `WebExtractionProvider.js` - Providers
- `ProviderAdapter.js` - Canonical mapping
- `BusinessDataExtractor.js` - Official website extraction
- `AIService.js` - OmniRoute abstraction, retry/fallback
- `BusinessProfileValidator.js` - Field validation
- `WEBSITE-GENERATION-ARCHITECTURE.md` - Sections 1-3, 6, 9
- Master prompt sections 5-15, 22-25