import express from 'express';
import BusinessResearchService from '../services/BusinessResearchService.js';
import BusinessDataExtractor from '../services/BusinessDataExtractor.js';
import { config } from '../config/env.js';

const router = express.Router();

/**
 * POST /api/business/analyze
 * Extract business intelligence from a Google Maps URL.
 * Thin route — delegates to BusinessResearchService, which orchestrates the
 * provider chain (Geoapify → web-extraction fallback → AI enrichment).
 * No Geoapify calls live in this route.
 * 
 * Body: { googleMapsUrl: string }
 * Returns: { success, business, businessDNA, metadata }
 */
router.post('/analyze', async (req, res, next) => {
  try {
    const { googleMapsUrl, name, city, state, country, latitude, longitude } = req.body;
    
    if (!googleMapsUrl && !name) {
      return res.status(400).json({ 
        error: 'googleMapsUrl or name is required' 
      });
    }

    // Validate URL format when provided (using the parser, not a network call)
    if (googleMapsUrl && !BusinessDataExtractor.validateGoogleMapsUrl(googleMapsUrl)) {
      return res.status(400).json({ 
        error: 'Invalid Google Maps URL format',
        code: 'INVALID_URL'
      });
    }

    // Orchestrated provider extraction (Geoapify-first, web fallback, AI enrichment)
    const result = await BusinessResearchService.extractBusinessIntelligenceWithProviders({
      googleMapsUrl,
      name,
      city,
      state,
      country,
      latitude,
      longitude,
    });

    const business = result.intelligence;

    // Provider chain returned nothing usable → 503 provider_unavailable
    const nothingUsable =
      result.provider?.geoapify &&
      result.provider?.geoapify !== 'ok' &&
      (!business.contact?.phone && !business.contact?.website && !business.location?.address);

    if (nothingUsable) {
      const providerError = {
        category: 'PROVIDER_UNAVAILABLE',
        httpStatus: null,
        safeMessage: 'Business provider temporarily unavailable. No business data was produced.',
      };

      return res.status(503).json({
        success: false,
        error: 'provider_unavailable',
        message: providerError.safeMessage,
        provider: {
          gateway: config.omniroute.baseUrl,
          model: config.omniroute.models.reasoning,
          category: providerError.category || 'PROVIDER_UNAVAILABLE',
          httpStatus: providerError.httpStatus || null,
          retryCount: 0,
          retryAttempted: false,
          geoapifyStatus: result.provider?.geoapify || null,
          webExtractionStatus: result.provider?.webExtraction || null,
        },
        data: null,
      });
    }

    // Brand-DNA generation is optional additive enrichment. Extraction has
    // already succeeded (business is valid). If the AI brand-DNA step fails
    // (e.g. transient upstream 500), we must NOT discard the successful
    // extraction or return HTTP 500. We surface an explicit failure state
    // instead, while keeping the valid business profile. Real extraction
    // errors are NOT swallowed here — they throw earlier, in
    // extractBusinessIntelligenceWithProviders, and follow the normal
    // errorHandler path.
    const { default: BrandStrategyService } = await import('../services/BrandStrategyService.js');
    let businessDNA = null;
    let brandStrategyStatus = 'not_attempted';
    try {
      businessDNA = await BrandStrategyService.generateBrandDNA(business);
      brandStrategyStatus = 'ok';
    } catch (brandError) {
      // Optional enrichment failed — log server-side (safe/redacted), do not 500.
      const safeMsg = brandError?.safeMessage || brandError?.message || 'unknown';
      console.error('[business/analyze] Brand DNA generation failed (non-fatal, extraction preserved):', safeMsg);
      brandStrategyStatus = 'failed';
      businessDNA = null;
    }

    res.json({
      success: true,
      business,
      businessDNA,
      brandStrategy: { status: brandStrategyStatus },
      metadata: {
        source: 'geoapify_and_web_extraction',
        providers: result.provider,
        confidence: business.confidence?.overall || 0,
        extractedAt: new Date().toISOString(),
        cached: false,
        persistence: result.persistence,
        brandDNAStatus: brandStrategyStatus,
        validationIssues: result.validation?.issues?.length ? result.validation.issues.map((i) => i.field) : [],
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

    // Extract business data via the provider orchestration (Geoapify → web fallback → AI)
    const result = await BusinessResearchService.extractBusinessIntelligenceWithProviders({
      googleMapsUrl,
      name: req.body.name,
      city: req.body.city,
      state: req.body.state,
      country: req.body.country,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
    });

    res.json({
      success: true,
      data: result.intelligence,
      metadata: {
        extractedAt: new Date().toISOString(),
        sourceUrl: googleMapsUrl,
        providers: result.provider,
        validationIssues: result.validation?.issues?.length ? result.validation.issues.map((i) => i.field) : [],
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