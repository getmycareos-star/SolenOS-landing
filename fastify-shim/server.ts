/**
 * Optional Fastify infrastructure shim — NOT started by default.
 *
 * Run manually (Next.js must already be running):
 *   npm run fastify:shim
 *
 * This process has zero cognitive responsibility.
 */
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
  resolveShimPort,
  resolveUpstreamBase,
  SHIM_INGEST_ROUTE,
} from "./config";
import { proxyRawFileIngest } from "./proxy";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function buildFastifyShim() {
  const app = Fastify({
    logger: true,
  });

  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_BYTES },
  });

  app.get("/health", async () => ({
    ok: true,
    layer: "fastify-shim",
    upstream: resolveUpstreamBase(),
    cognitive: false,
  }));

  app.post(SHIM_INGEST_ROUTE, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).type("text/plain").send("ERROR: no file");
    }

    const buffer = await file.toBuffer();
    const result = await proxyRawFileIngest({
      filename: file.filename,
      mimeType: file.mimetype,
      buffer,
    });

    return reply.code(result.status).type(result.contentType).send(result.body);
  });

  return app;
}

export async function startFastifyShim() {
  const app = await buildFastifyShim();
  const port = resolveShimPort();
  await app.listen({ port, host: "127.0.0.1" });
  return app;
}
