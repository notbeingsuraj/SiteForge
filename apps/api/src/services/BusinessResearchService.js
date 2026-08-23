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

      // Handle both old Google Places format and new extraction format
      const isNewFormat = extractedData.business !== undefined;
      
      if (isNewFormat) {
        return this.extractFromNewFormat(extractedData);
      } else {
        return this.extractFromGooglePlacesFormat(extractedData);
      }
    } catch (error) {
      console.error('Business research extraction error:', error);
      throw error;
    }
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

    const intelligence = {
      source: {
        placeId: metadata.placeId || null,
        mapsUrl: metadata.originalUrl || metadata.sourceUrl || null,
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
        googleMapsUrl: metadata.originalUrl || metadata.sourceUrl || null,
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
    if (data.name) facts.push({ claim: `Business name is ${data.name}`, source: 'google_maps', verified: true });
    if (data.rating) facts.push({ claim: `Has a rating of ${data.rating}/5`, source: 'google_maps', verified: true });
    return facts;
  }

  identifyUnknowns(data) {
    const unknowns = [];
    if (!data.website) unknowns.push('website');
    if (!data.phone && !data.formatted_phone_number) unknowns.push('phone');
    if (!data.email) unknowns.push('email');
    return unknowns;
  }

  validateGoogleMapsUrl(url) {
    try {
      const parsed = new URL(url);
      return ['maps.google.com', 'www.google.com', 'google.com', 'goo.gl', 'maps.app.goo.gl'].includes(parsed.hostname);
    } catch {
      return false;
    }
  }

  async resolveGoogleMapsUrl(url) {
    const originalUrl = new URL(url);
    let resolvedUrl = url;
    try {
      const response = await fetch(url, { redirect: 'follow' });
      resolvedUrl = response.url || url;
    } catch {
      // The Places search below can still resolve a valid, non-shortened URL.
    }

    const parsed = new URL(resolvedUrl);
    const placeId = originalUrl.searchParams.get('place_id')
      || originalUrl.searchParams.get('query_place_id')
      || parsed.searchParams.get('place_id')
      || parsed.searchParams.get('query_place_id');
    const embeddedPlaceId = (url.match(/!1s(ChIJ[^!&]+)/)?.[1])
      || (resolvedUrl.match(/!1s(ChIJ[^!&]+)/)?.[1])
      || null;
    const query = originalUrl.searchParams.get('query')
      || parsed.searchParams.get('query')
      || this.extractPlaceName(originalUrl.pathname)
      || this.extractPlaceName(parsed.pathname);
    return { placeId: placeId || embeddedPlaceId, query, resolvedUrl };
  }

  extractPlaceName(pathname) {
    const placeMatch = pathname.match(/\/(?:place|search)\/([^/]+)/i);
    return placeMatch ? decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ') : null;
  }
}

export default new BusinessResearchService();
