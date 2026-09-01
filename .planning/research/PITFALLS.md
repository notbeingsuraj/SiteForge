# Domain Pitfalls

**Domain:** AI-powered Business Research & Website Generation
**Researched:** 2026-09-01

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Silent Overwrite in BusinessProfile.set()
**What goes wrong:** `BusinessProfile.set()` overwrites field values based solely on provenance priority (verified > discovered > identified > inferred). When two sources disagree (e.g., Geoapify says phone=X, website extraction says phone=Y), the higher-provenance source silently wins. The conflict is lost - no trace that a disagreement existed.

**Why it happens:** `BusinessProfile.set()` compares provenance priority and confidence, keeps the winner, discards the loser. No conflict detection or preservation.

**Consequences:** 
- Downstream systems (Brand DNA, Design Intelligence) receive "clean" but potentially wrong data
- No audit trail for "why does Webloom believe this phone number?"
- Cannot answer "sources disagree on hours" - the conflict is erased
- Hallucination risk: if AI enrichment wins over structured data due to confidence scoring bug

**Prevention:** 
- Add conflict detection in `BusinessProfile.set()`: if `newValue !== currentValue` and both have provenance, store conflict object
- Add `getConflicts(path)` method to retrieve unresolved disagreements
- Include conflicts in `_profileToIntelligence()` output so downstream sees them
- Add conflict resolution strategies: `authority_wins`, `most_recent`, `manual_review`, `preserve_all`

**Detection:** 
- Search for `BusinessProfile.set()` calls and trace where different providers set same field
- Add integration test: two providers return different values for same field → conflict recorded

### Pitfall 2: No Conflict Detection Between Providers
**What goes wrong:** Geoapify says business hours = 9-5, official website says 8-6, web extraction says 9-6. All three enter pipeline but only one survives in `BusinessProfile`. The fact that sources disagree is lost.

**Why it happens:** Pipeline merges sequentially (Geoapify → WebExtraction → AI) with `onlyIfMissing` flag. First provider wins for each field. No cross-provider comparison.

**Consequences:**
- Hours/phone/address silently wrong
- No way to know "sources disagree" vs "single source"
- Generation uses potentially wrong hours

**Prevention:**
- After each provider merge, compare new values against existing for same fields
- Store `conflicts: { field: { values: [{value, source, provenance}], resolution: 'strategy' } }`
- Expose conflicts in `_profileToIntelligence()` and downstream

### Pitfall 3: No Source Independence Analysis
**What goes wrong:** Geoapify returns phone from its database. Web extraction finds same phone on official website. Directory site copies from Geoapify. System sees "3 sources agree" but actually only 1 independent source.

**Why it happens:** No source lineage tracking. `BusinessProfile` stores `metadata.sources` (URLs) but no provider lineage or copy-detection.

**Consequences:**
- False confidence in claims (3 sources ≠ 3 independent sources)
- Verification rate metric inflated
- Cannot detect directory copying chains

**Prevention:**
- Track provider lineage per claim: `claim.sources = [{url, provider, retrievedAt, isPrimary}]`
- Implement copy-detection: same phone/address on multiple domains → check if one is authoritative (official site) vs aggregator
- Compute `sourceIndependence` metric: unique primary sources / total sources

### Pitfall 4: Single-Pass Research (No Iteration)
**What goes wrong:** System does one search → one extraction → one AI call → done. If first search misses the official website, or review themes need follow-up, or competitor discovery is incomplete - system stops anyway.

**Why it happens:** `BusinessResearchService.extractBusinessIntelligenceWithProviders()` is a single linear pipeline (L1→L2→L3→L4→L5). No loop, no gap detection, no follow-up.

**Consequences:**
- Misses official website if not in first Geoapify result
- Misses review themes that require reading 50+ reviews
- Misses competitors not in first category search
- Cannot resolve "hours conflict" because no follow-up to check authoritative source

**Prevention:**
- Implement research loop with explicit stages: PLAN → DISCOVER → EXTRACT → VERIFY → GAP_DETECT → FOLLOW_UP → REPEAT
- Add `ResearchOrchestrator` class with budget guards
- Implement `KnowledgeGapDetector` after each stage

### Pitfall 5: No Knowledge-Gap Detection
**What goes wrong:** System doesn't know what it doesn't know. After extraction, no mechanism identifies "we have phone but no hours" or "we have rating but no review themes" or "competitors unknown."

**Why it happens:** `BusinessProfile.getCompleteness()` only counts filled fields (simple count). No semantic understanding of "which unknowns matter for website generation."

**Consequences:**
- Website generation proceeds with critical gaps (no hours → no hours section)
- Brand DNA generated without review intelligence
- Design Intelligence without competitor visual analysis

**Prevention:**
- Implement `KnowledgeGapDetector` that maps: field → business importance × uncertainty × decision impact
- After each research stage, produce `knowledgeMap: { known, uncertain, conflicted, unknown }`
- Rank gaps by `informationValue × businessImportance × uncertainty × decidability`

### Pitfall 6: LLM Self-Assessment of Quality
**What goes wrong:** System might ask LLM "Rate your confidence" or "How good is this research?" - models systematically overestimate.

**Why it happens:** Temptation to use LLM for quality metrics instead of deterministic computation.

**Consequences:**
- Inflated quality scores
- Low-quality research passes generation gate
- No actionable metrics for improvement

**Prevention:**
- All quality metrics deterministic: `verificationRate = verifiedClaims / totalClaims`, `sourceAuthority = avg(source.authority)`, `freshness = weightedAvgAge()`, `sourceIndependence = uniquePrimarySources / totalSources`
- Never ask LLM to rate itself
- Quality metrics computed by deterministic functions in `ResearchQualityCalculator` class

### Pitfall 6: LLM Self-Validation
**What goes wrong:** Using LLM to validate its own output ("Does this JSON match schema?")

**Why it happens:** Temptation to use LLM as validator

**Consequences:** Same failure modes as generator; circular validation

**Prevention:** Deterministic schema validation (`JSON.parse` + JSON Schema validator) + evidence cross-check (every factual claim must have source reference)

### Pitfall 7: Fabrication for Completeness
**What goes wrong:** AI enrichment fills missing fields with plausible guesses (e.g., invents phone number, makes up hours, creates fake review themes).

**Why it happens:** AI prompted to "fill all fields" without "only use provided evidence" constraint.

**Consequences:**
- Generated website shows fake phone number
- Customer calls wrong number
- Trust destroyed

**Prevention:**
- AI enrichment prompt: "Only fill fields that are currently null/empty; never change provided KNOWN values. If you cannot determine from evidence, return null."
- `BusinessProfile` provenance: `inferred` fields NEVER enter factual profile (only `identified`/`discovered`/`verified`/`user_provided`)
- Generation safety gate: if critical facts missing → conservative mode (omit section) not fabrication

### Pitfall 8: No Temporal Freshness Tracking
**What goes wrong:** 5-year-old review treated same as yesterday's. 2019 hours treated as current. Founding year from 2015 article treated as current fact.

**Why it happens:** `BusinessProfile` stores `updatedAt` per field but no `retrievedAt` / `observedAt` / `publishedAt` / `lastVerifiedAt`. No volatility classification per field type.

**Consequences:**
- Website shows outdated hours/pricing/menu
- Design uses outdated brand signals
- Competitor analysis uses stale data

**Prevention:**
- Add temporal metadata per claim: `retrievedAt`, `observedAt` (when source says it's current), `publishedAt`, `lastVerifiedAt`
- Volatility classification: `identity→low`, `address→low/medium`, `hours→high`, `pricing→high`, `menu→high`, `reviews→very high`, `social→very high`
- Freshness scoring: `freshness = 1 - min(age / maxAge, 1)` per volatility class
- TTL-aware caching: `static history→30d`, `hours→24h`, `pricing→24h`, `reviews→6h`, `social→1h`

### Pitfall 9: No Entity Resolution
**What goes wrong:** "Apple" search returns Apple Inc + Apple Bakery + Apple Farm. "Tartine Bakery" merges SF flagship + LA branch + closed Oakland location. Franchise vs independent not distinguished.

**Why it happens:** `BusinessProfile` has no entity ID concept. `BusinessResearchService` treats each extraction as single entity. No cross-provider ID mapping (placeId, domain, phone, coordinates).

**Consequences:**
- Merged profiles for different entities
- Branch-specific info (hours, menu) mixed
- Closed location treated as open

**Prevention:**
- Implement `EntityResolver` with multi-field matching: `name + coordinates + phone + domain + providerIds`
- Classification: `same_entity`, `same_brand_different_location`, `parent_subsidiary`, `franchise`, `different_entity`, `closed_entity`, `uncertain`
- Entity ID in `BusinessProfile`: `entityId: { value, resolutionMethod, confidence }`

### Pitfall 10: No Source Independence / Copy Detection
**What goes wrong:** Directory A copies from Geoapify. Directory B copies from Directory A. System sees 3 sources but only 1 primary.

**Why it happens:** No source lineage tracking. `BusinessProfile.metadata.sources` is just URL list.

**Consequences:** Inflated verification rate, false confidence.

**Prevention:**
- Track provider lineage: `claim.sources = [{url, provider, retrievedAt, isPrimary, copiesFrom}]`
- Copy detection: identical phone/address on multiple domains → check WHOIS, content similarity, authoritative domain (official site > directory > aggregator)
- Independence metric: `uniquePrimarySources / totalSources`

### Pitfall 11: LLM Self-Assessment / Self-Validation
**What goes wrong:** Asking LLM "How confident are you?" or "Validate this output"

**Why it happens:** Natural tendency to use LLM for everything

**Consequences:** Systematic overconfidence, circular validation

**Prevention:** 
- Quality metrics: deterministic functions only
- Validation: deterministic schema + evidence cross-reference
- Never ask LLM to rate/validate itself

### Pitfall 12: No Temporal Research / Historical Awareness
**What goes wrong:** Business founded date from 2015 article treated as current. Historical milestones not captured. Business evolution not tracked.

**Why it happens:** No historical research phase. Current extraction only captures current state.

**Consequences:** Missing brand heritage, founding story, evolution narrative for brand DNA.

**Prevention:** Historical research phase: search for founding, milestones, ownership changes, press over time. Store with temporal metadata.

### Pitfall 13: No Research Budget Enforcement
**What goes wrong:** Unbounded queries, infinite loops, runaway costs.

**Why it happens:** No budget parameters in `BusinessResearchService`.

**Consequences:** Runaway API bills, infinite loops, stalled generations.

**Prevention:**
- Budget config: `maxQueries`, `maxPages`, `maxReviews`, `maxAIRequests`, `maxTokens`, `maxIterations`, `maxRuntimeMs`
- Hard limits enforced in `ResearchOrchestrator` loop
- Safety limits: "We performed N searches" is NOT a stopping condition; use information-value threshold

### Pitfall 14: No Observability / Audit Trail
**What goes wrong:** Cannot answer "why does Webloom believe X?" or debug why research failed.

**Why it happens:** No structured audit logging of research process.

**Consequences:** Cannot debug, cannot improve, cannot explain to user.

**Prevention:**
- Structured audit log per research run (see master prompt §39)
- Log: entity resolution, source discovery, documents analyzed, evidence extracted, claims, conflicts, gaps, iterations, quality metrics
- Per-run unique ID for tracing

## Moderate Pitfalls

### Pitfall 15: Single Search Provider Dependency
**What goes wrong:** Only one search provider (or none - `DiscoveryProvider` abstract but no implementations). No source independence possible.

**Prevention:** Implement at least 2 concrete `DiscoveryProvider` implementations (Bing + Brave, or Brave + DuckDuckGo).

### Pitfall 16: Shallow Official Website Research
**What goes wrong:** Only homepage scraped. Menu, about, team, services, pricing pages not crawled.

**Prevention:** Implement sitemap/navigation discovery + business-type-aware page prioritization.

### Pitfall 17: Review Sentiment as Single Score
**What goes wrong:** "4.5 stars" - loses themes, frequency, evidence.

**Prevention:** Structured theme extraction with evidence snippets, frequency counting.

### Pitfall 18: No Competitor Intelligence
**What goes wrong:** Brand DNA and Design Intelligence generated in vacuum.

**Prevention:** Semantic competitor discovery → deep profile per competitor → comparative synthesis.

### Pitfall 19: No Generation Safety Gate
**What goes wrong:** Website generation runs even with critical gaps/conflicts.

**Prevention:** Quality gate before generation: `HIGH→normal`, `PARTIAL→conservative`, `LOW→evidence-only`, `CRITICAL→additional research`.

### Pitfall 20: AI Cost Unbounded
**What goes wrong:** No per-run token/query limits.

**Prevention:** Budget config: `maxQueries`, `maxAIRequests`, `maxTokens`, `maxRuntimeMs`.

## Minor Pitfalls

### Pitfall 21: No Caching Strategy
**What goes wrong:** Every generation starts from zero. Re-extracting same website repeatedly.

**Prevention:** Multi-layer cache with TTL by volatility: entity resolution (30d), discovered URLs (7d), retrieved documents (24h), parsed pages (24h), extracted evidence (24h), claims (24h), competitor discovery (7d).

### Pitfall 22: No Rate Limit / Provider Failure Handling
**What goes wrong:** One provider timeout kills entire pipeline.

**Prevention:** Provider orchestration with classification: `TIMEOUT`, `AUTH`, `RATE_LIMITED`, `NO_RESULT`, `NETWORK`, `INVALID_RESPONSE`. One provider failing → continue with others.

### Pitfall 23: No Security for Generated Sites
**What goes wrong:** Generated sites might expose API keys if not careful.

**Prevention:** Never write API keys to generated sites. Use existing redaction helpers. Keys stay in `apps/api/.env`.

### Pitfall 24: No Regression Testing for Generation
**What goes wrong:** Changes to research engine silently break website generation.

**Prevention:** `npm test` + `node test_v2_generation.js` after every phase. Protect: `DesignIntelligenceService`, `extractSummary`, `Brand DNA fallback`, `Design Intelligence fallback`, `WebsiteGenerationService`, `GeneratedSiteManager`, `Astro generation`, `port allocation`, `server startup`, `Webloom branding`.

### Pitfall 25: Generated Sites Pollute Repo
**What goes wrong:** `generated-sites/` committed to git.

**Prevention:** `.gitignore` add `generated-sites/`; root `generated-sites/.webloom.json` manifest.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Evidence Model | Creating parallel schema that duplicates BusinessProfile | Extend BusinessProfile with evidence graph, don't duplicate |
| Entity Resolution | Over-engineering matching logic | Start with exact match on (name+coords), then fuzzy |
| Source Discovery | Building custom crawler instead of using search APIs | Use search APIs (Bing/Brave) for discovery, not custom crawl |
| Deep Website Research | Crawling entire site (too slow/expensive) | Business-type page prioritization + maxPages budget |
| Evidence Extraction | Using LLM for all extraction | Deterministic parsers for structured data; AI only for semantic |
| Verification | Requiring 3 sources for every claim | Tiered: critical facts→2 independent; nice-to-have→1 |
| Conflict Resolution | Auto-resolving all conflicts | Preserve conflicts; only auto-resolve with clear authority |
| Knowledge Graph | Over-engineering graph DB | Start with in-memory JSON graph; persist to file |
| Gap Detection | Finding too many gaps (noise) | Rank by information value × business importance |
| Research Loop | Infinite loops | Hard budget limits (queries, time, iterations) |
| Customer Research | Reading all reviews (slow/expensive) | Sample + theme extraction; deduplicate first |
| Competitor Research | Finding competitors via "X competitors" search | Category + location + semantic similarity |
| Market Research | Treating industry trends as business facts | Separate FACT / OBSERVATION / INFERENCE |
| AI Synthesis | Passing raw documents to LLM | Curate evidence set: verified facts + conflicts + unknowns |
| Dossier | Creating parallel model to BusinessProfile | Extend BusinessProfile with research metadata |
| Brand DNA Integration | Breaking existing BrandStrategyService interface | Consume dossier, keep same output schema |
| Design Intelligence Integration | Breaking existing DesignIntelligenceService interface | Consume dossier, keep same output schema |
| Safety Gate | Blocking generation for minor gaps | Tiered modes: HIGH/normal, PARTIAL/conservative, LOW/evidence-only |
| Testing | Only testing happy path | Test: no results, conflicts, stale sources, provider failures |

## Sources

- `BusinessProfile.js` - Provenance model, `set()` method, conflict gap
- `BusinessResearchService.js` - Single-pass pipeline, no iteration
- `BusinessProfileValidator.js` - Validation but no conflict detection
- `BusinessResearchService.js` - Provider orchestration (no conflict detection)
- `ProviderAdapter.js` - Canonical mapping (no independence tracking)
- `BusinessDataExtractor.js` - Shallow extraction (homepage only)
- `DiscoveryProvider.js` - Abstract only, no implementations
- `AIService.js` - Fallback logic (good), but no cost budgets
- `BrandStrategyService.js` / `DigitalAuditService.js` / `DesignIntelligenceService.js` - Independent AI calls, don't consume shared research
- `BusinessProfileValidator.js` - Field validation only
- `WEBSITE-GENERATION-ARCHITECTURE.md` - Sections 4, 11, 12
- Master prompt sections 16-33, 42-43