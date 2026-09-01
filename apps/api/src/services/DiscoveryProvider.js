/**
 * DiscoveryProvider
 * 
 * Abstract interface for source-agnostic business website discovery.
 * 
 * The purpose of this abstraction is to allow different discovery
 * mechanisms to be plugged in without coupling Webloom to any
 * single search provider (e.g., Bing, DuckDuckGo, Brave, etc.).
 * 
 * IMPORTANT: This is intentionally NOT Google-specific. Webloom
 * has ZERO dependency on Google for business-data discovery.
 * Google Maps URLs are only used as input identifiers.
 * 
 * Implementations must:
 * - Return candidate official website URLs with confidence scores
 * - Preserve provenance for each candidate
 * - Never fabricate results
 * - Never make Google API calls
 */

export class DiscoveryProvider {
  /**
   * Abstract method - must be implemented by concrete providers
   * 
   * @param {Object} businessIdentity - Identified business hints
   * @param {Object} options - Provider-specific options
   * @returns {Promise<Array<{url: string, source: string, confidence: number}>>}
   */
  async discover(businessIdentity, options = {}) {
    throw new Error('DiscoveryProvider.discover() must be implemented by a concrete provider');
  }

  /**
   * Get the name of this provider
   * @returns {string}
   */
  get name() {
    throw new Error('DiscoveryProvider.name must be implemented by a concrete provider');
  }
}

export default DiscoveryProvider;