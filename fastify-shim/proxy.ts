import {
  ALLOWED_PROXY_PATH,
  resolveUpstreamBase,
} from "./config";

export interface RawIngestProxyResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Forward raw multipart file to Next.js pre-cognition extract endpoint.
 * No SolenOS imports — HTTP proxy only.
 */
export async function proxyRawFileIngest(params: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<RawIngestProxyResult> {
  const formData = new FormData();
  const blob = new Blob([params.buffer], { type: params.mimeType || "application/octet-stream" });
  formData.append("file", blob, params.filename);

  const upstream = `${resolveUpstreamBase()}${ALLOWED_PROXY_PATH}`;
  const response = await fetch(upstream, {
    method: "POST",
    body: formData,
  });

  const body = await response.text();
  const contentType =
    response.headers.get("content-type") ?? "text/plain; charset=utf-8";

  return {
    status: response.status,
    body,
    contentType,
  };
}
