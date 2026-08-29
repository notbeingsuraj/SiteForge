import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';
import BusinessResearchService from './src/services/BusinessResearchService.js';
import BrandStrategyService from './src/services/BrandStrategyService.js';
import WebsiteStrategyService from './src/services/WebsiteStrategyService.js';
import AIService from './src/services/AIService.js';
import { buildWebsiteStrategyPrompt } from './src/prompts/websiteStrategy.js';

const url = 'https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z';

async function test() {
  const extractedData = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
  const businessData = await BusinessResearchService.extractBusinessIntelligence(extractedData);
  const brandDNA = await BrandStrategyService.generateBrandDNA(businessData);
  
  const digitalAudit = {
    score: 50,
    gaps: ['No website', 'No Google reviews', 'No contact info on Maps'],
    opportunities: ['Build simple website', 'Claim Google Business Profile', 'Add photos'],
    details: { hasWebsite: false, websiteQuality: null, reviewCount: 0, rating: null, socialPresence: {}, seoHealth: null }
  };
  
  const prompt = buildWebsiteStrategyPrompt(brandDNA, digitalAudit, businessData);
  console.log('Prompt length:', prompt.length);
  
  console.log('\n=== DIRECT AI CALL ===');
  const strategy = await AIService.generate({
    prompt,
    model: 'reasoning',
    schema: true,
    temperature: 0.6,
    maxTokens: 16000,
    systemPrompt: `You are a senior conversion-focused website strategist. Using the Business DNA and digital audit, design the ideal website strategy for this business. Return strict JSON with websiteGoal, targetAudience, primaryCTA, secondaryCTA, pages, homepageSections, trustStrategy, conversionStrategy, seoStrategy, visualDirection, contentStrategy, mobileStrategy, implementationNotes. IMPORTANT: Return ONLY valid JSON. No markdown, no explanations.`,
  });
  
  console.log('\n=== FULL AI RESPONSE ===');
  console.log('Keys:', Object.keys(strategy));
  console.log('targetAudience:', strategy.targetAudience);
  console.log('Full strategy:', JSON.stringify(strategy, null, 2));
}

test().catch(console.error);