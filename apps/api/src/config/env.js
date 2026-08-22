import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = ['GOOGLE_MAPS_API_KEY', 'OMNIROUTE_API_KEY'];
const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please check your .env file\n');
  process.exit(1);
}

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  debugBusinessAnalysis: process.env.DEBUG_BUSINESS_ANALYSIS === 'true',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  omniroute: {
    apiKey: process.env.OMNIROUTE_API_KEY,
    baseUrl: process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1',
    models: {
      fast: process.env.OMNIROUTE_FAST_MODEL || 'auto/coding',
      reasoning: process.env.OMNIROUTE_REASONING_MODEL || 'auto/coding',
      coding: process.env.OMNIROUTE_CODING_MODEL || 'auto/coding',
      copywriting: process.env.OMNIROUTE_COPYWRITING_MODEL || 'auto/coding',
    },
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
