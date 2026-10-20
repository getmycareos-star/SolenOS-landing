# SolenOS

**An evolving intelligence layer that understands a person's changing care reality over time and helps families recognize change, coordinate action, and make decisions with confidence.**

> The care journey, remembered.

**Product:** SolenOS  
**Category (not a rename):** Care Reality Intelligence  
**Foundation:** The Living Care Record

**Documentation Governance (living SoT):** [docs/README.md](docs/README.md) · **Canonical architecture:** [docs/17-canonical-architecture/](docs/17-canonical-architecture/) · Machine contract: `src/lib/solenos-layers/architecture-map.ts`

A change is complete only when code works, verifies pass, docs/canonical architecture (and PRDs if affected) are updated. **If code and docs conflict, documentation wins.**

## What SolenOS is

SolenOS maintains continuous understanding of one person's care journey — CareEvents, change, context, meaning, and attention — so caregiving never depends on reconstructing everything from memory.

Philosophy chain: [**Input ? Event ? Change ? Context ? Meaning ? Attention**](docs/philosophy.md)

## What SolenOS is not

Not a chatbot, EHR, portal, document app, reminder app, task manager, or generic care coordination tool.  
Never use forbidden product renames from the permanent product-identity directive.

## Architecture

SolenOS consists of three main components:

1. **Frontend**: A Next.js application that serves the caregiver interface.
   - Development: http://localhost:3000
   - Production: Deployed to Netlify (see netlify.toml)
   - The frontend does not contain API route handlers; it makes direct API calls to the backend via the NEXT_PUBLIC_API_URL environment variable.

2. **Backend**: API routes handled by the same Next.js application (in src/app/api/), which interact with a PostgreSQL database for persistent storage.
   - Provides API endpoints such as /api/situation, /api/extract, and /api/analyze.
   - Interacts with a PostgreSQL database for persistent storage.
   - Database migrations are located in the db/migrations/ directory.

3. **Optional Infrastructure**: A Fastify shim (`fastify-shim/`) that can forward requests to the backend, but is not used by the default development or production flow.

## Caregiver path (MVP)

```
   caregiver input (text + documents) ? [Frontend] ? POST /api/situation ? [Backend] ? Living Care Record update
   caregiver input (text + documents) ? [Frontend] ? POST /api/situation ? [Backend] ? Living Care Record update
```
Ops/engine compression (`POST /api/analyze`) is hard-gated and is **not** the caregiver product entry.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**LLM (server-side only):**

```bash
copy .env.local.example .env.local
# Edit .env.local — set GEMINI_API_KEY (never commit this file)
```

## OpenTelemetry Observability

SolenOS includes OpenTelemetry instrumentation for observability, enabling tracing and metrics collection for monitoring application performance and diagnosing issues.

### Configuration

OpenTelemetry can be configured via environment variables:

- `OTEL_ENABLED`: Set to `false` to disable telemetry (default: `true`)
- `OTEL_SERVICE_NAME`: Service name for telemetry (default: `solenos`)
- `OTEL_SERVICE_VERSION`: Service version (default: `0.1.0`)
- `OTEL_ENVIRONMENT`: Deployment environment (default: `development`)
- `OTEL_TRACES_ENDPOINT`: OTLP trace endpoint URL (default: `http://localhost:4318/v1/traces`)
- `OTEL_METRICS_ENDPOINT`: OTLP metrics endpoint URL (default: `http://localhost:4318/v1/metrics`)
- `OTEL_TRACES_SAMPLE_RATE`: Trace sampling rate (0.0 to 1.0, default: `1.0`)

### Running with Local Telemetry Collection

For local development, you can use the OpenTelemetry Collector to collect and visualize telemetry data:

1. Install and run the OpenTelemetry Collector (version 0.100.0 or later)
2. Configure it to accept OTLP exports and export to console or a backend like Jaeger
3. Set the endpoint environment variables to point to your collector

### Testing Telemetry

To test the telemetry instrumentation:

```bash
npm run test:telemetry
```

This will run a test that exercises the care attention service and verifies that telemetry is being generated.

### What is Instrumented

- API requests (incoming HTTP requests to route handlers)
- Database queries (PostgreSQL operations)
- Care attention service methods (determineWhatMatters, createAttentionItem, etc.)
- Custom metrics for request counts, durations, and item generation

### Data Privacy

SolenOS is designed to protect sensitive caregiving information. Telemetry implementation ensures that:

- No personal health information is captured in traces or metrics
- Sensitive data from requests and responses is not recorded
- Database query parameters containing sensitive information are not captured
- All telemetry focuses on operational metrics and timing information

## Product integrity gate (Path A preview)

Before internal preview, Path A must stay green:

```bash
npm run verify:product-path
npm run verify:product-identity
```

This proves Care Reality / Living Care Record behavior — not chatbot, document summarizer, or task manager.

**Preview honesty:** single Node process + `.data/` JSON. Same-machine restart: yes. New device / multi-user / cloud multi-instance: **not** qualified. Details: [docs/13-infrastructure/preview-qualification.md](docs/13-infrastructure/preview-qualification.md) · Integrity: [docs/02-product/solenos-product-integrity.md](docs/02-product/solenos-product-integrity.md)

## Legacy analyze constraints

Historical analyze-only MVP notes live in [docs/MVP_ARCHITECTURE_CONSTRAINTS.md](docs/MVP_ARCHITECTURE_CONSTRAINTS.md). They describe the ops compression path — **not** SolenOS product identity.

