import type { CareSnapshot } from "./types";
import { typeLabel } from "./classify";

function formatGeneratedDate(iso: string): string {
  return iso.slice(0, 10);
}

function sectionOrNone(items: string[]): string {
  if (items.length === 0) return "None recorded.";
  return items.map((item) => `- ${item}`).join("\n");
}

export function toPlainText(snapshot: CareSnapshot): string {
  const lines: string[] = ["CARE SNAPSHOT"];
  lines.push(`Generated: ${formatGeneratedDate(snapshot.generatedAt)}`);
  lines.push("");

  if (snapshot.identity?.patientName) {
    lines.push(`Patient: ${snapshot.identity.patientName}`);
  }
  if (snapshot.identity?.contextLabel) {
    lines.push(`Context: ${snapshot.identity.contextLabel}`);
  }

  if (snapshot.identity?.patientName || snapshot.identity?.contextLabel) {
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("TIMELINE");

  if (snapshot.timeline.length === 0) {
    lines.push("None recorded.");
  } else {
    for (const event of snapshot.timeline) {
      const label = typeLabel(event.type);
      const suffix = label ? ` [${label}]` : "";
      lines.push(`- ${event.dateLabel}: ${event.description}${suffix}`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("KEY OBSERVATIONS");
  lines.push(sectionOrNone(snapshot.keyObservations));

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("CARE STORY DETAILS");
  lines.push(sectionOrNone(snapshot.careNotes));

  return lines.join("\n");
}
