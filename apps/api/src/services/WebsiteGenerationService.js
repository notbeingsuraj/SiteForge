/**
 * WebsiteGenerationService
 *
 * Orchestrates local website generation from a verified BusinessProfile:
 *
 *   verified business (from /api/business/analyze)
 *     + optional WebsiteStrategy / WebsiteCopy / LandingPageSpec (existing AI services)
 *     ↓
 *   assemble deterministic site.config.json (facts strictly from profile)
 *     → factual validation
 *     → copy reusable Astro template into generated-sites/<slug>/
 *     → write site.config.json
 *     → npm install → astro build → start localhost server on free port
 *     ↓
 *   { slug, path, port, url, status }
 *
 * The AI never invents business facts; it only provides design/content config
 * that this service merges over the verified profile. Any AI-provided copy is
 * passed through the FactualDataValidator.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import GeneratedSiteManager from './GeneratedSiteManager.js';
import { validateFactualFields, sanitizeAICopy } from './FactualDataValidator.js';

// Deterministic category → theme defaults used when no AI spec is available.
const THEMES = {
  bakery: {
    style: 'warm-editorial',
    colorPalette: { primary: '#8a5a2b', secondary: '#5c3d1e', accent: '#e0a458', background: '#fbf7f0', surface: '#f4ecdf', text: '#3a2a1a', muted: '#8a7663' },
    typography: { headingFont: "'Fraunces', Georgia, serif", bodyFont: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
    borderRadius: '14px',
  },
  restaurant: {
    style: 'warm-editorial',
    colorPalette: { primary: '#b03a2e', secondary: '#7c241c', accent: '#f2b632', background: '#fdfbf7', surface: '#f5efe5', text: '#2a2018', muted: '#7d6f5e' },
    typography: { headingFont: "'Playfair Display', Georgia, serif", bodyFont: "system-ui, sans-serif" },
    borderRadius: '12px',
  },
  furniture: {
    style: 'premium-editorial',
    colorPalette: { primary: '#1f2a33', secondary: '#3d4c5c', accent: '#c8a24a', background: '#f7f5f1', surface: '#eeece6', text: '#1c1c1c', muted: '#6b6b6b' },
    typography: { headingFont: "Georgia, 'Times New Roman', serif", bodyFont: "system-ui, sans-serif" },
    borderRadius: '8px',
  },
  corporate: {
    style: 'professional-corporate',
    colorPalette: { primary: '#1f3a5f', secondary: '#2e5b8a', accent: '#c9a86a', background: '#ffffff', surface: '#f4f6f9', text: '#16202c', muted: '#5b6b7c' },
    typography: { headingFont: "'Inter', system-ui, sans-serif", bodyFont: "'Inter', system-ui, sans-serif" },
    borderRadius: '10px',
  },
  retail: {
    style: 'clean-retail',
    colorPalette: { primary: '#0f2f4f', secondary: '#2c6e91', accent: '#f2a03d', background: '#ffffff', surface: '#f4f6f8', text: '#14181c', muted: '#5f6b75' },
    typography: { headingFont: "system-ui, sans-serif", bodyFont: "system-ui, sans-serif" },
    borderRadius: '12px',
  },
  health: {
    style: 'calm-health',
    colorPalette: { primary: '#2f6f6a', secondary: '#1f4f4b', accent: '#f0a35e', background: '#fbfdfd', surface: '#eef5f5', text: '#142422', muted: '#5e7572' },
    typography: { headingFont: "'Inter', system-ui, sans-serif", bodyFont: "'Inter', system-ui, sans-serif" },
    borderRadius: '12px',
  },
  default: {
    style: 'modern',
    colorPalette: { primary: '#2563eb', secondary: '#7c3aed', accent: '#f59e0b', background: '#ffffff', surface: '#f8fafc', text: '#0f172a', muted: '#64748b' },
    typography: { headingFont: "Georgia, 'Times New Roman', serif", bodyFont: "system-ui, -apple-system, sans-serif" },
    borderRadius: '12px',
  },
};

const CATEGORY_TO_THEME = [
  [/bakery|pastr|bread|cake/i, 'bakery'],
  [/restaurant|cafe|café|coffee|food|pizz|sushi|bar|grill|bistro|diner|deli/i, 'restaurant'],
  [/furniture|home|interior|decor|furnish/i, 'furniture'],
  [/office|center|cowork|business center|corporat|bank|insurance/i, 'corporate'],
  [/retail|store|shop|boutique|mall|market|outlet/i, 'retail'],
  [/health|dental|clinic|pharma|medical|fitness|gym|spa|salon|beauty/i, 'health'],
];

class WebsiteGenerationService {
  /**
   * @param {object} business  verified intelligence object from extractBusinessIntelligenceWithProviders
   * @param {object} [options]
   *   strategy  - WebsiteStrategyService JSON (optional)
   *   copy      - WebsiteCopywritingService JSON (optional)
   *   spec      - LandingPageSpecService JSON (optional)
   *   build     - run install+build (default true); set false to just scaffold
   *   start     - start server after build (default true)
   */
  async generate(business, options = {}) {
    if (!business || !business.identity?.name) {
      throw new Error('A verified business with a name is required to generate a website');
    }

    const slug = this.slugify(business.identity.name);
    const config = await this.assembleConfig(business, options);
    // `_validation` is an internal audit record; keep it out of the written JSON.
    const { _validation, ...writtenConfig } = config;

    // --- scaffold ---
    await GeneratedSiteManager.copyTemplate(slug);
    await GeneratedSiteManager.writeConfig(slug, writtenConfig);

    const result = {
      success: true,
      slug,
      path: GeneratedSiteManager.siteDir(slug),
      status: 'scaffolded',
    };

    const doBuild = options.build !== false;
    const doStart = options.start !== false;

    if (doBuild) {
      // Install only if requested (helps offline/dev iterations). ManagedSite
      // tolerates install failures when node_modules is usable; a real install
      // failure (no node_modules) surfaces here as a build-level error.
      if (GeneratedSiteManager.shouldRunInstall) {
        await GeneratedSiteManager.runInstall(slug);
      }
      // If node_modules present, build; otherwise throw a clear install error.
      await GeneratedSiteManager.runBuild(slug);
      result.build = 'ok';
      result.status = 'built';
    }

    if (doStart) {
      const port = await GeneratedSiteManager.allocatePort(slug);
      const live = await GeneratedSiteManager.start(slug, port);
      result.port = live.port;
      result.url = live.url;
      result.status = 'running';
    }

    return result;
  }

  /**
   * Deterministically assemble site.config.json from verified facts + AI config.
   */
  async assembleConfig(business, options = {}) {
    const facts = this.extractFacts(business);
    const copyJSON = options.copy || null;
    const spec = options.spec || null;
    const strategy = options.strategy || null;

    // Sanitize AI copy; drop invented factual claims.
    const { clean: cleanCopy, issues: copyIssues } = copyJSON
      ? sanitizeAICopy(copyJSON, { phone: facts.phone, email: facts.email, rating: facts.rating })
      : { clean: this.defaultCopy(facts), issues: [] };

    const theme = this.resolveTheme(facts, spec);
    const sections = this.resolveSections(facts, cleanCopy);
    const primaryCta = this.resolvePrimaryCta(facts, spec, strategy);
    const secondaryCta = this.resolveSecondaryCta(facts, spec, strategy);

    const config = {
      site: {
        slug: this.slugify(facts.name),
        title: facts.name,
        description: this.descriptionFor(facts, cleanCopy),
        lang: 'en',
        style: theme.style,
      },
      business: facts,
      facts: this.verifiedFacts(facts),
      copy: cleanCopy || this.defaultCopy(facts),
      sections,
      theme,
      primaryCta,
      secondaryCta,
      provenance: business.source?.providers || {},
      generatedAt: new Date().toISOString(),
    };

    // Factual safety: assembled factual fields must match the verified profile.
    const fieldIssues = validateFactualFields(facts, config);
    const allIssues = [...fieldIssues, ...copyIssues];
    if (fieldIssues.some((i) => /fabricated|name|phone|email|website|address/.test(i))) {
      const err = new Error(`Factual safety failure: ${allIssues.join('; ')}`);
      err.code = 'FACTUAL_SAFETY';
      throw err;
    }
    config._validation = { issues: allIssues };
    return config;
  }

  slugify(name) {
    const base = String(name || 'business')
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'business';
    return base;
  }

  /**
   * Extract a flat verified-facts object from the business intelligence shape.
   * Only non-null profile values are set; unknown remain null (never invented).
   */
  extractFacts(business) {
    const cats = Array.isArray(business.identity?.categories) ? business.identity.categories.map((c) => String(c)).filter(Boolean) : [];
    const hours = business.openingHours || null;
    return {
      name: business.identity?.name ?? null,
      category: business.identity?.category ?? null,
      categories: cats,
      description: business.identity?.description ?? null,
      phone: business.contact?.phone ?? null,
      email: business.contact?.email ?? null,
      website: business.contact?.website ?? null,
      address: business.location?.address ?? null,
      city: business.location?.city ?? null,
      state: business.location?.state ?? null,
      country: business.location?.country ?? null,
      postalCode: business.location?.postalCode ?? null,
      latitude: business.location?.coordinates?.lat ?? business.location?.coordinates?.latitude ?? null,
      longitude: business.location?.coordinates?.lng ?? business.location?.coordinates?.longitude ?? null,
      hours,
      hoursText: this.hoursToText(hours),
      rating: business.rating ?? null,
      reviewCount: business.reviewCount ?? null,
    };
  }

  hoursToText(hours) {
    if (!hours) return null;
    if (typeof hours === 'string') return hours;
    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const lines = [];
    for (const day of dayNames) {
      const key = day.toLowerCase();
      const val = hours[key] ?? hours[day.toLowerCase().slice(0,3)] ?? hours[day] ?? null;
      if (val) lines.push(`${day}: ${typeof val === 'object' ? JSON.stringify(val) : Array.isArray(val) ? val.join(', ') : val}`);
    }
    return lines.length ? lines.join(' · ') : null;
  }

  defaultCopy(facts) {
    const name = facts.name || 'This business';
    return {
      hero: {
        headline: name,
        subheadline: facts.description || `${name} — ${facts.category || 'local business'}.`,
        cta: null,
        secondaryCta: null,
      },
      services: {
        heading: 'What we offer',
        items: (facts.categories && facts.categories.length ? facts.categories.map((c) => ({ name: c, description: '' })) : []),
      },
      about: {
        heading: 'About',
        story: facts.description || `Welcome to ${name}.`,
        differentiators: [],
      },
      faq: [],
    };
  }

  descriptionFor(facts, copy) {
    if (copy?.hero?.subheadline) return copy.hero.subheadline;
    return facts.description || `Local business website for ${facts.name}.`;
  }

  resolveTheme(facts, spec) {
    const specTheme = spec?.theme;
    if (specTheme && !specTheme.error && (specTheme.colorPalette || specTheme.typography)) {
      const base = THEMES.default;
      return {
        style: specTheme.style || base.style,
        colorPalette: {
          primary: specTheme.colorPalette?.primary || base.colorPalette.primary,
          secondary: specTheme.colorPalette?.secondary || base.colorPalette.secondary,
          accent: specTheme.colorPalette?.accent || base.colorPalette.accent,
          background: specTheme.colorPalette?.background || base.colorPalette.background,
          surface: specTheme.colorPalette?.surface || base.colorPalette.surface,
          text: specTheme.colorPalette?.text || base.colorPalette.text,
          muted: specTheme.colorPalette?.muted || base.colorPalette.muted,
        },
        typography: {
          headingFont: specTheme.typography?.headingFont || base.typography.headingFont,
          bodyFont: specTheme.typography?.bodyFont || base.typography.bodyFont,
        },
        borderRadius: base.borderRadius,
      };
    }
    const cat = facts.category || (facts.categories && facts.categories[0]) || '';
    for (const [re, key] of CATEGORY_TO_THEME) {
      if (re.test(cat)) return THEMES[key];
    }
    return THEMES.default;
  }

  resolveSections(facts, copy) {
    const sections = ['hero'];
    if (facts.description || (copy?.about?.story && copy.about.story !== `Welcome to ${facts.name}.`)) sections.push('about');
    const hasServices = (facts.categories && facts.categories.length) || (copy?.services?.items && copy.services.items.length);
    if (hasServices) sections.push('services');
    if (facts.hours || facts.hoursText) sections.push('hours');
    if (facts.latitude != null || facts.longitude != null || facts.address) sections.push('location');
    if (facts.phone || facts.email || facts.website) sections.push('contact');
    if (copy?.faq && copy.faq.length) sections.push('faq');
    sections.push('cta');
    return Array.from(new Set(sections));
  }

  resolvePrimaryCta(facts, spec, strategy) {
    const specCta = spec?.primaryCTA;
    if (specCta?.text) {
      return { text: specCta.text, action: specCta.action || 'contact', href: null };
    }
    // Deterministic default based on available channels.
    if (facts.phone) return { text: facts.category ? `Call ${facts.name}` : 'Call now', action: 'call', href: null };
    if (facts.website) return { text: 'Visit our website', action: 'website', href: null };
    return { text: 'Get directions', action: 'directions', href: null };
  }

  resolveSecondaryCta(facts, spec, strategy) {
    const specSecondary = spec?.sections?.find?.((s) => s.type === 'hero')?.content?.secondaryCta;
    if (specSecondary?.text) {
      return { text: specSecondary.text, href: null };
    }
    if (facts.phone && facts.website) return { text: 'Visit website', href: facts.website };
    return null;
  }

  verifiedFacts(facts) {
    const list = [];
    if (facts.name) list.push({ claim: `Business name is ${facts.name}`, source: 'structured_provider', verified: true });
    if (facts.category) list.push({ claim: `Category: ${facts.category}`, source: 'structured_provider', verified: true });
    if (facts.rating != null) list.push({ claim: `Rating ${facts.rating}/5`, source: 'structured_provider', verified: true });
    return list;
  }

  /**
   * List generated sites (from manifest) for the UI.
   */
  async list() {
    const manifest = await GeneratedSiteManager.readManifest();
    const entries = Object.entries(manifest).map(([slug, m]) => ({
      slug,
      port: m?.port ?? null,
      url: m?.url ?? null,
      status: m?.status ?? 'unknown',
      startedAt: m?.startedAt ?? null,
      path: GeneratedSiteManager.siteDir(slug),
    }));
    entries.sort((a, b) => a.slug.localeCompare(b.slug));
    return entries;
  }

  async siteDir(slug) {
    return GeneratedSiteManager.siteDir(slug);
  }
}

export default new WebsiteGenerationService();
