/**
 * Website Generation E2E test.
 *
 * Runs the full pipeline deterministically (no live extraction needed):
 *   verified BusinessProfile → WebsiteGenerationService → Astro build → local
 *   server → HTTP request → inspect rendered HTML.
 *
 * Covers (per the WEBSITE-GENERATION spec's testing section):
 *   1. slug generation
 *   2. site config generation (facts preserved)
 *   3. missing optional fields (no fabrication)
 *   4. fabricated field rejection / sanitization
 *   5. Astro build
 *   6. local server startup
 *   7. localhost HTTP 200
 *   8. port collision handling
 *   9. regeneration
 *
 * Usage:  node test_website_generation.js   (from apps/api)
 * Requires: node_modules present (npm install ran in this repo).
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import WebsiteGenerationService from './src/services/WebsiteGenerationService.js';
import GeneratedSiteManager from './src/services/GeneratedSiteManager.js';
import { sanitizeAICopy, assertFactualIntegrity } from './src/services/FactualDataValidator.js';
import { validateFactualFields } from './src/services/FactualDataValidator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, label, extra) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; failures.push(label); console.log(`  ✗ FAIL: ${label}${extra ? ` — ${extra}` : ''}`); }
}

/** Deterministic, verified-looking Tartine bakery profile (mirrors Geoapify output). */
function tartineProfile() {
  return {
    identity: { name: 'Tartine Bakery', category: 'Bakery', categories: ['commercial', 'commercial.food_and_drink', 'commercial.food_and_drink.bakery'], description: 'Artisanal bakery in San Francisco.' },
    contact: { phone: '+1-415-487-2600', email: null, website: 'https://tartinebakery.com/san-francisco/bakery' },
    location: { address: 'Tartine Bakery, 600 Guerrero Street, San Francisco, CA 94110, United States of America', city: 'San Francisco', state: 'California', country: 'United States of America', postalCode: '94110', coordinates: { lat: 37.7615, lng: -122.4227 } },
    openingHours: { monday: '07:30-18:00', tuesday: '07:30-18:00', wednesday: '07:30-18:00', thursday: '07:30-18:00', friday: '07:30-18:00', saturday: '07:30-18:00', sunday: '07:30-18:00' },
    rating: null, reviewCount: null,
    source: { providers: { geoapify: 'ok', webExtraction: 'ok', aiEnrichment: true } },
  };
}

/** Profile with all optional fields missing — must render without fabrication. */
function sparseProfile() {
  return {
    identity: { name: 'Corner Market', category: 'Grocery Store', categories: ['Grocery Store'], description: null },
    contact: { phone: null, email: null, website: null },
    location: { address: '1 Main Street', city: 'Springfield', state: 'IL', country: null, postalCode: null, coordinates: null },
    openingHours: null,
    rating: null, reviewCount: null,
    source: { providers: { geoapify: 'ok', webExtraction: null, aiEnrichment: false } },
  };
}

async function httpGet(port, pathname = '/') {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

async function main() {
  console.log('\n=== Website Generation E2E ===\n');

  // 1. Slug generation
  console.log('1. Slug generation');
  assert(WebsiteGenerationService.slugify('Tartine Bakery') === 'tartine-bakery', 'simple name');
  assert(WebsiteGenerationService.slugify('Café Olé! & Grill') === 'caf-ol-grill', 'accents + special chars');
  assert(WebsiteGenerationService.slugify('  ') === 'business', 'empty → fallback');
  assert(/^[a-z0-9-]+$/.test(WebsiteGenerationService.slugify('New York  Sushi 123')), 'slug-safe chars only');

  // 2. Config generation — facts preserved from profile
  console.log('\n2. Site config generation (fact preservation)');
  const cfg = await WebsiteGenerationService.assembleConfig(tartineProfile(), {});
  assert(cfg.business.name === 'Tartine Bakery', 'name preserved');
  assert(cfg.business.phone === '+1-415-487-2600', 'phone preserved');
  assert(cfg.business.website === 'https://tartinebakery.com/san-francisco/bakery', 'website preserved');
  assert(cfg.business.address.includes('600 Guerrero Street'), 'address preserved');
  assert(cfg.business.hours?.monday === '07:30-18:00', 'hours preserved');
  assert(cfg.business.email === null, 'unknown email stays null');
  assert(cfg.business.rating === null, 'unknown rating stays null');
  assert(cfg.business.reviewCount === null, 'unknown reviewCount stays null');
  assert(cfg.provenance?.geoapify === 'ok', 'provenance preserved');
  assert(cfg.sections.includes('hero') && cfg.sections.includes('hours'), 'sections computed');

  // 3. Missing optional fields → no fabrication
  console.log('\n3. Missing optional fields (graceful, no fabrication)');
  const sparse = await WebsiteGenerationService.assembleConfig(sparseProfile(), {});
  assert(sparse.business.phone === null, 'sparse phone null');
  assert(sparse.business.email === null, 'sparse email null');
  assert(sparse.business.website === null, 'sparse website null');
  assert(sparse.sections.includes('contact') === false, 'no contact section without channels');
  assert(!sparse.sections.includes('hours'), 'no hours section without hours');
  assert(sparse.primaryCta.text === 'Get directions', 'CTA falls back to directions');

  // 4. Fabricated field rejection
  console.log('\n4. Fabricated field rejection / sanitization');
  // validateFactualFields must flag a fabricated phone in assembled config
  const badAssembled = { business: { name: 'Tartine Bakery', phone: '555-555-5555', category: 'Bakery', address: null, website: null, email: null, hours: null, rating: null, reviewCount: null, city: null, state: null, country: null, postalCode: null } };
  const issues = validateFactualFields(tartineProfile(), badAssembled);
  assert(issues.some((i) => i.includes('phone')), 'fabricated phone flagged');
  // assertFactualIntegrity throws on fabricated name/phone/email/website/address
  // (it expects a flat source profile: {name, phone, email, website, address, ...})
  const flatSource = {
    name: 'Tartine Bakery', category: 'Bakery',
    phone: '+1-415-487-2600', email: null, website: 'https://tartinebakery.com/san-francisco/bakery',
    address: 'Tartine Bakery, 600 Guerrero Street', city: 'San Francisco', state: 'California',
    country: 'USA', postalCode: '94110', rating: null, reviewCount: null, hours: { monday: '07:30' },
  };
  let threw = false;
  try { assertFactualIntegrity(flatSource, { business: { name: 'Tartine Bakery', phone: '555-555-5555', website: 'https://fake.example', address: '123 Fake St', category: 'Bakery', email: null, hours: null, rating: null, reviewCount: null, city: null, state: null, country: null, postalCode: null } }); }
  catch (e) { threw = e.code === 'FACTUAL_SAFETY'; }
  assert(threw, 'assertFactualIntegrity throws on fabrications');

  // sanitizeAICopy drops invented phone/email/review claims
  const aiCopy = {
    hero: { headline: 'Fresh baked daily', subheadline: 'Call 555-555-5555 or email fake@example.com today. 500+ five-star reviews!' },
    services: { items: [] }, about: { story: 'A local bakery.', differentiators: [] }, faq: [],
  };
  const { clean, issues: copyIssues } = sanitizeAICopy(aiCopy, { phone: '+1-415-487-2600', email: null, rating: null });
  assert(clean.hero.subheadline.includes('555-555-5555') === false, 'invented phone removed from copy');
  assert(clean.hero.subheadline.includes('fake@example.com') === false, 'invented email removed from copy');
  assert(clean.hero.subheadline.includes('500+') === false, 'review claim removed from copy');

  // 5-9. Build + server + HTTP + port + regenerate.
  // The E2E deliberately runs install+build to be a real end-to-end proof,
  // not just unit assertions. Requires network+npm (first run ~30-60s).
  console.log('\n5. Astro build, server start, HTTP');
  if (!process.env.SF_SKIP_BUILD_E2E) {
    // Ensure astro is available (generated site installs it). If the resolved
    // 'astro' package is absent at repo level, the generate() flow installs it.
    try { await GeneratedSiteManager.remove('tartine-bakery'); } catch {}
    try { await GeneratedSiteManager.remove('corner-market'); } catch {}

    // --- Tartine (fuller profile) ---
    const result = await WebsiteGenerationService.generate(tartineProfile(), { build: true, start: true });
    assert(result.success === true, 'generation success');
    assert(result.build === 'ok', 'astro build ok');
    assert(result.status === 'running', 'server running');
    assert(typeof result.port === 'number', 'port allocated');

    // HTTP 200 + content
    const res = await httpGet(result.port, '/');
    assert(res.status === 200, 'localhost returns HTTP 200');
    assert(res.body.includes('Tartine Bakery'), 'page contains business name');
    assert(res.body.includes('+1-415-487-2600'), 'page contains verified phone');
    assert(res.body.includes('600 Guerrero Street'), 'page contains verified address');
    assert(!res.body.includes('reviews'), 'no fabricated reviews');
    assert(!res.body.includes('mailto:'), 'no fake email link');

    // site.config.json on disk
    const cfgFile = await fsp.readFile(path.join(REPO_ROOT, 'generated-sites', 'tartine-bakery', 'src', 'data', 'site.config.json'), 'utf8');
    const onDisk = JSON.parse(cfgFile);
    assert(onDisk.business.name === 'Tartine Bakery', 'site.config.json written with verified name');

    // 6. missing-field profile also builds and omits (graceful degradation)
    console.log('\n6. Sparse-profile generation (missing phone/website/hours)');
    const sparseRes = await WebsiteGenerationService.generate(sparseProfile(), { build: true, start: true });
    assert(sparseRes.status === 'running', 'sparse profile generates + runs');
    // Reuse the freshly-built dist: fetch its page (port allocated by manager)
    const sparsePage = await httpGet(sparseRes.port, '/');
    assert(sparsePage.status === 200, 'sparse page HTTP 200');
    assert(sparsePage.body.includes('Corner Market'), 'sparse page shows name');
    assert(!sparsePage.body.includes('mailto:'), 'sparse page no email');
    assert(!/tel:/.test(sparsePage.body), 'sparse page no phone link');
    assert(!sparsePage.body.includes('reviews'), 'sparse page no reviews');
    await GeneratedSiteManager.remove('corner-market');

    // 8. Port collision handling
    console.log('\n8. Port collision handling');
    const port2 = await GeneratedSiteManager.allocatePort('tartine-bakery');
    assert(port2 !== result.port, 'next site gets a different port');

    // 9. Regeneration (rebuild + restart same slug)
    console.log('\n9. Regeneration');
    const regen = await WebsiteGenerationService.generate(tartineProfile(), { build: true, start: true });
    assert(regen.slug === 'tartine-bakery', 'regenerate same slug');
    assert(regen.status === 'running', 'regenerate re-runs');

    // cleanup
    await GeneratedSiteManager.remove('tartine-bakery');
  } else {
    console.log('  • Build E2E skipped (SF_SKIP_BUILD_E2E set).');
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    console.log('Failures:', failures);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('E2E run error:', e);
  process.exitCode = 1;
});
