/**
 * API client base resolution.
 *
 * PRODUCTION: the frontend calls the Railway backend directly to avoid
 * Netlify proxy body-limitation for non-GET requests. CORS is configured
 * in backend middleware to allow the Netlify frontend origin.
 *
 * LOCAL DEV: set NEXT_PUBLIC_API_URL to a backend origin (e.g. localhost or
 * ngrok) to bypass the proxy and hit the backend directly. When unset, we fall
 * back to same-origin relative paths.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) return normalized;
  return `${API_BASE.replace(/\/$/, "")}${normalized}`;
}

export async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    throw new Error(
      `Empty response from server (status ${response.status} ${response.statusText})`,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON response from server (status ${response.status}): ${text.slice(0, 200)}`,
    );
  }
}
