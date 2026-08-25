import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

async function test() {
  const url = 'https://www.google.com/maps/place/Starbucks/@37.7749,-122.4194,15z/data=!3m1!4b1!4m6!3m5!1s0x8085807c6d6d6d6d:0x1234567890abcdef!8m2!3d37.7749!4d-122.4194!16s%2Fg%2F11c5q8v7z';
  const result = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);