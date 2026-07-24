/**
 * Optional infrastructure shim — NOT part of SolenOS cognition.
 * Allowed scope only: raw file ingestion proxy to Next.js extract endpoint.
 */

export const FASTIFY_SHIM_SCOPE = {
  allowed: [
    "high-throughput request buffering",
    "raw file ingestion proxy (non-AI files only)",
    "isolated infrastructure utilities",
    "performance isolation experiments",
  ],
  forbidden: [
    "LLM calls",
    "LangChain",
    "/api/analyze logic",
    "Zod validation",
    "decision engine",
    "AI response formatting",
    "memory or events",
    "routing or orchestration",
    "output schema influence",
  ],
} as const;

/** Single allowed proxy target — pre-cognition extract only. */
export const ALLOWED_PROXY_PATH = "/api/v1/ingest/extract";

/** Shim-local route — does not duplicate Next.js API surface. */
export const SHIM_INGEST_ROUTE = "/ingest/raw";

export const DEFAULT_UPSTREAM = "http://localhost:3000";
export const DEFAULT_SHIM_PORT = 3001;

export function resolveUpstreamBase(): string {
  return (process.env.SOLENOS_NEXT_UPSTREAM ?? DEFAULT_UPSTREAM).replace(/\/$/, "");
}

export function resolveShimPort(): number {
  const port = Number(process.env.FASTIFY_SHIM_PORT ?? DEFAULT_SHIM_PORT);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_SHIM_PORT;
}
