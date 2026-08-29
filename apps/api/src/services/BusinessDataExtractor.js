import axios from 'axios';
import { config } from '../config/env.js';
import { createHash } from 'crypto';
import AIService from './AIService.js';

/**
 * Business Data Extractor
 * 
 * Retrieves business information from Google Maps URLs using:
 * 1. Google Places API (New) - when GOOGLE_MAPS_API_KEY is configured (preferred)
 * 2. r.jina.ai proxy fallback - when no API key is available
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

    // Google Places API (New) client - only initialized if API key is available
    if (config.googleMaps.apiKey) {
      this.placesClient = axios.create({
        baseURL: config.googleMaps.placesApiBaseUrl,
        timeout: config.extraction.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.googleMaps.apiKey,
          'X-Goog-FieldMask': config.googleMaps.fieldMask,
        },
        validateStatus: (status) => status < 500,
      });
    }
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
   * Fetch business data from Google Places API (New)
   * @param {string} placeId - Google Place ID (ChIJ... or 0x...:0x... format)
   * @returns {Object|null} Structured business data or null if not available
   */
  async fetchFromPlacesApi(placeId) {
    if (!this.placesClient) {
      if (config.debugBusinessAnalysis) {
        console.log('[BusinessDataExtractor] Google Places API not configured, skipping');
      }
      return null;
    }

    if (!placeId || typeof placeId !== 'string') {
      if (config.debugBusinessAnalysis) {
        console.log('[BusinessDataExtractor] Invalid placeId for Places API:', placeId);
      }
      return null;
    }

    const isCidFormat = /^0x[0-9a-fA-F]+:0x[0-9a-fA-F]+$/.test(placeId);
    const isStandardPlaceId = placeId.startsWith('ChIJ') && placeId.length >= 27;

    if (!isStandardPlaceId && !isCidFormat) {
      if (config.debugBusinessAnalysis) {
        console.log('[BusinessDataExtractor] Unsupported placeId format for Places API:', placeId);
      }
      return null;
    }

    try {
      if (config.debugBusinessAnalysis) {
        console.log('[BusinessDataExtractor] Fetching from Google Places API (New):', placeId);
      }

      const resourceName = `places/${placeId}`;
      const response = await this.placesClient.get(resourceName);

      if (response.status === 200 && response.data) {
        if (config.debugBusinessAnalysis) {
          console.log('[BusinessDataExtractor] Places API success:', response.data.id);
        }
        return this.normalizePlacesApiResponse(response.data);
      } else {
        if (config.debugBusinessAnalysis) {
          console.log('[BusinessDataExtractor] Places API returned non-200:', response.status);
        }
        return null;
      }
    } catch (error) {
      if (config.debugBusinessAnalysis) {
        console.log('[BusinessDataExtractor] Places API error:', error.message);
        if (error.response) {
          console.log('[BusinessDataExtractor] Places API error details:', error.response.status, error.response.data);
        }
      }
      return null;
    }
  }

  /**
   * Normalize Google Places API (New) response to internal format
   * @param {Object} data - Raw Places API response
   * @returns {Object} Normalized business data
   */
  normalizePlacesApiResponse(data) {
    if (!data) return null;

    const addressComponents = data.addressComponents || [];
    const getAddressComponent = (type) => {
      const component = addressComponents.find(c => c.types.includes(type));
      return component?.longText || component?.shortText || null;
    };

    let hours = null;
    if (data.regularOpeningHours?.periods) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      hours = {};
      for (const period of data.regularOpeningHours.periods) {
        const openDay = period.open?.day ?? 0;
        const openTime = period.open?.hour !== undefined ? `${String(period.open.hour).padStart(2, '0')}:${String(period.open.minute || 0).padStart(2, '0')}` : null;
        const closeTime = period.close?.hour !== undefined ? `${String(period.close.hour).padStart(2, '0')}:${String(period.close.minute || 0).padStart(2, '0')}` : null;
        
        const dayName = days[openDay];
        if (dayName) {
          if (openTime && closeTime) {
            hours[dayName] = `${openTime}-${closeTime}`;
          } else if (!openTime && !closeTime) {
            hours[dayName] = 'closed';
          }
        }
      }
    }

    const primaryType = data.primaryType || (data.types && data.types[0]);
    const primaryTypeDisplayName = data.primaryTypeDisplayName?.text || null;

    return {
      business: {
        name: data.displayName?.text || null,
        category: primaryTypeDisplayName || primaryType || null,
        categories: data.types || [],
        description: data.editorialSummary?.text || null,
        business_type: primaryType || null,
      },
      contact: {
        phone: data.nationalPhoneNumber || data.internationalPhoneNumber || null,
        email: null,
        website: data.websiteUri || null,
      },
      location: {
        full_address: data.formattedAddress || data.shortFormattedAddress || null,
        street: getAddressComponent('street_number') ? `${getAddressComponent('street_number')} ${getAddressComponent('route') || ''}`.trim() : getAddressComponent('route') || null,
        city: getAddressComponent('locality') || getAddressComponent('postal_town') || getAddressComponent('sublocality_level_1') || null,
        state: getAddressComponent('administrative_area_level_1') || null,
        country: getAddressComponent('country') || null,
        postal_code: getAddressComponent('postal_code') || null,
        latitude: data.location?.latitude || null,
        longitude: data.location?.longitude || null,
      },
      ratings: {
        rating: typeof data.rating === 'number' ? data.rating : null,
        review_count: typeof data.userRatingCount === 'number' ? data.userRatingCount : null,
      },
      hours: hours,
      reviews: [],
      services: [],
      products: [],
      amenities: [],
      social_links: [],
      pricing: data.priceLevel !== undefined ? String(data.priceLevel) : null,
      booking_url: null,
      source_urls: [],
      confidence: {
        overall: 0.9,
        name: 1.0,
        category: 0.9,
        phone: data.nationalPhoneNumber ? 0.9 : 0,
        website: data.websiteUri ? 0.9 : 0,
        address: data.formattedAddress ? 0.9 : 0,
        rating: data.rating ? 0.9 : 0,
      },
      metadata: {
        placesApi: true,
        placeId: data.id,
        types: data.types,
        priceLevel: data.priceLevel,
      },
    };
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
   * Supports:
   * - place_id query parameter (standard Place ID: ChIJ...)
   * - CID in query parameter (cid:...)
   * - Place ID in /data/ path (ChIJ... or 0x...:0x... format)
   * - query parameter (for search URLs - returns null, not synthetic ID)
   */
  extractPlaceId(url) {
    try {
      const parsed = new URL(url);
      
      // 1. Check for explicit place_id parameter (ChIJ... format)
      let placeId = parsed.searchParams.get('place_id') || parsed.searchParams.get('query_place_id');
      if (placeId) return placeId;
      
      // 2. Check for CID in query parameter
      const cid = parsed.searchParams.get('cid');
      if (cid) return `cid:${cid}`;
      
      // 3. Extract from /data/ path - supports both ChIJ... and 0x...:0x... formats
      // Pattern: !1s<place_id> where place_id can be ChIJ... or 0x...:0x...
      // Find ALL !1s occurrences and validate each
      const allMatches = url.matchAll(/!1s([^!&]+)/g);
      for (const match of allMatches) {
        const candidate = match[1];
        // Validate it's a legitimate place ID format (ChIJ... or 0x...:0x...)
        if (this.isValidPlaceIdFormat(candidate)) {
          return candidate;
        }
      }
      
      // 4. For search URLs with query parameter - DO NOT create synthetic placeId
      // Return null to indicate no extractable place ID
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate if a string is a legitimate Google Place ID format
   * - ChIJ... format (standard Place ID)
   * - 0x...:0x... format (CID/Place ID in data path)
   */
  isValidPlaceIdFormat(candidate) {
    if (!candidate || typeof candidate !== 'string') return false;
    
    // Standard Google Place ID format: ChIJ followed by base64-like chars
    if (candidate.startsWith('ChIJ') && candidate.length >= 27) {
      return true;
    }
    
    // CID format: 0x<hex>:0x<hex> (e.g., 0x390feb5b7b7b7b7b:0x1234567890abcdef)
    const cidRegex = /^0x[0-9a-fA-F]+:0x[0-9a-fA-F]+$/;
    if (cidRegex.test(candidate)) {
      return true;
    }
    
    return false;
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
  /**
   * Validate URL to prevent SSRF attacks
   */
  validateFetchUrl(url) {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTPS
      if (parsed.protocol !== "https:") {
        throw new Error("Only HTTPS URLs are allowed");
      }
      
      // Block private/internal IPs
      const hostname = parsed.hostname.toLowerCase();
      
      // Block localhost and common internal hostnames
      const blockedHostnames = ["localhost", "localhost.localdomain", "local"];
      if (blockedHostnames.includes(hostname)) {
        throw new Error("Localhost URLs are not allowed");
      }
      
      // Block private IP ranges
      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4Regex.test(hostname)) {
        const parts = hostname.split(".").map(Number);
        if (
          parts[0] === 10 ||
          parts[0] === 127 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          (parts[0] === 169 && parts[1] === 254)
        ) {
          throw new Error("Private IP addresses are not allowed");
        }
      }
      
      // Block IPv6 loopback and link-local
      if (hostname === "::1" || hostname.startsWith("fe80:")) {
        throw new Error("IPv6 internal addresses are not allowed");
      }
      
      return true;
    } catch (error) {
      if (error.message.includes("not allowed") || error.message.includes("Only HTTPS")) {
        throw error;
      }
      throw new Error("Invalid URL format");
    }
  }

  /**
   * Fetch page content with retries
   * Uses r.jina.ai proxy to render JavaScript-heavy Google Maps pages
   */
  async fetchPage(url, retryCount = 0) {
    // Validate URL to prevent SSRF
    this.validateFetchUrl(url);

    // Use jina.ai proxy to extract content from JavaScript-rendered pages
    const proxyUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;

    try {
      const response = await this.proxyClient.get(proxyUrl);
      return {
        url,
        html: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      if (error.response) {
        return {
          url,
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
        maxTokens: 6000,
        systemPrompt: `You are a business information extractor. Analyze the following data retrieved from a Google Maps page and extract structured business information. Return ONLY valid JSON matching the exact schema provided. No markdown, no explanations, no extra text.`,
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
   * Validate and clean extracted profile
   */
  validateProfile(profile) {
    if (!profile || typeof profile !== 'object') {
      throw new Error('Invalid profile: not an object');
    }

    const validated = {
      business: {
        name: profile.business?.name ?? null,
        category: profile.business?.category ?? null,
        categories: Array.isArray(profile.business?.categories) ? profile.business.categories : [],
        description: profile.business?.description ?? null,
        business_type: profile.business?.business_type ?? null,
      },
      contact: {
        phone: profile.contact?.phone ?? null,
        email: profile.contact?.email ?? null,
        website: profile.contact?.website ?? null,
      },
      location: {
        full_address: profile.location?.full_address ?? null,
        street: profile.location?.street ?? null,
        city: profile.location?.city ?? null,
        state: profile.location?.state ?? null,
        country: profile.location?.country ?? null,
        postal_code: profile.location?.postal_code ?? null,
        latitude: typeof profile.location?.latitude === 'number' ? profile.location.latitude : null,
        longitude: typeof profile.location?.longitude === 'number' ? profile.location.longitude : null,
      },
      ratings: {
        rating: typeof profile.ratings?.rating === 'number' ? profile.ratings.rating : null,
        review_count: typeof profile.ratings?.review_count === 'number' ? profile.ratings.review_count : null,
      },
      hours: {
        monday: profile.hours?.monday ?? null,
        tuesday: profile.hours?.tuesday ?? null,
        wednesday: profile.hours?.wednesday ?? null,
        thursday: profile.hours?.thursday ?? null,
        friday: profile.hours?.friday ?? null,
        saturday: profile.hours?.saturday ?? null,
        sunday: profile.hours?.sunday ?? null,
      },
      reviews: Array.isArray(profile.reviews) ? profile.reviews : [],
      services: Array.isArray(profile.services) ? profile.services : [],
      products: Array.isArray(profile.products) ? profile.products : [],
      amenities: Array.isArray(profile.amenities) ? profile.amenities : [],
      social_links: Array.isArray(profile.social_links) ? profile.social_links : [],
      pricing: profile.pricing ?? null,
      booking_url: profile.booking_url ?? null,
      source_urls: Array.isArray(profile.source_urls) ? profile.source_urls : [],
      confidence: {
        overall: typeof profile.confidence?.overall === 'number' ? Math.max(0, Math.min(1, profile.confidence.overall)) : 0,
        name: typeof profile.confidence?.name === 'number' ? Math.max(0, Math.min(1, profile.confidence.name)) : 0,
        category: typeof profile.confidence?.category === 'number' ? Math.max(0, Math.min(1, profile.confidence.category)) : 0,
        phone: typeof profile.confidence?.phone === 'number' ? Math.max(0, Math.min(1, profile.confidence.phone)) : 0,
        website: typeof profile.confidence?.website === 'number' ? Math.max(0, Math.min(1, profile.confidence.website)) : 0,
        address: typeof profile.confidence?.address === 'number' ? Math.max(0, Math.min(1, profile.confidence.address)) : 0,
        rating: typeof profile.confidence?.rating === 'number' ? Math.max(0, Math.min(1, profile.confidence.rating)) : 0,
      },
    };

    // Convert empty strings to null
    Object.keys(validated).forEach(key => {
      if (typeof validated[key] === 'string' && validated[key].trim() === '') {
        validated[key] = null;
      }
    });

    return validated;
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

    let extractedProfile = null;
    let metadata = {};
    let pageData = { url: googleMapsUrl, status: 200, html: '' };
    let acquisitionMethod = 'none';
    let resolutionStatus = 'unresolved';

    // Try Google Places API (New) first if placeId is available and API key configured
    if (placeId && this.placesClient) {
      if (config.debugBusinessAnalysis) {
        console.log('[BusinessDataExtractor] Attempting Places API acquisition for:', placeId);
      }
      const placesData = await this.fetchFromPlacesApi(placeId);
      if (placesData) {
        extractedProfile = placesData;
        acquisitionMethod = 'places_api';
        resolutionStatus = 'resolved';
        metadata = {
          sourceUrl: googleMapsUrl,
          originalUrl: googleMapsUrl,
          placeId,
          placeName,
          extractedAt: new Date().toISOString(),
          httpStatus: 200,
          hasJsonLd: false,
          hasMicrodata: false,
          hasOpenGraph: false,
          acquisitionMethod,
          resolutionStatus,
        };
        
        // Cache and return early with high-quality data
        const result = {
          ...extractedProfile,
          metadata,
          cached: false,
        };
        this.setCachedExtraction(googleMapsUrl, result);
        return result;
      }
    }

    // Fallback: Fetch page content via r.jina.ai proxy
    if (config.debugBusinessAnalysis) {
      console.log('[BusinessDataExtractor] Falling back to r.jina.ai proxy');
    }
    pageData = await this.fetchPage(googleMapsUrl);
    
    if (pageData.status >= 400) {
      throw new Error(`Failed to retrieve page: HTTP ${pageData.status}`);
    }

    // Extract metadata from HTML
    metadata = this.extractMetadata(pageData.html);
    metadata.sourceUrl = pageData.url;

    // Use AI to extract structured profile from page content
    extractedProfile = await this.extractWithAI(metadata, pageData.url);
    
    // Validate and clean
    const validatedProfile = this.validateProfile(extractedProfile);
    
    // Determine resolution status based on what we got
    if (placeId && this.isValidPlaceIdFormat(placeId)) {
      resolutionStatus = validatedProfile.business?.name ? 'resolved' : 'partial';
    } else if (placeName) {
      resolutionStatus = 'ambiguous';
    } else {
      resolutionStatus = 'unresolved';
    }

    acquisitionMethod = 'r_jina_ai';
    
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
        acquisitionMethod,
        resolutionStatus,
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