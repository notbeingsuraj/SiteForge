import AIService from './AIService.js';
import { buildLandingPageSpecPrompt } from '../prompts/landingPageSpec.js';

class LandingPageSpecService {
  async generateSpec(brandDNA, websiteStrategy, digitalAudit, options = {}) {
    try {
      const startTime = Date.now();
      if (!brandDNA || !websiteStrategy || !digitalAudit) {
        throw new Error('Brand DNA, website strategy, and digital audit are required');
      }
      const prompt = buildLandingPageSpecPrompt(brandDNA, websiteStrategy, digitalAudit);
      const spec = await AIService.generate({
        prompt,
        model: 'reasoning',
        schema: true,
        temperature: 0.5,
        maxTokens: 8000,
      });
      const latency = Date.now() - startTime;
      this.validateSpec(spec);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'landing-page-spec-v1',
        tokens: null,
        latency,
        error: null,
      });
      return { ...spec, metadata: { ...spec.metadata, generatedAt: new Date().toISOString(), version: 'v1', latency } };
    } catch (error) {
      console.error('Landing page spec generation error:', error);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'landing-page-spec-v1',
        tokens: null,
        latency: null,
        error: error.message,
      });
      throw new Error(`Failed to generate landing page spec: ${error.message}`);
    }
  }

  validateSpec(spec) {
    const required = ['pageTitle', 'pageDescription', 'primaryCTA', 'sections', 'theme', 'metadata'];
    for (const field of required) {
      if (!spec[field]) throw new Error(`Missing required field: ${field}`);
    }
    if (!Array.isArray(spec.sections) || spec.sections.length === 0) throw new Error('Sections must be a non-empty array');
    const sectionTypes = spec.sections.map(s => s.type);
    const criticalSections = ['navigation', 'hero', 'trustIndicators', 'cta', 'footer'];
    for (const critical of criticalSections) {
      if (!sectionTypes.includes(critical)) throw new Error(`Missing critical section: ${critical}`);
    }
    if (!spec.primaryCTA.text || !spec.primaryCTA.action) throw new Error('Invalid primary CTA');
    return true;
  }

  extractSummary(spec) {
    return {
      title: spec.pageTitle,
      primaryCTA: spec.primaryCTA.text,
      sectionCount: spec.sections.length,
      sections: spec.sections.map(s => s.type),
      theme: spec.theme.style,
      conversionGoal: spec.metadata.conversionGoal,
    };
  }

  getSectionByType(spec, type) {
    return spec.sections.find(s => s.type === type) || null;
  }

  getAllCTAs(spec) {
    const ctas = [];
    ctas.push({ location: 'primary', ...spec.primaryCTA });
    spec.sections.forEach(section => {
      if (section.cta) ctas.push({ location: section.type, ...section.cta });
      if (section.type === 'hero' && section.content.cta) {
        if (section.content.cta.primary) ctas.push({ location: 'hero-primary', ...section.content.cta.primary });
        if (section.content.cta.secondary) ctas.push({ location: 'hero-secondary', ...section.content.cta.secondary });
      }
    });
    return ctas;
  }

  getVerifiedTrustElements(spec) {
    const trustSection = this.getSectionByType(spec, 'trustIndicators');
    if (!trustSection || !trustSection.content.elements) return [];
    return trustSection.content.elements.filter(el => el.verified);
  }

  hasSectionData(spec, sectionType) {
    const section = this.getSectionByType(spec, sectionType);
    if (!section) return false;
    if (sectionType === 'testimonials') {
      return section.content.testimonials && section.content.testimonials.length > 0 && section.content.testimonials.every(t => t.verified);
    }
    if (sectionType === 'gallery') {
      return section.content.images && section.content.images.length > 0;
    }
    return true;
  }

  getMobileSections(spec) {
    return spec.sections.filter(s => s.visibility === 'always' || s.visibility === 'mobile');
  }

  getCriticalSections(spec) {
    return spec.sections.filter(s => s.priority === 'critical');
  }

  getSEOMetadata(spec) {
    return {
      title: spec.pageTitle,
      description: spec.pageDescription,
      businessName: spec.metadata.generatedFor,
      primaryKeywords: this.extractKeywords(spec),
    };
  }

  extractKeywords(spec) {
    const keywords = [];
    const hero = this.getSectionByType(spec, 'hero');
    if (hero && hero.content.headline) keywords.push(hero.content.headline);
    const services = this.getSectionByType(spec, 'services');
    if (services && services.content.services) {
      services.content.services.forEach(s => keywords.push(s.name));
    }
    return keywords.slice(0, 10);
  }

  calculateConversionScore(spec) {
    let score = 0;
    const ctas = this.getAllCTAs(spec);
    if (ctas.length >= 5) score += 40;
    else if (ctas.length >= 3) score += 30;
    else score += 20;
    const trustElements = this.getVerifiedTrustElements(spec);
    if (trustElements.length >= 3) score += 20;
    else if (trustElements.length >= 2) score += 15;
    else score += 10;
    const mobileSections = this.getMobileSections(spec);
    if (mobileSections.length === spec.sections.length) score += 20;
    else score += 10;
    const criticalSections = ['navigation', 'hero', 'trustIndicators', 'services', 'cta', 'footer'];
    const hasCritical = criticalSections.every(type => spec.sections.some(s => s.type === type));
    if (hasCritical) score += 20;
    return Math.min(score, 100);
  }
}

export default new LandingPageSpecService();
