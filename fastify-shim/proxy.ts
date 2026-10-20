/**
 * Forwarding for the optional shim.
 *
 * One destination, one purpose. The shim moves bytes; it never interprets them.
 */

import { ALLOWED_PROXY_PATH, SHIM_PROXY_ORIGIN, SHIM_PROXY_TIMEOUT_MS } from "./config";

export type ProxyResult = {
  status: number;
  body: unknown;
};

export function isAllowedProxyPath(pathname: string): boolean {
  return pathname === ALLOWED_PROXY_PATH;
}

/**
 * Forward an ingest payload to the Next.js extraction endpoint.
 * Returns the upstream status and parsed body; never throws.
 */
export async function forwardIngest(payload: unknown): Promise<ProxyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHIM_PROXY_TIMEOUT_MS);
  try {
    const response = await fetch(`${SHIM_PROXY_ORIGIN}${ALLOWED_PROXY_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // A non-JSON upstream response is passed through verbatim, not guessed at.
    }
    return { status: response.status, body };
  } catch (error) {
    return {
      status: 502,
      body: { error: "upstream_unavailable", detail: String((error as Error)?.message ?? error) },
    };
  } finally {
    clearTimeout(timer);
  }
}
