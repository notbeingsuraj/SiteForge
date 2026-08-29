import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

async function testFailure(name, url, expectedToFail = true) {
  console.log(`\n=== ${name} ===`);
  console.log(`URL: ${url}`);
  try {
    const result = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
    console.log('Result:', expectedToFail ? 'UNEXPECTED SUCCESS' : 'SUCCESS');
    console.log('Place ID:', result.metadata.placeId);
    console.log('Business name:', result.business.name);
    console.log('Confidence:', result.confidence.overall);
  } catch (error) {
    console.log('Result:', expectedToFail ? 'EXPECTED FAILURE' : 'UNEXPECTED FAILURE');
    console.log('Error:', error.message);
  }
}

async function runFailureTests() {
  console.log("========== FAILURE TESTS ==========");
  
  // 1. Malformed URL
  await testFailure('1. Malformed URL', 'not-a-url-at-all');
  
  // 2. Non-Google URL
  await testFailure('2. Non-Google URL', 'https://www.example.com/some-page');
  
  // 3. Localhost URL (SSRF)
  await testFailure('3. Localhost URL (SSRF)', 'http://localhost:8080/some-path');
  
  // 4. Private IP URL (SSRF)
  await testFailure('4. Private IP URL (SSRF)', 'http://192.168.1.1/admin');
  
  // 5. Private IP URL (SSRF) - 10.x
  await testFailure('5. Private IP URL 10.x (SSRF)', 'http://10.0.0.1/admin');
  
  // 6. Private IP URL (SSRF) - 172.16-31
  await testFailure('6. Private IP URL 172.16.x (SSRF)', 'http://172.16.0.1/admin');
  
  // 7. IPv6 localhost
  await testFailure('7. IPv6 Localhost (SSRF)', 'http://[::1]:8080/');
  
  // 8. Non-HTTPS URL
  await testFailure('8. HTTP (not HTTPS)', 'http://www.google.com/maps/place/test');
  
  // 9. Valid Google Maps URL but non-existent business (unresolved)
  await testFailure('9. Unresolved Maps URL', 'https://www.google.com/maps/place/ThisBusinessDoesNotExist12345/@0,0,15z/data=!3m1!4b1', false);
  
  // 10. Search URL (should return null placeId, unresolved)
  await testFailure('10. Search URL', 'https://www.google.com/maps/search/?api=1&query=Nilkamal+Homes+Chandigarh', false);
  
  // 11. Duplicate request (cache test)
  console.log('\n=== 11. Duplicate Request (Cache Test) ===');
  const url = 'https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z';
  try {
    const result1 = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
    const result2 = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
    console.log('First call cached:', result1.cached);
    console.log('Second call cached:', result2.cached);
    console.log('Same placeId:', result1.metadata.placeId === result2.metadata.placeId);
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\n========== FAILURE TESTS COMPLETE ==========');
}

runFailureTests().catch(console.error);