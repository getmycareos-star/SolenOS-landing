// Server-only OpenTelemetry initialization for Next.js
// This file should be imported early in the server lifecycle
'use server';

import { initializeTelemetry, shutdownTelemetry, getTracer } from './index';
import { autoInstrumentations } from './auto-instrumentations';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

// Initialize telemetry when this module is loaded
// This will run once when the Next.js server starts
let isInitialized = false;

export async function initTelemetry() {
  if (!isInitialized) {
    // Register automatic instrumentations
    registerInstrumentations({
      instrumentations: [
        ...autoInstrumentations
      ]
    });
    
    await initializeTelemetry();
    isInitialized = true;
  }
}

// Shutdown telemetry when the process exits
// This helps ensure clean shutdown in development
if (process.env.NODE_ENV !== 'production') {
  process.on('SIGTERM', async () => {
    await shutdownTelemetry();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    await shutdownTelemetry();
    process.exit(0);
  });
}

// Initialize immediately when imported in server environment
if (typeof window === 'undefined') {
  initTelemetry().catch(console.error);
}