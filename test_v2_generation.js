/**
 * V2 Website Generation Test
 * 
 * Tests the new DesignIntelligenceService + updated WebsiteGenerationService
 * with multiple businesses to verify business-specific design generation.
 */

import WebsiteGenerationService from './apps/api/src/services/WebsiteGenerationService.js';
import BusinessResearchService from './apps/api/src/services/BusinessResearchService.js';
import BrandStrategyService from './apps/api/src/services/BrandStrategyService.js';
import DigitalAuditService from './apps/api/src/services/DigitalAuditService.js';
import DesignIntelligenceService from './apps/api/src/services/DesignIntelligenceService.js';

const designIntelligenceService = new DesignIntelligenceService();
import { config } from './apps/api/src/config/env.js';

const testBusinesses = [
  {
    name: 'Tartine Bakery',
    city: 'San Francisco',
    state: 'CA',
    latitude: 37.7615,
    longitude: -122.4218,
    googleMapsUrl: 'https://www.google.com/maps/place/Tartine+Bakery/@37.7615,-122.4218,17z',
    expectedCategory: 'bakery',
  },
  {
    name: 'Zuni Cafe',
    city: 'San Francisco', 
    state: 'CA',
    latitude: 37.7794,
    longitude: -122.4212,
    googleMapsUrl: 'https://maps.google.com/?cid=4268564523473092854',
    expectedCategory: 'restaurant',
  },
  {
    name: 'Warby Parker',
    city: 'New York',
    state: 'NY', 
    latitude: 40.7243,
    longitude: -73.9975,
    googleMapsUrl: 'https://maps.google.com/?cid=4268564523473092855',
    expectedCategory: 'retail',
  },
  {
    name: 'Equinox Fitness',
    city: 'New York',
    state: 'NY',
    latitude: 40.745,
    longitude: -73.988,
    googleMapsUrl: 'https://maps.google.com/?cid=4268564523473092857',
    expectedCategory: 'gym',
  },
  {
    name: 'The Ritz-Carlton Chicago',
    city: 'Chicago',
    state: 'IL',
    latitude: 41.8992,
    longitude: -87.6241,
    googleMapsUrl: 'https://maps.google.com/?cid=4268564523473092858',
    expectedCategory: 'hotel',
  },
];

async function runTest() {
  console.log('=== WEBLOOM V2 GENERATION TEST ===\n');
  console.log(`Testing ${testBusinesses.length} businesses...\n`);

  const results = [];

  for (let i = 0; i < testBusinesses.length; i++) {
    const biz = testBusinesses[i];
    console.log(`\n[${i+1}/${testBusinesses.length}] ${biz.name} (${biz.expectedCategory})`);
    
    const startTime = Date.now();
    
    try {
      // Step 1: Research
      console.log('  1. Researching business...');
      const research = await BusinessResearchService.extractBusinessIntelligenceWithProviders({
        googleMapsUrl: biz.googleMapsUrl,
        name: biz.name,
        city: biz.city,
        state: biz.state,
        latitude: biz.latitude,
        longitude: biz.longitude,
      });
      
      const business = research.intelligence;
      console.log(`     ✓ ${business.identity.name} | ${business.identity.category} | phone: ${business.contact?.phone ? 'yes' : 'no'} | web: ${business.contact?.website ? 'yes' : 'no'}`);

      // Step 2: Brand DNA (skip AI when using deterministic fallback)
      console.log('  2. Generating Brand DNA...');
      let brandDNA;
      try {
        brandDNA = await BrandStrategyService.generateBrandDNA(business);
        console.log(`     ✓ ${brandDNA.brandPersonality?.join(', ') || 'generated'}`);
      } catch (error) {
        console.log(`     ⚠ Brand DNA failed (using fallback): ${error.message}`);
        brandDNA = { brandPersonality: ['professional', 'trustworthy'] };
      }

      // Step 3: Digital Audit (skip AI when using deterministic fallback)
      console.log('  3. Running Digital Audit...');
      let digitalAudit;
      try {
        digitalAudit = await DigitalAuditService.auditDigitalPresence(business);
        console.log(`     ✓ Score: ${digitalAudit.overallScore}/100`);
      } catch (error) {
        console.log(`     ⚠ Digital Audit failed (using fallback): ${error.message}`);
        digitalAudit = { overallScore: 50 };
      }

      // Step 4: Design Intelligence
      console.log('  4. Generating Design Intelligence...');
      const designIntelligence = await designIntelligenceService.generateDesignIntelligence(
        business, brandDNA, digitalAudit,
        { skipAIDesign: true } // Use deterministic fallback
      );
      const summary = designIntelligenceService.extractSummary(designIntelligence);
      console.log(`     ✓ Layout: ${summary.layoutFamily} | Theme: ${summary.visualDirection} | Primary: ${summary.primaryColor}`);
      console.log(`     Sections: ${summary.sections.join(', ')}`);
      console.log(`     Hero Asset: ${summary.heroAsset} | Supporting: ${summary.supportingAssets}`);

      // Step 5: Generate Website
      console.log('  5. Generating Website...');
      const result = await WebsiteGenerationService.generate(business, {
        designIntelligence,
        build: true,
        start: true,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`     ✓ Site generated: ${result.url} (port ${result.port}) in ${elapsed}s`);
      console.log(`     Design: ${result.designIntelligence?.layoutFamily} | ${result.designIntelligence?.visualDirection}`);

      results.push({
        name: biz.name,
        category: biz.expectedCategory,
        slug: result.slug,
        port: result.port,
        url: result.url,
        layoutFamily: result.designIntelligence?.layoutFamily,
        visualDirection: result.designIntelligence?.visualDirection,
        primaryColor: result.designIntelligence?.primaryColor,
        sections: result.designIntelligence?.sections,
        elapsed: elapsed,
        success: true,
      });

    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`     ✗ FAILED after ${elapsed}s: ${error.message}`);
      results.push({
        name: biz.name,
        category: biz.expectedCategory,
        success: false,
        error: error.message,
        elapsed: elapsed,
      });
    }

    // Brief pause between sites
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('\n=== TEST SUMMARY ===');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\nTotal: ${results.length} | Success: ${successful.length} | Failed: ${failed.length}\n`);
  
  console.log('--- Successful Sites ---');
  for (const r of successful) {
    console.log(`  ${r.name.padEnd(25)} | ${r.category.padEnd(12)} | ${r.layoutFamily.padEnd(16)} | ${r.visualDirection.padEnd(20)} | ${r.primaryColor} | ${r.elapsed}s`);
  }

  console.log('\n--- Design Variation Analysis ---');
  const layoutFamilies = [...new Set(successful.map(r => r.layoutFamily))];
  const visualDirections = [...new Set(successful.map(r => r.visualDirection))];
  const primaryColors = [...new Set(successful.map(r => r.primaryColor))];
  console.log(`  Layout Families: ${layoutFamilies.join(', ')}`);
  console.log(`  Visual Directions: ${visualDirections.join(', ')}`);
  console.log(`  Primary Colors: ${primaryColors.join(', ')}`);
  
  if (layoutFamilies.length > 1) {
    console.log('\n✓ PASS: Multiple layout families generated');
  } else {
    console.log('\n✗ FAIL: Only one layout family used');
  }
  
  if (visualDirections.length > 1) {
    console.log('✓ PASS: Multiple visual directions generated');
  } else {
    console.log('✗ FAIL: Only one visual direction used');
  }

  if (failed.length > 0) {
    console.log('\n--- Failed Sites ---');
    for (const r of failed) {
      console.log(`  ${r.name}: ${r.error}`);
    }
  }

  return results;
}

runTest().catch(console.error);