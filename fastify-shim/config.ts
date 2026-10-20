/**
 * Optional Fastify infrastructure shim — scope and constants.
 *
 * This module is deliberately self-contained. It imports nothing from the
 * SolenOS application so that deleting `fastify-shim/` leaves the product
 * completely unchanged.
 */

/** The one route the shim exposes. Not a SolenOS API path. */
export const SHIM_INGEST_ROUTE = "/shim/ingest";

/** The only SolenOS endpoint the shim may forward to. */
export const ALLOWED_PROXY_PATH = "/api/extract";

/** Port the shim binds when started explicitly. Never used by `npm run dev`. */
export const SHIM_PORT = Number(process.env.FASTIFY_SHIM_PORT ?? 4400);

/** Interface the shim binds. Loopback only: this is a local ingest aid. */
export const SHIM_HOST = process.env.FASTIFY_SHIM_HOST ?? "127.0.0.1";

/** Origin of the Next.js application the shim forwards to. */
export const SHIM_PROXY_ORIGIN = process.env.NEXT_ORIGIN ?? "http://127.0.0.1:3000";

/** Bounded so a stalled upstream cannot hold a request open indefinitely. */
export const SHIM_PROXY_TIMEOUT_MS = Number(process.env.FASTIFY_SHIM_TIMEOUT_MS ?? 15000);

export const FASTIFY_SHIM_SCOPE = {
  allowed: [
    "A single isolated ingest route for bulk document intake.",
    "Forwarding that ingest to the Next.js extraction endpoint.",
    "Health reporting for the shim process itself.",
  ],
  forbidden: [
    "Any caregiver-facing route.",
    "Cognitive reasoning, planning, or turn execution.",
    "Reading or writing SolenOS application state.",
    "Starting as part of the default dev or production start path.",
  ],
} as const;
