import express from 'express';
import BrandStrategyService from '../services/BrandStrategyService.js';

const router = express.Router();

/**
 * POST /api/brand-strategy/generate
 * Generate Brand DNA from business data
 * 
 * Body: { businessData: object }
 * Returns: Brand DNA object
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { businessData } = req.body;
    
    if (!businessData) {
      return res.status(400).json({ 
        error: 'businessData is required' 
      });
    }

    const brandDNA = await BrandStrategyService.generateBrandDNA(businessData);

    res.json({
      success: true,
      data: brandDNA,
    });
  } catch (error) {
    next(error);
  }
});

export default router;