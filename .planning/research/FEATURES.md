# Feature Landscape

**Domain:** AI-powered Business Research & Website Generation
**Researched:** 2026-09-01

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Google Maps URL → Business Intelligence | Core value prop | Medium | Already implemented via provider orchestration |
| Business Profile with provenance | Trust/verifiability | Medium | `BusinessProfile` class exists with provenance tracking |
| Structured data provider (Geoapify) | Reliable facts | Medium | Implemented with fallback |
| Web extraction fallback | Coverage when structured missing | Medium | r.jina.ai proxy implemented |
| AI enrichment of gaps | Completeness | Low | Single-pass AI enrichment exists |
| Brand DNA generation | Website personalization | Low | `BrandStrategyService` exists |
| Digital Audit | Competitive positioning | Low | `DigitalAuditService` exists |
| Design Intelligence | Visual personalization | Low | `DesignIntelligenceService` exists |
| Website Generation (local) | End product | High | Architecture designed, not implemented |
| Local dev server per site | Live preview | Medium | `GeneratedSiteManager` designed |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Deep iterative research loop** | Investigates until confident, not "N searches" | High | Core differentiator per master prompt |
| **Evidence graph with provenance** | "Why does Webloom believe this?" | High | Every claim traceable to source |
| **Multi-source verification** | Independent confirmation, not single source | High | Source independence analysis |
| **Conflict detection & preservation** | Transparency when sources disagree | High | Audit trail for contradictions |
| **Knowledge-gap driven follow-up** | Researches what matters, not what's easy | High | Information-value prioritization |
| **Entity resolution** | Handles branches/franchises/closed correctly | Medium | Critical for accuracy |
| **Business-type-specific research** | Restaurant ≠ SaaS ≠ Law firm | Medium | Taxonomy-driven investigation |
| **Customer review intelligence** | Themes + evidence, not just sentiment | Medium | Structured theme extraction |
| **Competitor intelligence** | Semantic discovery + deep profiles | Medium | Semantic + contextual |
| **Market intelligence** | Category norms, pricing patterns | Medium | Contextual positioning |
| **Research quality metrics** | Deterministic quality scores | Medium | Not LLM self-assessment |
| **Business Research Dossier** | Canonical output for all downstream | High | Single source of truth |
| **Deep official website research** | Full site crawl, not just homepage | High | Sitemap + business-type page priority |
| **Temporal research awareness** | Freshness tracking per claim type | Medium | Hours ≠ founding date volatility |
| **Source independence analysis** | Distinguishes copied vs independent | Medium | Directory chains detection |
| **Knowledge-gap driven iteration** | Researches unknowns that matter | High | Information value × business importance |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| "N searches and stop" | Arbitrary stopping = shallow research | Information-value stopping condition |
| Single-source acceptance | No verification = hallucination risk | Require independent confirmation |
| LLM self-assessment of quality | Models overestimate confidence | Deterministic quality metrics |
| Fabricated facts for completeness | Violates core trust | Render UNKNOWN, never invent |
| Single search provider | No independence possible | Minimum 2 independent providers |
| Flat search results list | No investigation structure | Research question → evidence graph |
| Ignoring temporal freshness | Stale data = wrong conclusions | Per-claim freshness tracking |
| Silent overwrite of conflicts | Hides uncertainty | Preserve conflicts with audit trail |
| LLM self-validation | Models can't validate themselves | Deterministic schema + evidence validation |
| Research as "more tokens" | Cost ≠ depth | Information value per token |

## Feature Dependencies

```
Entity Resolution → Source Discovery → Deep Website Research
                                      ↓
Evidence Extraction → Verification → Conflict Resolution
                                      ↓
Knowledge Graph / Research State → Knowledge-Gap Detection
                                      ↓
Iterative Research Orchestration (loop)
                                      ↓
Customer/Competitor/Market Intelligence (parallel, consume graph)
                                      ↓
Business Research Dossier (canonical output)
                                      ↓
Brand DNA / Design Intelligence / Copy Strategy (consume dossier)
                                      ↓
Website Generation (safety gate on dossier quality)
```

## MVP Recommendation

**Prioritize (Must Have for "Deep Research"):**
1. **Canonical Evidence/Claim/Source model** (Phase 2) - Foundation
2. **Entity Resolution** (Phase 3) - Accuracy prerequisite
3. **Source Discovery** with 2+ providers (Phase 4) - Independence prerequisite
4. **Deep Official Website Research** (Phase 5) - Primary source depth
5. **Evidence Extraction + Normalization** (Phase 6) - Structured evidence
6. **Verification + Conflict Resolution** (Phase 7) - Trust prerequisite
7. **Knowledge Graph + Gap Detection** (Phases 8-9) - "Deep" mechanism
8. **Iterative Research Orchestration** (Phase 10) - The "deep" loop
9. **Business Research Dossier** (Phase 15) - Canonical output
10. **Generation Safety Gate** (Phase 18) - Protects generation

**Defer (Post-MVP):**
- Customer Review Intelligence (Phase 11) - Can use basic review aggregation initially
- Competitor Intelligence (Phase 12) - Can use basic category competitors initially
- Market Intelligence (Phase 13) - Can use static category norms initially
- Business-Type-Specific Taxonomy (Phase 7) - Start with generic, add per-type
- Full Observability/Metrics (Phase 20) - Add after core works

## Sources

- `BusinessResearchService.js` - Current extraction pipeline
- `BusinessProfile.js` - Provenance model
- `GeoapifyProvider.js` / `WebExtractionProvider.js` - Current providers
- `BusinessDataExtractor.js` - Official website extraction
- `DiscoveryProvider.js` - Abstract interface (no implementations)
- `BrandStrategyService.js` / `DigitalAuditService.js` / `DesignIntelligenceService.js` - Downstream consumers
- `WEBSITE-GENERATION-ARCHITECTURE.md` - Architecture doc
- Master prompt requirements (sections 5-15, 22-25)