import axios from 'axios';
import { config } from '../config/env.js';
import { createHash } from 'crypto';

/**
 * Business Data Extractor
 * 
 * Retrieves business information from publicly accessible Google Maps URLs
 * without requiring a Google Maps API key.
 */

// In-memory cache (in production, use Redis or database)
const extractionCache = new Map();

class BusinessDataExtractor {
  constructor() {
    this.client = axios.create({
      timeout: config.extraction.timeout,
      headers: {
        'User-Agent': config.extraction.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });
  }

  /**
   * Normalize Google Maps URL for consistent caching
   */
  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      const allowedParams = ['place_id', 'query', 'cid', 'hl'];
      const cleaned = new URL(parsed.origin + parsed.pathname);
      allowedParams.forEach(param => {
        if (parsed.searchParams.has(param)) {
          cleaned.searchParams.set(param, parsed.searchParams.get(param));
        }
      });
      return cleaned.toString();
    } catch {
      return url;
    }
  }

  /**
   * Generate cache key from normalized URL
   */
  getCacheKey(url) {
    const normalized = this.normalizeUrl(url);
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Check cache for existing extraction
   */
  getCachedExtraction(url) {
    const key = this.getCacheKey(url);
    const cached = extractionCache.get(key);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < 24 * 60 * 60 * 1000) {
        return cached.data;
      }
      extractionCache.delete(key);
    }
    return null;
  }

  /**
   * Store extraction in cache
   */
  setCachedExtraction(url, data) {
    const key = this.getCacheKey(url);
    extractionCache.set(key, {
      data,
      timestamp: Date.now(),
      normalizedUrl: this.normalizeUrl(url),
    });
  }

  /**
   * Validate if URL is a Google Maps URL
   */
  validateGoogleMapsUrl(url) {
    try {
      const parsed = new URL(url);
      const validHostnames = [
        'maps.google.com',
        'www.google.com',
        'google.com',
        'goo.gl',
        'maps.app.goo.gl',
        'maps.googleapis.com',
      ];
      return validHostnames.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
    } catch {
      return false;
    }
  }

  /**
   * Extract place ID from Google Maps URL
   */
  extractPlaceId(url) {
    try {
      const parsed = new URL(url);
      let placeId = parsed.searchParams.get('place_id') || parsed.searchParams.get('query_place_id');
      
      if (!placeId) {
        const pathMatch = url.match(/!1s(ChIJ[^!&]+)/);
        placeId = pathMatch?.[1] || null;
      }
      
      if (!placeId) {
        const cid = parsed.searchParams.get('cid');
        if (cid) placeId = `cid:${cid}`;
      }
      
      if (!placeId) {
        const query = parsed.searchParams.get('query');
        if (query) placeId = `query:${query}`;
      }

      return placeId;
    } catch {
      return null;
    }
  }

  /**
   * Extract place name from URL path
   */
  extractPlaceName(url) {
    try {
      const parsed = new URL(url);
      const placeMatch = parsed.pathname.match(/\/(?:place|search)\/([^/]+)/i);
      return placeMatch ? decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ') : null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch page content with retries
   */
  async fetchPage(url, retryCount = 0) {
    try {
      const response = await this.client.get(url);
      return {
        url: response.request?.res?.responseUrl || response.config.url || url,
        html: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      if (error.response) {
        return {
          url: error.config?.url || url,
          html: error.response.data || '',
          status: error.response.status,
          headers: error.response.headers,
          error: error.message,
        };
      }
      
      if (retryCount < config.extraction.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.fetchPage(url, retryCount + 1);
      }
      
      throw new Error(`Failed to fetch page: ${error.message}`);
    }
  }