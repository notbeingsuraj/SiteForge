import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

const extractor = BusinessDataExtractor;
const url = 'https://www.google.com/maps/search/?api=1&query=Nilkamal+Homes+Elante+Mall+Chandigarh';
const pageData = await extractor.fetchPage(url);
console.log('Final URL:', pageData.url);
console.log('--- Search for place links in HTML ---');
const matches = pageData.html.match(/\/place\/[^"'>]+/g);
console.log('Place links:', matches?.slice(0, 10));