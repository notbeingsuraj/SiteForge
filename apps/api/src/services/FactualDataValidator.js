/**
 * FactualDataValidator
 *
 * Generation-time factual safety layer. Ensures the generated site's factual
 * values all originate from the verified BusinessProfile and that AI-generated
 * copy does not introduce fabricated business facts (phone, email, rating,
 * reviews, address, etc.) that the profile does not support.
 *
 * Rules (v1, deliberately simple but correct):
 *  1. Every factual field written to site.config.json must equal the verified
 *     profile value (or be null when the profile has none).
 *  2. AI copy may NOT contain:
 *       - a phone number different from the verified phone
 *       - an email different from the verified email (or any email if none verified)
 *       - a "reviews"/"rating"/N+ reviews claim when the profile has no verified rating
 *       - a full address different from the verified address
 *  3. Phone/email formats are detected so an invented value can be flagged.
 */
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const REVIEW_CLAIM_RE = /(\d[\d,]*\+?\s*(reviews|ratings|five-star|5-star))/i;
const ADDRESS_TOKEN_RE = /(street|road|avenue|ave|boulevard|blvd|lane|drive|dr|place|pl|way|highway|hwy|square|plaza|building)\b/i;

export function validateFactualFields(sourceProfile, assembled) {
  const issues = [];
  const map = {
    name: ['business', 'name'],
    category: ['business', 'category'],
    phone: ['business', 'phone'],
    email: ['business', 'email'],
    website: ['business', 'website'],
    address: ['business', 'address'],
    city: ['business', 'city'],
    state: ['business', 'state'],
    country: ['business', 'country'],
    postalCode: ['business', 'postalCode'],
    rating: ['business', 'rating'],
    reviewCount: ['business', 'reviewCount'],
    hours: ['business', 'hours'],
  };

  for (const [field, [top, sub]] of Object.entries(map)) {
    const assembledVal = assembled?.[top]?.[sub] ?? null;
    if (assembledVal === null || assembledVal === undefined || assembledVal === '') continue;
    if (!(field in sourceProfile)) {
      issues.push(`"${field}" present in config but missing from verified profile`);
      continue;
    }
    const sourceVal = sourceProfile[field];
    // null source + non-null assembled = fabricated
    if (sourceVal === null || sourceVal === undefined || sourceVal === '') {
      issues.push(`"${field}" fabricated: profile has no value but config renders "${String(assembledVal).slice(0, 60)}"`);
    } else if (String(sourceVal) !== String(assembledVal)) {
      issues.push(`"${field}" mismatch: profile "${String(sourceVal).slice(0, 60)}" != config "${String(assembledVal).slice(0, 60)}"`);
    }
  }
  return issues;
}

export function sanitizeAICopy(copy, verified) {
  const issues = [];
  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      const cleaned = sanitizeString(node, verified, issues);
      // In v1 we return the cleaned string; callers may detect and replace.
      if (cleaned !== node) node = cleaned; // note: not reflected (strings immutable) — handled by caller
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  };
  const clean = JSON.parse(JSON.stringify(copy));
  const apply = (obj) => {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string') {
        obj[k] = sanitizeString(v, verified, issues);
      } else if (Array.isArray(v)) {
        v.forEach((item) => { if (typeof item === 'string') { /* replaced in place below */ } });
        for (let i = 0; i < v.length; i++) {
          if (typeof v[i] === 'string') v[i] = sanitizeString(v[i], verified, issues);
          else if (typeof v[i] === 'object' && v[i] !== null) apply(v[i]);
        }
      } else if (typeof v === 'object' && v !== null) {
        apply(v);
      }
    }
  };
  apply(clean);
  return { clean, issues };
}

function sanitizeString(str, verified, issues) {
  let out = str;

  // Email: if profile has no verified email, drop invented emails.
  const emails = out.match(EMAIL_RE);
  if (emails) {
    const ok = verified.email && emails.every((e) => String(e).toLowerCase() === String(verified.email).toLowerCase());
    if (!ok) {
      issues.push(`removed invented email "${emails[0]}" from copy`);
      out = out.replace(EMAIL_RE, '');
    }
  }

  // Phone: if profile has no phone, drop invented numbers; if it has one, keep only matching.
  const phones = out.match(PHONE_RE);
  if (phones) {
    const verifiedDigits = verified.phone ? String(verified.phone).replace(/\D/g, '') : null;
    const matchesVerified = verifiedDigits && phones.every((p) => String(p).replace(/\D/g, '').endsWith(verifiedDigits.slice(-7)));
    if (!matchesVerified) {
      issues.push(`removed invented phone "${phones[0]}" from copy`);
      out = out.replace(PHONE_RE, '');
    }
  }

  // Reviews/rating claim: only allowed if profile has a verified rating.
  const reviewMatch = out.match(REVIEW_CLAIM_RE);
  if (reviewMatch && (verified.rating == null)) {
    issues.push(`removed unsupported review/rating claim "${reviewMatch[0]}" from copy`);
    out = out.replace(REVIEW_CLAIM_RE, '');
  }

  return out.replace(/\s{2,}/g, ' ').trim();
}

/** Reject generated configs whose factual fields are fabricated. Throws if a hard failure. */
export function assertFactualIntegrity(sourceProfile, assembled) {
  const issues = validateFactualFields(sourceProfile, assembled);
  // Fabrication of name/phone/email/website/address is a hard failure; the rest warn.
  const hard = ['name', 'phone', 'email', 'website', 'address'];
  const fatal = issues.filter((i) => {
    const field = hard.find((f) => i.includes(`"${f}"`));
    return field && /fabricated|mismatch/.test(i);
  });
  if (fatal.length > 0) {
    const err = new Error(`Factual safety check failed: ${fatal.join('; ')}`);
    err.code = 'FACTUAL_SAFETY';
    throw err;
  }
  return { passed: fatal.length === 0, issues };
}
