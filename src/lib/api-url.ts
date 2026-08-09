/**
 * API client base resolution.
 *
 * PRODUCTION (Netlify): the frontend calls the backend through the SAME-ORIGIN
 * Netlify proxy (`/api/*` -> Railway backend) configured in netlify.toml. This
 * fully avoids cross-origin CORS failures ("failed to fetch") because the
 * browser sees a same-origin request to the frontend origin.
 *
 * LOCAL DEV: set NEXT_PUBLIC_API_URL to a backend origin (e.g. localhost or
 * ngrok) to bypass the proxy and hit the backend directly. When unset, we fall
 * back to same-origin relative paths.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // Same-origin proxy (default): return a relative path.
  if (!API_BASE) return normalized;
  return `${API_BASE.replace(/\/$/, "")}${normalized}`;
}
