/**
 * BusinessProfile
 * 
 * Central data structure for business information with strict provenance tracking.
 * 
 * Provenance categories (from most to least reliable):
 * - VERIFIED: Information supported by an authoritative source (official website, government registry)
 * - DISCOVERED: Information found from public web sources (official website extraction, public pages)
 * - IDENTIFIED: Business name / coordinates / URL hints extracted from input identifiers (Google Maps URL)
 * - INFERRED: AI-derived assumptions (NEVER enters factual BusinessProfile)
 * 
 * CRITICAL: Only IDENTIFIED/DISCOVERED/VERIFIED factual information may enter the factual BusinessProfile.
 * INFERRED information must never be presented as verified business data.
 */

class BusinessProfile {
  constructor() {
    this.data = {
      identity: {
        name: { value: null, provenance: null, confidence: 0 },
        category: { value: null, provenance: null, confidence: 0 },
        business_type: { value: null, provenance: null, confidence: 0 },
        description: { value: null, provenance: null, confidence: 0 },
        categories: { value: [], provenance: null, confidence: 0 },
      },
      contact: {
        phone: { value: null, provenance: null, confidence: 0 },
        email: { value: null, provenance: null, confidence: 0 },
        website: { value: null, provenance: null, confidence: 0 },
      },
      location: {
        full_address: { value: null, provenance: null, confidence: 0 },
        street: { value: null, provenance: null, confidence: 0 },
        city: { value: null, provenance: null, confidence: 0 },
        state: { value: null, provenance: null, confidence: 0 },
        country: { value: null, provenance: null, confidence: 0 },
        postal_code: { value: null, provenance: null, confidence: 0 },
        coordinates: { value: null, provenance: null, confidence: 0 },
      },
      ratings: {
        rating: { value: null, provenance: null, confidence: 0 },
        review_count: { value: null, provenance: null, confidence: 0 },
      },
      hours: { value: {}, provenance: null, confidence: 0 },
      social_links: { value: [], provenance: null, confidence: 0 },
      metadata: {
        sources: [],
        extractionHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  set(path, value, provenance, confidence, sourceInfo = {}) {
    const validProvenances = ['identified', 'discovered', 'verified', 'user_provided', 'inferred'];
    if (!validProvenances.includes(provenance)) {
      throw new Error(`Invalid provenance: ${provenance}. Must be one of: ${validProvenances.join(', ')}`);
    }
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    const parts = path.split('.');
    let target = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]];
      if (!target) throw new Error(`Invalid path: ${path}`);
    }
    
    const field = parts[parts.length - 1];
    const current = target[field];
    
    const provenancePriority = { verified: 4, discovered: 3, user_provided: 3, identified: 2, inferred: 1 };
    const currentPriority = current?.provenance ? provenancePriority[current.provenance] : 0;
    const newPriority = provenancePriority[provenance];
    
    if (newPriority > currentPriority || (newPriority === currentPriority && confidence > (current?.confidence || 0))) {
      target[field] = {
        value,
        provenance,
        confidence,
        sourceInfo,
        updatedAt: new Date().toISOString(),
      };
      
      if (sourceInfo.sourceUrl && !this.data.metadata.sources.includes(sourceInfo.sourceUrl)) {
        this.data.metadata.sources.push(sourceInfo.sourceUrl);
      }
      
      this.data.metadata.extractionHistory.push({
        field: path,
        value,
        provenance,
        confidence,
        sourceInfo,
        timestamp: new Date().toISOString(),
      });
      
      this.data.metadata.updatedAt = new Date().toISOString();
    }
  }

  get(path) {
    const parts = path.split('.');
    let target = this.data;
    for (const part of parts) {
      target = target?.[part];
      if (!target) return null;
    }
    return target.value;
  }

  getField(path) {
    const parts = path.split('.');
    let target = this.data;
    for (const part of parts) {
      target = target?.[part];
      if (!target) return null;
    }
    return target;
  }

  merge(sourceData, provenance, defaultConfidence = 0.7) {
    if (!sourceData || typeof sourceData !== 'object') return;

    if (sourceData.business) {
      if (sourceData.business.name) this.set('identity.name', sourceData.business.name, provenance, sourceData.business.nameConfidence || defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.business.category) this.set('identity.category', sourceData.business.category, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.business.business_type) this.set('identity.business_type', sourceData.business.business_type, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.business.description) this.set('identity.description', sourceData.business.description, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.business.categories) this.set('identity.categories', sourceData.business.categories, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
    }

    if (sourceData.contact) {
      if (sourceData.contact.phone) this.set('contact.phone', sourceData.contact.phone, provenance, sourceData.contact.phoneConfidence || defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.contact.email) this.set('contact.email', sourceData.contact.email, provenance, sourceData.contact.emailConfidence || defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.contact.website) this.set('contact.website', sourceData.contact.website, provenance, sourceData.contact.websiteConfidence || defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
    }

    if (sourceData.location) {
      if (sourceData.location.full_address) this.set('location.full_address', sourceData.location.full_address, provenance, sourceData.location.addressConfidence || defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.location.street) this.set('location.street', sourceData.location.street, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.location.city) this.set('location.city', sourceData.location.city, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.location.state) this.set('location.state', sourceData.location.state, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.location.country) this.set('location.country', sourceData.location.country, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.location.postal_code) this.set('location.postal_code', sourceData.location.postal_code, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.location.coordinates) this.set('location.coordinates', sourceData.location.coordinates, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
    }

    if (sourceData.ratings) {
      if (sourceData.ratings.rating) this.set('ratings.rating', sourceData.ratings.rating, provenance, sourceData.ratings.ratingConfidence || defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
      if (sourceData.ratings.review_count) this.set('ratings.review_count', sourceData.ratings.review_count, provenance, sourceData.ratings.reviewCountConfidence || defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
    }

    if (sourceData.hours) {
      this.set('hours', sourceData.hours, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
    }

    if (sourceData.social_links) {
      this.set('social_links', sourceData.social_links, provenance, defaultConfidence, { sourceUrl: sourceData.metadata?.sourceUrl });
    }
  }

  toObject() {
    const result = {};
    
    const extractValues = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && 'value' in value) {
          result[path] = value.value;
        } else if (typeof value === 'object' && value !== null) {
          extractValues(value, path);
        }
      }
    };
    
    extractValues(this.data);
    return result;
  }

  toFullObject() {
    return { ...this.data };
  }

  getCompleteness() {
    const fields = [
      'identity.name', 'identity.category', 'identity.description',
      'contact.phone', 'contact.email', 'contact.website',
      'location.full_address', 'location.city', 'location.country',
    ];
    
    let filled = 0;
    for (const field of fields) {
      if (this.get(field)) filled++;
    }
    
    return filled / fields.length;
  }

  getProvenanceBreakdown() {
    const breakdown = { verified: 0, discovered: 0, identified: 0, user_provided: 0, inferred: 0 };
    
    const countProvenance = (obj) => {
      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object' && 'provenance' in value) {
          if (value.provenance) breakdown[value.provenance]++;
        } else if (typeof value === 'object' && value !== null) {
          countProvenance(value);
        }
      }
    };
    
    countProvenance(this.data);
    return breakdown;
  }
}

export default BusinessProfile;