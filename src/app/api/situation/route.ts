/**
 * Disabled legacy Next.js route.
 *
 * The deployed frontend is a Vite SPA and the authoritative care API is FastAPI.
 * This duplicate route used process-local state and cannot enforce durable,
 * authenticated care-recipient isolation. Do not recreate records here.
 */
function legacyRouteUnavailable(): Response {
  return new Response(
    JSON.stringify({
      error: "legacy_route_unavailable",
      detail: "Use the authenticated FastAPI care API. This process-local route is disabled.",
    }),
    {
      status: 410,
      headers: { "content-type": "application/json" },
    },
  );
}

export async function GET(): Promise<Response> {
  return legacyRouteUnavailable();
}

export async function POST(): Promise<Response> {
  return legacyRouteUnavailable();
}
