/**
 * AcquisitionResult — Phase 20
 *
 * Explicit internal result contract for business-data acquisition.
 *
 * Every acquisition attempt reports WHAT happened — provider, source URL,
 * status, extracted fields, completeness, confidence, errors, warnings,
 * timing, and whether data is structured or inferred — so the pipeline can
 * honestly distinguish:
 *
 *   - provider unavailable      (the source never responded)
 *   - extraction failed         (the source responded but we could not parse it)
 *   - empty result              (no usable business evidence was extracted)
 *   - invalid/unsupported URL   (the input is not a valid business URL)
 *   - insufficient evidence     (some data, but not enough to identify a business)
 *   - persistence failure       (identity layer failed)
 *   - AI enrichment failure     (optional enhancement failed)
 *   - internal failure          (unexpected)
 *
 * The system must be able to say "I found nothing" instead of converting that
 * into "I found a business called Unknown Business."
 */

export const ACQUISITION_STATUS = Object.freeze({
  SUCCESS: 'success',                 // usable business evidence acquired
  PARTIAL: 'partial',                 // some evidence, insufficient for identity
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence', // too little to identify
  EMPTY_RESULT: 'empty_result',       // nothing usable extracted
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  EXTRACTION_FAILED: 'extraction_failed',
  INVALID_URL: 'invalid_url',
  UNSUPPORTED_URL: 'unsupported_url',
  AI_ENRICHMENT_FAILED: 'ai_enrichment_failed',
  PERSISTENCE_FAILURE: 'persistence_failure',
  INTERNAL_FAILURE: 'internal_failure',
});

// Fields that count toward "meaningful business evidence" (identity-critical).
// A result must have at least one of these to be considered a real observation.
const IDENTITY_EVIDENCE_FIELDS = [
  'identity.name',
  'contact.phone',
  'contact.website',
  'location.full_address',
  'location.coordinates',
];

/**
 * Create a normalized AcquisitionResult.
 *
 * @param {Object}  init
 * @param {string}  init.provider           - provider/source label (e.g. 'web_extraction')
 * @param {string}  init.sourceUrl          - URL that was acquired
 * @param {string}  init.status             - one of ACQUISITION_STATUS
 * @param {Object}  [init.fields]           - flat/dot-path extracted field values
 * @param {number}  [init.completeness]     - 0..1
 * @param {number}  [init.confidence]       - 0..1
 * @param {string}  [init.dataKind]         - 'structured' | 'inferred' | 'identified' | 'mixed'
 * @param {Array}   [init.errors]           - structured error records
 * @param {Array}   [init.warnings]         - non-fatal warnings
 * @param {number}  [init.latencyMs]        - acquisition duration
 * @param {Object}  [init.metadata]         - provider-specific metadata
 * @param {string}  [init.errorCode]        - machine-readable error code
 * @param {string}  [init.message]          - human-readable result message
 * @returns {Object} an AcquisitionResult
 */
export function createAcquisitionResult({
  provider,
  sourceUrl,
  status,
  fields = {},
  completeness = 0,
  confidence = 0,
  dataKind = 'structured',
  errors = [],
  warnings = [],
  latencyMs = null,
  metadata = {},
  errorCode = null,
  message = null,
} = {}) {
  const result = {
    provider,
    sourceUrl: sourceUrl || null,
    status,
    fields: { ...fields },
    completeness: clamp01(completeness),
    confidence: clamp01(confidence),
    dataKind,
    errors: Array.isArray(errors) ? errors : [errors],
    warnings: Array.isArray(warnings) ? warnings : [warnings],
    latencyMs: latencyMs != null ? Math.round(latencyMs) : null,
    metadata: { ...metadata },
    errorCode,
    message,
  };
  return Object.freeze(result);
}

/**
 * Build an empty-result AcquisitionResult and decide whether the outcome is a
 * plain empty result or a provider failure, based on what the provider did.
 *
 * @param {Object} opts
 * @param {string} opts.provider
 * @param {string} opts.sourceUrl
 * @param {Object} opts.record            - the raw extracted record (may be empty)
 * @param {Object} [opts.providerError]   - structured provider error, if any
 * @param {string} [opts.httpStatus]      - HTTP status from the fetch
 * @param {number} [opts.latencyMs]
 * @returns {Object} AcquisitionResult
 */
export function classifyEmptyAcquisition({
  provider,
  sourceUrl,
  record = {},
  providerError = null,
  httpStatus = null,
  latencyMs = null,
} = {}) {
  const errors = [];
  const warnings = [];

  // If the provider explicitly reported a failure, that's not an empty result.
  if (providerError) {
    const code = providerError.category || 'PROVIDER_UNAVAILABLE';
    return createAcquisitionResult({
      provider,
      sourceUrl,
      status: ACQUISITION_STATUS.PROVIDER_UNAVAILABLE,
      fields: {},
      completeness: 0,
      confidence: 0,
      dataKind: 'structured',
      errors: [providerError],
      errorCode: normalizeErrorCode(code),
      message: providerError.safeMessage || 'Provider returned an error.',
      latencyMs,
    });
  }

  // HTTP-level failure (non-2xx) is an extraction/provider failure, not empty.
  if (httpStatus != null && (httpStatus < 200 || httpStatus >= 400)) {
    return createAcquisitionResult({
      provider,
      sourceUrl,
      status: ACQUISITION_STATUS.EXTRACTION_FAILED,
      fields: {},
      completeness: 0,
      confidence: 0,
      dataKind: 'structured',
      errors: [{ category: 'HTTP_ERROR', httpStatus, safeMessage: `HTTP ${httpStatus}` }],
      errorCode: 'extraction_failed',
      message: `Source returned HTTP ${httpStatus}.`,
      latencyMs,
    });
  }

  const hint = detectNoiseContent(record);
  if (hint) {
    warnings.push({ code: 'NO_BUSINESS_CONTENT', message: hint });
  }

  // Otherwise: the provider responded but produced no usable evidence.
  return createAcquisitionResult({
    provider,
    sourceUrl,
    status: ACQUISITION_STATUS.EMPTY_RESULT,
    fields: {},
    completeness: 0,
    confidence: 0,
    dataKind: 'structured',
    errors: warnings.length ? [] : [{ category: 'EMPTY_RESULT', safeMessage: 'No business evidence extracted.' }],
    warnings,
    errorCode: 'empty_result',
    message: warnings[0]?.message || 'No business evidence extracted from the source.',
    latencyMs,
  });
}

/**
 * Detect pages that contain no business content but might look "successful"
 * (Google Maps server errors, consent walls, map-tile noise, etc.).
 *
 * @param {Object} record - extracted profile record (flat dot-path or nested)
 * @returns {string|null} a human-readable hint, or null if not noise
 */
export function detectNoiseContent(record = {}) {
  const text =
    typeof record?.metadata?.visibleText === 'string'
      ? record.metadata.visibleText
      : record?.visibleText ||
        (typeof record?.metadata?.rawText === 'string' ? record.metadata.rawText : '');

  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('server error') && lower.includes('try again later')) {
    return 'Source returned a server-error page (no business content).';
  }
  if (lower.includes('enable javascript') && lower.includes('browser') && lower.includes('google')) {
    return 'Source requires JavaScript rendering; no business content was available.';
  }
  return null;
}

/**
 * Decide whether an extracted fields map contains any identity-critical evidence.
 *
 * @param {Object} fields - dot-path value map
 * @returns {boolean}
 */
export function hasIdentityEvidence(fields) {
  return IDENTITY_EVIDENCE_FIELDS.some((f) => {
    const v = fields[f];
    if (v == null || v === '') return false;
    if (typeof v === 'object') {
      return Object.keys(v).length > 0;
    }
    return true;
  });
}

/**
 * Summarize the field evidence (keys with non-empty values).
 * @param {Object} fields
 * @returns {string[]}
 */
export function summarizeFields(fields) {
  return Object.entries(fields || {})
    .filter(([, v]) => v != null && v !== '' && !(typeof v === 'object' && Object.keys(v).length === 0))
    .map(([k]) => k);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

export function clamp01(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const ERROR_CODE_MAP = {
  AUTHENTICATION: 'provider_unavailable',
  QUOTA_EXHAUSTED: 'provider_unavailable',
  RATE_LIMITED: 'provider_unavailable',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  TIMEOUT: 'provider_unavailable',
  INVALID_RESPONSE: 'extraction_failed',
  HTTP_ERROR: 'extraction_failed',
  EMPTY_RESULT: 'empty_result',
};

export function normalizeErrorCode(category) {
  return ERROR_CODE_MAP[category] || 'internal_failure';
}

export default {
  ACQUISITION_STATUS,
  createAcquisitionResult,
  classifyEmptyAcquisition,
  hasIdentityEvidence,
  summarizeFields,
};