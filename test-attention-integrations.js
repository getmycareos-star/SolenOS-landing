// Test that the attention summary API route and attention notifier service can be imported
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.log('Testing attention summary API route and notifier service...');

(async () => {
  try {
    // Test 1: Import attention summary route handler
    const { GET: attentionSummaryHandler } = await import('./src/app/api/attention-summary/route.ts');
    console.log('✓ Attention summary route imported successfully');
    
    // Test 2: Import attention notifier service
    const { AttentionNotifierService } = await import('./src/lib/notification-service/attention-notifier.ts');
    console.log('✓ Attention notifier service imported successfully');
    
    // Test 3: Create instances (would need mock db in real test)
    console.log('✓ Import tests completed successfully');
    console.log('✓ Care-attention service can now be imported in additional places to strengthen SolenOS');
    
  } catch (error) {
    console.log('✗ Import test failed:', error.message);
    console.log('Error stack:', error.stack);
    process.exit(1);
  }
})();