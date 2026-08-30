/**
 * ProviderAdapter
 *
 * Boundary between provider-specific response structures and SiteForge's
 * canonical business-data format.
 *
 * The rest of the application must NOT see Geoapify-specific fields
 * (properties.place_id, geometry.coordinates, categories[], etc.). This
 * adapter converts a provider response into the flat canonical profile shape
 * that BusinessResearchService already consumes:
 *
 * {
 *   business:  { name, category, categories, description, business_type },
 *   contact:   { phone, email, website },
 *   location:  { full_address, street, city, state, country, postal_code,
 *                latitude, longitude, coordinates },
 *   ratings:   { rating, review_count },
 *   hours:     { monday..sunday },
 *   services:  [],
 *   source_urls: [],
 *   provider:  { name, placeId },
 *   confidence: {...}  // field-level
 * }
 *
 * Field-level confidence and provenance ("geoapify") are attached here so
 * downstream code can trust high-confidence structured data over AI guesses.
 */

/**
 * Map a single Geoapify Places feature into the canonical flat profile shape.
 * Returns null if the feature carries no usable identity.
 *
 * @param {Object} feature - GeoJSON feature from Geoapify /v2/places
 * @returns {Object|null} canonical flat profile (merge-able by BusinessProfile/ResearchService)
 */
export function mapGeoapifyFeatureToProfile(feature) {
  if (!feature || !feature.properties) return null;

  const p = feature.properties;
  const coords = feature.geometry?.coordinates; // Geoapify returns [lng, lat]
  const latitude = typeof coords?.[1] === 'number' ? coords[1] : null;
  const longitude = typeof coords?.[0] === 'number' ? coords[0] : null;

  const name = p.name || p.address_line1 || null;
  if (!name) return null; // no usable identity

  // Category: Geoapify categories = array of hierarchical category strings
  const categories = Array.isArray(p.categories) ? p.categories : [];
  const primaryCategory = categories[0] || null;

  const phone =
    p.international_phone ||
    p.phone ||
    p.contact_phone ||
    null;

  const website = p.website || p.url || null;

  const fullAddress =
    p.formatted ||
    [p.address_line1, p.address_line2].filter(Boolean).join(', ') ||
    null;

  const hours = normalizeHours(p.opening_hours);

  const rating =
    typeof p.rating === 'number' ? p.rating :
    typeof p.rating?.value === 'number' ? p.rating.value : null;
  const reviewCount =
    typeof p.review_count === 'number' ? p.review_count :
    typeof p.reviews === 'number' ? p.reviews :
    typeof p.rating?.number_of_reviews === 'number' ? p.rating.number_of_reviews : null;

  const confidence = {
    overall: rating != null ? 0.9 : 0.85,
    name: name ? 0.98 : 0,
    category: primaryCategory ? 0.9 : 0,
    phone: phone ? 0.95 : 0,
    website: website ? 0.9 : 0,
    address: fullAddress ? 0.95 : 0,
    rating: rating != null ? 0.9 : 0,
  };

  return {
    business: {
      name,
      category: primaryCategory,
      categories,
      description: p.description || null,
      business_type: primaryCategory || null,
    },
    contact: {
      phone,
      email: p.email || null,
      website,
    },
    location: {
      full_address: fullAddress,
      street: p.street || p.address_line1 || null,
      city: p.city || p.district || null,
      state: p.state || p.county || null,
      country: p.country || null,
      postal_code: p.postcode || null,
      latitude,
      longitude,
      coordinates: latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null,
    },
    ratings: {
      rating,
      review_count: reviewCount,
    },
    hours,
    services: categories,
    social_links: Array.isArray(p.social_links) ? p.social_links : [],
    source_urls: [],
    provider: {
      name: 'geoapify',
      placeId: p.place_id || null,
      datasource: p.datasource || null,
    },
    confidence,
  };
}

/**
 * Normalize Geoapify opening_hours (either day->range map or array form)
 * into SiteForge's canonical { monday..sunday } map.
 */
function normalizeHours(openingHours) {
  const out = {};
  if (!openingHours) return out;

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Map form: { monday: "09:00-17:00", ... } (Geoapify uses this)
  if (typeof openingHours === 'object' && !Array.isArray(openingHours)) {
    for (const day of days) {
      const val = openingHours[day];
      if (val) out[day] = typeof val === 'string' ? val : Array.isArray(val) ? val.join(', ') : String(val);
    }
    return out;
  }

  // Array form: [{ day_of_week: 1, start_time, end_time }]
  if (Array.isArray(openingHours)) {
    for (const entry of openingHours) {
      const idx = entry?.day_of_week;
      if (idx == null || idx < 0 || idx > 6) continue;
      const day = days[idx];
      const range = `${entry.start_time || ''}${entry.end_time ? '-' + entry.end_time : ''}`;
      if (range && !out[day]) out[day] = range;
    }
    return out;
  }

  return out;
}

/**
 * Extract deterministic (LEVEL 1) hints from raw input — business name,
 * city/locality, and coordinates that SiteForge already has from a
 * Google Maps URL or user input. These are used to seed Geoapify search.
 *
 * @param {Object} input - { googleMapsUrl?, name?, city?, state?, country?, latitude?, longitude? }
 * @returns {Object} normalized hints { name, city, state, country, latitude, longitude, query }
 */
export function extractDeterministicHints(input = {}) {
  const hints = {
    name: null,
    city: null,
    state: null,
    country: null,
    latitude: null,
    longitude: null,
    query: null,
  };

  const name = input.name || input.businessName || null;
  const city = input.city || input.locality || null;
  const latitude = typeof input.latitude === 'number' ? input.latitude : null;
  const longitude = typeof input.longitude === 'number' ? input.longitude : null;

  // If location object bundled
  if (!latitude && input.location?.coordinates?.lat != null) {
    hints.latitude = input.location.coordinates.lat;
  }
  if (!longitude && input.location?.coordinates?.lng != null) {
    hints.longitude = input.location.coordinates.lng;
  }
  if (!city && input.location?.city) hints.city = input.location.city;
  if (!hints.state && input.location?.state) hints.state = input.location.state;
  if (!hints.country && input.location?.country) hints.country = input.location.country;

  hints.name = name;
  hints.city = city;
  hints.latitude = hints.latitude ?? latitude;
  hints.longitude = hints.longitude ?? longitude;

  const parts = [name, city].filter(Boolean);
  hints.query = parts.join(' ') || null;

  return hints;
}

export default {
  mapGeoapifyFeatureToProfile,
  extractDeterministicHints,
};
