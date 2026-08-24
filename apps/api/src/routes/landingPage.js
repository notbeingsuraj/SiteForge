import express from 'express';
import LandingPageSpecService from '../services/LandingPageSpecService.js';

const router = express.Router();

/**
 * POST /api/landing-page/generate
 * Generate landing page specification
 * 
 * Body: { brandDNA: object, websiteStrategy: object, digitalAudit: object }
 * Returns: Landing page specification
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { brandDNA, websiteStrategy, digitalAudit } = req.body;
    
    if (!brandDNA || !websiteStrategy || !digitalAudit) {
      return res.status(400).json({ 
        error: 'brandDNA, websiteStrategy, and digitalAudit are required' 
      });
    }

    const spec = await LandingPageSpecService.generateSpec(brandDNA, websiteStrategy, digitalAudit);

    res.json({
      success: true,
      data: spec,
    });
  } catch (error) {
    next(error);
  }
});

export default router;