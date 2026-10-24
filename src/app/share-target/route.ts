import { NextResponse } from "next/server";
import { getBackendOrigin } from "@/lib/backend-origin";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_SHARED_BYTES = 5 * 1024 * 1024;

type ShareCreateResponse = { id?: string; detail?: string; expires_at?: string };

async function createPersistentShare(
  payload: { title?: string; text?: string; url?: string; files: Array<{ name: string; mimeType: string; base64: string }> },
): Promise<{ id: string } | { error: string; status: number }> {
  try {
    const target = new URL("/api/v1/share-intake", getBackendOrigin());
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = (await upstream.json().catch(() => ({}))) as ShareCreateResponse;
    if (!upstream.ok || !data.id) {
      return {
        error: data.detail || "The care backend did not confirm the shared content was saved.",
        status: upstream.ok ? 502 : upstream.status,
      };
    }
    return { id: data.id };
  } catch {
    return { error: "The care backend could not be reached. Shared content was not saved.", status: 502 };
  }
}

/**
 * Web Share Target receiver. The backend stores a short-lived, one-time token;
 * the payload is not kept in a process-local map that may disappear between
 * serverless invocations.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const title = stringField(form, "title");
    const text = stringField(form, "text");
    const url = stringField(form, "url");

    const files: Array<{ name: string; mimeType: string; base64: string }> = [];
    let totalBytes = 0;
    for (const item of form.getAll("files")) {
      if (!(item instanceof File) || item.size === 0) continue;
      if (files.length >= MAX_FILES) {
        return NextResponse.json({ error: "Share up to five files at a time." }, { status: 413 });
      }
      totalBytes += item.size;
      if (totalBytes > MAX_SHARED_BYTES) {
        return NextResponse.json({ error: "Shared files exceed the 5 MB limit." }, { status: 413 });
      }
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

    const created = await createPersistentShare({
      title: title || undefined,
      text: text || undefined,
      url: url || undefined,
      files,
    });
    if ("error" in created) {
      return NextResponse.json({ error: created.error }, { status: created.status });
    }

    const dest = new URL("/workspace?enter=1", request.url);
    dest.searchParams.set("share_id", created.id);
    return NextResponse.redirect(dest, 303);
  } catch {
    return NextResponse.json({ error: "Shared content could not be processed." }, { status: 400 });
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

  const created = await createPersistentShare({
    title: title || undefined,
    text: text || undefined,
    url: sharedUrl || undefined,
    files: [],
  });
  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  const dest = new URL("/workspace?enter=1", request.url);
  dest.searchParams.set("share_id", created.id);
  return NextResponse.redirect(dest, 303);
}

function stringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
