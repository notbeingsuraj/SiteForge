import BusinessDataExtractor from './src/services/BusinessDataExtractor.js';

const extractor = BusinessDataExtractor;
const url = 'https://www.google.com/maps/search/?api=1&query=Nilkamal+Homes+Elante+Mall+Chandigarh';
const pageData = await extractor.fetchPage(url);
console.log('Status:', pageData.status);
console.log('Final URL:', pageData.url);
console.log('HTML preview:', pageData.html.substring(0, 3000));