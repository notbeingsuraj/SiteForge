import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';
import BusinessResearchService from './src/services/BusinessResearchService.js';
import BrandStrategyService from './src/services/BrandStrategyService.js';
import WebsiteStrategyService from './src/services/WebsiteStrategyService.js';
import AIService from './src/services/AIService.js';
import { buildLandingPageSpecPrompt } from './src/prompts/landingPageSpec.js';
import axios from 'axios';
import { config } from './src/config/env.js';

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
  
  const websiteStrategy = await WebsiteStrategyService.generateStrategy(brandDNA, digitalAudit, businessData);
  
  const prompt = buildLandingPageSpecPrompt(brandDNA, websiteStrategy, digitalAudit);
  console.log('Prompt length:', prompt.length);
  
  // Direct API call with higher max_tokens
  const client = axios.create({
    baseURL: config.omniroute.baseUrl,
    headers: {
      'Authorization': `Bearer ${config.omniroute.apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  
  const payload = {
    model: config.omniroute.models.reasoning,
    messages: [
      { role: 'system', content: 'You are a senior UX designer, conversion strategist and frontend information architect. Generate a structured landing-page specification for a local business. Return ONLY valid JSON with pageTitle, pageDescription, primaryCTA, sections, theme, metadata. IMPORTANT: Return ONLY valid JSON. No markdown, no explanations.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 16000,
    stream: false,
    response_format: { type: 'json_object' },
  };
  
  console.log('\n=== SENDING REQUEST ===');
  const response = await client.post('/chat/completions', payload);
  const message = response.data?.choices?.[0]?.message;
  console.log('Content length:', message?.content?.length);
  console.log('Reasoning content length:', message?.reasoning_content?.length);
  console.log('Full Content:', message?.content);
  console.log('\nFull Reasoning (first 5000):', message?.reasoning_content?.substring(0, 5000));
}

test().catch(console.error);