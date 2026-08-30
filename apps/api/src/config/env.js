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
  ai: {
    primaryModel: process.env.AI_PRIMARY_MODEL || null,
    fallbackModel: process.env.AI_FALLBACK_MODEL || null,
  },
  omniroute: {
    apiKey: process.env.OMNIROUTE_API_KEY,
    baseUrl: process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1',
    models: {
      fast: process.env.OMNIROUTE_FAST_MODEL || 'auto/best-fast',
      reasoning: process.env.OMNIROUTE_REASONING_MODEL || 'auto/best-coding',
      coding: process.env.OMNIROUTE_CODING_MODEL || 'auto/best-coding',
      copywriting: process.env.OMNIROUTE_COPYWRITING_MODEL || 'auto/best-fast',
    },
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
  geoapify: {
    apiKey: process.env.GEOAPIFY_API_KEY || null,
    baseUrl: process.env.GEOAPIFY_BASE_URL || 'https://api.geoapify.com/v2/places',
    timeout: parseInt(process.env.GEOAPIFY_TIMEOUT_MS) || 10000,
    maxResults: parseInt(process.env.GEOAPIFY_MAX_RESULTS) || 5,
  },
};
