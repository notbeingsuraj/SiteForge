import express from 'express';
import DigitalAuditService from '../services/DigitalAuditService.js';
import BusinessResearchService from '../services/BusinessResearchService.js';
import BusinessDataExtractor from '../services/BusinessDataExtractor.js';

const router = express.Router();

/**
 * POST /api/digital-audit
 * Perform digital audit on business data
 * 
 * Body: { businessData: object }
 * Returns: Digital audit results
 */
router.post('/', async (req, res, next) => {
  try {
    const { businessData } = req.body;
    
    if (!businessData) {
      return res.status(400).json({ 
        error: 'businessData is required' 
      });
    }

    const audit = await DigitalAuditService.auditDigitalPresence(businessData);

    res.json({
      success: true,
      data: audit,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/digital-audit/extract-and-audit
 * Extract business data from URL and perform digital audit in one call
 * 
 * Body: { googleMapsUrl: string }
 * Returns: Digital audit results with business data
 */
router.post('/extract-and-audit', async (req, res, next) => {
  try {
    const { googleMapsUrl } = req.body;
    
    if (!googleMapsUrl) {
      return res.status(400).json({ 
        error: 'googleMapsUrl is required' 
      });
    }

    // First extract business data
    const extractedData = await BusinessDataExtractor.extractFromGoogleMapsUrl(googleMapsUrl);
    const businessData = await BusinessResearchService.extractBusinessIntelligence(extractedData);
    
    // Then perform digital audit
    const audit = await DigitalAuditService.auditDigitalPresence(businessData);

    res.json({
      success: true,
      data: {
        businessData,
        audit,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;