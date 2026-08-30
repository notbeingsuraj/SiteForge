/**
 * UserProvidedDataProvider
 * 
 * Accepts explicit user-provided business information.
 * Marks provenance as user_provided.
 * 
 * This provider allows users to directly supply business data
 * that they know to be accurate, bypassing any discovery or extraction.
 */

class UserProvidedDataProvider {
  /**
   * Validate and normalize user-provided business data
   * @param {Object} data - Raw user-provided data
   * @returns {Object} Normalized data with provenance
   */
  static normalize(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('User provided data must be an object');
    }

    return {
      business: {
        name: data.name || null,
        description: data.description || null,
        category: data.category || null,
        business_type: data.business_type || null,
        categories: Array.isArray(data.categories) ? data.categories : [],
      },
      contact: {
        phone: data.phone || data.phoneNumber || null,
        email: data.email || null,
        website: data.website || data.url || null,
      },
      location: {
        full_address: data.address || data.full_address || null,
        street: data.street || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || null,
        postal_code: data.postal_code || data.zip || null,
        coordinates: data.coordinates || (data.lat && data.lng ? { lat: data.lat, lng: data.lng } : null),
      },
      ratings: {
        rating: data.rating || null,
        review_count: data.review_count || data.reviewCount || null,
      },
      hours: data.hours || {},
      social_links: Array.isArray(data.social_links) ? data.social_links : 
                     Array.isArray(data.social) ? data.social : [],
      provenance: {
        source: 'user_provided',
        providedAt: new Date().toISOString(),
        sourceUrl: null,
      },
      metadata: {
        userProvided: true,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Process user-provided data
   * @param {Object} data - User-provided business data
   * @returns {Object} Normalized business profile with user_provided provenance
   */
  static process(data) {
    const normalized = this.normalize(data);
    
    // Validate minimum required fields
    if (!normalized.business.name) {
      throw new Error('User-provided data must include at least a business name');
    }

    return normalized;
  }
}

export default UserProvidedDataProvider;