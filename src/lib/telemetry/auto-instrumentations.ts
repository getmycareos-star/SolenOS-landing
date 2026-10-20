// Automatic instrumentation setup for SolenOS
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Enable diagnostic logging only in development
if (process.env.NODE_ENV !== 'production') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

// Configure automatic instrumentation with selective disabling
export const autoInstrumentations = getNodeAutoInstrumentations({
  // Enable core instrumentations
  '@opentelemetry/instrumentation-http': {
    // Don't instrument outgoing requests to our own telemetry endpoint
    ignoreLayers: ['http', 'tcp'],
    ignoreOutgoingRequestHook: (spanInfo, url) => {
      // Skip instrumentation for telemetry endpoints to avoid infinite loops
      return url?.hostname === 'localhost' && 
             (url?.pathname?.includes('/v1/traces') || 
              url?.pathname?.includes('/v1/metrics'));
    }
  },
  '@opentelemetry/instrumentation-pg': {
    // Enhanced PostgreSQL instrumentation
    // Enhanced database reporting
    enhancedDatabaseReporting: true
  },
  // Disable instrumentations that might cause issues or are not needed
  '@opentelemetry/instrumentation-net': process.env.NODE_ENV === 'production' ? undefined : null,
  '@opentelemetry/instrumentation-dns': process.env.NODE_ENV === 'production' ? undefined : null,
  '@opentelemetry/instrumentation-http-client': process.env.NODE_ENV === 'production' ? undefined : null
});