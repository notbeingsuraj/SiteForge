import axios from 'axios';
import { config } from '../config/env.js';
import { createHash } from 'crypto';
import AIService from './AIService.js';

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
/**
   * Extract JSON-LD structured data from HTML
   */
  extractJsonLd(html) {
    const results = [];
    const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        results.push(json);
      } catch {
        // Ignore invalid JSON-LD
      }
    }
    
    return results;
  }

  /**
   * Extract microdata from HTML
   */
  extractMicrodata(html) {
    const results = {};
    const itemPropRegex = /itemprop=["']([^"']+)["'][^>]*>([^<]*)</gi;
    
    let match;
    while ((match = itemPropRegex.exec(html)) !== null) {
      const prop = match[1];
      const value = match[2].trim();
      if (value && !results[prop]) {
        results[prop] = value;
      }
    }
    
    return results;
  }

  /**
   * Extract Open Graph metadata
   */
  extractOpenGraph(html) {
    const results = {};
    const regex = /<meta[^>]*property=["']og:([^"']+)["'][^>]*content=["']([^"']*)["']/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      results[match[1]] = match[2];
    }
    
    return results;
  }

  /**
   * Extract visible text content from HTML (simplified)
   */
  extractVisibleText(html) {
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text.substring(0, 15000);
  }

  /**
   * Extract structured metadata from page
   */
  extractMetadata(html) {
    return {
      jsonLd: this.extractJsonLd(html),
      microdata: this.extractMicrodata(html),
      openGraph: this.extractOpenGraph(html),
      visibleText: this.extractVisibleText(html),
    };
  }

  /**
   * Build AI extraction prompt
   */
  buildExtractionPrompt(metadata, sourceUrl) {
    const jsonLd = metadata.jsonLd.length > 0 ? JSON.stringify(metadata.jsonLd, null, 2) : 'None found';
    const microdata = Object.keys(metadata.microdata).length > 0 ? JSON.stringify(metadata.microdata, null, 2) : 'None found';
    const openGraph = Object.keys(metadata.openGraph).length > 0 ? JSON.stringify(metadata.openGraph, null, 2) : 'None found';
    const visibleText = metadata.visibleText || 'None extracted';

    return `You are a business information extractor. Analyze the following data retrieved from a Google Maps page and extract structured business information.

SOURCE URL: ${sourceUrl}

STRUCTURED METADATA (JSON-LD):
${jsonLd}

STRUCTURED METADATA (Microdata):
${microdata}

STRUCTURED METADATA (Open Graph):
${openGraph}

VISIBLE PAGE TEXT (truncated):
${visibleText}

Extract ONLY information that is explicitly present in the source data. Do NOT hallucinate or infer missing information. If a field cannot be determined, use null.

Return a JSON object with this exact schema:
{
  "business": {
    "name": null,
    "category": null,
    "categories": [],
    "description": null,
    "business_type": null
  },
  "contact": {
    "phone": null,
    "email": null,
    "website": null
  },
  "location": {
    "full_address": null,
    "street": null,
    "city": null,
    "state": null,
    "country": null,
    "postal_code": null,
    "latitude": null,
    "longitude": null
  },
  "ratings": {
    "rating": null,
    "review_count": null
  },
  "hours": {
    "monday": null,
    "tuesday": null,
    "wednesday": null,
    "thursday": null,
    "friday": null,
    "saturday": null,
    "sunday": null
  },
  "reviews": [],
  "services": [],
  "products": [],
  "amenities": [],
  "social_links": [],
  "pricing": null,
  "booking_url": null,
  "source_urls": [],
  "confidence": {
    "overall": null,
    "name": null,
    "category": null,
    "phone": null,
    "website": null,
    "address": null,
    "rating": null
  }
}

Rules:
- "source_urls" should include the original Google Maps URL
- "confidence" values should be 0.0 to 1.0 based on how clearly the information appears in the source
- For "reviews", only include reviews explicitly found in the source data with {author, rating, text, date}
- For "hours", use 24-hour format strings like "09:00-17:00" or "closed"
- For "categories", use specific business types from the data
`
  }

  /**
   * Extract structured business profile using AI
   */
  async extractWithAI(metadata, sourceUrl) {
    const prompt = this.buildExtractionPrompt(metadata, sourceUrl);
    
    // Define the JSON schema for structured output
    const schema = {
      type: 'object',
      properties: {
        business: {
          type: 'object',
          properties: {
            name: { type: ['string', 'null'] },
            category: { type: ['string', 'null'] },
            categories: { type: 'array', items: { type: 'string' } },
            description: { type: ['string', 'null'] },
            business_type: { type: ['string', 'null'] }
          },
          required: ['name', 'category', 'categories', 'description', 'business_type']
        },
        contact: {
          type: 'object',
          properties: {
            phone: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            website: { type: ['string', 'null'] }
          },
          required: ['phone', 'email', 'website']
        },
        location: {
          type: 'object',
          properties: {
            full_address: { type: ['string', 'null'] },
            street: { type: ['string', 'null'] },
            city: { type: ['string', 'null'] },
            state: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
            postal_code: { type: ['string', 'null'] },
            latitude: { type: ['number', 'null'] },
            longitude: { type: ['number', 'null'] }
          },
          required: ['full_address', 'street', 'city', 'state', 'country', 'postal_code', 'latitude', 'longitude']
        },
        ratings: {
          type: 'object',
          properties: {
            rating: { type: ['number', 'null'] },
            review_count: { type: ['number', 'null'] }
          },
          required: ['rating', 'review_count']
        },
        hours: {
          type: 'object',
          properties: {
            monday: { type: ['string', 'null'] },
            tuesday: { type: ['string', 'null'] },
            wednesday: { type: ['string', 'null'] },
            thursday: { type: ['string', 'null'] },
            friday: { type: ['string', 'null'] },
            saturday: { type: ['string', 'null'] },
            sunday: { type: ['string', 'null'] }
          },
          required: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        reviews: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              author: { type: 'string' },
              rating: { type: 'number' },
              text: { type: 'string' },
              date: { type: 'string' }
            },
            required: ['author', 'rating', 'text', 'date']
          }
        },
        services: { type: 'array', items: { type: 'string' } },
        products: { type: 'array', items: { type: 'string' } },
        amenities: { type: 'array', items: { type: 'string' } },
        social_links: { type: 'array', items: { type: 'string' } },
        pricing: { type: ['string', 'null'] },
        booking_url: { type: ['string', 'null'] },
        source_urls: { type: 'array', items: { type: 'string' } },
        confidence: {
          type: 'object',
          properties: {
            overall: { type: ['number', 'null'] },
            name: { type: ['number', 'null'] },
            category: { type: ['number', 'null'] },
            phone: { type: ['number', 'null'] },
            website: { type: ['number', 'null'] },
            address: { type: ['number', 'null'] },
            rating: { type: ['number', 'null'] }
          },
          required: ['overall', 'name', 'category', 'phone', 'website', 'address', 'rating']
        }
      },
      required: ['business', 'contact', 'location', 'ratings', 'hours', 'reviews', 'services', 'products', 'amenities', 'social_links', 'pricing', 'booking_url', 'source_urls', 'confidence']
    };

    try {
      const result = await AIService.generate({
        prompt,
        model: 'reasoning',
        schema,
        temperature: 0.1,
        maxTokens: 4000,
      });
      return result;
    } catch (error) {
      console.error('[BusinessDataExtractor] AI extraction failed:', error.message);
      // Return a minimal valid structure on failure
      return {
        business: { name: null, category: null, categories: [], description: null, business_type: null },
        contact: { phone: null, email: null, website: null },
        location: { full_address: null, street: null, city: null, state: null, country: null, postal_code: null, latitude: null, longitude: null },
        ratings: { rating: null, review_count: null },
        hours: { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null },
        reviews: [],
        services: [],
        products: [],
        amenities: [],
        social_links: [],
        pricing: null,
        booking_url: null,
        source_urls: [sourceUrl],
        confidence: { overall: 0, name: 0, category: 0, phone: 0, website: 0, address: 0, rating: 0 }
      };
    }
  }

  /**
   * Main extraction method
   */
  async extractFromGoogleMapsUrl(googleMapsUrl) {
    // Check cache first
    const cached = this.getCachedExtraction(googleMapsUrl);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Validate URL
    if (!this.validateGoogleMapsUrl(googleMapsUrl)) {
      throw new Error('Invalid Google Maps URL');
    }

    // Extract identifiers
    const placeId = this.extractPlaceId(googleMapsUrl);
    const placeName = this.extractPlaceName(googleMapsUrl);

    // Fetch page content
    const pageData = await this.fetchPage(googleMapsUrl);
    
    if (pageData.status >= 400) {
      throw new Error(`Failed to retrieve page: HTTP ${pageData.status}`);
    }

    // Extract metadata
    const metadata = this.extractMetadata(pageData.html);
    metadata.sourceUrl = pageData.url;

    // Use AI to extract structured profile
    const extractedProfile = await this.extractWithAI(metadata, pageData.url);
    
    // Validate and clean
    const validatedProfile = this.validateProfile(extractedProfile);
    
    // Add metadata
    const result = {
      ...validatedProfile,
      metadata: {
        sourceUrl: pageData.url,
        originalUrl: googleMapsUrl,
        placeId,
        placeName,
        extractedAt: new Date().toISOString(),
        httpStatus: pageData.status,
        hasJsonLd: metadata.jsonLd.length > 0,
        hasMicrodata: Object.keys(metadata.microdata).length > 0,
        hasOpenGraph: Object.keys(metadata.openGraph).length > 0,
      },
      cached: false,
    };

    // Cache the result
    this.setCachedExtraction(googleMapsUrl, result);

    return result;
  }

  /**
   * Clear cache (for testing/admin)
   */
  clearCache() {
    extractionCache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: extractionCache.size,
      entries: Array.from(extractionCache.entries()).map(([key, value]) => ({
        key: key.substring(0, 16) + '...',
        normalizedUrl: value.normalizedUrl,
        timestamp: value.timestamp,
      })),
    };
  }
}

export default new BusinessDataExtractor();