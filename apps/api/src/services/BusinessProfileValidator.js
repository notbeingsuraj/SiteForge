/**
 * BusinessProfileValidator
 *
 * Lightweight, non-restructuring validation of the final canonical business
 * profile before it is handed to Website Strategy / Website Generation.
 *
 * It checks the most important factual fields and returns a normalized result
 * plus a list of validation issues. It does NOT mutate or restructure the
 * profile, and it does not introduce a schema framework.
 *
 * Validated:
 *  - name: non-empty string
 *  - category: string when present
 *  - phone: reasonable phone shape (digits/min length) when present
 *  - website: valid absolute http(s) URL when present
 *  - address: address-like (not a stray AI paragraph) when present
 *  - coordinates: valid lat (-90..90) / lng (-180..180)
 *  - rating: numeric within 0..5
 *  - reviewCount: non-negative number
 */

const PHONE_STRIP = /[^0-9+]/g;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidLat(v) {
  return typeof v === 'number' && !Number.isNaN(v) && v >= -90 && v <= 90;
}

function isValidLng(v) {
  return typeof v === 'number' && !Number.isNaN(v) && v >= -180 && v <= 180;
}

function looksLikeAddress(v) {
  if (!isNonEmptyString(v)) return false;
  const s = v.trim();
  // Heuristic: an address-like string should not be a long prose paragraph.
  if (s.length > 300) return false;
  // Should contain at least one of: digits, a street/common token, comma structure.
  return /\d/.test(s) || /street|road|ave|avenue|blvd|boulevard|rd|ln|lane|dr|drive|cir|pl|place|way|unit|suite|floor|hwy|highway|north|south|east|west|#/i.test(s);
}

function isValidPhone(v) {
  if (typeof v !== 'string' || v.trim().length === 0) return false;
  // Strip non-numeric; require a reasonable digit count for a phone number.
  const digits = v.replace(PHONE_STRIP, '');
  return digits.length >= 7 && digits.length <= 15;
}

function isValidWebsite(v) {
  if (typeof v !== 'string' || v.trim().length === 0) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate a canonical business-profile-shaped object.
 *
 * Accepts both the "flat" canonical shape (business/contact/location/ratings)
 * used throughout SiteForge AND the BusinessProfile.toObject() shape
 * (identity.name, contact.phone, location.full_address, ratings.rating, ...).
 *
 * @param {Object} profile
 * @returns {{ valid: boolean, normalized: Object, issues: Array<{field, message}> }}
 */
export function validateBusinessProfile(profile) {
  const issues = [];
  const profileObj = profile && typeof profile === 'object' ? profile : {};

  // Support canonical shapes (tolerant read). SiteForge has several:
  //   - flat canonical shape: business.name / contact.phone / location.full_address
  //   - nested BusinessProfile.data shape: identity.name.{value,..}
  //   - flattened dotted-path shape (BusinessProfile.toObject):
  //       "identity.name", "contact.phone", "location.coordinates"={lat,lng}, "ratings.rating"
  const flat = (path) => profileObj[path];
  const nested = (group, field) => profileObj?.[group]?.[field];
  const nestedVal = (group, field) => {
    const v = nested(group, field);
    return v && typeof v === 'object' && 'value' in v ? v.value : v;
  };

  const name = flat('identity.name') ?? nestedVal('identity', 'name') ?? nestedVal('business', 'name') ?? null;
  const category = flat('identity.category') ?? nestedVal('identity', 'category') ?? nestedVal('business', 'category') ?? null;
  const phone = flat('contact.phone') ?? nestedVal('contact', 'phone') ?? null;
  const website = flat('contact.website') ?? nestedVal('contact', 'website') ?? null;
  const address = flat('location.full_address') ?? flat('location.address') ?? nestedVal('location', 'full_address') ?? nestedVal('location', 'address') ?? null;

  // Coordinates: flat "location.coordinates"={lat,lng} OR nested location.coordinates OR lat/lng fields
  const flatCoords = flat('location.coordinates');
  const nestedCoords = nestedVal('location', 'coordinates');
  const locCoords = flatCoords ?? nestedCoords ?? null;
  const latitude = locCoords?.lat ?? flat('location.latitude') ?? nestedVal('location', 'latitude') ?? null;
  const longitude = locCoords?.lng ?? flat('location.longitude') ?? nestedVal('location', 'longitude') ?? null;

  const rating = flat('ratings.rating') ?? nestedVal('ratings', 'rating') ?? flat('rating') ?? null;
  const reviewCount = flat('ratings.review_count') ?? nestedVal('ratings', 'review_count') ?? flat('reviewCount') ?? null;

  if (!isNonEmptyString(name)) {
    issues.push({ field: 'name', message: 'Business name is missing or empty.' });
  }

  if (category != null && !isNonEmptyString(category)) {
    issues.push({ field: 'category', message: 'Category is invalid.' });
  }

  if (phone != null && !isValidPhone(phone)) {
    issues.push({ field: 'phone', message: 'Phone number does not match a reasonable format.' });
  }

  if (website != null && !isValidWebsite(website)) {
    issues.push({ field: 'website', message: 'Website is not a valid http(s) URL.' });
  }

  if (address != null && !looksLikeAddress(address)) {
    issues.push({ field: 'address', message: 'Address does not look like an actual address.' });
  }

  if (latitude != null && !isValidLat(latitude)) {
    issues.push({ field: 'latitude', message: 'Latitude is out of valid range (-90..90).' });
  }
  if (longitude != null && !isValidLng(longitude)) {
    issues.push({ field: 'longitude', message: 'Longitude is out of valid range (-180..180).' });
  }

  if (rating != null) {
    const r = Number(rating);
    if (Number.isNaN(r) || r < 0 || r > 5) {
      issues.push({ field: 'rating', message: 'Rating must be numeric within 0..5.' });
    }
  }

  if (reviewCount != null) {
    const rc = Number(reviewCount);
    if (Number.isNaN(rc) || rc < 0) {
      issues.push({ field: 'review_count', message: 'Review count must be a non-negative number.' });
    }
  }

  return {
    valid: issues.length === 0,
    normalized: profileObj,
    issues,
  };
}

/**
 * Sanitize a raw free-text value so it can be used safely in a business
 * profile field (basic string cleaning). Used for AI-normalized fields.
 */
export function sanitizeFieldValue(value) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/\s+/g, ' ');
}

export default validateBusinessProfile;
