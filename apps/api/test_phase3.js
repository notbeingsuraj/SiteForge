import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';
import BusinessResearchService from './src/services/BusinessResearchService.js';

async function testBusiness(name, placeUrl, searchUrl) {
  console.log(`\n========== ${name} ==========`);
  
  // Test /place/ URL
  console.log(`\n--- /place/ URL ---`);
  console.log(`URL: ${placeUrl}`);
  try {
    const placeData = await BusinessDataExtractor.extractFromGoogleMapsUrl(placeUrl);
    const placeIntel = await BusinessResearchService.extractBusinessIntelligence(placeData);
    console.log(`Name: ${placeIntel.identity.name}`);
    console.log(`Place ID: ${placeIntel.source.placeId}`);
    console.log(`Resolution Status: ${placeIntel.source.resolutionStatus}`);
    console.log(`Resolution Confidence: ${placeIntel.source.resolutionConfidence}`);
    console.log(`Coordinates: ${JSON.stringify(placeIntel.location.coordinates)}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  // Test /search/ URL
  console.log(`\n--- /search/ URL ---`);
  console.log(`URL: ${searchUrl}`);
  try {
    const searchData = await BusinessDataExtractor.extractFromGoogleMapsUrl(searchUrl);
    const searchIntel = await BusinessResearchService.extractBusinessIntelligence(searchData);
    console.log(`Name: ${searchIntel.identity.name}`);
    console.log(`Query: ${searchIntel.source.query}`);
    console.log(`Place ID: ${searchIntel.source.placeId}`);
    console.log(`Resolution Status: ${searchIntel.source.resolutionStatus}`);
    console.log(`Resolution Confidence: ${searchIntel.source.resolutionConfidence}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function runTests() {
  // Business A: Nilkamal Homes Elante Mall
  await testBusiness(
    'Business A: Nilkamal Homes Elante Mall',
    'https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z',
    'https://www.google.com/maps/search/?api=1&query=Nilkamal+Homes+Elante+Mall+Chandigarh'
  );
  
  // Business B: Wooden Street
  await testBusiness(
    'Business B: Wooden Street',
    'https://www.google.com/maps/place/Wooden+Street/@30.7415,76.7681,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x2222222222222222!8m2!3d30.7415!4d76.7681!16s%2Fg%2F11c5q8v7z',
    'https://www.google.com/maps/search/?api=1&query=Wooden+Street+Sector+17A+Chandigarh'
  );
  
  // Business C: Trendz The Furniture Mall
  await testBusiness(
    'Business C: Trendz The Furniture Mall',
    'https://www.google.com/maps/place/Trendz+The+Furniture+Mall/@30.7415,76.7681,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x3333333333333333!8m2!3d30.7415!4d76.7681!16s%2Fg%2F11c5q8v7z',
    'https://www.google.com/maps/search/?api=1&query=Trendz+The+Furniture+Mall+Chandigarh'
  );
}

runTests().catch(console.error);