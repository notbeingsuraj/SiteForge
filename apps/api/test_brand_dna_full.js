import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';
import BusinessResearchService from './src/services/BusinessResearchService.js';
import BrandStrategyService from './src/services/BrandStrategyService.js';

const url = 'https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z';

async function test() {
  const extractedData = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
  console.log('=== EXTRACTED DATA ===');
  console.log('Name:', extractedData.business.name);
  console.log('Category:', extractedData.business.category);
  console.log('Place ID:', extractedData.metadata.placeId);
  
  const businessData = await BusinessResearchService.extractBusinessIntelligence(extractedData);
  console.log('\n=== BUSINESS INTELLIGENCE ===');
  console.log('Identity:', JSON.stringify(businessData.identity, null, 2));
  console.log('Location:', JSON.stringify(businessData.location, null, 2));
  console.log('Contact:', JSON.stringify(businessData.contact, null, 2));
  console.log('Ratings:', JSON.stringify(businessData.ratings, null, 2));
  console.log('Hours:', JSON.stringify(businessData.hours, null, 2));
  console.log('Trust Signals:', JSON.stringify(businessData.trustSignals, null, 2));
  console.log('Services:', JSON.stringify(businessData.services, null, 2));
  console.log('Facts:', JSON.stringify(businessData.facts, null, 2));
  console.log('Digital Presence:', JSON.stringify(businessData.digitalPresence, null, 2));
  console.log('Confidence:', JSON.stringify(businessData.confidence, null, 2));
  console.log('Resolution Status:', businessData.source.resolutionStatus);
  
  const brandDNA = await BrandStrategyService.generateBrandDNA(businessData);
  console.log('\n=== BRAND DNA ===');
  console.log(JSON.stringify(brandDNA, null, 2));
}

test().catch(console.error);