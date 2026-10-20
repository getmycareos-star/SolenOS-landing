import type { SystemAggregation } from "./aggregate-output";
import type { ObservationRecord } from "./stores/observation-store";
import type { WeeklySummary } from "./weekly-summary";

export type ExportReportFormat = "html" | "text" | "pdf";

export type DoctorSummaryReport = {
  title: string;
  generatedAt: string;
  caregiverId: string;
  observationCount: number;
  sections: {
    summary: string;
    patterns: string[];
    recurring: string[];
    emotionalIncidents: number;
    memoryIncidents: number;
    changes: string[];
    recentObservations: { date: string; text: string; signals: string[] }[];
    aggregation: SystemAggregation;
    disclaimer: string;
  };
  html: string;
  /**
   * PDF path status: STUB — print-ready HTML until pdfkit (or similar) is added.
   * See docs/10-ai-systems and observation export API `format=pdf`.
   */
  pdfPath: "html_print_stub";
};

const DISCLAIMER =
  "This report summarizes caregiver observations only. It does not constitute a medical diagnosis, " +
  "clinical assessment, or treatment recommendation. Patterns reflect what was observed and reported, not medical truth.";

/**
 * Build a simple caregiver→doctor summary export (HTML + PDF print stub).
 * No diagnoses. No medical certainty.
 */
export function buildDoctorSummaryReport(params: {
  caregiverId: string;
  observations: ObservationRecord[];
  weeklySummary: WeeklySummary;
  aggregation: SystemAggregation;
  signalsByObservation: Map<string, string[]>;
  format?: ExportReportFormat;
}): DoctorSummaryReport {
  const { caregiverId, observations, weeklySummary, aggregation, signalsByObservation } = params;
  const generatedAt = new Date().toISOString();

  const recent = [...observations]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map((o) => ({
      date: o.created_at.slice(0, 10),
      text: o.raw_text,
      signals: signalsByObservation.get(o.id) ?? [],
    }));

  const patterns = [
    weeklySummary.headline,
    ...weeklySummary.trendSnippets,
    ...weeklySummary.categoryTrends
      .filter((c) => c.direction === "increasing")
      .map((c) => c.label),
  ];

  const recurring = weeklySummary.recurringSignals.map(
    (r) => `${r.signal.replace(/_/g, " ")} (${r.count}× this week)`,
  );

  const summary = [aggregation.what_is_happening, aggregation.what_matters_now].join(" ");

  const html = renderHtmlReport({
    caregiverId,
    generatedAt,
    summary,
    patterns,
    recurring,
    changes: weeklySummary.changes,
    emotionalIncidents: weeklySummary.emotionalIncidents,
    memoryIncidents: weeklySummary.memoryIncidents,
    recent,
    aggregation,
    observationCount: observations.length,
  });

  return {
    title: "Caregiver Observation Summary",
    generatedAt,
    caregiverId,
    observationCount: observations.length,
    sections: {
      summary,
      patterns,
      recurring,
      emotionalIncidents: weeklySummary.emotionalIncidents,
      memoryIncidents: weeklySummary.memoryIncidents,
      changes: weeklySummary.changes,
      recentObservations: recent,
      aggregation,
      disclaimer: DISCLAIMER,
    },
    html,
    pdfPath: "html_print_stub",
  };
}

function renderHtmlReport(params: {
  caregiverId: string;
  generatedAt: string;
  summary: string;
  patterns: string[];
  recurring: string[];
  changes: string[];
  emotionalIncidents: number;
  memoryIncidents: number;
  recent: { date: string; text: string; signals: string[] }[];
  aggregation: SystemAggregation;
  observationCount: number;
}): string {
  const {
    caregiverId,
    generatedAt,
    summary,
    patterns,
    recurring,
    changes,
    emotionalIncidents,
    memoryIncidents,
    recent,
    aggregation,
    observationCount,
  } = params;

  const patternList = patterns.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
  const recurringList = recurring.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
  const changesList = changes.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
  const recentList = recent
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.text)}</td><td>${escapeHtml(r.signals.join(", "))}</td></tr>`,
    )
    .join("");
  const followUps = aggregation.follow_up_items
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Caregiver Observation Summary</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 2rem auto; color: #1a1a1a; line-height: 1.45; }
    h1 { font-size: 1.35rem; font-family: system-ui, sans-serif; }
    h2 { font-size: 1.05rem; font-family: system-ui, sans-serif; margin-top: 1.5rem; }
    .meta { color: #666; font-size: 0.875rem; font-family: system-ui, sans-serif; }
    .counts { display: flex; gap: 1.5rem; font-family: system-ui, sans-serif; font-size: 0.9rem; }
    .disclaimer { background: #f5f5f5; padding: 1rem; border-radius: 4px; font-size: 0.875rem; margin-top: 2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; vertical-align: top; }
    th { background: #f9f9f9; font-family: system-ui, sans-serif; }
    @media print { body { margin: 0; max-width: none; } }
  </style>
</head>
<body>
  <h1>Caregiver Observation Summary</h1>
  <p class="meta">Caregiver: ${escapeHtml(caregiverId)} · Generated: ${escapeHtml(generatedAt)} · ${observationCount} total observation(s)</p>
  <p class="meta">Structure only — no diagnoses, no medical certainty.</p>

  <div class="counts">
    <span>Memory signals (week): <strong>${memoryIncidents}</strong></span>
    <span>Emotional signals (week): <strong>${emotionalIncidents}</strong></span>
  </div>

  <h2>What Is Happening</h2>
  <p>${escapeHtml(summary)}</p>

  <h2>Pattern Trends</h2>
  <ul>${patternList || "<li>No patterns recorded yet</li>"}</ul>

  <h2>Recurring Signals</h2>
  <ul>${recurringList || "<li>No recurring signals this week</li>"}</ul>

  <h2>Changes</h2>
  <ul>${changesList || "<li>No week-over-week changes noted</li>"}</ul>

  <h2>What Matters Now</h2>
  <p>${escapeHtml(aggregation.what_matters_now)}</p>
  <p><strong>Risk level (observation-based):</strong> ${escapeHtml(aggregation.risk_level)}</p>

  <h2>Questions for Care Team</h2>
  <p>${escapeHtml(aggregation.what_to_ask_next)}</p>

  <h2>Follow-Up Items</h2>
  <ul>${followUps || "<li>Continue recording observations</li>"}</ul>

  <h2>Recent Observations</h2>
  <table>
    <thead><tr><th>Date</th><th>Observation</th><th>Signals</th></tr></thead>
    <tbody>${recentList || "<tr><td colspan='3'>None</td></tr>"}</tbody>
  </table>

  <p class="disclaimer">${escapeHtml(DISCLAIMER)}</p>
  <p class="meta">PDF generation: HTML print stub (add pdfkit for binary PDF).</p>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportReportAsHtml(report: DoctorSummaryReport): string {
  return report.html;
}

/** PDF stub — returns print-ready HTML until pdfkit is added as a dependency. */
export function exportReportAsPdfStub(report: DoctorSummaryReport): string {
  return report.html;
}

export function exportReportAsText(report: DoctorSummaryReport): string {
  const lines = [
    report.title,
    `Generated: ${report.generatedAt}`,
    `Caregiver: ${report.caregiverId}`,
    `PDF path: ${report.pdfPath}`,
    "",
    "SUMMARY",
    report.sections.summary,
    "",
    `Memory incidents (week): ${report.sections.memoryIncidents}`,
    `Emotional incidents (week): ${report.sections.emotionalIncidents}`,
    "",
    "PATTERNS",
    ...report.sections.patterns.map((p) => `- ${p}`),
    "",
    "RECURRING",
    ...(report.sections.recurring.length
      ? report.sections.recurring.map((p) => `- ${p}`)
      : ["- None"]),
    "",
    "CHANGES",
    ...(report.sections.changes.length
      ? report.sections.changes.map((p) => `- ${p}`)
      : ["- None"]),
    "",
    "WHAT MATTERS NOW",
    report.sections.aggregation.what_matters_now,
    `Risk level: ${report.sections.aggregation.risk_level}`,
    "",
    "QUESTIONS FOR CARE TEAM",
    report.sections.aggregation.what_to_ask_next,
    "",
    "FOLLOW-UP",
    ...report.sections.aggregation.follow_up_items.map((f) => `- ${f}`),
    "",
    "DISCLAIMER",
    report.sections.disclaimer,
  ];
  return lines.join("\n");
}
