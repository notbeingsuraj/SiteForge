import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

const extractor = BusinessDataExtractor;
const url = 'https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z';
const result = await extractor.extractFromGoogleMapsUrl(url);
console.log(JSON.stringify(result, null, 2));