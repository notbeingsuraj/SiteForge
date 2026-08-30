/**
 * GeoapifyProvider
 *
 * Concrete BusinessDataProvider backed by the Geoapify Places API.
 * Handles:
 *  - searching for businesses (text + coordinates)
 *  - retrieving useful place information
 *  - mapping Geoapify responses into SiteForge's canonical profile (via ProviderAdapter)
 *  - API errors, empty results, rate limits, timeouts, malformed responses
 *  - normalization and safe logging (never exposes the API key)
 *
 * The Geoapify-specific response structure is fully contained in this
 * provider + ProviderAdapter. Nothing Geoapify-specific leaks to
 * BusinessResearchService or the routes.
 *
 * Uses the backend-only GEOAPIFY_API_KEY from config/env.js. Never exposed to
 * the frontend. Any non-2xx / credential failure makes the provider report
 * unavailable so the calling pipeline can fall back safely.
 */

import axios from 'axios';
import { config } from '../config/env.js';
import BusinessDataProvider from './BusinessDataProvider.js';
import { mapGeoapifyFeatureToProfile } from './ProviderAdapter.js';

// Provider-status sentinels so callers can reason about WHY no result returned
export const GEOAPIFY_STATUS = Object.freeze({
  OK: 'ok',
  NOT_CONFIGURED: 'not_configured', // no API key
  AUTH_FAILED: 'auth_failed', // 401/403
  RATE_LIMITED: 'rate_limited', // 429
  TIMEOUT: 'timeout',
  NETWORK_ERROR: 'network_error',
  NO_RESULT: 'no_result',
  INVALID_RESPONSE: 'invalid_response',
});

class GeoapifyProvider extends BusinessDataProvider {
  constructor() {
    super();
    this._client = null;
  }

  get name() {
    return 'geoapify';
  }

  /**
   * True only when a backend API key is configured.
   */
  isAvailable() {
    return Boolean(config.geoapify?.apiKey);
  }

  /**
   * Lazily-initialized axios client (never stores the key in a way that leaks).
   */
  _getClient() {
    if (this._client) return this._client;
    this._client = axios.create({
      baseURL: config.geoapify.baseUrl,
      timeout: config.geoapify.timeout,
      paramsSerializer: {
        indexes: false,
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return this._client;
  }

  /**
   * Search for businesses using deterministic hints.
   *
   * @param {Object} hints - { name, city, state, country, latitude, longitude, query }
   * @param {Object} options
   * @returns {Promise<{ status, records, error? }>}
   */
  async search(hints = {}, options = {}) {
    // Guard: no credential configured → report gracefully
    if (!this.isAvailable()) {
      return { status: GEOAPIFY_STATUS.NOT_CONFIGURED, records: [] };
    }

    const text = (hints && (hints.query || hints.name)) || null;
    const lat = hints?.latitude;
    const lng = hints?.longitude;

    const params = {
      apiKey: config.geoapify.apiKey,
      limit: options.limit || config.geoapify.maxResults || 5,
    };

    // Preferred: text search; bias with coordinates when available
    if (text) params.text = text;
    if (lat != null && lng != null) params.bias = `proximity:${lng},${lat}`;

    // Must have at least a text query OR coordinates to search
    if (!params.text && (lat == null || lng == null)) {
      return { status: GEOAPIFY_STATUS.NO_RESULT, records: [] };
    }

    try {
      const client = this._getClient();
      const response = await client.get('', { params });

      const features = response.data?.features;
      if (!Array.isArray(features) || features.length === 0) {
        return { status: GEOAPIFY_STATUS.NO_RESULT, records: [] };
      }

      const records = features
        .map((feature) => {
          try {
            return mapGeoapifyFeatureToProfile(feature);
          } catch {
            return null;
          }
        })
        .filter((r) => r !== null);

      if (records.length === 0) {
        return { status: GEOAPIFY_STATUS.INVALID_RESPONSE, records: [] };
      }

      return { status: GEOAPIFY_STATUS.OK, records };
    } catch (error) {
      const status = this._classifyError(error);
      this._logSafe(status, error);
      return { status, records: [] };
    }
  }

  /**
   * Return the best-matching normalized business record for the hints.
   * @returns {Promise<Object|null>}
   */
  async getBusiness(hints, options = {}) {
    const { status, records } = await this.search(hints, options);
    if (status !== GEOAPIFY_STATUS.OK || records.length === 0) {
      return null;
    }

    // If coordinates were supplied, prefer the record closest to them;
    // otherwise take the top-ranked record from the API.
    const lat = hints?.latitude;
    const lng = hints?.longitude;
    if (lat != null && lng != null) {
      let best = records[0];
      let bestDist = Infinity;
      for (const rec of records) {
        const c = rec.location?.coordinates;
        if (!c) continue;
        const d = Math.hypot(c.lat - lat, c.lng - lng);
        if (d < bestDist) {
          bestDist = d;
          best = rec;
        }
      }
      return best;
    }
    return records[0];
  }

  /**
   * Classify an axios/network error into a GEOAPIFY_STATUS (never leaks details).
   */
  _classifyError(error) {
    if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
      return GEOAPIFY_STATUS.TIMEOUT;
    }
    const status = error?.response?.status;
    if (status === 401 || status === 403) return GEOAPIFY_STATUS.AUTH_FAILED;
    if (status === 429) return GEOAPIFY_STATUS.RATE_LIMITED;
    if (status === 400 && /no.*result|not found/i.test(error?.response?.data || '')) {
      return GEOAPIFY_STATUS.NO_RESULT;
    }
    if (error?.response || error?.request || error?.code) {
      return GEOAPIFY_STATUS.NETWORK_ERROR;
    }
    return GEOAPIFY_STATUS.NETWORK_ERROR;
  }

  /**
   * Log a safe, secret-free failure message.
   */
  _logSafe(status, error) {
    const map = {
      [GEOAPIFY_STATUS.AUTH_FAILED]: 'Geoapify provider unavailable (authentication failed); using fallback extraction.',
      [GEOAPIFY_STATUS.RATE_LIMITED]: 'Geoapify provider rate-limited; using fallback extraction.',
      [GEOAPIFY_STATUS.TIMEOUT]: 'Geoapify provider timed out; using fallback extraction.',
      [GEOAPIFY_STATUS.NETWORK_ERROR]: 'Geoapify provider temporarily unavailable; using fallback extraction.',
      [GEOAPIFY_STATUS.INVALID_RESPONSE]: 'Geoapify provider returned an invalid response; using fallback extraction.',
    };
    const message = map[status] || 'Geoapify provider error; using fallback extraction.';
    // Log only the safe message — never the API key or raw stack/infra details.
    console.error(`[GeoapifyProvider] ${message} (${error?.response?.status || error?.code || 'unknown'})`);
  }
}

export default new GeoapifyProvider();
