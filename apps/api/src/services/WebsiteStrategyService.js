import AIService from './AIService.js';
import { buildWebsiteStrategyPrompt } from '../prompts/websiteStrategy.js';

class WebsiteStrategyService {
  async generateStrategy(brandDNA, digitalAudit, businessData, options = {}) {
    try {
      const startTime = Date.now();
      if (!brandDNA || !digitalAudit || !businessData) {
        throw new Error('Brand DNA, digital audit, and business data are required');
      }
      const prompt = buildWebsiteStrategyPrompt(brandDNA, digitalAudit, businessData);
      const strategy = await AIService.generate({
        prompt,
        model: 'reasoning',
        schema: true,
        temperature: 0.6,
        maxTokens: 3500,
      });
      const latency = Date.now() - startTime;
      this.validateStrategy(strategy);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'website-strategy-v1',
        tokens: null,
        latency,
        error: null,
      });
      return { ...strategy, metadata: { generatedAt: new Date().toISOString(), version: 'v1', latency } };
    } catch (error) {
      console.error('Website strategy generation error:', error);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'website-strategy-v1',
        tokens: null,
        latency: null,
        error: error.message,
      });
      throw new Error(`Failed to generate website strategy: ${error.message}`);
    }
  }

  validateStrategy(strategy) {
    const required = ['websiteGoal', 'targetAudience', 'primaryCTA', 'secondaryCTA', 'pages', 'homepageSections', 'trustStrategy', 'conversionStrategy', 'seoStrategy', 'visualDirection', 'contentStrategy'];
    for (const field of required) {
      if (!strategy[field]) throw new Error(`Missing required field: ${field}`);
    }
    if (!Array.isArray(strategy.pages) || strategy.pages.length === 0) throw new Error('Pages must be a non-empty array');
    if (!Array.isArray(strategy.homepageSections) || strategy.homepageSections.length === 0) throw new Error('Homepage sections must be a non-empty array');
    if (!strategy.primaryCTA.text || !strategy.primaryCTA.action) throw new Error('Invalid primary CTA');
    return true;
  }

  extractSummary(strategy) {
    return {
      goal: strategy.websiteGoal,
      primaryCTA: strategy.primaryCTA.text,
      pageCount: strategy.pages.length,
      essentialPages: strategy.pages.filter(p => p.priority === 'essential').map(p => p.name),
      complexity: strategy.implementationNotes?.estimatedComplexity || 'moderate',
      visualStyle: strategy.visualDirection.style,
    };
  }

  getPagesByPriority(strategy) {
    const priorityOrder = { essential: 1, recommended: 2, optional: 3 };
    return strategy.pages.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  getHomepageBlueprint(strategy) {
    return strategy.homepageSections.sort((a, b) => a.order - b.order).map(section => ({
      name: section.section,
      purpose: section.purpose,
      messages: section.keyMessages,
      hasCTA: section.ctaIncluded,
    }));
  }

  getVerifiedTrustElements(strategy) {
    return strategy.trustStrategy.filter(t => t.source === 'verified').sort((a, b) => {
      const impactOrder = { high: 1, medium: 2, low: 3 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }

  getConversionFunnel(strategy) {
    return {
      steps: strategy.conversionStrategy.conversionFunnel,
      frictionPoints: strategy.conversionStrategy.frictionPoints,
      persuasionTactics: strategy.conversionStrategy.persuasionTactics,
      primaryGoal: strategy.conversionStrategy.primaryGoal,
    };
  }

  getSEOQuickWins(strategy) {
    return strategy.seoStrategy.quickWins || [];
  }

  calculateComplexity(strategy) {
    let score = 0;
    if (strategy.pages.length <= 4) score += 0;
    else if (strategy.pages.length <= 6) score += 1;
    else score += 2;
    if (strategy.homepageSections.length <= 5) score += 0;
    else if (strategy.homepageSections.length <= 7) score += 1;
    else score += 2;
    const hasBooking = strategy.primaryCTA.action === 'book';
    const hasEcommerce = strategy.primaryCTA.action === 'order';
    if (hasBooking || hasEcommerce) score += 2;
    if (score <= 1) return 'simple';
    if (score <= 4) return 'moderate';
    return 'complex';
  }

  getImplementationChecklist(strategy) {
    const checklist = [];
    strategy.pages.filter(p => p.priority === 'essential').forEach(page => {
      checklist.push({ category: 'Pages', task: `Create ${page.name} page`, priority: 'high' });
    });
    if (strategy.implementationNotes?.contentNeeds) {
      strategy.implementationNotes.contentNeeds.forEach(need => {
        checklist.push({ category: 'Content', task: need, priority: 'high' });
      });
    }
    if (strategy.implementationNotes?.technicalRequirements) {
      strategy.implementationNotes.technicalRequirements.forEach(req => {
        checklist.push({ category: 'Technical', task: req, priority: 'medium' });
      });
    }
    strategy.seoStrategy.quickWins?.forEach(win => {
      checklist.push({ category: 'SEO', task: win, priority: 'medium' });
    });
    return checklist;
  }
}

export default new WebsiteStrategyService();
