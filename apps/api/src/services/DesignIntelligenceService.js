/**
 * DesignIntelligenceService
 *
 * Consolidated design intelligence layer that replaces the separate
 * WebsiteStrategyService, WebsiteCopywritingService, and LandingPageSpecService.
 * Produces a complete design specification in a single AI call.
 *
 * Input: BusinessProfile + BrandDNA + DigitalAudit
 * Output: Complete DesignSystem + PageArchitecture + ContentStrategy + AssetPlan
 */

import AIService from './AIService.js';
import { buildDesignIntelligencePrompt } from '../prompts/designIntelligence.js';
import { DESIGN_INTELLIGENCE_SCHEMA } from '../schemas/designIntelligence.js';

class DesignIntelligenceService {
  /**
   * Generate complete design intelligence for a business.
   * Single AI call that produces everything needed for website generation.
   */
  async generateDesignIntelligence(businessProfile, brandDNA, digitalAudit, options = {}) {
    try {
      const startTime = Date.now();
      
      if (!businessProfile || !businessProfile.identity?.name) {
        throw new Error('BusinessProfile with name is required');
      }
      if (!brandDNA) {
        throw new Error('BrandDNA is required');
      }
      if (!digitalAudit) {
        throw new Error('DigitalAudit is required');
      }

      const prompt = buildDesignIntelligencePrompt(businessProfile, brandDNA, digitalAudit);
      
      const intelligence = await AIService.generate({
        prompt,
        model: 'reasoning',
        schema: DESIGN_INTELLIGENCE_SCHEMA,
        temperature: 0.5,
        maxTokens: 16000,
        systemPrompt: `You are a senior UX designer, conversion strategist, brand designer, and frontend architect. Generate a complete website design intelligence specification for a local business. Return ONLY valid JSON matching the schema. No markdown, no explanations.`,
      });

      const latency = Date.now() - startTime;
      this.validateIntelligence(intelligence);

      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'design-intelligence-v1',
        tokens: null,
        latency,
        error: null,
      });

      return { 
        ...intelligence, 
        metadata: { 
          generatedAt: new Date().toISOString(), 
          version: 'v1', 
          latency 
        } 
      };
    } catch (error) {
      console.error('Design intelligence generation error:', error);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'design-intelligence-v1',
        tokens: null,
        latency: null,
        error: error.message,
      });
      throw new Error(`Failed to generate design intelligence: ${error.message}`);
    }
  }

  validateIntelligence(intelligence) {
    const required = [
      'designSystem', 
      'pageArchitecture', 
      'contentStrategy', 
      'assetPlan',
      'metadata'
    ];
    for (const field of required) {
      if (!intelligence[field]) throw new Error(`Missing required field: ${field}`);
    }
    
    // Validate design system completeness
    const ds = intelligence.designSystem;
    if (!ds.visualDirection || !ds.brandPersonality || !ds.colorSystem || 
        !ds.typography || !ds.layout || !ds.shapeLanguage) {
      throw new Error('Incomplete design system');
    }

    // Validate page architecture
    if (!intelligence.pageArchitecture?.sections || !Array.isArray(intelligence.pageArchitecture.sections)) {
      throw new Error('Invalid page architecture sections');
    }
    if (!intelligence.pageArchitecture.layoutFamily) {
      throw new Error('Missing layout family');
    }

    // Validate content strategy
    if (!intelligence.contentStrategy?.hero || !intelligence.contentStrategy?.sections) {
      throw new Error('Incomplete content strategy');
    }

    // Validate asset plan
    if (!intelligence.assetPlan?.hero || !intelligence.assetPlan?.supporting) {
      throw new Error('Incomplete asset plan');
    }

    return true;
  }

  extractSummary(intelligence) {
    return {
      layoutFamily: intelligence.pageArchitecture.layoutFamily,
      visualDirection: intelligence.designSystem.visualDirection,
      primaryColor: intelligence.designSystem.colorSystem.primary,
      typography: `${intelligence.designSystem.typography.display.family} / ${intelligence.designSystem.typography.body.family}`,
      sections: intelligence.pageArchitecture.sections.map(s => s.id),
      heroAsset: intelligence.assetPlan.hero?.type,
      supportingAssets: intelligence.assetPlan.supporting?.length || 0,
      primaryCTA: intelligence.contentStrategy.hero.cta?.primary,
    };
  }
}

export default new DesignIntelligenceService();