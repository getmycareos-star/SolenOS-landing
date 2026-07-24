import { CHECKIN_CLOSING_TEMPLATE } from "../contract-constants";
import type { CareRecipientProfileData, CheckinOutput, CheckinPeriod } from "../types";

function entriesSince(
  log: CareRecipientProfileData["tagged_event_log"],
  since: string | null,
): CareRecipientProfileData["tagged_event_log"] {
  if (!since) return log.slice(-10);
  return log.filter((e) => e.date > since);
}

/**
 * Close-the-loop ritual — explicit permission to stop carrying, not a to-do recap.
 */
export function generateCheckin(
  profile: CareRecipientProfileData,
  period: CheckinPeriod,
  lastCheckinAt: string | null,
  resolvedLabels: string[] = [],
): CheckinOutput {
  const generated_at = new Date().toISOString();
  const since = lastCheckinAt;
  const recent = entriesSince(profile.tagged_event_log, since);

  const resolved_since_last =
    resolvedLabels.length > 0
      ? resolvedLabels
      : recent.length === 0
        ? ["Nothing new required closure since your last check-in."]
        : [];

  const still_open_brief = recent.slice(-4).map(
    (e) => `${e.tag.replace(/_/g, " ")} — last noted ${e.date.slice(0, 10)}`,
  );

  if (still_open_brief.length === 0) {
    still_open_brief.push("No new open items flagged since last check-in.");
  }

  const periodLabel = period === "daily" ? "today" : "this week";
  const closing_statement = `${CHECKIN_CLOSING_TEMPLATE} For ${periodLabel}, what needed logging is held here.`;

  return {
    period,
    resolved_since_last,
    still_open_brief,
    closing_statement,
    generated_at,
  };
}
