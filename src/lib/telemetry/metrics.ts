// OpenTelemetry metrics for SolenOS Care Attention Service
import { getMeter } from './index';

// Get meter for this service
const meter = getMeter('solenos-care-attention-service', '0.1.0');

// Create metrics
export const careAttentionRequestCounter = meter.createCounter('solenos_care_attention_requests_total', {
  description: 'Total number of care attention requests',
  unit: '1'
});

export const careAttentionRequestDuration = meter.createHistogram('solenos_care_attention_request_duration_seconds', {
  description: 'Duration of care attention requests',
  unit: 's'
});

export const careAttentionItemsCounter = meter.createCounter('solenos_care_attention_items_total', {
  description: 'Total number of care attention items generated',
  unit: '1'
});

export const careAttentionItemPriorityGauge = meter.createUpDownCounter('solenos_care_attention_item_priority', {
  description: 'Priority levels of care attention items',
  unit: '1'
});

export const careAttentionDatabaseQueryDuration = meter.createHistogram('solenos_care_attention_database_query_duration_seconds', {
  description: 'Duration of database queries in care attention service',
  unit: 's'
});

export const careAttentionDatabaseQueryCounter = meter.createCounter('solenos_care_attention_database_queries_total', {
  description: 'Total number of database queries in care attention service',
  unit: '1'
});

// Helper functions to record metrics
export function recordCareAttentionRequest(operation: string, duration: number, status: string) {
  careAttentionRequestCounter.add(1, {
    operation,
    status
  });
  
  careAttentionRequestDuration.record(duration, {
    operation,
    status
  });
}

export function recordCareAttentionItemsGenerated(count: string, operation: string) {
  careAttentionItemsCounter.add(parseInt(count), {
    operation
  });
}

export function recordCareAttentionItemPriority(priority: number, operation: string) {
  careAttentionItemPriorityGauge.add(1, {
    operation,
    priority: priority.toString()
  });
}

export function recordCareAttentionDatabaseQuery(operation: string, duration: number, success: boolean) {
  careAttentionDatabaseQueryDuration.record(duration, {
    operation,
    success: success.toString()
  });
  
  careAttentionDatabaseQueryCounter.add(1, {
    operation,
    success: success.toString()
  });
}