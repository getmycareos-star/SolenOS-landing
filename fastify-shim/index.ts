export {
  FASTIFY_SHIM_SCOPE,
  ALLOWED_PROXY_PATH,
  SHIM_INGEST_ROUTE,
  DEFAULT_UPSTREAM,
  DEFAULT_SHIM_PORT,
  resolveUpstreamBase,
  resolveShimPort,
} from "./config";
export { proxyRawFileIngest, type RawIngestProxyResult } from "./proxy";
export { buildFastifyShim, startFastifyShim } from "./server";
