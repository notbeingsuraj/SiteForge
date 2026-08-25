import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

async function test() {
  // Invalid/nonexistent URL
  const url = 'https://www.google.com/maps/place/ThisBusinessDoesNotExist12345/@0,0,15z/data=!3m1!4b1';
  try {
    const result = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
    console.log('UNEXPECTED SUCCESS:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('EXPECTED FAILURE:', error.message);
  }
}

test().catch(console.error);