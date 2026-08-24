import express from 'express';
import { config } from '../config/env.js';

const router = express.Router();

/**
 * Health check endpoint
 * Returns basic server status and configuration info
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0',
    services: {
      omniRoute: config.omniroute.apiKey ? 'configured' : 'missing',
    },
  });
});

/**
 * Detailed health check with dependency status
 */
router.get('/detailed', async (req, res) => {
  const checks = {
    server: { status: 'ok', timestamp: new Date().toISOString() },
    omniRoute: { status: config.omniroute.apiKey ? 'configured' : 'missing' },
    rateLimit: { 
      windowMs: config.rateLimit.windowMs, 
      maxRequests: config.rateLimit.maxRequests 
    },
  };

  const allOk = Object.values(checks).every(c => 
    typeof c.status === 'string' ? c.status === 'ok' : c.status === 'configured'
  );

  res.status(allOk ? 200 : 503).json({
    overall: allOk ? 'healthy' : 'degraded',
    checks,
  });
});

export default router;