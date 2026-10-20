// OpenTelemetry instrumentation wrapper for Next.js API routes
import { context, trace } from '@opentelemetry/api';
import { getTracer } from './index';

const tracer = getTracer('solenos-api', '0.1.0');

/**
 * Wrapper to add OpenTelemetry tracing to Next.js API route handlers
 * Automatically creates spans for incoming requests and captures attributes
 * 
 * Usage:
 * export const GET = withTelemetry(async (request) => {
 *   // your handler logic
 * });
 */
export function withTelemetry<Args extends any[], Return>(
  handler: (...args: Args) => Promise<Return>,
  operationName: string = 'API Request'
) {
  return async (...args: Args): Promise<Return> => {
    // Extract request object from args (typically first argument in Next.js API handlers)
    const request = args[0] as Request;
    
    // Start a span for the API request
    return tracer.startActiveSpan(
      operationName,
      {
        kind: trace.SpanKind.SERVER,
        attributes: {
          // HTTP attributes following semantic conventions
          'http.method': request.method,
          'http.target': new URL(request.url).pathname,
          'http.scheme': new URL(request.url).protocol.replace(':', ''),
          'http.host': new URL(request.url).hostname,
          'net.peer.ip': request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        request.headers.get('x-client-ip') || 
                        'unknown',
        }
      },
      async (span) => {
        // Set up context for the span
        return context.with(trace.setSpan(context.active(), span), async () => {
          try {
            // Execute the original handler
            const result = await handler(...args);
            
            // Add response status to span if available
            if (result instanceof Response) {
              span.setAttribute('http.status_code', result.status);
              
              // Mark as error if status code indicates client or server error
              if (result.status >= 400) {
                span.setAttribute('http.error', 'true');
                span.setStatus({
                  code: trace.SpanStatusCode.ERROR,
                  message: `HTTP ${result.status}`
                });
              } else {
                span.setStatus({
                  code: trace.SpanStatusCode.OK
                });
              }
            } else {
              // Assume successful execution for non-Response returns
              span.setStatus({
                code: trace.SpanStatusCode.OK
              });
            }
            
            return result;
          } catch (error) {
            // Record exception in span
            span.recordException(error as Error);
            span.setStatus({
              code: trace.SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : String(error)
            });
            
            // Re-throw the error
            throw error;
          } finally {
            // Always end the span
            span.end();
          }
        });
      }
    );
  };
}

/**
 * Wrapper specifically for Next.js App Router route handlers
 * Handles the request/response pattern used in route.ts files
 */
export function withRouteTelemetry<Return>(
  handler: (request: Request) => Promise<Response>,
  operationName: string = 'API Route'
) {
  return withTelemetry(handler, operationName);
}

// Convenience wrappers for specific HTTP methods
export function withGetTelemetry(handler: (request: Request) => Promise<Response>) {
  return withRouteTelemetry(handler, 'GET Request');
}

export function withPostTelemetry(handler: (request: Request) => Promise<Response>) {
  return withRouteTelemetry(handler, 'POST Request');
}

export function withPutTelemetry(handler: (request: Request) => Promise<Response>) {
  return withRouteTelemetry(handler, 'PUT Request');
}

export function withDeleteTelemetry(handler: (request: Request) => Promise<Response>) {
  return withRouteTelemetry(handler, 'DELETE Request');
}