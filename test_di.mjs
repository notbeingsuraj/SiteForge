import DesignIntelligenceService from './apps/api/src/services/DesignIntelligenceService.js';

const service = new DesignIntelligenceService();
console.log('Service created, testing generateDeterministicIntelligence...');

try {
  const result = service.generateDeterministicIntelligence(
    { 
      identity: { name: 'Test Bakery', category: 'Bakery', categories: ['Bakery'], description: 'A test bakery' }, 
      contact: { phone: '+1-555-1234', email: null, website: 'https://example.com' }, 
      location: { address: '123 Main St', city: 'San Francisco', state: 'CA', country: 'USA', postalCode: '94102', coordinates: { lat: 37.7749, lng: -122.4194 } }, 
      openingHours: { monday: '08:00-18:00' }, 
      rating: 4.5, 
      reviewCount: 100, 
      services: ['Bread', 'Pastries', 'Coffee'] 
    },
    { brandPersonality: ['warm', 'artisan', 'welcoming'] },
    { overallScore: 50, categories: {} },
    Date.now()
  );
  console.log('SUCCESS:', JSON.stringify(result, null, 2).substring(0, 500));
} catch (e) {
  console.error('ERROR:', e.message);
  console.error(e.stack);
}