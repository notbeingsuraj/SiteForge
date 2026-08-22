/**
 * Business Intelligence Research Service
 * 
 * This service is the core of the business data extraction pipeline.
 * It extracts and normalizes business information from various sources.
 */

class BusinessResearchService {
  /**
   * Extract business information and return structured JSON
   */
  async extractBusinessIntelligence(rawBusinessData) {
    try {
      if (!rawBusinessData) {
        throw new Error('Business data is required');
      }

      const intelligence = {
        source: {
          placeId: rawBusinessData.place_id || null,
          mapsUrl: rawBusinessData.url || null,
        },
        identity: this.extractIdentity(rawBusinessData),
        contact: this.extractContact(rawBusinessData),
        location: this.extractLocation(rawBusinessData),
        digitalPresence: this.extractDigitalPresence(rawBusinessData),
        services: this.extractServices(rawBusinessData),
        trustSignals: this.extractTrustSignals(rawBusinessData),
        positioning: this.extractPositioning(rawBusinessData),
        facts: this.extractVerifiedFacts(rawBusinessData),
        unknowns: this.identifyUnknowns(rawBusinessData),
        rating: rawBusinessData.rating || null,
        reviewCount: rawBusinessData.user_ratings_total || null,
        openingHours: rawBusinessData.opening_hours || null,
        reviews: rawBusinessData.reviews || [],
        photos: rawBusinessData.photos?.map(photo => photo.photo_reference || photo.url) || [],
      };

      return intelligence;
    } catch (error) {
      console.error('Business research extraction error:', error);
      throw error;
    }
  }

  extractIdentity(data) {
    return {
      name: data.name || null,
      category: data.category || data.types?.[0] || null,
      businessType: data.businessType || null,
      description: data.description || data.editorial_summary?.overview || null,
    };
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
