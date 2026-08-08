/**
 * SolenOS — Document Intelligence Quality Verification
 *
 * Verifies the Living Care Record quality bar (9/10) for the document-intelligence
 * care layer:
 *  1. High-priority medication safety signals are never missed (duplicate dose,
 *     missed dose, refill problem, unclear instructions, medication uncertainty).
 *  2. Important upcoming events are always structured (what / when / who /
 *     preparation), never buried in paragraphs.
 *  3. Reduced abstraction — concrete caregiver-relevant language, no vague phrasing.
 *  4. Information is prioritized by caregiver impact (immediateAttention /
 *     importantToTrack / canWait).
 *  5. Safety signals and deadlines surface as immediate attention.
 *  6. Timeline whatMattersNext is concrete and evidence-backed.
 */

import { extractCareJourneyUnderstanding } from "../src/lib/document-intelligence/care-journey-extraction";
import { detectCareChanges } from "../src/lib/document-intelligence/change-detection";
import { buildCaregiverTranslation } from "../src/lib/document-intelligence/caregiver-translation";
import { buildDocumentTimelineEvents } from "../src/lib/document-intelligence/timeline-events";
import { buildCaregiverPrioritization } from "../src/lib/document-intelligence/prioritization";
import type {
  CareJourneyUnderstanding,
} from "../src/lib/document-intelligence/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS — Document Intelligence Quality (Living Care Record) ===\n");

const firstJourney: CareJourneyUnderstanding = {
  medicalEvents: [],
  medications: [],
  appointments: [],
  careInstructions: [],
  people: [],
  whatChanged: [],
  uncertainties: [],
  caregiverTranslation: [],
  timelineEvents: [],
  prioritization: { immediateAttention: [], importantToTrack: [], canWait: [] },
};

// ─── 1. High-priority medication safety signals ─────────────────────────────

const safetyText =
  "The patient may have been given a duplicate dose of lisinopril today. " +
  "Metformin refill was denied by the pharmacy. " +
  "The current medication list is unclear and instructions for atenolol are confusing. " +
  "A dose of atorvastatin was missed this morning.";
const safetyJourney = extractCareJourneyUnderstanding(safetyText, "medical_document");

assert(
  safetyJourney.medications.some((m) => m.duplicateDose),
  "must flag duplicate dose",
);
assert(
  safetyJourney.medications.some((m) => m.missedDose),
  "must flag missed dose",
);
assert(
  safetyJourney.medications.some((m) => m.refillProblem),
  "must flag refill problem",
);
assert(
  safetyJourney.medications.some((m) => m.unclearInstructions),
  "must flag unclear instructions",
);
assert(
  safetyJourney.medications.some((m) => m.uncertainty),
  "must flag medication uncertainty",
);
console.log("✓ medication safety signals extracted (all 5 flags)");

// Safety signals are never swallowed by change detection.
const safetyChanges = detectCareChanges(safetyJourney, firstJourney);
const safetyLabels = safetyChanges.map((c) => c.label.toLowerCase()).join(" | ");
assert(/(duplicate|more than once)/.test(safetyLabels), "duplicate surfaces as change");
assert(/refill problem/.test(safetyLabels), "refill problem surfaces as change");
assert(/missed dose/.test(safetyLabels), "missed dose surfaces as change");
assert(/unclear instructions/.test(safetyLabels), "unclear instructions surfaces as change");
assert(/medication uncertainty/.test(safetyLabels), "medication uncertainty surfaces as change");
console.log("✓ medication safety signals surface through change detection");

// Safety signals produce concrete whatMattersNext.
const safetyTimeline = buildDocumentTimelineEvents(safetyJourney, "Safety list.pdf");
const safetyNext = safetyTimeline.map((t) => t.whatMattersNext.toLowerCase()).join(" ");
assert(/(duplicate dose|correct dose)/.test(safetyNext), "duplicate -> correct dose action");
assert(/(make-up|refill|how .*taken|clarify)/.test(safetyNext), "whatMattersNext concrete");
console.log("✓ timeline produces concrete, evidence-backed whatMattersNext");

// Safety signals route to immediate attention.
const safetyPrioritization = buildCaregiverPrioritization(safetyJourney);
const immediate = safetyPrioritization.immediateAttention.join(" ").toLowerCase();
assert(
  /(duplicate|confirm the correct dose|refill|missed dose|unclear|clarify)/.test(immediate),
  "safety signals route to immediate attention",
);
console.log("✓ safety signals prioritized to immediate attention");

// ─── 2. Structured upcoming events ──────────────────────────────────────────

const appointmentText =
  "Neurology appointment scheduled for Thursday at 10:30 AM. Bring the medication list and recent records. " +
  "Family discussion about care options planned for next week with Dr. Johnson. " +
  "A decision about the care plan must be made by March 20.";
const appointmentJourney = extractCareJourneyUnderstanding(appointmentText, "care_plan");

const neuroAppt = appointmentJourney.appointments.find((a) => a.kind === "upcoming_visit");
assert(neuroAppt, "upcoming visit extracted");
assert(neuroAppt && neuroAppt.what.length > 0, "upcoming visit has what");
assert(neuroAppt && typeof neuroAppt.who === "string" && neuroAppt.who.length > 0, "upcoming visit has who");
assert(neuroAppt && neuroAppt.timeframe && neuroAppt.timeframe.length > 0, "upcoming visit has when");
assert(
  appointmentJourney.appointments.some((a) => a.preparation),
  "appointment with prep must carry preparation",
);
assert(
  appointmentJourney.appointments.some((a) => a.kind === "family_discussion"),
  "family discussion extracted",
);
assert(
  appointmentJourney.appointments.some((a) => a.kind === "planned_care_decision"),
  "planned care decision extracted",
);
assert(
  appointmentJourney.appointments.some((a) => a.kind === "deadline"),
  "deadline extracted",
);
console.log("✓ upcoming events are structured (what/when/who/preparation + all kinds)");

// Deadlines route to immediate attention.
const apptPrioritization = buildCaregiverPrioritization(appointmentJourney);
const apptImmediate = apptPrioritization.immediateAttention.join(" ").toLowerCase();
assert(/(deadline|by march 20)/.test(apptImmediate), "deadline routes to immediate attention");
console.log("✓ deadlines prioritized to immediate attention");

// ─── 3. Reduced abstraction ─────────────────────────────────────────────────

const dischargeTranslation = buildCaregiverTranslation(
  {
    ...safetyJourney,
    medicalEvents: [],
    people: [],
    uncertainties: [],
    whatChanged: [],
    caregiverTranslation: [],
    timelineEvents: [],
  },
  12,
).join(" ");
assert(!/care situation changed/.test(dischargeTranslation), "no vague 'care situation changed'");
assert(!/care story continues/.test(dischargeTranslation), "no 'care story continues'");
assert(!/something needs attention/.test(dischargeTranslation), "no 'something needs attention'");
assert(!/medication complexity is present/.test(dischargeTranslation), "no abstraction phrase");
assert(
  /lisinopril|metformin|atorvastatin|atenolol/.test(dischargeTranslation),
  "translation must be concrete with medication names",
);
console.log("✓ caregiver translation is concrete, no vague/abstract phrasing");

// ─── 4. Caregiver-impact prioritization contract ────────────────────────────

assert(
  Array.isArray(safetyPrioritization.immediateAttention) &&
    Array.isArray(safetyPrioritization.importantToTrack) &&
    Array.isArray(safetyPrioritization.canWait),
  "prioritization has all three impact buckets",
);
assert(
  safetyPrioritization.immediateAttention.length > 0,
  "safety document surfaces immediate attention",
);
console.log("✓ prioritization groups information by caregiver impact");

console.log("\n=== Document Intelligence Quality: all checks passed ===");

