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

  /**
   * Fetch page content with retries using r.jina.ai proxy
   */
  async fetchPage(url, retryCount = 0) {
    // Validate URL to prevent SSRF
    try {
      const parsed = new URL(url);
      
      // Only allow HTTPS
      if (parsed.protocol !== "https:") {
        throw new Error("Only HTTPS URLs are allowed");
      }
      
      // Block private/internal IPs
      const hostname = parsed.hostname.toLowerCase();
      const blockedHostnames = ["localhost", "localhost.localdomain", "local"];
      if (blockedHostnames.includes(hostname)) {
        throw new Error("Localhost URLs are not allowed");
      }
      
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
      
      if (hostname === "::1" || hostname.startsWith("fe80:")) {
        throw new Error("IPv6 internal addresses are not allowed");
      }
    } catch (error) {
      if (error.message.includes("not allowed") || error.message.includes("Only HTTPS")) {
        throw error;
      }
      throw new Error("Invalid URL format");
    }

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
   * Extract structured metadata from page (from Google Maps page via proxy)
   */
  extractMetadata(html) {
    return {
      jsonLd: this.extractJsonLd(html),
      microdata: this.extractMicrodata(html),
      openGraph: this.extractOpenGraph(html),
      visibleText: this.extractVisibleText(html),
    };
  }

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

  extractOpenGraph(html) {
    const results = {};
    const regex = /<meta[^>]*property=["']og:([^"']+)["'][^>]*content=["']([^"']*)["']/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      results[match[1]] = match[2];
    }
    return results;
  }

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
   * Build AI extraction prompt from Google Maps page content
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
\``;
  }

  /**
   * Extract structured business profile using AI (from Google Maps page content)
   */
  async extractWithAI(metadata, sourceUrl) {
    // Dynamic import to avoid circular deps
    const { default: AIService } = await import('./AIService.js');
    
    const prompt = this.buildExtractionPrompt(metadata, sourceUrl);
    
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
      const providerError = error?.providerError || {
        category: 'PROVIDER_UNAVAILABLE',
        httpStatus: null,
        safeMessage: error?.message || 'AI provider request failed.',
        retryAttempted: false,
        retryCount: 0,
        provider: 'omniroute',
        model: 'reasoning',
        success: false,
      };

      console.error('[BusinessDataExtractor] AI extraction failed:', providerError.safeMessage);
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
        confidence: { overall: 0, name: 0, category: 0, phone: 0, website: 0, address: 0, rating: 0 },
        providerError,
        providerUnavailable: true,
        metadata: {
          providerError,
          providerUnavailable: true,
          extractionStatus: 'provider_unavailable',
        }
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
        latitude: profile.location?.latitude ?? null,
        longitude: profile.location?.longitude ?? null,
      },
      ratings: {
        rating: typeof profile.ratings?.rating === 'number' ? profile.ratings.rating : null,
        review_count: typeof profile.ratings?.review_count === 'number' ? profile.ratings.review_count : null,
      },
      hours: profile.hours ?? {},
      reviews: Array.isArray(profile.reviews) ? profile.reviews : [],
      services: Array.isArray(profile.services) ? profile.services : [],
      products: Array.isArray(profile.products) ? profile.products : [],
      amenities: Array.isArray(profile.amenities) ? profile.amenities : [],
      social_links: Array.isArray(profile.social_links) ? profile.social_links : [],
      pricing: profile.pricing ?? null,
      booking_url: profile.booking_url ?? null,
      source_urls: Array.isArray(profile.source_urls) ? profile.source_urls : [],
      confidence: profile.confidence ?? { overall: 0, name: 0, category: 0, phone: 0, website: 0, address: 0, rating: 0 },
    };

    return validated;
  }

  /**
   * MAIN ENTRY POINT: Extract from Google Maps URL
   * 
   * Pipeline:
   * 1. Parse URL for identifiers (IDENTIFIED provenance)
   * 2. If website found in extracted data, fetch official website (DISCOVERED provenance)
   * 3. Merge into BusinessProfile with provenance tracking
   * 4. Return normalized result
   */
  async extractFromGoogleMapsUrl(googleMapsUrl) {
    // Check cache first
    const cached = this.getCachedExtraction(googleMapsUrl);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Step 1: Parse URL for identifiers (IDENTIFIED provenance)
    const parsed = this.parser.parse(googleMapsUrl);
    const identified = parsed.identified;
    const provenance = parsed.provenance;

    if (config.debugBusinessAnalysis) {
      console.log('[BusinessDataExtractor] Parsed identifiers:', identified);
    }

    // Step 2: Fetch Google Maps page content via proxy
    let pageData;
    let metadata;
    let extractedProfile;
    let resolutionStatus = 'unresolved';
    let acquisitionMethod = 'r_jina_ai';

    try {
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
      extractedProfile = this.validateProfile(extractedProfile);
      
      // Determine resolution status
      if (identified.placeId && this.parser.isValidPlaceIdFormat(identified.placeId)) {
        resolutionStatus = extractedProfile.business?.name ? 'resolved' : 'partial';
      } else if (identified.placeName) {
        resolutionStatus = 'ambiguous';
      }
    } catch (error) {
      console.error('[BusinessDataExtractor] Extraction failed:', error.message);
      // Return minimal profile with just identified info
      extractedProfile = {
        business: { name: identified.placeName, category: null, categories: [], description: null, business_type: null },
        contact: { phone: null, email: null, website: null },
        location: { full_address: null, street: null, city: null, state: null, country: null, postal_code: null, latitude: identified.coordinates?.lat ?? null, longitude: identified.coordinates?.lng ?? null },
        ratings: { rating: null, review_count: null },
        hours: {},
        reviews: [],
        services: [],
        products: [],
        amenities: [],
        social_links: [],
        pricing: null,
        booking_url: null,
        source_urls: [googleMapsUrl],
        confidence: { overall: 0, name: identified.placeName ? 0.5 : 0, category: 0, phone: 0, website: 0, address: 0, rating: 0 },
      };
      resolutionStatus = identified.placeId ? 'partial' : 'unresolved';
    }

    // Step 3: Build BusinessProfile with provenance tracking
    const profile = new BusinessProfile();
    
    // Add IDENTIFIED data from URL parsing
    if (identified.placeName) {
      profile.set('identity.name', identified.placeName, 'identified', 0.6, { sourceUrl: googleMapsUrl });
    }
    if (identified.coordinates) {
      profile.set('location.coordinates', identified.coordinates, 'identified', 0.8, { sourceUrl: googleMapsUrl });
    }

    // Add DISCOVERED data from Google Maps page extraction
    if (extractedProfile.business?.name) {
      profile.set('identity.name', extractedProfile.business.name, 'discovered', extractedProfile.confidence?.name || 0.7, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.business?.category) {
      profile.set('identity.category', extractedProfile.business.category, 'discovered', extractedProfile.confidence?.category || 0.6, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.business?.categories?.length) {
      profile.set('identity.categories', extractedProfile.business.categories, 'discovered', 0.6, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.business?.description) {
      profile.set('identity.description', extractedProfile.business.description, 'discovered', 0.6, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.contact?.phone) {
      profile.set('contact.phone', extractedProfile.contact.phone, 'discovered', extractedProfile.confidence?.phone || 0.6, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.contact?.website) {
      profile.set('contact.website', extractedProfile.contact.website, 'discovered', extractedProfile.confidence?.website || 0.6, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.location?.full_address) {
      profile.set('location.full_address', extractedProfile.location.full_address, 'discovered', extractedProfile.confidence?.address || 0.6, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.location?.coordinates) {
      profile.set('location.coordinates', extractedProfile.location.coordinates, 'discovered', 0.7, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.ratings?.rating) {
      profile.set('ratings.rating', extractedProfile.ratings.rating, 'discovered', extractedProfile.confidence?.rating || 0.7, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.hours && Object.keys(extractedProfile.hours).some(k => extractedProfile.hours[k])) {
      profile.set('hours', extractedProfile.hours, 'discovered', 0.6, { sourceUrl: pageData?.url || googleMapsUrl });
    }
    if (extractedProfile.social_links?.length) {
      profile.set('social_links', extractedProfile.social_links, 'discovered', 0.5, { sourceUrl: pageData?.url || googleMapsUrl });
    }

    // Step 4: Try to fetch official website for VERIFIED/DISCOVERED data
    const websiteUrl = extractedProfile.contact?.website || profile.get('contact.website');
    if (websiteUrl) {
      try {
        if (config.debugBusinessAnalysis) {
          console.log('[BusinessDataExtractor] Fetching official website:', websiteUrl);
        }
        const websiteData = await this.websiteProvider.extract(websiteUrl);
        
        // Merge with VERIFIED provenance (official website is authoritative)
        profile.merge(websiteData, 'verified', 0.9);
        
        if (config.debugBusinessAnalysis) {
          console.log('[BusinessDataExtractor] Official website data merged');
        }
      } catch (error) {
        if (config.debugBusinessAnalysis) {
          console.log('[BusinessDataExtractor] Official website fetch failed:', error.message);
        }
        // Don't fail - continue with what we have
      }
    }

    // Step 5: Build final result
    const result = {
      ...profile.toObject(),
      metadata: {
        ...provenance,
        placeId: identified.placeId,
        placeName: identified.placeName,
        extractedAt: new Date().toISOString(),
        httpStatus: pageData?.status,
        hasJsonLd: metadata?.jsonLd?.length > 0,
        hasMicrodata: Object.keys(metadata?.microdata || {}).length > 0,
        hasOpenGraph: Object.keys(metadata?.openGraph || {}).length > 0,
        acquisitionMethod,
        resolutionStatus,
        provenanceBreakdown: profile.getProvenanceBreakdown(),
        completeness: profile.getCompleteness(),
        providerError: extractedProfile?.providerError || null,
        providerUnavailable: Boolean(extractedProfile?.providerUnavailable),
        gateway: config.omniroute.baseUrl,
        model: config.omniroute.models.reasoning,
      },
      cached: false,
    };

    // Cache the result
    this.setCachedExtraction(googleMapsUrl, result);

    return result;
  }

  /**
   * Extract from user-provided data
   */
  async extractFromUserData(userData) {
    const processed = UserProvidedDataProvider.process(userData);
    const profile = new BusinessProfile();
    profile.merge(processed, 'user_provided', 1.0);
    
    return {
      ...profile.toObject(),
      metadata: {
        source: 'user_provided',
        extractedAt: new Date().toISOString(),
        provenanceBreakdown: profile.getProvenanceBreakdown(),
        completeness: profile.getCompleteness(),
      },
      cached: false,
    };
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