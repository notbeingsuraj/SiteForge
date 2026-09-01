# Research Summary: Webloom Deep Research Intelligence Engine

**Domain:** AI-powered business research and website generation pipeline
**Researched:** 2026-09-01
**Overall confidence:** HIGH

## Executive Summary

Webloom is a sophisticated AI-powered pipeline that converts Google Maps URLs into verified business intelligence and generates personalized local websites. The current architecture (as of commit aea7eb6) has a **stable, production-ready extraction pipeline** but the **research depth is shallow** - it primarily uses Geoapify structured data + web extraction fallback + single-pass AI enrichment. The deep research engine specified in the master prompt requires fundamental architectural changes to transform Webloom from a "search + LLM summary" system into a genuine "iterative, evidence-backed investigation engine."

## Key Findings

**Stack:** Node.js/Express + React/Vite + OmniRoute (AI routing) + Geoapify (structured data) + r.jina.ai (web extraction proxy) + Astro/Vite (generated site renderer). **Architecture:** Provider-abstracted extraction pipeline (Geoapify → WebExtraction → AI enrichment) feeding a provenance-tracked `BusinessProfile`, consumed by downstream services (Brand DNA, Digital Audit, Design Intelligence) for website generation. **Critical gap:** No iterative research loop, no evidence graph, no multi-source verification, no conflict resolution, no knowledge-gap detection - the system produces a single-pass result and stops.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Codebase Research + Architecture** - Complete this audit (done)
2. **Phase 2: Canonical Evidence/Provenance Model** - Create `Evidence`, `Claim`, `Source` types with field-level provenance; replace flat `facts[]` with structured evidence graph
3. **Phase 3: Entity Resolution** - Disambiguate branches/franchises/closed entities using multi-field matching (name + coords + phone + domain + provider IDs)
4. **Phase 4: Source Discovery** - Implement `DiscoveryProvider` abstraction with at least 2 concrete implementations (Bing, DuckDuckGo, Brave); prioritize primary sources
5. **Phase 5: Deep Official Website Research** - Crawl sitemap/navigation, extract structured data from ALL relevant pages (not just homepage), business-type-aware page prioritization
6. **Phase 6: Evidence Extraction + Normalization** - Schema.org, microdata, OpenGraph, visible text extraction with deterministic parsers; AI only for semantic interpretation
7. **Phase 7: Verification + Conflict Resolution** - Cross-source claim verification, independence detection, conflict preservation with audit trail
8. **Phase 8: Knowledge Graph / Research State** - Persistent research state machine with questions → sources → evidence → claims → verification graph
9. **Phase 9: Knowledge-Gap Detection** - Post-stage uncertainty mapping → targeted follow-up question generation → research prioritization (information value × business importance × uncertainty)
10. **Phase 10: Iterative Research Orchestration** - Research loop with budget guards, diminishing-returns stopping condition, cache-aware incremental runs
11. **Phase 11: Customer/Review Intelligence** - Structured review theme extraction (not sentiment scores), deduplication, theme frequency counting with evidence snippets
12. **Phase 12: Competitor Intelligence** - Semantic competitor discovery → deep profile per competitor → comparative landscape synthesis
13. **Phase 13: Market Intelligence** - Category norms, pricing patterns, positioning whitespace analysis
14. **Phase 14: AI Research Synthesis** - Source-aware prompt with verified facts + conflicts + unknowns → canonical Business Research Dossier
15. **Phase 15: Business Research Dossier** - Single canonical output replacing current `intelligence` shape; includes facts, inferences, conflicts, unknowns, provenance, quality metrics
16. **Phase 16: Brand DNA Integration** - Consume dossier instead of independent AI call; brand signals derived from observed evidence
17. **Phase 17: Design Intelligence Integration** - Consume dossier; visual signals derived from observed brand evidence
18. **Phase 18: Generation Safety Gate** - Quality threshold check before website generation; conservative/evidence-only modes for low-quality dossiers
19. **Phase 19: Deep End-to-End Testing** - Multi-business-type validation (restaurant, retail, SaaS, professional services); regression tests
20. **Phase 20: Performance/Cost Hardening** - Parallel retrieval, caching layers, budget enforcement, observability metrics

## Phase Ordering Rationale

- **Phases 1-3** establish the foundational data model (evidence, claims, entity resolution) without which later phases have no structure
- **Phases 4-7** build the core research capability (discovery → extraction → verification → conflict resolution) - the "investigation" engine
- **Phases 8-10** add the iterative loop (state machine, gap detection, orchestration) - the "deep" in deep research
- **Phases 11-13** add specialized intelligence domains (customer, competitor, market) that depend on the core loop
- **Phases 14-18** integrate with existing downstream systems (Brand DNA, Design Intelligence, Website Generation) - must come after dossier exists
- **Phases 19-20** validation and hardening - require complete system

## Research Flags for Phases

- **Phase 2 (Evidence Model):** HIGH - Need to decide whether to extend `BusinessProfile` or create parallel `EvidenceGraph`; existing `BusinessProfile` provenance is strong but flat
- **Phase 3 (Entity Resolution):** MEDIUM - Current `BusinessProfile` has no entity ID concept; need cross-provider ID mapping
- **Phase 4 (Source Discovery):** HIGH - `DiscoveryProvider` abstract class exists but NO concrete implementations; need to select/integrate search APIs
- **Phase 5 (Deep Website Research):** HIGH - Current `OfficialWebsiteProvider` only extracts homepage; need sitemap/navigation discovery + business-type-aware page prioritization
- **Phase 7 (Conflict Resolution):** HIGH - Current system has NO conflict detection; `BusinessProfile.set()` silently overwrites based on provenance priority
- **Phase 9 (Knowledge-Gap Detection):** HIGH - No uncertainty tracking exists; `BusinessProfile.getCompleteness()` is simple field-count
- **Phase 14 (AI Synthesis):** MEDIUM - Current prompts don't pass conflicts/unknowns/evidence; need source-aware synthesis prompt
- **Phase 18 (Safety Gate):** MEDIUM - Current pipeline has no quality gate; `DesignIntelligenceService` runs regardless of research quality

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Actual code inspected |
| Features | HIGH | Master prompt requirements vs current code gap is clear |
| Architecture | HIGH | Actual service dependencies traced |
| Pitfalls | HIGH | Based on actual code patterns (silent overwrites, no conflict detection, single-pass) |