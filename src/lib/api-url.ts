/**
 * API URL resolution for the Vite + React SPA.
 *
 * By default requests stay same-origin so Netlify can proxy /api/* to FastAPI.
 * To call a backend origin directly in a controlled environment, set
 * VITE_API_ORIGIN. Do not use Next.js process.env variables in this Vite app.
 */
const API_BASE = import.meta.env.VITE_API_ORIGIN || "";

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
