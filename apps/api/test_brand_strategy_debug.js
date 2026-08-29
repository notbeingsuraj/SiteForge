import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';
import BusinessResearchService from './src/services/BusinessResearchService.js';
import BrandStrategyService from './src/services/BrandStrategyService.js';
import AIService from './src/services/AIService.js';
import { buildBrandStrategyPrompt } from './src/prompts/brandStrategy.js';

const url = 'https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z';

async function test() {
  const extractedData = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
  const businessData = await BusinessResearchService.extractBusinessIntelligence(extractedData);
  console.log('Business Data:', JSON.stringify(businessData, null, 2));
  
  const prompt = buildBrandStrategyPrompt(businessData);
  console.log('\n=== PROMPT LENGTH ===', prompt.length);
  
  const brandStrategy = await AIService.generate({
    prompt,
    model: 'reasoning',
    schema: true,
    temperature: 0.7,
    maxTokens: 6000,
    systemPrompt: `You are a senior brand strategist and local-business growth consultant. Analyze the supplied business information. Your objective is to determine the commercial and branding DNA of the business. Return strict JSON following the structure with fields: businessIdentity, audience, customerIntent, painPoints, purchaseTriggers, services, competitiveAdvantages, trustSignals, brandPersonality, toneOfVoice, visualDirection, positioning, websiteObjectives, conversionStrategy, strategicRecommendations, confidence. IMPORTANT: Return ONLY valid JSON. No markdown, no explanations, no extra text.`,
  });
  
  console.log('\n=== BRAND STRATEGY RAW ===');
  console.log(JSON.stringify(brandStrategy, null, 2));
}

test().catch(console.error);