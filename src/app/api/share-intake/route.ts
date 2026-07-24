import { NextResponse } from "next/server";
import { claimSharedIntake } from "@/lib/input-entry-contract/share-intake";

export const runtime = "nodejs";

/** Claim shared evidence into the composer — same extract → situation path afterward. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  }

  const payload = claimSharedIntake(id);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    entry_method: "share",
    text: payload.text ?? "",
    title: payload.title ?? "",
    url: payload.url ?? "",
    files: payload.files,
  });
}
