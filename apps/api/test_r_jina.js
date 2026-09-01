import axios from 'axios';

const testUrl = 'http://maps.google.com/maps?q=Nilkamal+Homes+Elante+Mall+Chandigarh';
const proxyUrl = `https://r.jina.ai/${testUrl}`;

async function test() {
  try {
    const response = await axios.get(proxyUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Webloom/1.0 (+https://webloom.dev)',
      },
    });
    
    console.log('Status:', response.status);
    console.log('Data type:', typeof response.data);
    
    if (typeof response.data === 'string') {
      console.log('--- MARKDOWN CONTENT (first 3000 chars) ---');
      console.log(response.data.substring(0, 3000));
    } else {
      console.log('--- JSON DATA ---');
      console.log(JSON.stringify(response.data, null, 2).substring(0, 3000));
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

test();