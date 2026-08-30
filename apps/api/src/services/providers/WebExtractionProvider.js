/**
 * WebExtractionProvider
 *
 * Concrete BusinessDataProvider that wraps the existing
 * BusinessDataExtractor web-scraping + AI-extraction pipeline as a
 * drop-in fallback inside the provider abstraction.
 *
 * This is LEVEL 3 in the data priority (after deterministic hints and a
 * structured provider like Geoapify). It preserves all existing SiteForge
 * extraction/fallback behavior and returns data in the same canonical flat
 * profile shape the rest of the pipeline consumes.
 */

import BusinessDataProvider from './BusinessDataProvider.js';

class WebExtractionProvider extends BusinessDataProvider {
  constructor() {
    super();
    this._extractorPromise = null;
  }

  get name() {
    return 'web_extraction';
  }

  isAvailable() {
    return true; // web extraction has no external key requirement
  }

  /**
   * Lazily resolve BusinessDataExtractor to avoid circular imports.
   */
  async _getExtractor() {
    if (!this._extractorPromise) {
      // Dynamic import breaks the static import cycle
      this._extractorPromise = import('../BusinessDataExtractor.js').then((m) => m.default || m);
    }
    return this._extractorPromise;
  }

  /**
   * Run the existing web-extraction pipeline for a Google Maps URL.
   * Returns the canonical flat profile shape (BusinessDataExtractor returns
   * the flattened profile via profile.toObject() with metadata).
   *
   * @param {Object} hints - { googleMapsUrl } or forwarded extraction input
   * @param {Object} options
   * @returns {Promise<{ status, records, error? }>}
   */
  async search(hints = {}) {
    // Web extraction is per-URL; supports Google Maps URLs primarily.
    // If no URL is provided, there's nothing authoritative to scrape.
    const url = hints?.googleMapsUrl || hints?.sourceUrl || null;
    if (!url) {
      return { status: 'not_applicable', records: [] };
    }

    try {
      const extractor = await this._getExtractor();
      const result = await extractor.extractFromGoogleMapsUrl(url);

      if (!result || typeof result !== 'object') {
        return { status: 'no_result', records: [] };
      }

      // BusinessDataExtractor returns the flattened canonical profile
      // (toObject shape) with a metadata block — wrap in a single record.
      const record = { ...result };
      // Normalize coord fields into location.coordinates if present as lat/lng
      if (record.location && record.location.latitude != null && record.location.longitude != null && !record.location.coordinates) {
        record.location.coordinates = {
          lat: record.location.latitude,
          lng: record.location.longitude,
        };
      }
      if (record.location && record.location.coordinates && record.location.latitude == null) {
        record.location.latitude = record.location.coordinates.lat;
        record.location.longitude = record.location.coordinates.lng;
      }
      record.source = 'web_extraction';
      return { status: 'ok', records: [record] };
    } catch (error) {
      console.error('[WebExtractionProvider] Web extraction failed:', error.message);
      return { status: 'error', records: [] };
    }
  }

  /**
   * Best-matching record (web extraction returns a single resolved profile).
   */
  async getBusiness(hints, options = {}) {
    const { status, records } = await this.search(hints, options);
    if (status === 'ok' && records.length > 0) return records[0];
    return null;
  }
}

export default new WebExtractionProvider();
