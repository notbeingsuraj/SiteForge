import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';
import BusinessResearchService from './src/services/BusinessResearchService.js';

const url = 'https://www.google.com/maps/place/Trendz+The+Furniture+Mall/@30.7415,76.7681,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x3333333333333333!8m2!3d30.7415!4d76.7681!16s%2Fg%2F11c5q8v7z';

async function test() {
  const extractedData = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
  console.log('=== EXTRACTED DATA ===');
  console.log('Business name:', extractedData.business.name);
  console.log('Business category:', extractedData.business.category);
  console.log('Contact phone:', extractedData.contact.phone);
  console.log('Contact website:', extractedData.contact.website);
  console.log('Location address:', extractedData.location.full_address);
  console.log('Ratings:', JSON.stringify(extractedData.ratings, null, 2));
  console.log('Hours:', JSON.stringify(extractedData.hours, null, 2));
  console.log('Confidence:', JSON.stringify(extractedData.confidence, null, 2));
  console.log('Place ID:', extractedData.metadata.placeId);
  console.log('Resolution Status: resolved (expected)');
  
  const businessData = await BusinessResearchService.extractBusinessIntelligence(extractedData);
  console.log('\n=== BUSINESS INTELLIGENCE ===');
  console.log('Identity:', JSON.stringify(businessData.identity, null, 2));
  console.log('Location:', JSON.stringify(businessData.location, null, 2));
  console.log('Contact:', JSON.stringify(businessData.contact, null, 2));
  console.log('Ratings:', JSON.stringify(businessData.ratings, null, 2));
  console.log('Hours:', JSON.stringify(businessData.hours, null, 2));
  console.log('Resolution Status:', businessData.source.resolutionStatus);
}

test().catch(console.error);