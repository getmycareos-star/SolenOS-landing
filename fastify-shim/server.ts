/**
 * Optional Fastify infrastructure shim — server.
 *
 * One route, one upstream. Nothing here knows that SolenOS exists beyond the
 * forwarding target named in config.
 */

import Fastify from "fastify";
import { ALLOWED_PROXY_PATH, SHIM_INGEST_ROUTE } from "./config";
import { forwardIngest, isAllowedProxyPath } from "./proxy";

export function buildServer() {
  const app = Fastify({ logger: false });

  app.post(SHIM_INGEST_ROUTE, async (request, reply) => {
    const result = await forwardIngest(request.body ?? {});
    return reply.code(result.status).send(result.body);
  });

  app.get("/shim/health", async () => ({
    status: "ok",
    role: "optional-infrastructure-shim",
    proxies_to: ALLOWED_PROXY_PATH,
  }));

  return app;
}

if (!isAllowedProxyPath(ALLOWED_PROXY_PATH)) {
  throw new Error(`shim proxy target is outside the allowed scope: ${ALLOWED_PROXY_PATH}`);
}
