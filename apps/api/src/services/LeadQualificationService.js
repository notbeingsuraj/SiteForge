import AIService from './AIService.js';
import { buildLeadQualificationPrompt } from '../prompts/leadQualification.js';

class LeadQualificationService {
  async calculateOpportunityScore(businessData, digitalAudit, brandDNA, options = {}) {
    try {
      const startTime = Date.now();
      if (!businessData || !digitalAudit || !brandDNA) {
        throw new Error('Business data, digital audit, and brand DNA are required');
      }
      const prompt = buildLeadQualificationPrompt(businessData, digitalAudit, brandDNA);
      const qualification = await AIService.generate({
        prompt,
        model: 'reasoning',
        schema: true,
        temperature: 0.4,
        maxTokens: 5000,
      });
      const latency = Date.now() - startTime;
      this.validateQualification(qualification);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'lead-qualification-v1',
        tokens: null,
        latency,
        error: null,
      });
      return { ...qualification, metadata: { calculatedAt: new Date().toISOString(), version: 'v1', latency } };
    } catch (error) {
      console.error('Lead qualification error:', error);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'lead-qualification-v1',
        tokens: null,
        latency: null,
        error: error.message,
      });
      throw new Error(`Failed to calculate opportunity score: ${error.message}`);
    }
  }

  validateQualification(qualification) {
    if (typeof qualification.score !== 'number' || qualification.score < 0 || qualification.score > 100) {
      throw new Error('Invalid score: must be 0-100');
    }
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
    if (!validPriorities.includes(qualification.priority)) {
      throw new Error(`Invalid priority: must be one of ${validPriorities.join(', ')}`);
    }
    if (!qualification.breakdown) throw new Error('Missing breakdown');
    if (!Array.isArray(qualification.reasons) || qualification.reasons.length === 0) throw new Error('Missing or empty reasons array');
    if (!qualification.salesAngle || typeof qualification.salesAngle !== 'string') throw new Error('Missing sales angle');
    if (!qualification.recommendedApproach) throw new Error('Missing recommended approach');
    return true;
  }

  extractSummary(qualification) {
    return {
      score: qualification.score,
      priority: qualification.priority,
      topReasons: qualification.reasons.slice(0, 3),
      salesAngle: qualification.salesAngle,
      approach: qualification.recommendedApproach,
      closeRate: qualification.estimatedCloseRate,
      packageSuggestion: qualification.estimatedValue?.packageSuggestion,
    };
  }

  calculateFallbackScore(digitalAudit, brandDNA, businessData) {
    let score = 0;
    if (!digitalAudit.websiteExists) {
      score += 30;
    } else {
      const quality = digitalAudit.overallScore;
      if (quality <= 3) score += 25;
      else if (quality <= 5) score += 18;
      else if (quality <= 7) score += 10;
      else if (quality <= 9) score += 5;
    }
    const mobileScore = digitalAudit.categories?.mobile?.score || 0;
    if (mobileScore === 0) score += 15;
    else if (mobileScore <= 4) score += 12;
    else if (mobileScore <= 6) score += 8;
    else if (mobileScore <= 8) score += 4;
    const ctaScore = digitalAudit.categories?.conversion?.score || 0;
    if (ctaScore === 0) score += 12;
    else if (ctaScore <= 4) score += 10;
    else if (ctaScore <= 6) score += 6;
    else if (ctaScore <= 8) score += 3;
    const seoScore = digitalAudit.categories?.seo?.score || 0;
    if (seoScore === 0) score += 10;
    else if (seoScore <= 3) score += 8;
    else if (seoScore <= 5) score += 6;
    else if (seoScore <= 7) score += 4;
    const brandingScore = digitalAudit.categories?.branding?.score || 0;
    if (brandingScore === 0) score += 8;
    else if (brandingScore <= 4) score += 6;
    else if (brandingScore <= 6) score += 4;
    else if (brandingScore <= 8) score += 2;
    const highValueCategories = ['legal', 'medical', 'real_estate', 'finance', 'dental', 'attorney'];
    const category = businessData.identity?.category?.toLowerCase() || '';
    const isHighValue = highValueCategories.some(hv => category.includes(hv));
    if (isHighValue) score += 15;
    else if (businessData.identity?.category) score += 10;
    const reviewCount = businessData.trustSignals?.find(t => t.type === 'review_count')?.value || 0;
    if (reviewCount > 100) score += 5;
    else if (reviewCount > 50) score += 3;
    else if (reviewCount > 20) score += 2;
    const urgentCategories = ['emergency', 'plumber', 'locksmith', 'towing', 'urgent_care'];
    const isUrgent = urgentCategories.some(uc => category.includes(uc));
    if (isUrgent) score += 5;
    else score += 3;
    score += 3;
    const finalScore = Math.min(Math.round(score), 100);
    let priority = 'LOW';
    if (finalScore >= 81) priority = 'VERY_HIGH';
    else if (finalScore >= 61) priority = 'HIGH';
    else if (finalScore >= 41) priority = 'MEDIUM';
    return {
      score: finalScore,
      priority,
      breakdown: {
        websiteAbsence: !digitalAudit.websiteExists ? 30 : Math.max(0, 30 - digitalAudit.overallScore * 3),
        mobileGap: Math.max(0, 15 - Math.round(mobileScore * 1.5)),
        ctaWeakness: Math.max(0, 12 - Math.round(ctaScore * 1.2)),
        seoWeakness: Math.max(0, 10 - seoScore),
        brandingGap: Math.max(0, 8 - Math.round(brandingScore * 0.8)),
        commercialValue: isHighValue ? 15 : 10,
        purchaseIntent: isUrgent ? 5 : 3,
        competitiveOpportunity: 3,
      },
      reasons: [
        !digitalAudit.websiteExists ? 'No website exists' : 'Website quality issues detected',
        `${reviewCount} reviews indicate established business`,
        isHighValue ? 'High-value service category' : 'Standard service category',
      ],
      salesAngle: 'Your business deserves a digital presence that matches your reputation.',
      recommendedApproach: 'email_with_preview',
      estimatedCloseRate: finalScore >= 70 ? 40 : finalScore >= 50 ? 25 : 15,
      metadata: { calculatedAt: new Date().toISOString(), version: 'v1-fallback', method: 'algorithmic' },
    };
  }

  shouldPrioritize(qualification) {
    return qualification.priority === 'VERY_HIGH' || qualification.priority === 'HIGH';
  }

  getFollowUpTimeline(qualification) {
    switch (qualification.priority) {
      case 'VERY_HIGH': return { days: 0, urgency: 'Contact immediately' };
      case 'HIGH': return { days: 1, urgency: 'Contact within 24 hours' };
      case 'MEDIUM': return { days: 3, urgency: 'Contact within 3 days' };
      case 'LOW': return { days: 7, urgency: 'Contact within a week if needed' };
      default: return { days: 7, urgency: 'Standard timeline' };
    }
  }
}

export default new LeadQualificationService();
