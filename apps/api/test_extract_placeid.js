import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

const testCases = [
  // 1. /place/ URL containing the 0x...:0x... identifier
  "https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z",
  
  // 2. /place/ URL containing ChIJ... Place ID
  "https://www.google.com/maps/place/Starbucks/@37.7749,-122.4194,15z/data=!3m1!4b1!4m6!3m5!1sChIJ0x8085807c6d6d6d6d:0x1234567890abcdef!8m2!3d37.7749!4d-122.4194",
  
  // 3. /place/ URL with coordinates only (no place ID in data path)
  "https://www.google.com/maps/place/Some+Business/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!8m2!3d30.9003452!4d75.85667325",
  
  // 4. /place/ URL with additional /data/ parameters
  "https://www.google.com/maps/place/Test+Business/@30.9003452,75.85667325,17z/data=!4m8!1m2!2m1!1sTest+Business!3m4!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325",
  
  // 5. Malformed /place/ URL
  "https://www.google.com/maps/place/invalid/",
  
  // 6. Valid Google Maps URL without an extractable Place ID (search URL)
  "https://www.google.com/maps/search/?api=1&query=Wooden+Street+Sector+17A+Chandigarh",
  
  // 7. /place/ URL with place_id query param
  "https://www.google.com/maps/place/Test+Business?place_id=ChIJ0x8085807c6d6d6d6d",
  
  // 8. /place/ URL with cid query param
  "https://www.google.com/maps/place/Test+Business?cid=1234567890123456789",
];

console.log("=== Testing extractPlaceId() ===");
for (const url of testCases) {
  const placeId = BusinessDataExtractor.extractPlaceId(url);
  console.log(`URL: ${url.substring(0, 80)}...`);
  console.log(`  placeId: ${placeId}`);
  console.log();
}