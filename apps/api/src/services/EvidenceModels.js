/**
 * Evidence Model
 * 
 * Represents a piece of supporting material extracted from a source.
 * Each piece of evidence links to a source and supports specific claims.
 */
export class Evidence {
  constructor({
    id,
    sourceId,
    fieldPath,
    value,
    excerpt = null,
    location = null,
    extractedAt = new Date().toISOString(),
    extractionMethod = 'unknown',
    metadata = {}
  } = {}) {
    this.id = id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.sourceId = sourceId;
    this.fieldPath = fieldPath;
    this.value = value;
    this.excerpt = excerpt;
    this.location = location; // e.g., { xpath, cssSelector, lineNumber, charOffset }
    this.extractedAt = extractedAt;
    this.extractionMethod = extractionMethod; // 'schema.org', 'microdata', 'openGraph', 'visibleText', 'aiExtraction', 'apiResponse'
    this.metadata = metadata; // Additional context (e.g., HTML context, nearby text)
  }

  toObject() {
    return {
      id: this.id,
      sourceId: this.sourceId,
      fieldPath: this.fieldPath,
      value: this.value,
      excerpt: this.excerpt,
      location: this.location,
      extractedAt: this.extractedAt,
      extractionMethod: this.extractionMethod,
      metadata: this.metadata
    };
  }
}

/**
 * Source Model
 * Represents the origin of information.
 */
export class Source {
  constructor({
    id,
    url,
    domain = null,
    provider = null,
    sourceType = 'other',
    authority = 0.5,
    isPrimary = false,
    retrievedAt = new Date().toISOString(),
    publishedAt = null,
    updatedAt = null,
    metadata = {}
  } = {}) {
    this.id = id || `src_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.url = url;
    this.domain = domain || (url ? new URL(url).hostname : null);
    this.provider = provider;
    this.sourceType = sourceType; // 'official_website', 'structured_provider', 'search_result', 'directory', 'review_platform', 'news', 'social', 'user_provided', 'ai_inference', 'other'
    this.authority = Math.max(0, Math.min(1, authority)); // 0-1
    this.isPrimary = isPrimary; // Whether this is a primary/authoritative source
    this.retrievedAt = retrievedAt;
    this.publishedAt = publishedAt;
    this.updatedAt = updatedAt;
    this.metadata = metadata;
  }

  toObject() {
    return {
      id: this.id,
      url: this.url,
      domain: this.domain,
      provider: this.provider,
      sourceType: this.sourceType,
      authority: this.authority,
      isPrimary: this.isPrimary,
      retrievedAt: this.retrievedAt,
      publishedAt: this.publishedAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }
}

/**
 * Claim Model
 * Represents a statement about the business with supporting evidence.
 */
export class Claim {
  constructor({
    id,
    entityId,
    fieldPath,
    value,
    normalizedValue = null,
    claimType = 'fact', // 'fact', 'observation', 'inference'
    sources = [],
    evidence = [],
    confidence = 0.5,
    verificationStatus = 'unverified', // 'verified', 'supported', 'unverified', 'conflicted', 'refuted'
    temporalMetadata = {},
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  } = {}) {
    this.id = id || `clm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.entityId = entityId;
    this.fieldPath = fieldPath;
    this.value = value;
    this.normalizedValue = normalizedValue;
    this.claimType = claimType; // 'fact', 'observation', 'inference'
    this.sources = sources; // Array of { sourceId, provider, confidence, isPrimary }
    this.evidence = evidence; // Array of evidence IDs
    this.confidence = Math.max(0, Math.min(1, confidence));
    this.verificationStatus = verificationStatus;
    this.temporalMetadata = {
      retrievedAt: temporalMetadata.retrievedAt || new Date().toISOString(),
      publishedAt: temporalMetadata.publishedAt || null,
      observedAt: temporalMetadata.observedAt || null,
      lastVerifiedAt: temporalMetadata.lastVerifiedAt || null
    };
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Check if this claim conflicts with another claim on the same field
   */
  conflictsWith(other) {
    return this.fieldPath === other.fieldPath && 
           this.normalizedValue !== other.normalizedValue &&
           this.value !== other.value;
  }

  toObject() {
    return {
      id: this.id,
      entityId: this.entityId,
      fieldPath: this.fieldPath,
      value: this.value,
      normalizedValue: this.normalizedValue,
      claimType: this.claimType,
      sources: this.sources,
      evidence: this.evidence,
      confidence: this.confidence,
      verificationStatus: this.verificationStatus,
      temporalMetadata: this.temporalMetadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Conflict Model
 * Represents a disagreement between multiple claims on the same field.
 */
export class Conflict {
  constructor({
    id,
    fieldPath,
    values = [],
    status = 'conflicted', // 'conflicted', 'resolved', 'dismissed'
    resolutionStrategy = null,
    resolutionReason = null,
    resolvedAt = null,
    resolvedBy = null
  } = {}) {
    this.id = id || `conf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.fieldPath = fieldPath;
    this.values = values; // Array of { value, source, provider, provenance, confidence, sourceId, claimId }
    this.status = status; // 'conflicted', 'resolved', 'dismissed'
    this.resolutionStrategy = resolutionStrategy; // 'authority_wins', 'most_recent', 'highest_confidence', 'manual_review', 'preserve_all'
    this.resolutionReason = resolutionReason;
    this.resolvedAt = resolvedAt;
    this.resolvedBy = resolvedBy;
  }

  /**
   * Get the canonical (winning) value based on resolution strategy
   */
  getCanonicalValue() {
    if (this.status !== 'resolved' || this.values.length === 0) {
      return this.values[0]?.value || null;
    }

    switch (this.resolutionStrategy) {
      case 'authority_wins':
        return this.values.reduce((best, curr) => 
          (curr.authority || 0) > (best.authority || 0) ? curr : best
        ).value;
      case 'most_recent':
        return this.values.reduce((best, curr) => 
          new Date(curr.retrievedAt || 0) > new Date(best.retrievedAt || 0) ? curr : best
        ).value;
      case 'highest_confidence':
        return this.values.reduce((best, curr) => 
          (curr.confidence || 0) > (best.confidence || 0) ? curr : best
        ).value;
      case 'preserve_all':
      default:
        return this.values[0]?.value || null;
    }
  }

  toObject() {
    return {
      id: this.id,
      fieldPath: this.fieldPath,
      values: this.values,
      status: this.status,
      resolutionStrategy: this.resolutionStrategy,
      resolutionReason: this.resolutionReason,
      resolvedAt: this.resolvedAt,
      resolvedBy: this.resolvedBy
    };
  }
}

/**
 * Source Independence Analyzer
 * Helps determine if multiple sources are independent or copies
 */
export class SourceIndependenceAnalyzer {
  /**
   * Analyze a set of sources for independence
   */
  static analyze(sources) {
    const byDomain = {};
    for (const src of sources) {
      const domain = src.domain || (src.url ? new URL(src.url).hostname : 'unknown');
      if (!byDomain[domain]) byDomain[domain] = [];
      byDomain[domain].push(src);
    }

    const domains = Object.keys(byDomain);
    const primaryCount = sources.filter(s => s.isPrimary).length;
    const uniqueDomains = domains.length;
    const totalSources = sources.length;

    return {
      totalSources,
      uniqueDomains,
      primarySources: primaryCount,
      domainDistribution: Object.fromEntries(
        Object.entries(byDomain).map(([domain, srcs]) => [domain, srcs.length])
      ),
      independenceScore: uniqueDomains > 0 ? Math.min(1, primaryCount / Math.max(1, totalSources)) : 0,
      isLikelyCopied: totalSources > 1 && uniqueDomains === 1,
      likelyPrimarySource: sources.find(s => s.isPrimary) || sources[0]
    };
  }

  /**
   * Detect if one source likely copies from another
   * Returns pairs of [likelyOriginal, likelyCopy]
   */
  static detectCopyPairs(sources) {
    const pairs = [];
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const a = sources[i];
        const b = sources[j];
        
        // Check for same domain (likely same system)
        const domainA = a.domain || (a.url ? new URL(a.url).hostname : '');
        const domainB = b.domain || (b.url ? new URL(b.url).hostname : '');
        
        // Check if one is likely aggregator of the other
        if (a.provider === 'directory' && b.provider === 'structured_provider') {
          pairs.push({ original: b, copy: a, reason: 'directory_copies_structured' });
        } else if (b.provider === 'directory' && a.provider === 'structured_provider') {
          pairs.push({ original: a, copy: b, reason: 'directory_copies_structured' });
        } else if (a.provider === 'directory' && b.provider === 'directory' && domainA !== domainB) {
          pairs.push({ original: a, copy: b, reason: 'directory_copies_directory' });
        }
      }
    }
    return pairs;
  }
}

export default {
  Evidence,
  Source,
  Claim,
  Conflict,
  SourceIndependenceAnalyzer
};