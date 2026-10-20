// Test script to verify OpenTelemetry instrumentation
import { Pool } from 'pg';
import { CareAttentionService } from './src/lib/care-attention/service';
import { initializeTelemetry, shutdownTelemetry } from './src/lib/telemetry';

// Mock database pool for testing
const mockPool = {
  query: async (text: string, params: any[]) => {
    // Simulate different queries
    if (text.includes('care_contexts') && text.includes('LIMIT 1')) {
      // Return a mock care context
      return {
        rows: [{
          id: '123',
          care_recipient_id: params[0],
          caregiver_id: params[1],
          timeline_events: ['Took medication', 'Had appointment'],
          updated_at: new Date()
        }]
      };
    } else if (text.includes('care_contexts') && text.includes('OFFSET 1')) {
      // Return a mock previous care context
      return {
        rows: [{
          id: '456',
          care_recipient_id: params[0],
          caregiver_id: params[1],
          timeline_events: ['Took different medication'],
          updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        }]
      };
    } else if (text.includes('open_loops')) {
      // Return mock open loops
      return {
        rows: [
          {
            id: '789',
            care_recipient_id: params[0],
            caregiver_id: params[1],
            description: 'Need to schedule follow-up appointment',
            category: 'appointment',
            source_event_id: 'event123',
            status: 'open'
          }
        ]
      };
    }
    
    // Default empty response
    return { rows: [] };
  }
};

async function testTelemetry() {
  console.log('Starting OpenTelemetry test...');
  
  // Initialize telemetry
  await initializeTelemetry();
  
  try {
    // Create service instance with mocked pool
    const service = new CareAttentionService(mockPool as unknown as Pool);
    
    // Test determineWhatMatters
    console.log('Testing determineWhatMatters...');
    const result = await service.determineWhatMatters('care-recipient-123', 'caregiver-456');
    console.log('determineWhatMatters result:', JSON.stringify(result, null, 2));
    
    // Test createAttentionItem
    console.log('Testing createAttentionItem...');
    const createResult = await service.createAttentionItem({
      attentionReason: 'Test attention item',
      evidence: ['event123'],
      relatedObjects: {}
    });
    console.log('createAttentionItem result:', JSON.stringify(createResult, null, 2));
    
    // Test updateAttentionItem
    console.log('Testing updateAttentionItem...');
    if (createResult.success) {
      const updateResult = await service.updateAttentionItem(createResult.item.id, {
        attentionReason: 'Updated attention item',
        attentionState: 'AWAITING_CONFIRMATION'
      });
      console.log('updateAttentionItem result:', JSON.stringify(updateResult, null, 2));
    }
    
    // Test deleteAttentionItem
    console.log('Testing deleteAttentionItem...');
    if (createResult.success) {
      const deleteResult = await service.deleteAttentionItem(createResult.item.id);
      console.log('deleteAttentionItem result:', deleteResult);
    }
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Give some time for spans to be exported
    setTimeout(async () => {
      await shutdownTelemetry();
      console.log('Telemetry shutdown complete');
    }, 2000);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTelemetry().catch(console.error);
}