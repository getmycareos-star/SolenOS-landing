export type CareRecordRow = Record<string, unknown>;

type DraftSection = {
  title: string;
  items: Array<{ text: string; id: string }>;
};

function renderRecord(row: CareRecordRow, keys: string[]): string {
  let text = "";
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) { text = value.trim(); break; }
    if (value && typeof value === "object") { text = JSON.stringify(value); break; }
    if (typeof value === "number" || typeof value === "boolean") { text = String(value); break; }
  }
  if (!text) return "";
  const status = typeof row.epistemic_status === "string" ? ` · status: ${row.epistemic_status}` : "";
  let when = "";
  for (const key of ["effective_at", "occurred_at", "recorded_at", "created_at", "observed_at"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) { when = value.trim(); break; }
    if (typeof value === "number" || typeof value === "boolean") { when = String(value); break; }
  }
  return `${text.slice(0, 700)}${status}${when ? ` · recorded: ${when}` : ""}`;
}

function makeSection(title: string, rows: CareRecordRow[], keys: string[], maxItems: number): DraftSection {
  const selected = rows
    .map(row => ({ row, text: renderRecord(row, keys) }))
    .filter(item => item.text)
    .slice(0, maxItems);
  return {
    title,
    items: selected.map(item => ({
      text: item.text,
      id: typeof item.row.id === "string" ? item.row.id.trim() : "",
    })),
  };
}

export function buildReviewedHandoffDraft(input: {
  facts: CareRecordRow[];
  decisions: CareRecordRow[];
  questions: CareRecordRow[];
  gaps: CareRecordRow[];
  timeline: CareRecordRow[];
  preparedAt?: string;
}): { text: string; sourceRecordIds: string[] } {
  const sections = [
    makeSection("Care facts", input.facts, ["fact_value", "description", "title"], 12),
    makeSection("Care decisions", input.decisions, ["decision_text", "title", "description"], 8),
    makeSection("Open questions", input.questions, ["question", "description", "title"], 8),
    makeSection("Information gaps", input.gaps, ["description", "topic", "title"], 8),
    makeSection("Recent timeline", input.timeline, ["summary", "title", "description", "entry_type"], 8),
  ].filter(section => section.items.length > 0);

  if (sections.length === 0) {
    throw new Error("There are no saved care facts, decisions, questions, gaps, or timeline entries to include yet. Add real care information first.");
  }

  const parts = [
    "SOLENOS CARE HANDOFF SUMMARY",
    `Prepared for caregiver review: ${input.preparedAt ?? new Date().toLocaleString()}`,
    "This summary reflects saved records only. Status labels are preserved where available; missing information is not treated as false.",
  ];
  const includedSourceIds: string[] = [];
  const appendIfWithinLimit = (part: string, finalLimitations = false) => {
    const maximum = finalLimitations ? 18000 : 17500;
    if ([...parts, part].join("\n").length > maximum) return false;
    parts.push(part);
    return true;
  };

  for (const section of sections) {
    if (!appendIfWithinLimit(`\n${section.title.toUpperCase()}`)) break;
    for (const item of section.items) {
      if (!appendIfWithinLimit(`• ${item.text}`)) break;
      if (item.id) includedSourceIds.push(item.id);
    }
  }

  appendIfWithinLimit(
    "\nLIMITATIONS\nThis is a caregiver-reviewed summary, not a clinical judgment. Source IDs identify saved records used to prepare this draft; SolenOS does not independently verify that every edited statement is supported by those records.",
    true,
  );

  return {
    text: parts.join("\n"),
    sourceRecordIds: [...new Set(includedSourceIds)].slice(0, 100),
  };
}
