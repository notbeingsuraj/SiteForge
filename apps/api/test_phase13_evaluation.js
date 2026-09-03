import { calculateMatchScore, normalizePhone, normalizeWebsite } from './src/services/EntityResolution.js';

/**
 * Phase 13: Entity Resolution Accuracy & Calibration Evaluation Harness
 * 
 * Measures calculateMatchScore() behavior against a labeled dataset.
 * Reports precision, recall, F1, confusion matrix by category.
 */

// ============================================================================
// LABELED DATASET
// ============================================================================

const TEST_CASES = [
  // =========================================================================
  // CATEGORY A: SAME ENTITY
  // =========================================================================
  
  {
    id: 'A1',
    category: 'same_entity',
    subcategory: 'identical_records',
    label: 'same_entity',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110', coordinates: { lat: 37.7614552, lng: -122.4239452 } },
      provider: { placeId: 'ChIJ123' }
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110', coordinates: { lat: 37.7614552, lng: -122.4239452 } },
      provider: { placeId: 'ChIJ123' }
    }
  },
  
  {
    id: 'A2',
    category: 'same_entity',
    subcategory: 'minor_formatting_differences',
    label: 'same_entity',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'TARTINE BAKERY' },
      contact: { phone: '4154872600', website: 'tartinebakery.com' },
      location: { full_address: '600 Guerrero St, SF, CA 94110' }
    }
  },
  
  {
    id: 'A3',
    category: 'same_entity',
    subcategory: 'missing_fields',
    label: 'same_entity',
    record1: {
      identity: { name: 'Tartine Bakery', category: 'Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    }
  },
  
  {
    id: 'A4',
    category: 'same_entity',
    subcategory: 'name_variation',
    label: 'same_entity',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    }
  },
  
  {
    id: 'A5',
    category: 'same_entity',
    subcategory: 'phone_formatting_variation',
    label: 'same_entity',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '(415) 487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    }
  },
  
  {
    id: 'A6',
    category: 'same_entity',
    subcategory: 'website_formatting_variation',
    label: 'same_entity',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    }
  },

  // =========================================================================
  // CATEGORY B: DIFFERENT ENTITY
  // =========================================================================
  
  {
    id: 'B1',
    category: 'different_entity',
    subcategory: 'clearly_different',
    label: 'different_entity',
    record1: {
      identity: { name: 'Tartine Bakery', category: 'Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Blue Bottle Coffee', category: 'Coffee Shop' },
      contact: { phone: '+1-415-555-0100', website: 'https://bluebottlecoffee.com' },
      location: { full_address: '123 Mission Street, San Francisco, CA 94105' }
    }
  },
  
  {
    id: 'B2',
    category: 'different_entity',
    subcategory: 'similar_names_different_phone_address',
    label: 'different_entity',
    record1: {
      identity: { name: 'Tartine Bakery', category: 'Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine Bakery & Cafe', category: 'Bakery' },
      contact: { phone: '+1-415-555-0100', website: 'https://tartinebakerycafe.com' },
      location: { full_address: '123 Mission Street, San Francisco, CA 94105' }
    }
  },
  
  {
    id: 'B3',
    category: 'different_entity',
    subcategory: 'same_street_nearby',
    label: 'different_entity',
    record1: {
      identity: { name: 'Tartine Bakery', category: 'Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Guerrero Cafe', category: 'Cafe' },
      contact: { phone: '+1-415-555-0100', website: 'https://guerrerocafe.com' },
      location: { full_address: '610 Guerrero Street, San Francisco, CA 94110' }
    }
  },
  
  {
    id: 'B4',
    category: 'different_entity',
    subcategory: 'same_category_unrelated',
    label: 'different_entity',
    record1: {
      identity: { name: 'Tartine Bakery', category: 'Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Flour + Water', category: 'Bakery' },
      contact: { phone: '+1-415-555-0100', website: 'https://flourwater.com' },
      location: { full_address: '123 Mission Street, San Francisco, CA 94105' }
    }
  },

  // =========================================================================
  // CATEGORY C: SAME BRAND / DIFFERENT LOCATION
  // =========================================================================
  
  {
    id: 'C1',
    category: 'same_brand_different_location',
    subcategory: 'chain_same_name_different_address',
    label: 'same_brand_different_location',
    record1: {
      identity: { name: 'Blue Bottle Coffee', category: 'Coffee Shop' },
      contact: { phone: '+1-415-555-0100', website: 'https://bluebottlecoffee.com/sf-ferry' },
      location: { full_address: '1 Ferry Building, San Francisco, CA 94111' }
    },
    record2: {
      identity: { name: 'Blue Bottle Coffee', category: 'Coffee Shop' },
      contact: { phone: '+1-510-555-0100', website: 'https://bluebottlecoffee.com/oakland' },
      location: { full_address: '123 Broadway, Oakland, CA 94607' }
    }
  },
  
  {
    id: 'C2',
    category: 'same_brand_different_location',
    subcategory: 'same_website_different_address',
    label: 'same_brand_different_location',
    record1: {
      identity: { name: 'Philz Coffee', category: 'Coffee Shop' },
      contact: { phone: '+1-415-555-0100', website: 'https://philzcoffee.com' },
      location: { full_address: '123 Mission Street, San Francisco, CA 94105' }
    },
    record2: {
      identity: { name: 'Philz Coffee', category: 'Coffee Shop' },
      contact: { phone: '+1-415-555-0200', website: 'https://philzcoffee.com' },
      location: { full_address: '456 Castro Street, San Francisco, CA 94114' }
    }
  },
  
  {
    id: 'C3',
    category: 'same_brand_different_location',
    subcategory: 'multiple_locations_same_brand',
    label: 'same_brand_different_location',
    record1: {
      identity: { name: 'Starbucks', category: 'Coffee Shop' },
      contact: { phone: '+1-415-555-0100', website: 'https://starbucks.com' },
      location: { full_address: '1 Market Street, San Francisco, CA 94105' }
    },
    record2: {
      identity: { name: 'Starbucks', category: 'Coffee Shop' },
      contact: { phone: '+1-415-555-0200', website: 'https://starbucks.com' },
      location: { full_address: '2 Embarcadero, San Francisco, CA 94111' }
    }
  },

  // =========================================================================
  // CATEGORY D: RELOCATION-LIKE CASES
  // =========================================================================
  
  {
    id: 'D1',
    category: 'relocation_like',
    subcategory: 'same_business_moved',
    label: 'relocation_like',
    record1: {
      identity: { name: 'Tartine Bakery', category: 'Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine Bakery', category: 'Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '123 New Street, San Francisco, CA 94105' }
    }
  },
  
  {
    id: 'D2',
    category: 'relocation_like',
    subcategory: 'old_vs_new_address_stable_phone_website',
    label: 'relocation_like',
    record1: {
      identity: { name: 'Blue Bottle Coffee', category: 'Coffee Shop' },
      contact: { phone: '+1-415-555-0100', website: 'https://bluebottlecoffee.com' },
      location: { full_address: '1 Ferry Building, San Francisco, CA 94111' }
    },
    record2: {
      identity: { name: 'Blue Bottle Coffee', category: 'Coffee Shop' },
      contact: { phone: '+1-415-555-0100', website: 'https://bluebottlecoffee.com' },
      location: { full_address: '2 New Ferry Building, San Francisco, CA 94111' }
    }
  },

  // =========================================================================
  // CATEGORY E: MISSING / PARTIAL DATA
  // =========================================================================
  
  {
    id: 'E1',
    category: 'missing_partial',
    subcategory: 'null_phone',
    label: 'uncertain', // Expected uncertain due to missing phone
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: null, website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    }
  },
  
  {
    id: 'E2',
    category: 'missing_partial',
    subcategory: 'null_website',
    label: 'uncertain',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: null },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    }
  },
  
  {
    id: 'E3',
    category: 'missing_partial',
    subcategory: 'null_address',
    label: 'uncertain',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: null }
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    }
  },
  
  {
    id: 'E4',
    category: 'missing_partial',
    subcategory: 'sparse_records',
    label: 'uncertain',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600' },
      location: {}
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600' },
      location: {}
    }
  },

  // =========================================================================
  // CATEGORY F: CONTRADICTORY SIGNALS
  // =========================================================================
  
  {
    id: 'F1',
    category: 'contradictory',
    subcategory: 'matching_phone_different_names',
    label: 'different_entity',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Completely Different Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://differentbakery.com' },
      location: { full_address: '123 Mission Street, San Francisco, CA 94105' }
    }
  },
  
  {
    id: 'F2',
    category: 'contradictory',
    subcategory: 'matching_website_different_identity',
    label: 'different_entity',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Fake Tartine', category: 'Coffee Shop' },
      contact: { phone: '+1-415-555-0100', website: 'https://tartinebakery.com' },
      location: { full_address: '123 Mission Street, San Francisco, CA 94105' }
    }
  },
  
  {
    id: 'F3',
    category: 'contradictory',
    subcategory: 'same_name_contradictory_phone_address',
    label: 'different_entity',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-555-0100', website: 'https://differentbakery.com' },
      location: { full_address: '123 Mission Street, San Francisco, CA 94105' }
    }
  },
  
  {
    id: 'F4',
    category: 'same_entity',
    subcategory: 'equivalent_normalized_records',
    label: 'same_entity',
    record1: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    },
    record2: {
      identity: { name: 'Tartine Bakery' },
      contact: { phone: '+1-415-487-2600', website: 'https://tartinebakery.com' },
      location: { full_address: '600 Guerrero Street, San Francisco, CA 94110' }
    }
  }
];

// ============================================================================
// EVALUATION LOGIC
// ============================================================================

function evaluate() {
  console.log('='.repeat(80));
  console.log('PHASE 13: ENTITY RESOLUTION ACCURACY & CALIBRATION');
  console.log('='.repeat(80));
  
  const results = [];
  const byCategory = {};
  
  for (const tc of TEST_CASES) {
    const result = calculateMatchScore(tc.record1, tc.record2);
    const predicted = result.matchType;
    const expected = tc.label;
    const correct = predicted === expected;
    
    results.push({
      id: tc.id,
      category: tc.category,
      subcategory: tc.subcategory,
      expected,
      predicted,
      score: result.score,
      signals: result.signals,
      contradictions: result.contradictions,
      correct
    });
    
    if (!byCategory[tc.category]) {
      byCategory[tc.category] = { total: 0, correct: 0, tp: 0, fp: 0, fn: 0, tn: 0 };
    }
    byCategory[tc.category].total++;
    if (correct) byCategory[tc.category].correct++;
  }
  
  // Calculate metrics
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(80));
  
  for (const r of results) {
    const status = r.correct ? '✓' : '✗';
    console.log(`${status} ${r.id} (${r.category}/${r.subcategory}): expected=${r.expected}, predicted=${r.predicted}, score=${r.score.toFixed(3)}`);
    if (!r.correct) {
      console.log(`    Signals: ${JSON.stringify(r.signals)}`);
      console.log(`    Contradictions: ${JSON.stringify(r.contradictions)}`);
    }
  }
  
  // Per-category metrics
  console.log('\n' + '='.repeat(80));
  console.log('PER-CATEGORY METRICS');
  console.log('='.repeat(80));
  
  for (const [cat, stats] of Object.entries(byCategory)) {
    const accuracy = (stats.correct / stats.total * 100).toFixed(1);
    console.log(`${cat}: ${stats.correct}/${stats.total} (${accuracy}%)`);
  }
  
  // Overall metrics
  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const overallAccuracy = (correct / total * 100).toFixed(1);
  console.log(`\nOverall: ${correct}/${total} (${overallAccuracy}%)`);
  
  // Confusion matrix for match types - include all possible predicted types
  const expectedTypes = ['same_entity', 'same_brand_different_location', 'different_entity', 'uncertain', 'relocation_like'];
  const predictedTypes = ['same_entity', 'same_brand_different_location', 'different_entity', 'uncertain'];
  console.log('\n' + '='.repeat(80));
  console.log('CONFUSION MATRIX (rows=expected, cols=predicted)');
  console.log('='.repeat(80));
  
  const cm = {};
  for (const et of expectedTypes) {
    cm[et] = {};
    for (const pt of predictedTypes) cm[et][pt] = 0;
  }
  
  for (const r of results) {
    if (!cm[r.expected]) cm[r.expected] = {};
    if (!cm[r.expected][r.predicted]) cm[r.expected][r.predicted] = 0;
    cm[r.expected][r.predicted] = (cm[r.expected][r.predicted] || 0) + 1;
  }
  
  console.log('Expected \\ Predicted | ' + predictedTypes.join(' | '));
  console.log('-'.repeat(80));
  for (const et of expectedTypes) {
    let row = `${et.padEnd(30)} | `;
    for (const pt of predictedTypes) {
      row += `${String(cm[et]?.[pt] || 0).padStart(6)} | `;
    }
    console.log(row);
  }
  
  // Per-match-type precision/recall/F1
  console.log('\n' + '='.repeat(80));
  console.log('PER-MATCH-TYPE PRECISION / RECALL / F1');
  console.log('='.repeat(80));
  
  const matchTypes = ['same_entity', 'same_brand_different_location', 'different_entity', 'uncertain'];
  for (const mt of matchTypes) {
    let tp = 0, fp = 0, fn = 0;
    for (const r of results) {
      if (r.expected === mt && r.predicted === mt) tp++;
      else if (r.expected !== mt && r.predicted === mt) fp++;
      else if (r.expected === mt && r.predicted !== mt) fn++;
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    console.log(`${mt}: P=${precision.toFixed(3)} R=${recall.toFixed(3)} F1=${f1.toFixed(3)} (TP=${tp} FP=${fp} FN=${fn})`);
  }
  
  // Specific category analysis
  console.log('\n' + '='.repeat(80));
  console.log('SAME-BRAND-DIFFERENT-LOCATION ANALYSIS');
  console.log('='.repeat(80));
  
  const sbdl = results.filter(r => r.category === 'same_brand_different_location');
  console.log(`Same-brand cases: ${sbdl.length}`);
  for (const r of sbdl) {
    console.log(`  ${r.id}: score=${r.score.toFixed(3)}, predicted=${r.predicted}, expected=${r.expected}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('RELOCATION-LIKE ANALYSIS');
  console.log('='.repeat(80));
  
  const reloc = results.filter(r => r.category === 'relocation_like');
  console.log(`Relocation-like cases: ${reloc.length}`);
  for (const r of reloc) {
    console.log(`  ${r.id}: score=${r.score.toFixed(3)}, predicted=${r.predicted}, expected=${r.expected}`);
  }
  
  // Score distribution
  console.log('\n' + '='.repeat(80));
  console.log('SCORE DISTRIBUTION');
  console.log('='.repeat(80));
  
  const bins = { '<0': 0, '0-0.3': 0, '0.3-0.5': 0, '0.5-0.7': 0, '0.7-0.85': 0, '>=0.85': 0 };
  for (const r of results) {
    const s = r.score;
    if (s < 0) bins['<0']++;
    else if (s < 0.3) bins['0-0.3']++;
    else if (s < 0.5) bins['0.3-0.5']++;
    else if (s < 0.7) bins['0.5-0.7']++;
    else if (s < 0.85) bins['0.7-0.85']++;
    else bins['>=0.85']++;
  }
  for (const [bin, count] of Object.entries(bins)) {
    console.log(`  ${bin}: ${count}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total test cases: ${total}`);
  console.log(`Overall accuracy: ${overallAccuracy}%`);
  console.log(`Same-entity accuracy: ${(byCategory.same_entity?.correct / byCategory.same_entity?.total * 100 || 0).toFixed(1)}%`);
  console.log(`Different-entity accuracy: ${(byCategory.different_entity?.correct / byCategory.different_entity?.total * 100 || 0).toFixed(1)}%`);
  console.log(`Same-brand-diff-location accuracy: ${(byCategory.same_brand_different_location?.correct / byCategory.same_brand_different_location?.total * 100 || 0).toFixed(1)}%`);
  console.log(`Relocation-like accuracy: ${(byCategory.relocation_like?.correct / byCategory.relocation_like?.total * 100 || 0).toFixed(1)}%`);
  console.log(`Missing/partial accuracy: ${(byCategory.missing_partial?.correct / byCategory.missing_partial?.total * 100 || 0).toFixed(1)}%`);
  console.log(`Contradictory accuracy: ${(byCategory.contradictory?.correct / byCategory.contradictory?.total * 100 || 0).toFixed(1)}%`);
  
  return { results, byCategory, confusionMatrix: cm };
}

// Run evaluation
evaluate();