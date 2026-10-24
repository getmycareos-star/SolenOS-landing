import { NextResponse } from "next/server";
import { getBackendOrigin } from "@/lib/backend-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Claim a short-lived, one-time share capability stored by the FastAPI backend. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 256) return NextResponse.json({ ok: false, error: "missing or invalid id" }, { status: 400 });
  try {
    const target = new URL(`/api/v1/share-intake/${encodeURIComponent(id)}`, getBackendOrigin());
    const upstream = await fetch(target, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json", "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Shared content could not be retrieved from the care backend." }, { status: 502 });
  }
}
