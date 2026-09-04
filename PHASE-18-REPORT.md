# PHASE 18 REPORT — Re-run Affected Research After Identity Resolution

**Date:** 2026-09-04
**Status:** COMPLETE
**Objective:** Close the Webloom intelligence loop so that after an operator
approves or rejects an identity review, the affected provider records can be
re-run through the existing research/intelligence pipeline against the
*corrected persistent identity state* — no stale in-memory objects.

---

## 1. Audit Results (STEP 1 — inspected before any modification)

The following is the existing production call graph and answers to the 16 audit
questions. No code was modified during this audit.

### Answers to the 16 audit questions

1. **Where are review decisions persisted?** `IdentityRepository.enforceReviewDecision(id, decision, opts)` (in `apps/api/src/db/IdentityRepository.js`, Phase 16). It atomically applies the decision and writes the review status + audit `resolution_record` inside one SQLite transaction. Exposed via `resolveReviewItem()`.
2. **How does a review identify the affected provider records/entities?** `ReviewItem` rows carry `entityId`, `relatedEntityId`, `provider`, `providerRecordId`, `relatedProvider`, `relatedProviderRecordId`, plus `matchType`. Pairwise reviews name both providers; temporal (`relocated_entity`) reviews usually name only the entity (provider records live on the entity's observations).
3. **How does BusinessResearchService start research?** `extractBusinessIntelligenceWithProviders(input)` (Levels 1–6: deterministic hints → Geoapify → web extraction → AI enrichment → validation → `_persistIdentity`). The authoritative path.
4. **How is ProviderIdentity recovered?** `IdentityRepository.findProviderIdentity(provider, providerRecordId)`; the UNIQUE `(provider, providerRecordId)` constraint is the authoritative mapping boundary. `_persistIdentity` reuses the mapped entity and never duplicates.
5. **How are canonical fields loaded?** `IdentityRepository.getCanonicalFields(entityId)` and `loadCanonicalFieldsIntoProfile(entityId, profile)`.
6. **How are observations appended?** `IdentityRepository.createObservation(...)` — append-only (never destructive). `CanonicalizationService.processObservation` appends observations + canonicalizes.
7. **How are conflicts handled?** `CanonicalizationService._handleConflict` — identity-sensitive fields keep existing canonical unless new evidence is significantly stronger; `verified` provenance (priority 4) always wins over `discovered` (priority 3).
8. **How does BrandStrategyService consume intelligence?** `generateBrandDNA(normalizedBusinessData)` — reads the canonical intelligence shape (`identity`, `contact`, `location`, …).
9. **How does WebsiteStrategyService consume intelligence?** `generateStrategy(brandDNA, digitalAudit, businessData)`.
10. **How does WebsiteGenerationService consume intelligence?** `generate(business, options)` — assembles a deterministic site config strictly from profile facts, with deterministic fallback when AI design is unavailable.
11. **Does any existing method already perform part of this re-run?** No. `_persistIdentity` re-resolves *newly observed* provider records, but there was no operator entry point to re-run a *resolved review* against persisted post-decision state.
12. **Could re-running create a duplicate BusinessEntity?** Yes, if re-run naively called `_persistIdentity` with an unseen primary observation. The re-run must consult the already-persisted `ProviderIdentity` mapping and re-canonicalize, never `createEntity*`.
13. **Could re-running reopen an already resolved review?** Yes, if it re-ran Hook A/Hook B (`createReviewItem`). Re-run must not call review creation at all; the dedupe key also already returns the resolved review unchanged.
14. **Could re-running overwrite verified canonical data?** Only if it bypassed provenance priority. `verified` provenance (used by relocation approval) beats `discovered`, so re-running provider observations cannot clobber an approved relocation.
15. **Could re-running merge same-brand-different-location entities?** Only if it invoked merge logic. Re-run must not merge; it re-canonicalizes each provider into its own persisted entity.
16. **Does relocation approval cause subsequent research to use the new canonical address?** Yes — `_txApplyRelocation` writes the approved address to `BusinessEntity.canonicalAddress` and the `location.full_address` canonical field with `verified`/`1.0`. Re-running through canonicalization preserves it (verified wins).

### Existing call graph (as found)

```
[research request]
      │ extractBusinessIntelligenceWithProviders(input)   BusinessResearchService
      ▼
 [deterministic hints] → [Geoapify] → [web extraction] → [AI enrichment] → [validation]
      │
      ▼
 _persistIdentity(profile, hints, sourceUrl, geoapifyRec, webRec)
      │  findProviderIdentity → reuse OR createEntityWithProviderIdentity (first obs)
      │  secondary provider → calculateMatchScore (EntityResolution) → createProviderIdentity
      │  → createResolutionRecord
      │  → Hook A: createReviewItem (pairwise uncertain / same_brand_different_location)
      ▼
 CanonicalizationService.processObservation  (per provider record)
      │  createObservation (append) → upsertCanonicalField (provenance-guarded)
      │  conflicts → _handleConflict
      ▼
 Hook B: analyzeEntityRelocation (TemporalRelocationAnalyzer) → createReviewItem
      ▼
 loadCanonicalFieldsIntoProfile → _profileToIntelligence
      ▼
 intelligence snapshot   → BrandStrategyService → WebsiteStrategyService → WebsiteGenerationService
```

---

## 2. Minimal Re-run Contract (STEP 2)

Designed as THE single internal operation, reusing existing production services
— **no second pipeline**:

```
review decision (approved | rejected)
   → identify affected provider record(s) from ReviewItem
   → reload persistent entity state (Repository reads only)
   → re-run provider observations through CanonicalizationService.processObservation
   → reload canonical profile (loadCanonicalFieldsIntoProfile)
   → regenerate intelligence (BusinessResearchService.regenerateCanonicalIntelligence
                              → existing _profileToIntelligence projection)
   → return refreshed intelligence + explicit status per record
```

`BusinessResearchService.regenerateCanonicalIntelligence(repo, entityId)` is the
only new method added to the authoritative research service; it reuses the exact
same canonical-profile-load + `_profileToIntelligence` path as the primary
research flow.

---

## 3. Decision-Specific Semantics (STEP 3)

- **APPROVED same_entity / merge** — The re-run reads the *reassigned* provider
  mapping (Phase 16 moved the provisional mapping onto the authoritative
  entity). Both provider sides re-canonicalize into the authoritative entity.
  No third entity, no new mapping. The MERGED source keeps its historical
  observations (the re-run reads them from the source entity when the mapping
  points at the authority).
- **APPROVED relocated_entity** — The re-run keeps the `verified` approved
  address authoritative. Re-observing the provider's latest address (new) is
  equivalent to the verified canonical; the OLD historical observation remains.
  No second entity is created.
- **APPROVED same_brand_different_location** — NOT a merge. Each provider
  record re-canonicalizes into its own persisted entity; mappings stay
  isolated; canonical fields remain entity-specific.
- **REJECTED** — Identity is untouched. Re-run re-resolves records
  best-effort but never reinterprets the rejection, never merges, never
  reopens the review.

---

## 4. Idempotency (STEP 4)

The re-run composes only side-effect-free reads plus the existing
provenance-guarded `processObservation`. Repeating the same review yields the
same entity count, the same provider mappings, the same canonical values, and
the same resolved review status. Verified.**

---

## 5. Failure Behavior (STEP 5)

- **Provider data unavailable** → `status: 'provider_unavailable'`; no fake
  observations, canonical state untouched.
- **AI unavailable** → re-run is fully deterministic and never calls AI; facts
  come from persisted canonical fields. No corruption.
- **Persistence failure** → surfaced as `persistence_error`; never reported as
  full success.
- No new failure architecture was introduced.

---

## 6. Production Files Changed

| File | Change |
| ---- | ------ |
| `apps/api/src/services/BusinessResearchService.js` | Added public `regenerateCanonicalIntelligence(repo, entityId, providerTrace?)` — rebuilds a fresh `BusinessProfile`, loads persisted canonical fields, and projects intelligence via the existing `_profileToIntelligence` path. |
| `apps/api/src/services/ReResearchService.js` | **New** thin orchestrator. `rerunReview(reviewId)`: identifies affected provider records, reloads persistent state, re-runs observations through the existing `CanonicalizationService`, reloads the canonical profile, and regenerates intelligence. Pure orchestration — no duplicated pipeline. |

## 7. Test Files Changed

| File | Change |
| ---- | ------ |
| `apps/api/test_phase18_reresearch.js` | **New** — the single focused Phase 18 harness (49 assertions, 14 scenarios). |
| `apps/api/test_phase18_rerun_child.js` | **New** — child-process runner for the process-restart persistence scenario (scenario 9). |

No pre-existing test was weakened.

---

## 8. Architectural Change

A **review → re-run orchestrator** layered on top of the existing authoritative
research path. Identity corrections produced by Phase 16's atomic review
enforcement are now consumable by downstream intelligence: an operator decision
mutates persisted identity, and `ReResearchService` replays the affected
provider records through the existing canonicalization + intelligence-projection
path against that persisted state. No new DB tables, no new provider, no new
Entity Resolution/canonicalization path, no new review creation.

### Complete review → re-run call graph

```
[operator resolves review]   review-cli.js | POST /api/reviews/:id/resolve
   → IdentityRepository.enforceReviewDecision()   (atomic, idempotent, Phase 16)
        approved same_entity        → _txApplyMerge        → status=approved
        approved relocated_entity   → _txApplyRelocation   → status=approved
        approved same_brand_diff    → status-only          → status=approved
        rejected (any)              → status-only          → status=rejected
        ▼
[re-run]   ReResearchService.rerunReview(reviewId)
   → getReviewItem(reviewId)            (must be resolved; pending → ValidationError)
   → identify affected provider record(s)
         - from review.provider / relatedProvider
         - fallback: derive from the review entity's observations
   → for each (provider, providerRecordId):
         findProviderIdentity(provider, recordId)     → PERSISTED (post-decision) mapping
         getEntityById(entityId)
         getObservations(entity/relatedEntity, provider, recordId)
         reconstructRecordFromObservations()          (latest per field, deterministic)
         CanonicalizationService.processObservation(entityId, provider, record)
             → createObservation (append) → upsertCanonicalField (verified wins)
         BusinessResearchService.regenerateCanonicalIntelligence(repo, entityId)
             → loadCanonicalFieldsIntoProfile → _profileToIntelligence
   → returns { results[], entities[], reviewStatus }
        ▼
[downstream] BrandStrategyService → WebsiteStrategyService → WebsiteGenerationService
```

---

## 9. Scenarios Tested & Test Counts

`node apps/api/test_phase18_reresearch.js` → **49 passed, 0 failed**.

| # | Scenario | Assertions |
| --| -------- | ---------- |
| 1 | merge approval → re-run | results for both providers; resolves to authoritative entity; no 3rd entity; no duplicate mapping; secondary intelligence present; history preserved; review stays approved |
| 2 | relocated approval → re-run | keeps approved new canonical address (verified); no 2nd entity; old-address history preserved |
| 3 | same-brand-different-location approval → re-run | both entities remain; no collapse; mappings isolated; canonical entity-specific |
| 4 | rejected review → re-run | identity untouched; provisional not merged; no review resurrection |
| 5 | repeated re-run idempotency | entity/mapping/canonical/review stable across 3 re-runs; intelligence deterministic |
| 6 | provider unavailable during re-run | surfaced explicitly; no fabrication; canonical not destroyed |
| 7 | AI unavailable during re-run | deterministic intelligence present; canonical facts preserved |
| 8 | persistence degradation during re-run | surfaced explicitly; never fake success |
| 9 | process restart between approval and re-run | fresh Node process continues the workflow; sees corrected state |
| 10 | entity isolation | distinct branches remain isolated (covered in 3) |
| 11 | provider mapping uniqueness | no duplicate mappings after re-run (covered in 1 & 5) |
| 12 | observation history preservation | old observations intact |
| 13 | canonical value preservation | canonical fields intact / verified address preserved |
| 14 | previously resolved review remains resolved | approved/rejected status immutable |

---

## 10. Regression Results (STEP 7)

All on clean temporary SQLite databases. Two harnesses use fixed DB paths and
are not self-cleaning; their first-pass "1 failed" was a **stale-DB artifact**
(documented, not a production failure) — confirmed green when re-run fresh:

| Test | Result |
| ---- | ------ |
| `test_phase18_reresearch.js` | **49 passed, 0 failed** |
| `npm test` (`test_providers.js`) | **22 passed, 0 failed** |
| Schema (`test_db_schema.js`) | **All schema tests passed** |
| IdentityRepository (`test_identity_repository.js`) | **All IdentityRepository tests passed** (fresh DB) |
| Entity Resolution (`test_entity_resolution.js`) | **All passed** |
| Phase 14 (`test_phase14_entity_resolution.js`) | **27 passed, 0 failed** |
| Phase 15 (`test_phase15_temporal_review.js`) | **44 passed, 0 failed** |
| Phase 16 (`test_phase16_review_enforcement.js`) | **54 passed, 0 failed** |
| Phase 17 (`test_phase17_review_operator.js`) | **35 passed, 0 failed** |
| Phase 17 (`test_phase17_review_boundary.js`) | **37 passed, 0 failed** |
| Phase 10 (`test_phase10_entity_lifecycle.js`) | **12 passed, 0 failed** |
| Phase 11 (`test_phase11_concurrency.js`) | **5 scenarios passed, 0 failed** |
| Phase 12 (`test_phase12_transactional_identity.js`) | **12 passed, 0 failed** (fresh DB) |
| Website generation (`test_website_generation.js`) | **45 passed, 0 failed** (deterministic fallback used) |

---

## 11. Duplicate-Pipeline Audit (STEP 8)

The implementation introduces **no** second pipeline:

- No second canonicalization path — reuses `CanonicalizationService.processObservation`.
- No second Entity Resolution path — none needed: the re-run reads the already-resolved `ProviderIdentity` mapping rather than re-scoring.
- No second provider research path — no live provider fetches; re-runs persisted observations deterministically.
- No duplicate downstream intelligence generation — one projection (`_profileToIntelligence`).
- No duplicate observation writes — appends via the existing `createObservation` inside `processObservation`.
- No duplicate review creation — re-run never calls `createReviewItem`.

Webloom still has exactly **ONE authoritative research pipeline**;
`ReResearchService` is a thin orchestrator over it.

---

## 12. Defects Discovered & Fixed

- **Test seed gap (relocation):** the relocation scenario lacked a persisted
  `ProviderIdentity` mapping, so `findProviderIdentity` correctly returned
  `provider_unavailable`. Fixed by seeding the mapping (a real research run
  always creates one).
- **Temporal review provider identification:** a `relocated_entity` review
  carries no explicit provider pair; the orchestrator now derives affected
  provider records from the review entity's observations.
- **Child-process stdout contamination:** the DB-init `console.log` polluted
  the child's JSON; routed library logs to stderr so stdout remains
  JSON-clean.
- **Idempotency baseline assertion bug** (test-only): canonical-baseline read
  before the first re-run returned null; moved the baseline read after `r1`.
- **Stale-DB artifacts** in `test_phase12` / `test_identity_repository`
  (both fixed-path, non-self-cleaning). Not production defects — cleaned and
  confirmed green once.

## 13. Defects Discovered & Not Fixed (out of scope)

None within Phase 18 scope. Persistence is append-only by design (each re-run
appends an observation set), consistent with the existing research pipeline's
behavior and the Phase 18 spec's "no destructive observation replacement".

---

## 14. Remaining Limitations

- Re-run is **offline/deterministic**: it replays persisted observations rather
  than re-fetching live provider data. If live provider data changed between
  review and re-run, a separate research request (`extractBusinessIntelligenceWithProviders`)
  is the path to ingest the new observations; the re-run reconciles what is
  already persisted with the corrected identity.
- Existing conflict rows may accumulate across repeated re-runs when a provider
  record disagrees with a verified canonical field (e.g. a branch reporting the
  old address post-relocation). This is non-destructive and matches existing
  pipeline semantics.
- The re-run returns per-record status + refreshed intelligence but does not
  itself re-run `BrandStrategyService`/`WebsiteStrategyService`; downstream
  consumers must be re-invoked with the refreshed intelligence (or for
  `WebsiteGenerationService`, re-fired with the new profile). No caching layer
  exists to auto-invalidate those outputs.

---

## 15. What Phase 18 Can Now Guarantee

For any review resolved through Phase 16, `ReResearchService.rerunReview` gives:

1. A decision persistently changed identity state (via `enforceReviewDecision`).
2. A re-run that **reads** that persisted state (mappings, entities, canonical).
3. The same provider record resolves to the corrected entity (no duplicates).
4. Canonical intelligence reflects the corrected state.
5. Downstream consumers can receive the corrected intelligence snapshot.
6. Historical observations remain preserved.
7. Review history remains immutable / stays resolved.
8. Repeated re-runs are idempotent.
9. Different entities remain isolated (same-brand-drop / branches).
10. No duplicate identity records or provider mappings are created.
11. Failure of optional AI does not corrupt deterministic intelligence.
12. Provider/persistence failures are explicitly surfaced, never faked.
13. A fresh Node process can continue the workflow after restart.

---

## 16. Recommended Phase 19

**Refresh downstream deterministic consumers after a re-run.** When a re-run
produces a changed intelligence snapshot for an entity, invalidate/regenerate
the deterministic downstream artifacts that depend on that intelligence
(e.g. re-run `WebsiteGenerationService.assembleConfig` with `build:false` and
`start:false` for the same slug, and update `site.config.json`), keyed by the
entity's canonical profile version. This turns Phase 18's "refreshed
intelligence" into "refreshed live outputs." A minimal, deterministic
`refreshDownstream(entityId)` that reuses existing services and records a
`canonical_profile_version` would close the last gap without new architecture.

**Phase 19 is NOT started automatically.**
