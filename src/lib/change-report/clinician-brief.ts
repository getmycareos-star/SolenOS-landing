/**
 * Clinician Brief — specialized composition that formats the Change Report
 * into a clinician-ready format for appointment preparation.
 *
 * Dementia Wedge Moment: Neurologist/Doctor Appointment
 *
 * "Caregivers need to explain weeks or months of behavior changes
 * during a limited 15-minute appointment. Important details are
 * often forgotten or scattered."
 *
 * SolenOS role: Create a care brief that summarizes changes, patterns,
 * history, and questions worth discussing.
 */

import type { ChangeReport } from "./types";

export type ClinicianBrief = {
  /** Subject */
  care_recipient: string | null;
  /** Period covered by this brief */
  period: { from: string; to: string };
  /** Executive summary of key changes */
  executive_summary: string;
  /** What changed since last visit */
  what_changed_since_last: string[];
  /** Timeline of significant events */
  significant_events: Array<{
    date: string;
    description: string;
  }>;
  /** Pattern observations (recurring themes) */
  pattern_observations: string[];
  /** Open questions for the clinician */
  questions_for_clinician: string[];
  /** Current concerning signals */
  concerning_signals: string[];
  /** Medication or treatment context if available */
  medication_context: string[];
  /** What the caregiver is most concerned about */
  caregiver_primary_concern: string | null;
  /** Confidence in the observations presented */
  confidence: "low" | "medium" | "high";
  /** When this brief was generated */
  generated_at: string;
};

/**
 * Format a Change Report into a clinician-facing brief.
 *
 * The brief is designed to be:
 * - Readable in under 2 minutes
 * - Actionable (questions + observations)
 * - Focused on changes, not history
 * - Free of diagnostic language
 */
export function formatClinicianBrief(report: ChangeReport): ClinicianBrief {
  const now = new Date().toISOString();
  const fromDate =
    report.relevant_timeline.length > 0
      ? report.relevant_timeline[report.relevant_timeline.length - 1]?.date ?? "unknown"
      : "unknown";
  const toDate =
    report.relevant_timeline.length > 0
      ? report.relevant_timeline[0]?.date ?? now.slice(0, 10)
      : now.slice(0, 10);

  // Build executive summary
  const summaryParts: string[] = [];
  if (report.what_changed.length > 0) {
    const changes = report.what_changed.slice(0, 2).join("; ");
    summaryParts.push(`Changes reported: ${changes}`);
  }
  if (report.is_recurring_pattern) {
    summaryParts.push(`This pattern has been observed ${report.recurrence_count} times previously`);
  }
  if (report.prior_baseline.length > 0) {
    summaryParts.push(`Prior baseline: ${report.prior_baseline[0]}`);
  }
  const executiveSummary = summaryParts.length > 0
    ? summaryParts.join(". ") + "."
    : "A change was reported. Details are available in the care record.";

  // Significant events from timeline
  const significantEvents = report.relevant_timeline
    .filter((item) => item.type === "event" || item.type === "decision")
    .slice(0, 5)
    .map((item) => ({
      date: item.date,
      description: item.description,
    }));

  // Pattern observations
  const patternObservations: string[] = [];
  if (report.is_recurring_pattern) {
    patternObservations.push(`This type of change has been reported ${report.recurrence_count} times`);
  }
  for (const ctx of report.possible_context) {
    if (ctx.connection === "recurring_pattern") {
      patternObservations.push(`${ctx.observation} — has appeared before in relation to ${ctx.related_to}`);
    }
  }
  if (report.related_history.length > 0) {
    patternObservations.push(`Related prior observations: ${report.related_history.slice(0, 2).join("; ")}`);
  }

  // Concerning signals
  const concerningSignals: string[] = [];
  if (report.possible_context.some((c) => c.connection === "temporal_proximity")) {
    concerningSignals.push("Change occurred in temporal proximity to a medical event or medication change");
  }
  const safetyDomain = report.relevant_timeline.find((t) => t.domain?.includes("safety"));
  if (safetyDomain) {
    concerningSignals.push("Safety-related change was noted");
  }

  // Medication context
  const medicationContext = report.related_history
    .filter((h) => /\b(?:medication|medicine|dose|dosage)\b/i.test(h))
    .slice(0, 3);

  // Caregiver primary concern
  const primaryConcern = report.what_changed[0] ?? null;

  return {
    care_recipient: report.care_recipient,
    period: { from: fromDate, to: toDate },
    executive_summary: executiveSummary,
    what_changed_since_last: report.what_changed.slice(0, 4),
    significant_events: significantEvents,
    pattern_observations: patternObservations.slice(0, 4),
    questions_for_clinician: report.questions_for_clinician.slice(0, 5),
    concerning_signals: concerningSignals.slice(0, 3),
    medication_context: medicationContext,
    caregiver_primary_concern: primaryConcern,
    confidence: report.confidence,
    generated_at: now,
  };
}

