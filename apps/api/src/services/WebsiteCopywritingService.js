import AIService from './AIService.js';
import { buildWebsiteCopyPrompt } from '../prompts/websiteCopy.js';

class WebsiteCopywritingService {
  async generateCopy(brandDNA, websiteStrategy, landingPageSpec, businessData, options = {}) {
    try {
      const startTime = Date.now();
      if (!brandDNA || !websiteStrategy || !landingPageSpec || !businessData) {
        throw new Error('Brand DNA, website strategy, landing page spec, and business data are required');
      }
      const prompt = buildWebsiteCopyPrompt(brandDNA, websiteStrategy, landingPageSpec, businessData);
      const copy = await AIService.generate({
        prompt,
        model: 'reasoning',
        schema: true,
        temperature: 0.7,
        maxTokens: 7000,
        systemPrompt: `You are a senior conversion copywriter specializing in local business websites. Generate compelling, concise website copy that drives action. Return strict JSON with hero, services, about, trust, faq, finalCTA, metadata. IMPORTANT: Return ONLY valid JSON. No markdown, no explanations.`,
      });
      const latency = Date.now() - startTime;
      this.validateCopy(copy);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'website-copy-v1',
        tokens: null,
        latency,
        error: null,
      });
      return { ...copy, metadata: { generatedAt: new Date().toISOString(), version: 'v1', latency } };
    } catch (error) {
      console.error('Website copy generation error:', error);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'website-copy-v1',
        tokens: null,
        latency: null,
        error: error.message,
      });
      throw new Error(`Failed to generate website copy: ${error.message}`);
    }
  }

  validateCopy(copy) {
    const required = ['hero', 'services', 'about', 'trust', 'faq', 'finalCTA'];
    for (const field of required) {
      if (!copy[field]) throw new Error(`Missing required field: ${field}`);
    }
    if (!copy.hero.headline || !copy.hero.subheadline || !copy.hero.cta) throw new Error('Invalid hero structure');
    if (!Array.isArray(copy.services) || copy.services.length === 0) throw new Error('Services must be a non-empty array');
    return true;
  }

  extractSummary(copy) {
    return {
      headline: copy.hero.headline,
      subheadline: copy.hero.subheadline,
      primaryCTA: copy.hero.cta.primary,
      serviceCount: copy.services.length,
      faqCount: copy.faq.questions.length,
      tone: copy.metadata?.tone || 'professional',
    };
  }

  getHeroCopy(copy) {
    return { headline: copy.hero.headline, subheadline: copy.hero.subheadline, description: copy.hero.description, cta: copy.hero.cta };
  }

  getServiceDescriptions(copy) {
    return copy.services.map(service => ({ name: service.name, headline: service.headline, description: service.description, benefits: service.benefits }));
  }

  getAboutCopy(copy) {
    return { headline: copy.about.headline, story: copy.about.story, differentiators: copy.about.differentiators, cta: copy.about.cta };
  }

  getTrustCopy(copy) {
    return { headline: copy.trust.headline, elements: copy.trust.elements, socialProof: copy.trust.socialProof };
  }

  getFAQCopy(copy) {
    return { headline: copy.faq.headline, questions: copy.faq.questions };
  }

  getFinalCTACopy(copy) {
    return { headline: copy.finalCTA.headline, subheadline: copy.finalCTA.subheadline, cta: copy.finalCTA.cta, urgency: copy.finalCTA.urgency };
  }

  calculateQualityScore(copy) {
    let score = 0;
    const headline = copy.hero.headline;
    const headlineWords = headline.split(' ').length;
    if (headlineWords >= 5 && headlineWords <= 10) score += 30;
    else if (headlineWords >= 3 && headlineWords <= 12) score += 20;
    else score += 10;
    const hasSpecifics = this.hasSpecificDetails(copy);
    if (hasSpecifics >= 5) score += 25;
    else if (hasSpecifics >= 3) score += 15;
    else score += 5;
    const hasGeneric = this.hasGenericLanguage(copy);
    if (hasGeneric === 0) score += 25;
    else if (hasGeneric <= 2) score += 15;
    else score += 5;
    const ctaClear = copy.hero.cta.primary.length <= 20;
    if (ctaClear) score += 20;
    else score += 10;
    return Math.min(score, 100);
  }

  hasSpecificDetails(copy) {
    const allText = JSON.stringify(copy).toLowerCase();
    let count = 0;
    if (/\d+/.test(allText)) count++;
    if (/(years?|decades?|months?|days?)/.test(allText)) count++;
    if (/(city|town|county|area|neighborhood)/.test(allText)) count++;
    if (/(licensed|certified|insured|bonded)/.test(allText)) count++;
    if (/(reviews?|ratings?|stars?)/.test(allText)) count++;
    return count;
  }

  hasGenericLanguage(copy) {
    const allText = JSON.stringify(copy).toLowerCase();
    const genericPhrases = ['welcome to', 'passionate about', 'one-stop', 'cutting-edge', 'world-class', 'innovative solutions', 'best in class', 'industry-leading'];
    return genericPhrases.filter(phrase => allText.includes(phrase)).length;
  }
}

export default new WebsiteCopywritingService();
