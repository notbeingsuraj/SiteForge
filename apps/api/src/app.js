import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      const isDevelopmentOrigin = config.nodeEnv === 'development'
        && (!origin || /^https?:\/\/localhost:\d+$/.test(origin));
      const isConfiguredOrigin = !origin || origin === config.frontendUrl;

      callback(null, isConfiguredOrigin || isDevelopmentOrigin);
    },
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'SiteForge API',
    version: '1.0.0',
    description: 'Stateless backend for business intelligence and website generation',
    endpoints: {
      health: '/health',
      // Note: Lead persistence endpoints removed - application is stateless
    },
  });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
