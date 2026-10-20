/**
 * Optional Fastify infrastructure shim — entrypoint.
 *
 * Started only on explicit request (`npm run shim`). The default `dev` and
 * `start` scripts run Next.js alone, so the shim can never become a dependency
 * of the product path.
 */

import { SHIM_HOST, SHIM_PORT } from "./config";
import { buildServer } from "./server";

const app = buildServer();

app
  .listen({ port: SHIM_PORT, host: SHIM_HOST })
  .then((address) => {
    console.log(`fastify-shim listening on ${address}`);
  })
  .catch((error) => {
    console.error("fastify-shim failed to start:", error);
    process.exit(1);
  });
