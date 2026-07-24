import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  coerceSolenOSLanguage,
  isSolenOSLanguage,
  SOLENOS_LANGUAGES,
} from "@/lib/multilingual-execution";
import { getTelemetryStore } from "@/lib/telemetry-persistence/server";

const LanguageQuerySchema = z.object({
  telemetry_user_id: z.string().uuid(),
});

const LanguageUpdateSchema = z.object({
  telemetry_user_id: z.string().uuid(),
  language_preference: z.enum(SOLENOS_LANGUAGES),
  ui_language: z.enum(SOLENOS_LANGUAGES).optional(),
});

/**
 * GET /api/user/language — load persisted language preference for a telemetry user.
 */
export async function GET(req: NextRequest) {
  const parsed = LanguageQuerySchema.safeParse({
    telemetry_user_id: req.nextUrl.searchParams.get("telemetry_user_id"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "telemetry_user_id query parameter required (uuid)" },
      { status: 400 },
    );
  }

  const store = await getTelemetryStore();
  await store.ensureUser(parsed.data.telemetry_user_id);
  const language = await store.getUserLanguagePreference(parsed.data.telemetry_user_id);

  return NextResponse.json({
    language_preference: language ?? "en",
    ui_language: language ?? "en",
    supported_languages: SOLENOS_LANGUAGES,
  });
}

/**
 * PATCH /api/user/language — update user language preference (UI + execution aligned).
 */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LanguageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "telemetry_user_id and language_preference required" },
      { status: 400 },
    );
  }

  if (!isSolenOSLanguage(parsed.data.language_preference)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const store = await getTelemetryStore();
  await store.ensureUser(parsed.data.telemetry_user_id);
  const uiLanguage = coerceSolenOSLanguage(
    parsed.data.ui_language ?? parsed.data.language_preference,
  );

  await store.updateUserLanguagePreference(parsed.data.telemetry_user_id, {
    language_preference: parsed.data.language_preference,
    ui_language: uiLanguage,
  });

  return NextResponse.json({
    language_preference: parsed.data.language_preference,
    ui_language: uiLanguage,
  });
}
