import type { CareRecipientProfileData, GeneratedSummary, SummaryAudience } from "../types";

function formatList(items: string[], empty = "None recorded yet."): string {
  if (items.length === 0) return empty;
  return items.map((i) => `• ${i}`).join("\n");
}

function recentChanges(log: CareRecipientProfileData["tagged_event_log"], days = 30): string[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return log
    .filter((e) => new Date(e.date).getTime() >= cutoff)
    .slice(-8)
    .map((e) => `${e.category}: ${e.tag.replace(/_/g, " ")} (${e.date.slice(0, 10)})`);
}

function openItemsBrief(profile: CareRecipientProfileData): string[] {
  const recent = profile.tagged_event_log.slice(-5);
  return recent.map((e) => `${e.tag.replace(/_/g, " ")} — noted ${e.date.slice(0, 10)}`);
}

/**
 * Audience determines content slice — not just formatting.
 */
export function generateSummary(
  profile: CareRecipientProfileData,
  audience: SummaryAudience,
  scope = "current",
): GeneratedSummary {
  const generated_at = new Date().toISOString();
  const basics = profile.care_recipient_basics || "Care recipient — context accumulating from entries.";

  if (audience === "new_doctor") {
    const content = [
      `Care recipient overview: ${basics}`,
      "",
      "Known conditions:",
      formatList(profile.known_conditions),
      "",
      "Current medications:",
      formatList(profile.current_medications),
      "",
      "Recent changes (last 30 days):",
      formatList(recentChanges(profile.tagged_event_log), "No tagged changes in the last 30 days."),
      "",
      "Key dates:",
      profile.key_dates.length
        ? profile.key_dates.map((k) => `• ${k.label}: ${k.date || "date not confirmed"}`).join("\n")
        : "None recorded yet.",
    ].join("\n");

    return { audience, scope, content, generated_at };
  }

  if (audience === "family_member") {
    const content = [
      `About: ${basics}`,
      "",
      "What's open right now:",
      formatList(openItemsBrief(profile), "Nothing flagged as open from recent entries."),
      "",
      "How you can help:",
      "• Ask what feels heaviest this week",
      "• Offer specific time blocks — not open-ended availability",
      "• Medical and financial specifics are omitted unless explicitly shared",
    ].join("\n");

    return { audience, scope, content, generated_at };
  }

  if (audience === "aide") {
    const content = [
      `Care recipient: ${basics}`,
      "",
      "Conditions to be aware of:",
      formatList(profile.known_conditions),
      "",
      "Medication notes:",
      formatList(profile.current_medications),
      "",
      "Care team contacts:",
      profile.care_team.length
        ? profile.care_team.map((m) => `• ${m.name} (${m.role})${m.contact ? `: ${m.contact}` : ""}`).join("\n")
        : "None recorded yet.",
      "",
      "Recent incidents/symptoms:",
      formatList(
        profile.tagged_event_log
          .slice(-6)
          .map((e) => `${e.tag.replace(/_/g, " ")} — ${e.date.slice(0, 10)}`),
      ),
    ].join("\n");

    return { audience, scope, content, generated_at };
  }

  const content = [
    `Scope: ${scope}`,
    basics,
    formatList(profile.known_conditions, ""),
    formatList(openItemsBrief(profile), ""),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { audience: "custom", scope, content, generated_at };
}
