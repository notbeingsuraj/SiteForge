import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

async function test() {
  // Real Google Maps URL for a real business
  const url = 'https://www.google.com/maps/place/Tartine+Bakery/@37.7615,-122.4218,17z/data=!3m1!4b1!4m6!3m5!1s0x8085808c6b8e8e8e:0x8c7d6b5a4f3e2d1c!8m2!3d37.7615!4d-122.4218!16s%2Fg%2F11b8c7d6e5';
  const result = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);