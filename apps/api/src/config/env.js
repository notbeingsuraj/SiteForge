import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = ['OMNIROUTE_API_KEY'];
const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please check your .env file\n');
  process.exit(1);
}

export const config = {
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  debugBusinessAnalysis: process.env.DEBUG_BUSINESS_ANALYSIS === 'true',
  omniroute: {
    apiKey: process.env.OMNIROUTE_API_KEY,
    baseUrl: process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1',
    models: {
      fast: process.env.OMNIROUTE_FAST_MODEL || 'hy3-free',
      reasoning: process.env.OMNIROUTE_REASONING_MODEL || 'hy3-free',
      coding: process.env.OMNIROUTE_CODING_MODEL || 'auto/best-coding',
      copywriting: process.env.OMNIROUTE_COPYWRITING_MODEL || 'hy3-free',
    },
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || null,
    placesApiBaseUrl: 'https://places.googleapis.com/v1',
    fieldMask: 'id,displayName,formattedAddress,location,rating,userRatingCount,types,primaryType,primaryTypeDisplayName,nationalPhoneNumber,internationalPhoneNumber,websiteUri,regularOpeningHours,photos,priceLevel,editorialSummary,addressComponents,shortFormattedAddress',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  extraction: {
    timeout: parseInt(process.env.EXTRACTION_TIMEOUT_MS) || 15000,
    maxRetries: parseInt(process.env.EXTRACTION_MAX_RETRIES) || 2,
    userAgent: 'SiteForge/1.0 (+https://siteforge.app)',
  },
};
