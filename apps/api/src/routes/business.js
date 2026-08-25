import express from 'express';
import BusinessResearchService from '../services/BusinessResearchService.js';
import BusinessDataExtractor from '../services/BusinessDataExtractor.js';

const router = express.Router();

/**
 * POST /api/business/research
 * Extract business intelligence from a Google Maps URL
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
    const isValid = BusinessResearchService.validateGoogleMapsUrl(googleMapsUrl);
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
 * GET /api/business/research/:placeId
 * Research business by Google Place ID
 * 
 * Returns: Full business intelligence object
 */
router.get('/research/:placeId', async (req, res, next) => {
  try {
    const { placeId } = req.params;
    
    if (!placeId) {
      return res.status(400).json({ 
        error: 'placeId is required' 
      });
    }

    // Get place details from Google Maps
    const placeDetails = await GoogleMapsService.getPlaceDetails(placeId);
    
    // Research and structure the business intelligence
    const intelligence = await BusinessResearchService.extractBusinessIntelligence(placeDetails);

    res.json({
      success: true,
      data: intelligence,
      metadata: {
        extractedAt: new Date().toISOString(),
        placeId,
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

    const isValid = GoogleMapsService.validateUrl(googleMapsUrl);
    
    if (!isValid) {
      return res.json({ valid: false });
    }

    // Try to resolve the URL to get place ID
    const resolved = await GoogleMapsService.resolveUrl(googleMapsUrl);

    res.json({
      valid: true,
      placeId: resolved.placeId,
      query: resolved.query,
      resolvedUrl: resolved.resolvedUrl,
    });
  } catch (error) {
    next(error);
  }
});

export default router;