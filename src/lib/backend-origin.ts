/** Server-only origin for authenticated/proxied calls to the SolenOS FastAPI service. */
export function getBackendOrigin(): string {
  const configured =
    process.env.SOLENOS_BACKEND_URL ||
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://solenosbackend-production.up.railway.app";
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new Error("The SolenOS backend URL is not a valid absolute URL."); }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && isLocal && url.protocol === "http:")) {
    throw new Error("The SolenOS backend must use HTTPS in production.");
  }
  return url.origin;
}
