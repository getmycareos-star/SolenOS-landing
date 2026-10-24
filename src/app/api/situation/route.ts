import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendOrigin(): string {
  const configured =
    process.env.SOLENOS_BACKEND_URL ||
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://solenosbackend-production.up.railway.app";
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("The SolenOS backend URL is not a valid absolute URL.");
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && isLocal && url.protocol === "http:")) {
    throw new Error("The SolenOS backend must use HTTPS in production.");
  }
  return url.origin;
}

async function proxySituation(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { detail: "A valid SolenOS anonymous session is required." },
      { status: 401 },
    );
  }

  let target: URL;
  try {
    const incoming = new URL(request.url);
    target = new URL(`/api/situation${incoming.search}`, backendOrigin());
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "The SolenOS backend is not configured." },
      { status: 503 },
    );
  }

  const headers = new Headers({
    Authorization: authorization,
    Accept: request.headers.get("accept") || "application/json",
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("content-type");
    const disposition = upstream.headers.get("content-disposition");
    if (upstreamContentType) responseHeaders.set("content-type", upstreamContentType);
    if (disposition) responseHeaders.set("content-disposition", disposition);
    responseHeaders.set("cache-control", "no-store");
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { detail: "The SolenOS backend could not be reached. No successful save is claimed." },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  return proxySituation(request);
}

export async function POST(request: Request) {
  return proxySituation(request);
}

export async function PATCH(request: Request) {
  return proxySituation(request);
}
