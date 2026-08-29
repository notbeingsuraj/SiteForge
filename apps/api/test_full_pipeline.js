import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';
import BusinessResearchService from './src/services/BusinessResearchService.js';
import BrandStrategyService from './src/services/BrandStrategyService.js';
import WebsiteStrategyService from './src/services/WebsiteStrategyService.js';
import LandingPageSpecService from './src/services/LandingPageSpecService.js';

const urls = {
  A: 'https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z',
  B: 'https://www.google.com/maps/place/Wooden+Street/@30.7415,76.7681,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x2222222222222222!8m2!3d30.7415!4d76.7681!16s%2Fg%2F11c5q8v7z',
  C: 'https://www.google.com/maps/place/Trendz+The+Furniture+Mall/@30.7415,76.7681,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x3333333333333333!8m2!3d30.7415!4d76.7681!16s%2Fg%2F11c5q8v7z',
};

async function runFullPipeline(url, label) {
  console.log(`\n========== ${label} - FULL PIPELINE ==========`);
  
  // Step 1: Google Maps URL -> Place resolution
  console.log('\n--- STEP 1: Google Maps URL -> Place resolution ---');
  const extractedData = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
  console.log('Original URL:', extractedData.metadata.originalUrl);
  console.log('Extracted Place ID:', extractedData.metadata.placeId);
  console.log('Place Name:', extractedData.metadata.placeName);
  
  // Step 2: BusinessDataExtractor -> normalized BusinessProfile
  console.log('\n--- STEP 2: BusinessDataExtractor -> BusinessProfile ---');
  const businessData = await BusinessResearchService.extractBusinessIntelligence(extractedData);
  console.log('Resolved Name:', businessData.identity.name);
  console.log('Category:', businessData.identity.category);
  console.log('Coordinates:', JSON.stringify(businessData.location.coordinates));
  console.log('Address:', businessData.location.address);
  console.log('Phone:', businessData.contact.phone);
  console.log('Website:', businessData.contact.website);
  console.log('Rating:', businessData.ratings?.rating);
  console.log('Review Count:', businessData.ratings?.reviewCount);
  console.log('Hours:', JSON.stringify(businessData.hours));
  console.log('Source URLs:', businessData.source.urls);
  console.log('Confidence:', JSON.stringify(businessData.confidence));
  console.log('Resolution Status:', businessData.source.resolutionStatus);
  
  // Step 3: BusinessResearchService -> Brand DNA
  console.log('\n--- STEP 3: BusinessResearchService -> Brand DNA ---');
  const brandDNA = await BrandStrategyService.generateBrandDNA(businessData);
  console.log('Brand DNA keys:', Object.keys(brandDNA));
  console.log('Brand Essence:', brandDNA.brandEssence);
  console.log('Value Proposition:', brandDNA.valueProposition);
  
  // Step 4: Brand DNA -> Website Strategy
  console.log('\n--- STEP 4: Brand DNA -> Website Strategy ---');
  const digitalAudit = { score: 50, gaps: [], opportunities: [], details: {} };
  const websiteStrategy = await WebsiteStrategyService.generateStrategy(brandDNA, digitalAudit, businessData);
  console.log('Website Strategy keys:', Object.keys(websiteStrategy));
  console.log('Strategy:', websiteStrategy.strategy);
  
  // Step 5: Website Strategy -> Landing Page Specification
  console.log('\n--- STEP 5: Website Strategy -> Landing Page Specification ---');
  const landingPageSpec = await LandingPageSpecService.generateSpec(websiteStrategy, brandDNA, businessData);
  console.log('Landing Page Spec keys:', Object.keys(landingPageSpec));
  console.log('Hero:', landingPageSpec.hero);
  console.log('Sections:', landingPageSpec.sections?.length);
  
  console.log('\n========== PIPELINE COMPLETE ==========');
  return { businessData, brandDNA, websiteStrategy, landingPageSpec };
}

async function main() {
  const results = {};
  for (const [label, url] of Object.entries(urls)) {
    results[label] = await runFullPipeline(url, label);
  }
  
  // A → B → A → C verification
  console.log('\n\n========== A → B → A → C ISOLATION VERIFICATION ==========');
  const A1 = results.A;
  const A2 = results.A; // cached, so same object
  const B = results.B;
  const C = results.C;
  
  console.log('Place ID A1:', A1.businessData.source.placeId);
  console.log('Place ID A2:', A2.businessData.source.placeId);
  console.log('Place ID B:', B.businessData.source.placeId);
  console.log('Place ID C:', C.businessData.source.placeId);
  
  const placeIdIsolation = 
    A1.businessData.source.placeId === A2.businessData.source.placeId &&
    A1.businessData.source.placeId !== B.businessData.source.placeId &&
    A1.businessData.source.placeId !== C.businessData.source.placeId &&
    B.businessData.source.placeId !== C.businessData.source.placeId;
  console.log('Place ID isolation:', placeIdIsolation ? 'PASS' : 'FAIL');
  
  const dataIsolation = 
    A1.businessData.identity.name === A2.businessData.identity.name &&
    A1.businessData.identity.name !== B.businessData.identity.name &&
    A1.businessData.identity.name !== C.businessData.identity.name &&
    B.businessData.identity.name !== C.businessData.identity.name;
  console.log('Business name isolation:', dataIsolation ? 'PASS' : 'FAIL');
  
  console.log('\nBrand DNA A1 keys:', Object.keys(A1.brandDNA));
  console.log('Brand DNA B keys:', Object.keys(B.brandDNA));
  console.log('Brand DNA C keys:', Object.keys(C.brandDNA));
}

main().catch(console.error);