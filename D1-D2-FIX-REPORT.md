# SITEFORGE — D1/D2 FIX REPORT

**Scope:** Implementation of the two P1 defects identified in the prior read-only benchmark.
**Constraint compliance:** No git-history rewrite, no automatic credential rotation, no credentials exposed, no fabricated data. All test results are actual observed output.

---

## 1. D1 Root Cause

**Defect:** `POST /api/business/analyze` returned **HTTP 500** `"Failed to generate brand strategy: Request failed with status code 500"` and **discarded a successful business extraction**.

**Mechanism (pre-fix `apps/api/src/routes/business.js`):**
```js
const { default: BrandStrategyService } = await import('../services/BrandStrategyService.js');
const businessDNA = await BrandStrategyService.generateBrandDNA(business);  // ← threw, no catch
res.json({ success: true, business, businessDNA, metadata: {...} });         // ← never reached
```
- Extraction (`BusinessResearchService.extractBusinessIntelligenceWithProviders`) had already succeeded and produced a valid `business` object.
- The **optional additive** brand-DNA step (`BrandStrategyService.generateBrandDNA`) called the OmniRoute reasoning model (`auto/best-coding`) via `AIService.generate`.
- When that upstream call failed — observed as an OmniRoute HTTP 500 with `providerError.category: 'PROVIDER_UNAVAILABLE'`, `retryCount: 2`, and `x-omniroute-combo-terminal-reason: '[500]: fetch failed'` — `AIService.generate` threw an axios `"Request failed with status code 500"` after exhausting retries.
- `BrandStrategyService.generateBrandDNA` wrapped it as `Error('Failed to generate brand strategy: ' + error.message)`, which propagated to the route, then to `errorHandler.js`, producing an HTTP 500.
- **Asymmetry:** AI enrichment *inside* extraction (`_enrichMissingWithAI`) is best-effort (soft-fail, never fails the pipeline), but brand-DNA *outside* it was a hard-fail — so a transient/optional upstream failure threw away a perfectly good extraction.

**Trigger:** This was an **upstream / transient** OmniRoute gateway combo failure (`x-omniroute-recovery-action: 'retry'` on a `felo/felo-search … provider — [500]: fetch failed`), not a SiteForge request-construction defect. The app-side fix (degradation boundary) is the correct smallest change.

---

## 2. D1 Fix

**File changed:** `apps/api/src/routes/business.js` (route `/analyze`), committed as `413043c`.

Brand-DNA generation is now treated as **optional additive enrichment** with an explicit degradation boundary. The successful extraction is never discarded; a brand-DNA failure is surfaced through explicit status fields instead of an HTTP 500.

```js
const { default: BrandStrategyService } = await import('../services/BrandStrategyService.js');
let businessDNA = null;
let brandStrategyStatus = 'not_attempted';
try {
  businessDNA = await BrandStrategyService.generateBrandDNA(business);
  brandStrategyStatus = 'ok';
} catch (brandError) {
  const safeMsg = brandError?.safeMessage || brandError?.message || 'unknown';
  console.error('[business/analyze] Brand DNA generation failed (non-fatal, extraction preserved):', safeMsg);
  brandStrategyStatus = 'failed';
  businessDNA = null;
}
res.json({
  success: true,
  business,
  businessDNA,
  brandStrategy: { status: brandStrategyStatus },
  metadata: { ..., brandDNAStatus: brandStrategyStatus, ... },
});
```

**Important:** Genuine extraction errors are **not** swallowed. `extractBusinessIntelligenceWithProviders` failures still throw before this block and follow the normal `errorHandler` path, including the existing `nothingUsable` → HTTP 503 branch (unchanged).

---

## 3. D1 Before / After

| Aspect | Before (pre-fix) | After (fix) |
|---|---|---|
| `/analyze` when brand-DNA AI fails | **HTTP 500** `"Failed to generate brand strategy: Request failed with status code 500"`; `business` **discarded** (`hasBusiness:false`) | **HTTP 200**; `business` **preserved**; `businessDNA:null` |
| Business extraction | Lost | Retained (name/contact/location intact) |
| Failure visibility to client | Opaque 500 + generic message | Explicit `brandStrategy.status:"failed"`, `metadata.brandDNAStatus:"failed"` |
| Optional enrichment failure | Fatal (whole request) | Non-fatal degradation boundary |
| Real extraction failure | 503 via `nothingUsable` (unchanged) | 503 via `nothingUsable` (unchanged) |
| AI-success path | 200 + businessDNA | 200 + businessDNA (unchanged) |

---

## 4. D1 Tests (actual results)

**4a. AI-succeeds case** — live fixed server `:5001`, `POST /api/business/analyze` (Tartine Bakery):
```
HTTP 200  latMs 95676
success: true
business.name: Tartine Bakery
business.contact: {"phone":"+1-415-487-2600","email":null,"website":"https://tartinebakery.com/san-francisco/bakery"}
businessDNA present: true
brandStrategy.status: ok
metadata.brandDNAStatus: ok
metadata.providers: {"geoapify":"ok","webExtraction":"ok","aiEnrichment":true}
validationIssues: []
error field: null
```

**4b. AI-fails case (deterministic)** — temp fixed server `:5099` with `OMNIROUTE_BASE_URL=http://127.0.0.1:9/v1` (unreachable → every AI call fails, reproducing the pre-fix 500 trigger). `POST /api/business/analyze` (Tartine):
```
HTTP 200  latMs 3444          ← pre-fix this was HTTP 500
success: true
business.name: Tartine Bakery
business.contact: {"phone":"+1-415-487-2600","email":null,"website":"https://tartinebakery.com/san-francisco/bakery"}
business.location.address present: true
businessDNA present: false
businessDNA value: null
brandStrategy.status (should be failed): failed
metadata.brandDNAStatus: failed
metadata.providers: {"geoapify":"ok","webExtraction":"ok","aiEnrichment":true}
error field: null
```
Temp server log (confirms the brand-DNA failure was genuinely exercised, while extraction proceeded):
```
[BusinessDataExtractor] AI extraction failed: connect ECONNREFUSED 127.0.0.1:9
[BusinessResearchService] AI enrichment failed (best-effort): connect ECONNREFUSED 127.0.0.1:9
Brand strategy generation error: AxiosError: connect ECONNREFUSED 127.0.0.1:9
```
**=> D1 fix verified for both the AI-succeed and AI-fail branches.**

---

## 5. D2 Security Fix

**Defect:** A real OmniRoute API key (`sk-cd7ef…`, 35 chars, `sk-` prefix) was committed in **tracked** `apps/api/.env.example` (introduced in git commit `76c2f9c`). The key was treated as **compromised**.

**Where the secret was found & removed:**
- **File:** `apps/api/.env.example`, `OMNIROUTE_API_KEY=` line.
- **Action:** The real key was replaced with an empty placeholder plus a security comment; the placeholder can no longer be mistaken for a real credential.
- **Removed commit:** `413043c` (this task's fix commit).

**Remaining exposure (honest assessment):**
- **Tracked working tree contains the key: NO.** `git grep` for the key prefix across all tracked files → **0 matches**. No tracked `.env*` file contains a non-empty `OMNIROUTE_API_KEY` or `GEOAPIFY_API_KEY` (both are empty placeholders). `apps/api/.env` (which holds the live key and Geoapify key) is gitignored.
- **Git history still contains the key: YES.** It is present in historical commit `76c2f9c` (and was removed again only in `413043c`). Per task constraints, **history was NOT rewritten** and **credentials were NOT rotated automatically** — both remain **required**.
- **Runtime log exposure (D2-adjacent, pre-existing):** On the brand-DNA failure path, `BrandStrategyService.generateBrandDNA` logs the **full axios error object** (`console.error('Brand strategy generation error:', error)`), which includes `config.headers.Authorization: 'Bearer <key>'`, leaking the key into server logs at runtime. This is pre-existing behavior and was left unchanged (out of scope), but warrants a follow-up fix to use the existing redaction helpers. *(The actual key is NOT reproduced in this report.)*

**Rotation requirement:** Because the key exists in git history, **credential rotation is REQUIRED** (treat the key as compromised). Rotation and history scrubbing are **not** performed here per explicit task constraints.

---

## 6. Regression Tests (actual results)

**Unit suite** — `apps/api`: `npm test` (`node test_providers.js`):
```
RESULTS: 22 passed, 0 failed, 0 skipped
```
Includes test `[11] Route wiring` → "business route ESM specifier resolves & app imports clean" (passes).

**Live regression** on the fixed server `:5001` across business types (`POST /api/business/analyze`), all **HTTP 200**, full profiles, no errors, no validation issues:

| id | type | status | name | phone | website | hasDNA | dnaStatus | providers |
|---|---|---|---|---|---|---|---|---|
| bluebottle | cafe | 200 | Blue Bottle Coffee | – | y | true | ok | geoapify ok, web ok, ai true |
| applesf | retail | 200 | Apple Union Square | – | y | true | ok | geoapify ok, web ok, ai true |
| dental | service | 200 | Union Square Dental Group | y | y | true | ok | geoapify ok, web ok, ai false |

**`/research` endpoint** (alias, no brand-DNA) — fixed server `:5001`, Zuni Café: **HTTP 200**, `success:true`, providers `{"geoapify":"ok","webExtraction":"ok","aiEnrichment":true}`. **No regression.**

---

## 7. Files Modified

| File | Change | Status |
|---|---|---|
| `apps/api/src/routes/business.js` | D1: `/analyze` now catches brand-DNA failure, preserves extraction, returns 200 + explicit status | Committed (`413043c`) |
| `apps/api/.env.example` | D2: removed real OMNIROUTE key; empty placeholder + security comment | Committed (`413043c`) |

Working tree is clean after the commit.

---

## 8. FINAL VERDICT

**D1 FIXED — D2 REQUIRES CREDENTIAL ROTATION**

- **D1 is FIXED and verified:** the `/analyze` endpoint no longer returns HTTP 500 or discards a successful extraction when the optional brand-DNA AI step fails; it returns HTTP 200 with the business preserved and an explicit failure status. Verified under both AI-succeed and AI-fail conditions, with 22/22 unit tests and live multi-business regression passing.
- **D2 requires rotation:** the real OmniRoute key has been removed from all tracked files (0 matches in the working tree), but it remains present in **git history** (commit `76c2f9c`). Consequently the key must be treated as compromised: **rotate the OmniRoute key and scrub git history** (neither performed, per task constraints). Also recommended (out of scope, D2-adjacent): stop logging the raw axios error (which contains the Authorization header) on the brand-DNA failure path.
