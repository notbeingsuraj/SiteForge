/**
 * BusinessDataProvider
 *
 * Abstract interface for source-agnostic structured business-data providers.
 *
 * BusinessResearchService consumes NORMALIZED business data through this
 * abstraction rather than depending on any single provider's raw response
 * shape. Concrete providers must map their provider-specific responses into
 * SiteForge's canonical business-data format (see ProviderAdapter).
 *
 * Providers must:
 * - Return normalized business data (SiteForge canonical flat profile shape)
 * - Preserve field-level provenance + confidence
 * - Never reveal credentials / secrets in errors or logs
 * - Fail gracefully (return { available:false } / null) rather than crash
 * - Not assume provider IDs are interchangeable (provider-specific IDs stay provider-specific)
 *
 * Concrete implementations:
 * - GeoapifyProvider
 * - WebExtractionProvider (wraps existing BusinessDataExtractor as fallback)
 */

export class BusinessDataProvider {
  /**
   * Human-readable provider name.
   * @returns {string}
   */
  get name() {
    throw new Error('BusinessDataProvider.name must be implemented by a concrete provider');
  }

  /**
   * Whether this provider is configured/available to use.
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }

  /**
   * Search for a business using deterministic hints (name, city, coords).
   * @param {Object} hints - { name, city, state, country, latitude, longitude, query }
   * @param {Object} options
   * @returns {Promise<Array>} list of normalized business records (canonical shape)
   */
  async search(hints, options = {}) {
    throw new Error('BusinessDataProvider.search() must be implemented by a concrete provider');
  }

  /**
   * Retrieve the single best-matching business for given hints.
   * @param {Object} hints
   * @param {Object} options
   * @returns {Promise<Object|null>} normalized business record or null
   */
  async getBusiness(hints, options = {}) {
    const results = await this.search(hints, options);
    if (!Array.isArray(results) || results.length === 0) return null;
    return results[0];
  }
}

export default BusinessDataProvider;
