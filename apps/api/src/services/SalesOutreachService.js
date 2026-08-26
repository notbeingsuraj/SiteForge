import AIService from './AIService.js';
import { buildSalesOutreachPrompt } from '../prompts/salesOutreach.js';

class SalesOutreachService {
  async generateOutreach(businessData, leadQualification, websiteStrategy, options = {}) {
    try {
      const startTime = Date.now();
      if (!businessData || !leadQualification || !websiteStrategy) {
        throw new Error('Business data, lead qualification, and website strategy are required');
      }
      const prompt = buildSalesOutreachPrompt(businessData, leadQualification, websiteStrategy);
      const outreach = await AIService.generate({
        prompt,
        model: 'reasoning',
        schema: true,
        temperature: 0.7,
        maxTokens: 5000,
        systemPrompt: `You are a senior sales strategist specializing in outreach for digital agencies. Generate personalized, professional outreach messages for business owners. Return strict JSON with whatsapp, email, instagramDM, callOpening, followUp, metadata. IMPORTANT: Return ONLY valid JSON. No markdown, no explanations.`,
      });
      const latency = Date.now() - startTime;
      this.validateOutreach(outreach);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'sales-outreach-v1',
        tokens: null,
        latency,
        error: null,
      });
      return { ...outreach, metadata: { generatedAt: new Date().toISOString(), version: 'v1', latency } };
    } catch (error) {
      console.error('Sales outreach generation error:', error);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'sales-outreach-v1',
        tokens: null,
        latency: null,
        error: error.message,
      });
      throw new Error(`Failed to generate sales outreach: ${error.message}`);
    }
  }

  validateOutreach(outreach) {
    const required = ['whatsapp', 'email', 'instagramDM', 'callOpening', 'followUp'];
    for (const field of required) {
      if (!outreach[field]) throw new Error(`Missing required field: ${field}`);
    }
    if (!outreach.email.subject || !outreach.email.body) throw new Error('Invalid email structure');
    return true;
  }

  extractSummary(outreach) {
    return {
      whatsappLength: outreach.whatsapp.message.length,
      emailSubject: outreach.email.subject,
      primaryObservation: outreach.metadata.observation,
      recommendedChannel: outreach.metadata.recommendedChannel,
      tone: outreach.metadata.tone,
    };
  }

  getChannelMessage(outreach, channel) {
    const channelMap = { whatsapp: outreach.whatsapp, email: outreach.email, instagram: outreach.instagramDM, call: outreach.callOpening, followup: outreach.followUp };
    return channelMap[channel.toLowerCase()] || null;
  }

  getRecommendedChannel(outreach) {
    return outreach.metadata.recommendedChannel;
  }

  formatEmailForSending(outreach, fromName, fromEmail) {
    return {
      from: { name: fromName, email: fromEmail },
      to: outreach.email.recipientEmail || null,
      subject: outreach.email.subject,
      body: outreach.email.body,
      html: this.convertToHTML(outreach.email.body),
    };
  }

  convertToHTML(text) {
    return text.split('\n\n').map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('');
  }

  getCharacterCounts(outreach) {
    return {
      whatsapp: outreach.whatsapp.message.length,
      email: outreach.email.body.length,
      instagram: outreach.instagramDM.message.length,
      callOpening: outreach.callOpening.script.length,
      followUp: outreach.followUp.message.length,
    };
  }

  checkPlatformLimits(outreach) {
    const limits = { whatsapp: 4096, instagram: 1000, email: 10000 };
    const counts = this.getCharacterCounts(outreach);
    return {
      whatsapp: counts.whatsapp <= limits.whatsapp,
      instagram: counts.instagram <= limits.instagram,
      email: counts.email <= limits.email,
      allWithinLimits: counts.whatsapp <= limits.whatsapp && counts.instagram <= limits.instagram && counts.email <= limits.email,
    };
  }

  calculateQualityScore(outreach) {
    let score = 0;
    const hasBusinessName = JSON.stringify(outreach).includes(outreach.metadata.businessName || '');
    if (hasBusinessName) score += 30;
    if (outreach.metadata.observation && outreach.metadata.observation.length > 20) score += 30;
    const counts = this.getCharacterCounts(outreach);
    if (counts.whatsapp <= 300 && counts.instagram <= 200) score += 20;
    else if (counts.whatsapp <= 500 && counts.instagram <= 400) score += 10;
    const allText = JSON.stringify(outreach).toLowerCase();
    const spammyPhrases = ['act now', 'limited time', 'free money', 'guaranteed', 'risk-free', 'no obligation'];
    const spammyCount = spammyPhrases.filter(phrase => allText.includes(phrase)).length;
    if (spammyCount === 0) score += 20;
    else if (spammyCount <= 1) score += 10;
    return Math.min(score, 100);
  }
}

export default new SalesOutreachService();
