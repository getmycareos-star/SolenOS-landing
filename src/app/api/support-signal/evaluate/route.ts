import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { evaluateSupportSignal } from "@/lib/support-signal-system";
import {
  SupportSignalEvaluateRequestSchema,
  SupportSignalTelemetryInsertSchema,
} from "@/lib/telemetry-persistence/support-signal-telemetry";
import {
  getLastDeliveredSupportSignalAt,
  recordSupportSignalEvent,
} from "@/lib/telemetry-persistence/support-signal-server";
import { getTelemetryStore } from "@/lib/telemetry-persistence/server";

/**
 * POST /api/support-signal/evaluate
 *
 * Server evaluates observational signals and returns deliver/suppress + static template OR null.
 * Actual push notification delivery is out of scope for MVP — evaluation + logging contract only.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SupportSignalEvaluateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid support signal payload" }, { status: 400 });
  }

  const {
    telemetry_user_id,
    last_delivered_at: requestLastDelivered,
    previous_support_state,
    sustained_pressure_days,
    ...signal
  } = parsed.data;

  let userId = telemetry_user_id;
  if (!userId) {
    try {
      const store = await getTelemetryStore();
      const ensured = await store.ensureUser();
      userId = ensured.user_id;
    } catch {
      userId = undefined;
    }
  }

  const lastDeliveredAt =
    requestLastDelivered ??
    (userId ? await getLastDeliveredSupportSignalAt(userId) : null);

  const result = evaluateSupportSignal({
    ...signal,
    last_delivered_at: lastDeliveredAt,
    previous_support_state: previous_support_state ?? null,
    sustained_pressure_days: sustained_pressure_days ?? 0,
  });

  if (userId) {
    try {
      const telemetryPayload = SupportSignalTelemetryInsertSchema.parse({
        user_id: userId,
        notification_id: result.template?.id ?? `none-${result.support_state}`,
        category: result.support_state,
        delivered_at: result.deliver ? new Date().toISOString() : null,
        suppressed: result.suppressed || !result.deliver,
      });
      await recordSupportSignalEvent(telemetryPayload);
    } catch (error) {
      console.warn("[/api/support-signal/evaluate] telemetry write failed (non-blocking):", error);
    }
  }

  return NextResponse.json({
    deliver: result.deliver,
    suppressed: result.suppressed,
    support_state: result.support_state,
    template: result.template ?? null,
    reason: result.reason,
  });
}
