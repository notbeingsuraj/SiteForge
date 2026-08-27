import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';
import BusinessResearchService from './src/services/BusinessResearchService.js';

async function extractBusiness(url) {
  const data = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
  return await BusinessResearchService.extractBusinessIntelligence(data);
}

async function runIsolationTest() {
  console.log("========== A → B → A → C ISOLATION TEST ==========\n");
  
  const urls = {
    A_place: 'https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z',
    B_place: 'https://www.google.com/maps/place/Wooden+Street/@30.7415,76.7681,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x2222222222222222!8m2!3d30.7415!4d76.7681!16s%2Fg%2F11c5q8v7z',
    C_place: 'https://www.google.com/maps/place/Trendz+The+Furniture+Mall/@30.7415,76.7681,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x3333333333333333!8m2!3d30.7415!4d76.7681!16s%2Fg%2F11c5q8v7z',
  };
  
  console.log("--- A1 (first A) ---");
  const A1 = await extractBusiness(urls.A_place);
  console.log(`Name: ${A1.identity.name}`);
  console.log(`Place ID: ${A1.source.placeId}`);
  console.log(`Phone: ${A1.contact.phone}`);
  console.log(`Address: ${A1.location.address}`);
  console.log(`Website: ${A1.contact.website}`);
  console.log(`Services: ${JSON.stringify(A1.services)}`);
  console.log(`Reviews: ${JSON.stringify(A1.reviews)}`);
  
  console.log("\n--- B ---");
  const B = await extractBusiness(urls.B_place);
  console.log(`Name: ${B.identity.name}`);
  console.log(`Place ID: ${B.source.placeId}`);
  console.log(`Phone: ${B.contact.phone}`);
  console.log(`Address: ${B.location.address}`);
  console.log(`Website: ${B.contact.website}`);
  console.log(`Services: ${JSON.stringify(B.services)}`);
  console.log(`Reviews: ${JSON.stringify(B.reviews)}`);
  
  console.log("\n--- A2 (second A) ---");
  const A2 = await extractBusiness(urls.A_place);
  console.log(`Name: ${A2.identity.name}`);
  console.log(`Place ID: ${A2.source.placeId}`);
  console.log(`Phone: ${A2.contact.phone}`);
  console.log(`Address: ${A2.location.address}`);
  console.log(`Website: ${A2.contact.website}`);
  console.log(`Services: ${JSON.stringify(A2.services)}`);
  console.log(`Reviews: ${JSON.stringify(A2.reviews)}`);
  
  console.log("\n--- C ---");
  const C = await extractBusiness(urls.C_place);
  console.log(`Name: ${C.identity.name}`);
  console.log(`Place ID: ${C.source.placeId}`);
  console.log(`Phone: ${C.contact.phone}`);
  console.log(`Address: ${C.location.address}`);
  console.log(`Website: ${C.contact.website}`);
  console.log(`Services: ${JSON.stringify(C.services)}`);
  console.log(`Reviews: ${JSON.stringify(C.reviews)}`);
  
  // Verify isolation
  console.log("\n========== ISOLATION VERIFICATION ==========");
  
  const placeIdIsolation = 
    A1.source.placeId === A2.source.placeId &&
    A1.source.placeId !== B.source.placeId &&
    A1.source.placeId !== C.source.placeId &&
    B.source.placeId !== C.source.placeId;
  console.log(`Place ID isolation: ${placeIdIsolation ? 'PASS' : 'FAIL'}`);
  console.log(`  A1.placeId = ${A1.source.placeId}`);
  console.log(`  A2.placeId = ${A2.source.placeId}`);
  console.log(`  B.placeId = ${B.source.placeId}`);
  console.log(`  C.placeId = ${C.source.placeId}`);
  
  const dataIsolation = 
    A1.identity.name === A2.identity.name &&
    A1.identity.name !== B.identity.name &&
    A1.identity.name !== C.identity.name &&
    B.identity.name !== C.identity.name;
  console.log(`Business name isolation: ${dataIsolation ? 'PASS' : 'FAIL'}`);
  console.log(`  A1.name = ${A1.identity.name}`);
  console.log(`  A2.name = ${A2.identity.name}`);
  console.log(`  B.name = ${B.identity.name}`);
  console.log(`  C.name = ${C.identity.name}`);
  
  // Check that A1 and A2 have identical data
  const a1EqualsA2 = 
    A1.source.placeId === A2.source.placeId &&
    A1.identity.name === A2.identity.name &&
    A1.contact.phone === A2.contact.phone &&
    A1.location.address === A2.location.address &&
    A1.contact.website === A2.contact.website &&
    JSON.stringify(A1.services) === JSON.stringify(A2.services) &&
    JSON.stringify(A1.reviews) === JSON.stringify(A2.reviews);
  console.log(`A1 === A2 (data consistency): ${a1EqualsA2 ? 'PASS' : 'FAIL'}`);
}

runIsolationTest().catch(console.error);