import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

const extractor = BusinessDataExtractor;
const url = 'https://www.google.com/maps/place/Nilkamal+Homes/@30.9003452,75.85667325,17z/data=!3m1!4b1!4m6!3m5!1s0x390feb5b7b7b7b7b:0x1234567890abcdef!8m2!3d30.9003452!4d75.85667325!16s%2Fg%2F11c5q8v7z';
const pageData = await extractor.fetchPage(url);
const metadata = extractor.extractMetadata(pageData.html);
console.log('Metadata keys:', Object.keys(metadata));
console.log('JSON-LD:', JSON.stringify(metadata.jsonLd, null, 2));
console.log('Microdata:', JSON.stringify(metadata.microdata, null, 2));
console.log('OpenGraph:', JSON.stringify(metadata.openGraph, null, 2));
console.log('Visible text (first 2000):', metadata.visibleText?.substring(0, 2000));