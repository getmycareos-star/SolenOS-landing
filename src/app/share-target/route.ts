import { NextResponse } from "next/server";
import { putSharedIntake } from "@/lib/input-entry-contract/share-intake";

export const runtime = "nodejs";

/**
 * Web Share Target receiver (manifest share_target.action).
 * Evidence only — redirects into Living Care Record; same understanding pipeline.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const title = stringField(form, "title");
    const text = stringField(form, "text");
    const url = stringField(form, "url");

    const files: Array<{ name: string; mimeType: string; base64: string }> = [];
    for (const item of form.getAll("files")) {
      if (!(item instanceof File) || item.size === 0) continue;
      const buffer = Buffer.from(await item.arrayBuffer());
      files.push({
        name: item.name || "shared-file",
        mimeType: item.type || "application/octet-stream",
        base64: buffer.toString("base64"),
      });
    }

    const combinedText = [title, text, url].filter(Boolean).join("\n").trim();
    if (!combinedText && files.length === 0) {
      return NextResponse.redirect(new URL("/workspace?enter=1", request.url), 303);
    }

    const payload = putSharedIntake({
      title: title || undefined,
      text: combinedText || undefined,
      url: url || undefined,
      files,
    });

    const dest = new URL("/workspace?enter=1", request.url);
    dest.searchParams.set("share_id", payload.id);
    return NextResponse.redirect(dest, 303);
  } catch {
    return NextResponse.redirect(new URL("/workspace?enter=1", request.url), 303);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title") ?? "";
  const text = url.searchParams.get("text") ?? "";
  const sharedUrl = url.searchParams.get("url") ?? "";
  const combined = [title, text, sharedUrl].filter(Boolean).join("\n").trim();

  if (!combined) {
    return NextResponse.redirect(new URL("/share", request.url), 303);
  }

  const payload = putSharedIntake({
    title: title || undefined,
    text: combined,
    url: sharedUrl || undefined,
    files: [],
  });
  const dest = new URL("/workspace?enter=1", request.url);
  dest.searchParams.set("share_id", payload.id);
  return NextResponse.redirect(dest, 303);
}

function stringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
