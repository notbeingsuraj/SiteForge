/**
 * BusinessDataExtractor - New Architecture
 * 
 * Extracts business information from Google Maps URLs using ONLY:
 * 1. GoogleMapsUrlParserProvider - parses URL for identifiers (NO network calls)
 * 2. OfficialWebsiteProvider - fetches and extracts from official website
 * 3. UserProvidedDataProvider - accepts explicit user data
 * 
 * NO Google Places API, NO Google Maps API, NO Google billing required.
 * 
 * Pipeline:
 * Input (Google Maps URL)
 *   ↓
 * GoogleMapsUrlParserProvider.parse() → Identified hints
 *   ↓
 * DiscoveryProvider.discover() → Candidate official website URLs (pluggable)
 *   ↓
 * OfficialWebsiteProvider.extract() → Discovered/Verified data from official website
 *   ↓
 * BusinessProfile.merge() → Normalized profile with provenance
 */

import axios from 'axios';
import { createHash } from 'crypto';
import GoogleMapsUrlParserProvider from './GoogleMapsUrlParserProvider.js';
import OfficialWebsiteProvider from './OfficialWebsiteProvider.js';
import UserProvidedDataProvider from './UserProvidedDataProvider.js';
import BusinessProfile from './BusinessProfile.js';
import { config } from '../config/env.js';

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

    // Separate client for r.jina.ai proxy (no redirects, simpler)
    this.proxyClient = axios.create({
      timeout: config.extraction.timeout,
      headers: {
        'User-Agent': config.extraction.userAgent,
        'Accept': 'text/plain, text/markdown, */*',
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500,
    });

    // Initialize providers
    this.websiteProvider = new OfficialWebsiteProvider();
    this.parser = GoogleMapsUrlParserProvider;
  }

  /**
   * Normalize Google Maps URL for consistent caching
   */
  normalizeUrl(url) {
    return this.parser.normalizeUrl(url);
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
    return this.parser.validateGoogleMapsUrl(url);
  }

  /**
   * Extract place ID from Google Maps URL
   */
  extractPlaceId(url) {
    return this.parser.extractPlaceId(url);
  }

  /**
   * Extract place name from URL path
   */
  extractPlaceName(url) {
    return this.parser.extractPlaceName(url);
  }
}