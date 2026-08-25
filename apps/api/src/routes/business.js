import express from 'express';
import BusinessResearchService from '../services/BusinessResearchService.js';
import BusinessDataExtractor from '../services/BusinessDataExtractor.js';

const router = express.Router();

/**
 * POST /api/business/analyze
 * Extract business intelligence from a Google Maps URL (no API key required)
 * Phase 15 API contract
 * 
 * Body: { googleMapsUrl: string }
 * Returns: { success, business, businessDNA, metadata }
 */
router.post('/analyze', async (req, res, next) => {
  try {
    const { googleMapsUrl } = req.body;
    
    if (!googleMapsUrl) {
      return res.status(400).json({ 
        error: 'googleMapsUrl is required' 
      });
    }

    // Validate URL format using extractor's validator
    const isValid = BusinessDataExtractor.validateGoogleMapsUrl(googleMapsUrl);
    if (!isValid) {
      return res.status(400).json({ 
        error: 'Invalid Google Maps URL format',
        code: 'INVALID_URL'
      });
    }

    // Extract business data from public page
    const extractedData = await BusinessDataExtractor.extractFromGoogleMapsUrl(googleMapsUrl);
    
    // Transform to normalized BusinessProfile
    const business = await BusinessResearchService.extractBusinessIntelligence(extractedData);

    // Build Business DNA using existing BrandStrategyService
    // (imported lazily to avoid circular deps if needed)
    const { default: BrandStrategyService } = await import('../services/BrandStrategyService.js');
    const businessDNA = await BrandStrategyService.generateBrandDNA(business);

    res.json({
      success: true,
      business,
      businessDNA,
      metadata: {
        source: 'google_maps_public_data',
        confidence: extractedData.confidence?.overall || 0,
        extractedAt: extractedData.metadata?.extractedAt || new Date().toISOString(),
        cached: extractedData.cached || false,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/business/research
 * Extract business intelligence from a Google Maps URL (alias for /analyze)
 * 
 * Body: { googleMapsUrl: string }
 * Returns: Full business intelligence object
 */
router.post('/research', async (req, res, next) => {
  try {
    const { googleMapsUrl } = req.body;
    
    if (!googleMapsUrl) {
      return res.status(400).json({ 
        error: 'googleMapsUrl is required' 
      });
    }

    // Validate URL format
    const isValid = BusinessDataExtractor.validateGoogleMapsUrl(googleMapsUrl);
    if (!isValid) {
      return res.status(400).json({ 
        error: 'Invalid Google Maps URL format' 
      });
    }

    // Extract business data
    const extractedData = await BusinessDataExtractor.extractFromGoogleMapsUrl(googleMapsUrl);
    
    // Research and structure the business intelligence
    const intelligence = await BusinessResearchService.extractBusinessIntelligence(extractedData);

    res.json({
      success: true,
      data: intelligence,
      metadata: {
        extractedAt: new Date().toISOString(),
        sourceUrl: googleMapsUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/business/validate-url
 * Validate a Google Maps URL without full extraction
 * 
 * Body: { googleMapsUrl: string }
 * Returns: { valid: boolean, placeId?: string, query?: string }
 */
router.post('/validate-url', async (req, res, next) => {
  try {
    const { googleMapsUrl } = req.body;
    
    if (!googleMapsUrl) {
      return res.status(400).json({ 
        error: 'googleMapsUrl is required' 
      });
    }

    const isValid = BusinessDataExtractor.validateGoogleMapsUrl(googleMapsUrl);
    
    if (!isValid) {
      return res.json({ valid: false });
    }

    // Extract identifiers without full fetch
    const placeId = BusinessDataExtractor.extractPlaceId(googleMapsUrl);
    const placeName = BusinessDataExtractor.extractPlaceName(googleMapsUrl);

    res.json({
      valid: true,
      placeId,
      query: placeName,
      resolvedUrl: googleMapsUrl,
    });
  } catch (error) {
    next(error);
  }
});

export default router;