#!/usr/bin/env node
/**
 * Test suite for Phase 2 Evidence/Provenance/Conflict System
 */

import BusinessProfile from './apps/api/src/services/BusinessProfile.js';

async function runTests() {
  console.log('=== PHASE 2 EVIDENCE/PROVENANCE/CONFLICT SYSTEM TESTS ===\n');
  
  let passed = 0;
  let failed = 0;
  
  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      return true;
    } else {
      console.log(`  ✗ ${message}`);
      return false;
    }
  }
  
  // Test 1: Single source
  console.log('\n--- Test 1: Single source ---');
  const profile1 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile1.set('contact.phone', '555-1234', 'discovered', 0.9, { 
    sourceUrl: 'https://example.com', 
    provider: 'geoapify' 
  });
  
  const phone1 = profile1.get('contact.phone');
  const field1 = profile1.getField('contact.phone');
  const conflicts1 = profile1.getConflicts('contact.phone');
  const evidence1 = profile1.getEvidenceForField('contact.phone');
  const sources1 = profile1.getSourcesForField('contact.phone');
  
  passed += assert(phone1 === '555-1234', 'Single source: value retrieved correctly');
  passed += assert(field1.provenance === 'discovered', 'Single source: provenance preserved');
  passed += assert(field1.confidence === 0.9, 'Single source: confidence preserved');
  passed += assert(conflicts1.length === 0, 'Single source: no conflicts');
  passed += assert(evidence1.length === 1, 'Single source: evidence created');
  passed += assert(sources1.length === 1, 'Single source: source tracked');
  passed += assert(profile1.getClaimType('contact.phone') === 'fact', 'Claim type is fact');
  
  // Test 2: Same value from two sources
  console.log('\n--- Test 2: Same value from two sources ---');
  const profile2 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile2.set('contact.phone', '555-1234', 'discovered', 0.9, { 
    sourceUrl: 'https://geoapify.com', 
    provider: 'geoapify' 
  });
  profile2.set('contact.phone', '555-1234', 'discovered', 0.85, { 
    sourceUrl: 'https://official.com', 
    provider: 'official_website' 
  });
  
  const phone2 = profile2.get('contact.phone');
  const conflicts2 = profile2.getConflicts('contact.phone');
  const sources2 = profile2.getSourcesForField('contact.phone');
  const evidence2 = profile2.getEvidenceForField('contact.phone');
  const independence = profile2.getSourceIndependence('contact.phone');
  
  passed += assert(phone2 === '555-1234', 'Same value: value retrieved correctly');
  passed += assert(conflicts2.length === 0, 'Same value: no conflicts');
  passed += assert(sources2.length === 2, 'Same value: both sources tracked');
  passed += assert(evidence2.length === 2, 'Same value: both evidence tracked');
  passed += assert(independence.uniqueDomains >= 1, 'Independence analysis works');
  
  // Test 3: Conflicting values
  console.log('\n--- Test 3: Conflicting values ---');
  const profile3 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile3.set('contact.phone', '555-1111', 'discovered', 0.9, { 
    sourceUrl: 'https://geoapify.com', 
    provider: 'geoapify' 
  });
  profile3.set('contact.phone', '555-2222', 'discovered', 0.85, { 
    sourceUrl: 'https://official.com', 
    provider: 'official_website' 
  });
  
  const phone3 = profile3.get('contact.phone');
  const conflicts3 = profile3.getConflicts('contact.phone');
  const field3 = profile3.getFieldEnhanced('contact.phone');
  
  passed += assert(conflicts3.length === 1, 'Conflict detected');
  passed += assert(conflicts3[0].values.length === 2, 'Both conflicting values preserved');
  passed += assert(conflicts3[0].values[0].value === '555-1111', 'First value preserved');
  passed += assert(conflicts3[0].values[1].value === '555-2222', 'Second value preserved');
  passed += assert(conflicts3[0].status === 'conflicted', 'Conflict status is conflicted');
  passed += assert(field3.hasConflict === true, 'Field enhanced shows conflict');
  passed += assert(field3.conflictCount === 1, 'Conflict count correct');
  
  // Test 4: AI inference separation
  console.log('\n--- Test 4: AI inference separation ---');
  const profile4 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile4.set('identity.category', 'bakery', 'discovered', 0.9, { 
    sourceUrl: 'https://geoapify.com', 
    provider: 'geoapify' 
  });
  profile4.set('identity.description', 'Handcrafted sourdough baked daily', 'inferred', 0.6, { 
    provider: 'ai' 
  });
  
  const categoryClaim = profile4.getClaimType('identity.category');
  const descriptionClaim = profile4.getClaimType('identity.description');
  
  passed += assert(profile4.getClaimType('identity.category') === 'fact', 'Category is fact');
  passed += assert(profile4.getClaimType('identity.description') === 'inference', 'Description is inference');
  
  // Test 5: Missing provenance
  console.log('\n--- Test 5: Missing provenance / evidence ---');
  const profile5 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  // Try to set without proper source info (simulating AI without evidence)
  profile5.set('contact.phone', '555-9999', 'inferred', 0.5, { 
    provider: 'ai' 
  });
  
  const phone5 = profile5.get('contact.phone');
  const field5 = profile5.getField('contact.phone');
  const evidence5 = profile5.getEvidenceForField('contact.phone');
  const claimType5 = profile5.getClaimType('contact.phone');
  
  passed += assert(phone5 === '555-9999', 'Inferred value stored');
  passed += assert(field5.provenance === 'inferred', 'Provenance is inferred');
  passed += assert(claimType5 === 'inference', 'Claim type is inference');
  // Note: Inference with no source should not create evidence
  
  // Test 6: Temporal metadata
  console.log('\n--- Test 6: Temporal metadata ---');
  const profile6 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile6.set('contact.phone', '555-1111', 'discovered', 0.9, { 
    sourceUrl: 'https://old.com', 
    provider: 'geoapify' 
  });
  // Update temporal metadata
  const temporalUpdated = profile6.updateTemporalMetadata('contact.phone', {
    observedAt: '2023-01-01T00:00:00.000Z',
    publishedAt: '2023-01-01T00:00:00.000Z'
  });
  
  const temporal = profile6.getTemporalMetadata('contact.phone');
  passed += assert(temporalUpdated === true, 'Temporal metadata updated');
  passed += assert(temporal?.observedAt === '2023-01-01T00:00:00.000Z', 'ObservedAt stored');
  passed += assert(temporal?.publishedAt === '2023-01-01T00:00:00.000Z', 'PublishedAt stored');
  
  // Test 7: Conflict resolution
  console.log('\n--- Test 7: Conflict resolution ---');
  const profile7 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile7.set('contact.phone', '555-1111', 'discovered', 0.9, { 
    sourceUrl: 'https://geoapify.com', 
    provider: 'geoapify' 
  });
  profile7.set('contact.phone', '555-2222', 'discovered', 0.85, { 
    sourceUrl: 'https://official.com', 
    provider: 'official_website' 
  });
  
  const conflictsBefore = profile7.getConflicts('contact.phone');
  const conflictId = profile7.getConflicts('contact.phone')[0].id;
  const resolved = profile7.resolveConflict(conflictId, 'authority_wins', 'Official website has higher authority');
  
  const phoneAfter = profile7.get('contact.phone');
  const conflictsAfter = profile7.getConflicts('contact.phone');
  const conflictAfter = profile7.getConflicts('contact.phone')[0];
  
  passed += assert(conflictsBefore.length === 1, 'Conflict existed before resolution');
  passed += assert(resolved === true, 'Resolution returned true');
  passed += assert(phoneAfter === '555-2222', 'Canonical value is from official_website (higher authority)');
  passed += assert(conflictAfter.status === 'resolved', 'Conflict status is resolved');
  passed += assert(conflictAfter.resolutionStrategy === 'authority_wins', 'Strategy recorded');
  
  // Test 8: Source independence analysis
  console.log('\n--- Test 8: Source independence analysis ---');
  const profile8 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile8.set('contact.phone', '555-1111', 'discovered', 0.9, { 
    sourceUrl: 'https://geoapify.com/place/123', 
    provider: 'geoapify' 
  });
  profile8.set('contact.phone', '555-1111', 'discovered', 0.8, { 
    sourceUrl: 'https://directory-a.com/biz/123', 
    provider: 'directory' 
  });
  profile8.set('contact.phone', '555-1111', 'discovered', 0.7, { 
    sourceUrl: 'https://directory-b.com/biz/123', 
    provider: 'directory' 
  });
  
  const indep = profile8.getSourceIndependence('contact.phone');
  const copyPairs = profile8.detectCopyPairs('contact.phone');
  
  passed += assert(indep.totalSources === 3, 'Three sources tracked');
  passed += assert(indep.uniqueDomains === 2, 'Two unique domains (geoapify + directory)');
  passed += assert(indep.primarySources === 1, 'One primary source (geoapify)');
  passed += assert(indep.isLikelyCopied === false, 'Not flagged as copied (different domains)');
  passed += assert(copyPairs.length >= 1, 'Copy detection found directory copies');
  
  // Test 9: Backwards compatibility - get() and toObject()
  console.log('\n--- Test 9: Backwards compatibility ---');
  const profile9 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile9.set('identity.name', 'Test Bakery', 'discovered', 0.9, { provider: 'geoapify' });
  profile9.set('contact.phone', '555-1234', 'discovered', 0.9, { provider: 'geoapify' });
  
  const obj = profile9.toObject();
  const name = profile9.get('identity.name');
  const phone = profile9.get('contact.phone');
  
  passed += assert(obj['identity.name'] === 'Test Bakery', 'toObject() works');
  passed += assert(obj['contact.phone'] === '555-1234', 'toObject() includes phone');
  passed += assert(name === 'Test Bakery', 'get() works');
  passed += assert(phone === '555-1234', 'get() works for phone');
  
  // Test 10: Existing regression - BusinessProfile.merge()
  console.log('\n--- Test 10: merge() backwards compatibility ---');
  const profile10 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile10.merge({
    business: { name: 'Merged Bakery', category: 'bakery' },
    contact: { phone: '555-9999' },
    location: { full_address: '123 Main St' }
  }, 'discovered', 0.8);
  
  const mergedName = profile10.get('identity.name');
  const mergedPhone = profile10.get('contact.phone');
  const mergedAddress = profile10.get('location.full_address');
  
  passed += assert(mergedName === 'Merged Bakery', 'merge() sets name');
  passed += assert(mergedPhone === '555-9999', 'merge() sets phone');
  passed += assert(mergedAddress === '123 Main St', 'merge() sets address');
  
  // Test 11: getFieldEnhanced()
  console.log('\n--- Test 11: getFieldEnhanced() ---');
  const profile11 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile11.set('contact.phone', '555-1111', 'discovered', 0.9, { provider: 'geoapify' });
  profile11.set('contact.phone', '555-2222', 'discovered', 0.85, { provider: 'official_website' });
  
  const enhanced = profile11.getFieldEnhanced('contact.phone');
  passed += assert(enhanced.value === '555-2222', 'Enhanced field has canonical value');
  passed += assert(enhanced.hasConflict === true, 'Enhanced field shows conflict');
  passed += assert(enhanced.conflictCount === 1, 'Conflict count in enhanced');
  
  // Test 12: toObjectWithConflicts()
  console.log('\n--- Test 12: toObjectWithConflicts() ---');
  const profile12 = new (await import('./apps/api/src/services/BusinessProfile.js')).default();
  profile12.set('contact.phone', '555-1111', 'discovered', 0.9, { provider: 'geoapify' });
  profile12.set('contact.phone', '555-2222', 'discovered', 0.85, { provider: 'official_website' });
  profile12.set('identity.name', 'Test', 'identified', 0.6, {});
  
  const obj12 = profile12.toObjectWithConflicts();
  passed += assert(obj12['contact.phone'].hasConflict === true, 'toObjectWithConflicts marks conflict');
  passed += assert(obj12['contact.phone'].conflictCount === 1, 'Conflict count in object');
  passed += assert(obj12['identity.name'].hasConflict === false, 'No conflict on other fields');
  
  // Summary
  console.log('\n=== SUMMARY ===');
  const total = passed + failed;
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Failed: ${failed}/${total}`);
  
  if (failed === 0) {
    console.log('\n✓ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('\n✗ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});