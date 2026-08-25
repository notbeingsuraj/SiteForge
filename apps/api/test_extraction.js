import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

async function test() {
  const url = 'https://www.google.com/maps/place/Blue+Bottle+Coffee+Ferry+Building/@37.7955,-122.3937,17z/data=!3m1!4b1!4m6!3m5!1s0x8085807c6d6d6d6d:0x1234567890abcdef!8m2!3d37.7955!4d-122.3937!16s%2Fg%2F11c5q8v7z';
  const result = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);