// OpenTelemetry initialization for SolenOS
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPExporterNodeConfigBase } from '@opentelemetry/otlp-exporter-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Enable diagnostic logging only in development
if (process.env.NODE_ENV !== 'production') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

// Configuration from environment variables
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'solenos';
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || '0.1.0';
const ENVIRONMENT = process.env.OTEL_ENVIRONMENT || process.env.NODE_ENV || 'development';
const TRACE_EXPORTER_URL = process.env.OTEL_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces';
const METRIC_EXPORTER_URL = process.env.OTEL_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics';
const TRACE_SAMPLE_RATE = parseFloat(process.env.OTEL_TRACES_SAMPLE_RATE || '1.0');

// Create resource with service information
const resource = Resource.default.merge(new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
  [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
  [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'unknown',
}));

// Configure OTLP exporter for traces
const traceExporter = new OTLPTraceExporter({
  url: TRACE_EXPORTER_URL,
  // Optional: add headers for authentication if needed
  // headers: {
  //   'authorization': `Bearer ${process.env.OTEL_TRACES_TOKEN}`
  // }
});

// Configure OTLP exporter for metrics
const metricExporter = new OTLPMetricExporter({
  url: METRIC_EXPORTER_URL,
  // Optional: add headers for authentication if needed
  // headers: {
  //   'authorization': `Bearer ${process.env.OTEL_METRICS_TOKEN}`
  // }
});

// Configure metric reader
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60000, // Export every minute
});

// Initialize the SDK
export const traceSdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: metricReader,
  // Instrumentations will be added separately to avoid conflicts
  // with Next.js specific instrumentation
  instrumentations: [],
  // Sampling configuration
  // traceParams: { traceIdRatio: TRACE_SAMPLE_RATE }
});

// Start tracing and metrics
export async function initializeTelemetry() {
  if (process.env.OTEL_ENABLED === 'false') {
    console.log('OpenTelemetry is disabled via OTEL_ENABLED=false');
    return;
  }

  try {
    await traceSdk.start();
    console.log('OpenTelemetry initialized successfully');
    console.log(`Service: ${SERVICE_NAME} v${SERVICE_VERSION} (${ENVIRONMENT})`);
    console.log(`Trace endpoint: ${TRACE_EXPORTER_URL}`);
    console.log(`Metrics endpoint: ${METRIC_EXPORTER_URL}`);
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
    // Don't throw error to prevent application startup failure
    // Telemetry should be optional
  }
}

// Graceful shutdown
export async function shutdownTelemetry() {
  if (traceSdk) {
    try {
      await traceSdk.shutdown();
      console.log('OpenTelemetry shut down gracefully');
    } catch (error) {
      console.error('Error shutting down OpenTelemetry:', error);
    }
  }
}

// Helper to get tracer for manual instrumentation
export function getTracer(name: string, version?: string) {
  return traceSdk.tracerProvider.getTracer(name, version || '0.1.0');
}

// Helper to get meter for manual metrics
export function getMeter(name: string, version?: string) {
  return traceSdk.meterProvider.getMeter(name || 'default', version || '0.1.0');
}

// Export metrics
export * from './metrics';