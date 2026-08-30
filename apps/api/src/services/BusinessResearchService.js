/**
 * Business Intelligence Research Service
 * 
 * This service is the core of the business data extraction pipeline.
 * It extracts and normalizes business information from various sources.
 * Now works with BusinessDataExtractor output (no Google Maps API required).
 */

class BusinessResearchService {
  /**
   * Extract business information from new extraction format and return structured JSON
   */
  async extractBusinessIntelligence(extractedData) {
    try {
      if (!extractedData) {
        throw new Error('Business data is required');
      }

      const isFlatProfile =
        extractedData.identity !== undefined ||
        extractedData.contact !== undefined ||
        extractedData.location !== undefined ||
        extractedData.metadata !== undefined ||
        extractedData.confidence !== undefined;

      const normalizedData = isFlatProfile ? this.normalizeFlatProfile(extractedData) : extractedData;
      const isNewFormat = normalizedData.business !== undefined;

      if (isNewFormat) {
        return this.extractFromNewFormat(normalizedData);
      } else {
        return this.extractFromGooglePlacesFormat(normalizedData);
      }
    } catch (error) {
      console.error('Business research extraction error:', error);
      throw error;
    }
  }

  normalizeFlatProfile(data) {
    if (!data || typeof data !== 'object') return data;

    const flattened = {
      business: {
        name: data['identity.name'] ?? data.business?.name ?? null,
        category: data['identity.category'] ?? data.business?.category ?? null,
        categories: data['identity.categories'] ?? data.business?.categories ?? [],
        description: data['identity.description'] ?? data.business?.description ?? null,
        business_type: data['identity.business_type'] ?? data.business?.business_type ?? null,
      },
      contact: {
        phone: data['contact.phone'] ?? data.contact?.phone ?? null,
        email: data['contact.email'] ?? data.contact?.email ?? null,
        website: data['contact.website'] ?? data.contact?.website ?? null,
      },
      location: {
        full_address: data['location.full_address'] ?? data.location?.full_address ?? null,
        street: data['location.street'] ?? data.location?.street ?? null,
        city: data['location.city'] ?? data.location?.city ?? null,
        state: data['location.state'] ?? data.location?.state ?? null,
        country: data['location.country'] ?? data.location?.country ?? null,
        postal_code: data['location.postal_code'] ?? data.location?.postal_code ?? null,
        latitude: data['location.coordinates']?.lat ?? data.location?.latitude ?? data.location?.coordinates?.lat ?? null,
        longitude: data['location.coordinates']?.lng ?? data.location?.longitude ?? data.location?.coordinates?.lng ?? null,
      },
      ratings: {
        rating: data['ratings.rating'] ?? data.ratings?.rating ?? null,
        review_count: data['ratings.review_count'] ?? data.ratings?.review_count ?? null,
      },
      hours: data.hours ?? {},
      reviews: data.reviews ?? [],
      services: data.services ?? [],
      products: data.products ?? [],
      amenities: data.amenities ?? [],
      social_links: data.social_links ?? [],
      pricing: data.pricing ?? null,
      booking_url: data.booking_url ?? null,
      source_urls: data.source_urls ?? [],
      confidence: data.confidence ?? {},
      metadata: data.metadata ?? {},
      cached: data.cached ?? false,
    };

    return flattened;
  }

  /**
   * Extract from new BusinessDataExtractor format
   */
  extractFromNewFormat(data) {
    const business = data.business || {};
    const contact = data.contact || {};
    const location = data.location || {};
    const ratings = data.ratings || {};
    const hours = data.hours || {};
    const metadata = data.metadata || {};

    // Determine resolution status based on URL type and placeId availability
    const originalUrl = metadata.originalUrl || metadata.sourceUrl || '';
    const placeId = metadata.placeId || null;
    const isSearchUrl = originalUrl.includes('/search/');
    const isPlaceUrl = originalUrl.includes('/place/');
    
    let resolutionStatus = 'unresolved';
    let resolutionConfidence = 0;
    let query = null;
    let resolvedName = null;
    
    if (isSearchUrl) {
      // Search URL - extract query but no placeId
      const urlObj = new URL(originalUrl);
      query = urlObj.searchParams.get('query');
      resolutionStatus = 'unresolved';
      resolutionConfidence = 0;
      resolvedName = business.name || null;
    } else if (isPlaceUrl) {
      if (placeId && this.isValidPlaceId(placeId)) {
        // Place URL with valid placeId
        resolutionStatus = 'resolved';
        resolutionConfidence = data.confidence?.overall || 0.8;
        resolvedName = business.name || null;
      } else if (placeId && placeId.startsWith('cid:')) {
        // Place URL with CID - partially resolved
        resolutionStatus = 'resolved';
        resolutionConfidence = (data.confidence?.overall || 0.6);
        resolvedName = business.name || null;
      } else {
        // Place URL but no extractable placeId
        resolutionStatus = 'ambiguous';
        resolutionConfidence = 0.3;
        resolvedName = business.name || null;
      }
    } else {
      // Unknown URL type
      resolutionStatus = 'invalid';
      resolutionConfidence = 0;
    }

    const intelligence = {
      source: {
        query: query,
        placeId: placeId,
        resolvedName: resolvedName,
        resolutionStatus: resolutionStatus,
        resolutionConfidence: resolutionConfidence,
        mapsUrl: originalUrl || null,
      },
      identity: {
        name: business.name,
        category: business.category,
        businessType: business.business_type,
        description: business.description,
        categories: business.categories || [],
      },
      contact: {
        phone: contact.phone,
        email: contact.email,
        website: contact.website,
      },
      location: {
        address: location.full_address,
        city: location.city,
        state: location.state,
        country: location.country,
        postalCode: location.postal_code,
        coordinates: (location.latitude && location.longitude) ? {
          lat: location.latitude,
          lng: location.longitude,
        } : null,
      },
      digitalPresence: {
        googleMapsUrl: originalUrl || null,
        website: contact.website || null,
        socialProfiles: { facebook: null, instagram: null, twitter: null, linkedin: null },
        hasWebsite: !!contact.website,
        photos: [],
      },
      services: business.services || [],
      trustSignals: this.buildTrustSignals(ratings, data.reviews),
      positioning: {
        priceLevel: data.pricing || null,
        category: business.category,
        location: location.full_address,
      },
      facts: this.buildVerifiedFacts(business, contact, location, ratings, metadata),
      unknowns: this.identifyUnknowns(business, contact, location),
      rating: ratings.rating,
      reviewCount: ratings.review_count,
      openingHours: this.formatOpeningHours(hours),
      reviews: data.reviews || [],
      photos: [],
      confidence: data.confidence || {},
    };

    return intelligence;
  }

  /**
   * Check if a placeId is a valid Google Place ID (not a synthetic one)
   */
  isValidPlaceId(placeId) {
    if (!placeId || typeof placeId !== 'string') return false;
    if (placeId.startsWith('query:')) return false;
    if (placeId.startsWith('cid:')) return true; // CID is a valid identifier
    // Standard Place ID format
    if (placeId.startsWith('ChIJ') && placeId.length >= 27) return true;
    // CID format: 0x<hex>:0x<hex> (e.g., 0x390feb5b7b7b7b7b:0x1234567890abcdef)
    const cidRegex = /^0x[0-9a-fA-F]+:0x[0-9a-fA-F]+$/;
    if (cidRegex.test(placeId)) return true;
    return false;
  }
/**
   * Extract from legacy Google Places API format (for backward compatibility)
   */
  extractFromGooglePlacesFormat(data) {
    return {
      source: {
        placeId: data.place_id || null,
        mapsUrl: data.url || null,
      },
      identity: this.extractIdentity(data),
      contact: this.extractContact(data),
      location: this.extractLocation(data),
      digitalPresence: this.extractDigitalPresence(data),
      services: this.extractServices(data),
      trustSignals: this.extractTrustSignals(data),
      positioning: this.extractPositioning(data),
      facts: this.extractVerifiedFacts(data),
      unknowns: this.identifyUnknownsLegacy(data),
      rating: data.rating || null,
      reviewCount: data.user_ratings_total || null,
      openingHours: data.opening_hours || null,
      reviews: data.reviews || [],
      photos: data.photos?.map(photo => photo.photo_reference || photo.url) || [],
      confidence: {},
    };
  }

  buildTrustSignals(ratings, reviews) {
    const signals = [];
    if (ratings.rating !== null && ratings.rating !== undefined) {
      signals.push({ type: 'rating', value: ratings.rating, source: 'google_maps_public', verified: true });
    }
    if (ratings.review_count !== null && ratings.review_count !== undefined) {
      signals.push({ type: 'review_count', value: ratings.review_count, source: 'google_maps_public', verified: true });
    }
    if (reviews && reviews.length > 0) {
      signals.push({ type: 'reviews_available', value: reviews.length, source: 'google_maps_public', verified: true });
    }
    return signals;
  }

  buildVerifiedFacts(business, contact, location, ratings, metadata) {
    const facts = [];
    if (business.name) facts.push({ claim: `Business name is ${business.name}`, source: 'google_maps_public', verified: true });
    if (business.category) facts.push({ claim: `Business category is ${business.category}`, source: 'google_maps_public', verified: true });
    if (ratings.rating) facts.push({ claim: `Has a rating of ${ratings.rating}/5`, source: 'google_maps_public', verified: true });
    if (ratings.review_count) facts.push({ claim: `Has ${ratings.review_count} reviews`, source: 'google_maps_public', verified: true });
    if (contact.website) facts.push({ claim: `Website: ${contact.website}`, source: 'google_maps_public', verified: true });
    if (contact.phone) facts.push({ claim: `Phone: ${contact.phone}`, source: 'google_maps_public', verified: true });
    if (location.full_address) facts.push({ claim: `Address: ${location.full_address}`, source: 'google_maps_public', verified: true });
    if (metadata.hasJsonLd) facts.push({ claim: 'Structured data (JSON-LD) found on page', source: 'page_metadata', verified: true });
    return facts;
  }

  identifyUnknowns(business, contact, location) {
    const unknowns = [];
    if (!business.name) unknowns.push('name');
    if (!business.category) unknowns.push('category');
    if (!contact.website) unknowns.push('website');
    if (!contact.phone) unknowns.push('phone');
    if (!contact.email) unknowns.push('email');
    if (!location.full_address) unknowns.push('address');
    if (!business.description) unknowns.push('description');
    return unknowns;
  }

  formatOpeningHours(hours) {
    if (!hours) return null;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const formatted = {};
    let hasAny = false;
    for (const day of days) {
      if (hours[day]) {
        formatted[day] = hours[day];
        hasAny = true;
      }
    }
    return hasAny ? formatted : null;
  }

  extractContact(data) {
    return {
      phone: data.phone || data.formatted_phone_number || null,
      email: data.email || null,
      website: data.website || null,
    };
  }

  extractLocation(data) {
    return {
      address: data.formatted_address || data.vicinity || null,
      city: data.address_components?.find(c => c.types.includes('locality'))?.long_name || null,
      state: data.address_components?.find(c => c.types.includes('administrative_area_level_1'))?.long_name || null,
      country: data.address_components?.find(c => c.types.includes('country'))?.long_name || null,
      postalCode: data.address_components?.find(c => c.types.includes('postal_code'))?.long_name || null,
      coordinates: data.geometry?.location ? {
        lat: data.geometry.location.lat,
        lng: data.geometry.location.lng,
      } : null,
    };
  }

  extractDigitalPresence(data) {
    return {
      googleMapsUrl: data.url || null,
      website: data.website || null,
      socialProfiles: { facebook: null, instagram: null, twitter: null, linkedin: null },
      hasWebsite: !!data.website,
      photos: data.photos?.map(p => p.photo_reference || p.url) || [],
    };
  }

  extractServices(data) {
    const services = [];
    if (data.types && Array.isArray(data.types)) {
      services.push(...data.types.filter(t => t !== 'point_of_interest' && t !== 'establishment'));
    }
    return services.length > 0 ? services : null;
  }

  extractTrustSignals(data) {
    const signals = [];
    if (data.rating) {
      signals.push({ type: 'rating', value: data.rating, source: 'google_maps', verified: true });
    }
    if (data.user_ratings_total) {
      signals.push({ type: 'review_count', value: data.user_ratings_total, source: 'google_maps', verified: true });
    }
    return signals;
  }

  extractPositioning(data) {
    return {
      priceLevel: data.price_level || null,
      category: data.types?.[0] || null,
      location: data.formatted_address || null,
    };
  }

  extractVerifiedFacts(data) {
    const facts = [];
    if (data.name) facts.push({ claim: `Business name is ${data.name}`, source: 'google_maps_public_data', verified: true });
    if (data.rating) facts.push({ claim: `Has a rating of ${data.rating}/5`, source: 'google_maps_public_data', verified: true });
    return facts;
  }

  identifyUnknowns(data) {
    const unknowns = [];
    if (!data.website) unknowns.push('website');
    if (!data.phone && !data.formatted_phone_number) unknowns.push('phone');
    if (!data.email) unknowns.push('email');
    return unknowns;
  }
}

export default new BusinessResearchService();
