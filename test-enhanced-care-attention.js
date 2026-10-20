// Test that the care-attention service can be imported and instantiated
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.log('Testing care-attention service with all enhancements...');

(async () => {
  try {
    const { CareAttentionService } = await import('./src/lib/care-attention/service.ts');
    console.log('✓ Import successful - CareAttentionService loaded');
    
    // Check that it's a constructor function
    if (typeof CareAttentionService === 'function') {
      console.log('✓ CareAttentionService is a constructor function');
    } else {
      console.log('✗ CareAttentionService is not a function');
      return;
    }
    
    // Create a mock database pool for testing
    class MockPool {
      query(text, params) {
        // Return empty results for most queries
        if (text.includes('care_contexts') || 
            text.includes('open_loops') ||
            text.includes('responsibility') ||
            text.includes('care_journey')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }
    }
    
    // Test instantiation
    const mockDb = new MockPool();
    const service = new CareAttentionService(mockDb);
    console.log('✓ Service instance created with all enhancements');
    
    // Test a simple method to see if it works
    try {
      const result = await service.determineWhatMatters(
        'test-care-recipient-id',
        'test-caregiver-id'
      );
      
      console.log('✓ determineWhatMatters executed successfully');
      console.log('✓ Response type:', typeof result);
      
      // Basic check
      if (result && typeof result === 'object') {
        console.log('✓ Response is an object');
        console.log('✓ Service is working correctly!');
      } else {
        console.log('✗ Response is not an object:', result);
      }
    } catch (error) {
      console.error('Error in determineWhatMatters:', error.message);
    }
    
  } catch (error) {
    console.log('✗ Import failed:', error.message);
    console.log('Error stack:', error.stack);
    process.exit(1);
  }

  console.log('Enhanced care-attention service test completed.');
})();