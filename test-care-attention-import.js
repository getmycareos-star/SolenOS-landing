// Test that the care-attention service can be imported without syntax errors
console.log('Testing care-attention service import...');

try {
  const { CareAttentionService } = require('./src/lib/care-attention/service');
  console.log('✓ Import successful - CareAttentionService loaded');
  
  // Check that it's a constructor function
  if (typeof CareAttentionService === 'function') {
    console.log('✓ CareAttentionService is a constructor function');
  } else {
    console.log('✗ CareAttentionService is not a function');
  }
  
  // Check that it has the expected methods
  const expectedMethods = [
    'determineWhatMatters',
    'getCurrentCareContext', 
    'getPreviousCareContext',
    'identifyMeaningfulChanges',
    'getUnresolvedOpenLoops',
    'getUpcomingAppointments',
    'identifyStaleInformation',
    'identifyConflicts',
    'identifyMissingInformation',
    'processRecentInformation',
    'categorizeAttentionItems',
    'determineAttentionState',
    'calculatePriority'
  ];
  
  const missingMethods = expectedMethods.filter(method => 
    !(method in CareAttentionService.prototype)
  );
  
  if (missingMethods.length === 0) {
    console.log('✓ All expected methods present on prototype');
  } else {
    console.log('✗ Missing methods:', missingMethods);
  }
  
} catch (error) {
  console.log('✗ Import failed:', error.message);
  process.exit(1);
}

console.log('Import test completed successfully.');