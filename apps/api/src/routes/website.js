import express from 'express';
import WebsiteGenerationService from '../services/WebsiteGenerationService.js';
import BusinessResearchService from '../services/BusinessResearchService.js';
import BusinessDataExtractor from '../services/BusinessDataExtractor.js';
import GeneratedSiteManager from '../services/GeneratedSiteManager.js';

const router = express.Router();

/**
 * POST /api/business/generate
 * Generate a local website from a Google Maps URL or a previously analyzed business.
 *
 * Body:
 *   - googleMapsUrl: string (to analyze fresh)
 *   - business: object (pre-analyzed business intelligence; skips re-analysis)
 *   - options: { build, start } (default true)
 *
 * Returns: { success, website: { slug, path, port, url, status } }
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { googleMapsUrl, business, options = {} } = req.body;

    let businessData = business;

    // If a URL is provided (and no pre-analyzed business), run the extraction pipeline first.
    if (!businessData && googleMapsUrl) {
      if (!BusinessDataExtractor.validateGoogleMapsUrl(googleMapsUrl)) {
        return res.status(400).json({ error: 'Invalid Google Maps URL format' });
      }

      const result = await BusinessResearchService.extractBusinessIntelligenceWithProviders({
        googleMapsUrl,
        name: req.body.name,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
      });

      if (!result.intelligence?.identity?.name) {
        return res.status(503).json({
          success: false,
          error: 'provider_unavailable',
          message: 'Could not extract business data from URL.',
        });
      }
      businessData = result.intelligence;
    }

    if (!businessData || !businessData.identity?.name) {
      return res.status(400).json({ error: 'googleMapsUrl or business object (with name) is required' });
    }

    // Generate the site using deterministic verified facts.
    // Optional AI strategy/copy/spec are best-effort; the service falls back to
    // deterministic design/copy/theme when they are unavailable (keeps v1 robust).
    const result = await WebsiteGenerationService.generate(businessData, {
      build: options.build !== false,
      start: options.start !== false,
    });

    res.json({ success: true, website: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/website/list
 * List all generated sites with status/port/url.
 */
router.get('/list', async (req, res, next) => {
  try {
    const sites = await WebsiteGenerationService.list();
    res.json({ success: true, sites });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/website/:slug/start
 * Start a previously generated site (build if needed, then serve).
 */
router.post('/:slug/start', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const port = await GeneratedSiteManager.allocatePort(slug);
    const live = await GeneratedSiteManager.start(slug, port);
    res.json({ success: true, website: { slug, port: live.port, url: live.url, status: 'running' } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/website/:slug/stop
 * Stop a running generated site.
 */
router.post('/:slug/stop', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await GeneratedSiteManager.stop(slug);
    res.json({ success: true, website: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/website/:slug/regenerate
 * Regenerate a site (pulls fresh business data if URL provided, or rebuilds from
 * stored config). For v1: rebuild + restart using stored config if no URL.
 */
router.post('/:slug/regenerate', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { googleMapsUrl, options = {} } = req.body;

    // Stop if running
    await GeneratedSiteManager.stop(slug);

    if (googleMapsUrl) {
      // Fresh generation from URL — full pipeline
      const extraction = await BusinessResearchService.extractBusinessIntelligenceWithProviders({ googleMapsUrl });
      const result = await WebsiteGenerationService.generate(extraction.intelligence, {
        build: options.build !== false,
        start: options.start !== false,
      });
      return res.json({ success: true, website: result });
    }

    // Rebuild from stored config: install + build + start
    await GeneratedSiteManager.runInstall(slug);
    await GeneratedSiteManager.runBuild(slug);
    const port = await GeneratedSiteManager.allocatePort(slug);
    const live = await GeneratedSiteManager.start(slug, port);
    res.json({ success: true, website: { slug, port: live.port, url: live.url, status: 'running' } });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/website/:slug
 * Stop and permanently delete a generated site (removes directory + manifest).
 */
router.delete('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await GeneratedSiteManager.remove(slug);
    res.json({ success: true, website: result });
  } catch (error) {
    next(error);
  }
});

export default router;