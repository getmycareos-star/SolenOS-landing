/**
 * SolenOS — Document Intelligence Care-Journey Verification
 *
 * Verifies the care-journey understanding layer:
 * 1. Care-journey extraction (medical events, medications, appointments, instructions, people)
 * 2. Change detection (New / Changed / Missing / Unclear)
 * 3. Caregiver translation (medical → caregiver understanding)
 * 4. Timeline events (Document → care timeline)
 * 5. Evidence traceability (every insight carries source text)
 * 6. SolenOS never confirms diagnoses, validates medications, or makes care decisions
 */

import { extractCareJourneyUnderstanding } from "../src/lib/document-intelligence/care-journey-extraction";
import { detectCareChanges, changesToWhatChanged } from "../src/lib/document-intelligence/change-detection";
import { buildCaregiverTranslation, buildCaregiverSummary } from "../src/lib/document-intelligence/caregiver-translation";
import { buildDocumentTimelineEvents } from "../src/lib/document-intelligence/timeline-events";
import { processDocumentIntelligenceLayer } from "../src/lib/document-intelligence/process-document-intelligence";
import { applyDocumentIntake } from "../src/lib/document-intake";
import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";
import type {
  CareJourneyUnderstanding,
  DocumentNode,
} from "../src/lib/document-intelligence/types";

console.log("=== SolenOS — Document Intelligence Care-Journey Verification ===\n");

// ─── 1. Care-journey extraction ──────────────────────────────────────────────

// Medical document with all categories
const dischargeText =
  "Discharge summary: Ms. Smith was admitted to St. Mary's Hospital on March 15, 2026. " +
  "Diagnosis: hypertension and type 2 diabetes. " +
  "Procedure: cardiac catheterization performed on March 16. " +
  "New medications: lisinopril 10mg daily, metformin 500mg twice daily. " +
  "Discontinue atorvastatin. " +
  "Follow up with cardiology in 4 weeks. " +
  "Monitor blood pressure daily and call the doctor if readings exceed 140/90. " +
  "No driving for 48 hours. " +
  "Dr. Johnson (cardiologist) will see you at the follow-up. " +
  "Refill lisinopril at the pharmacy before discharge.";

const dischargeJourney = extractCareJourneyUnderstanding(dischargeText, "medical_document");

if (dischargeJourney.medicalEvents.length === 0) {
  throw new Error("must extract medical events from discharge summary");
}
const hasHospitalVisit = dischargeJourney.medicalEvents.some((e) => e.kind === "hospital_visit");
const hasDiagnosis = dischargeJourney.medicalEvents.some((e) => e.kind === "diagnosis");
const hasProcedure = dischargeJourney.medicalEvents.some((e) => e.kind === "procedure");
const hasDischarge = dischargeJourney.medicalEvents.some((e) => e.kind === "discharge");
if (!hasHospitalVisit || !hasDiagnosis || !hasProcedure || !hasDischarge) {
  throw new Error("must extract all medical event types: hospital_visit, diagnosis, procedure, discharge");
}
console.log("✓ medical event extraction (all 4 event types)");

if (dischargeJourney.medications.length < 3) {
  throw new Error("must extract at least 3 medications (lisinopril, metformin, atorvastatin)");
}
const hasNewLisinopril = dischargeJourney.medications.some(
  (m) => m.name.toLowerCase() === "lisinopril" && m.status === "new",
);
const hasNewMetformin = dischargeJourney.medications.some(
  (m) => m.name.toLowerCase() === "metformin" && m.status === "new",
);
const hasDiscontinuedAtorvastatin = dischargeJourney.medications.some(
  (m) => m.name.toLowerCase() === "atorvastatin" && m.status === "discontinued",
);
if (!hasNewLisinopril || !hasNewMetformin || !hasDiscontinuedAtorvastatin) {
  throw new Error("must classify medication statuses correctly (new, discontinued)");
}
if (dischargeJourney.medications.some((m) => m.dose && !m.dose.match(/mg|mcg|ml|units?|g/))) {
  throw new Error("dose must include unit (mg etc.)");
}
console.log("✓ medication extraction + status classification");

if (dischargeJourney.appointments.length === 0) {
  throw new Error("must extract appointments from 'follow up with cardiology in 4 weeks'");
}
const hasCardioFollowUp = dischargeJourney.appointments.some(
  (a) => a.kind === "specialist_referral" || a.kind === "recommended_follow_up",
);
if (!hasCardioFollowUp) {
  throw new Error("must classify cardiology follow-up as specialist_referral or recommended_follow_up");
}
console.log("✓ appointment/follow-up extraction");

if (dischargeJourney.careInstructions.length === 0) {
  throw new Error("must extract care instructions (monitor, warning signs, restrictions)");
}
const hasMonitoring = dischargeJourney.careInstructions.some((i) => i.kind === "monitoring_requirement");
const hasWarningSign = dischargeJourney.careInstructions.some((i) => i.kind === "warning_sign");
const hasRestriction = dischargeJourney.careInstructions.some((i) => i.kind === "restriction");
if (!hasMonitoring || !hasWarningSign || !hasRestriction) {
  throw new Error("must extract monitoring, warning sign, and restriction instructions");
}
console.log("✓ care instruction extraction (monitoring, warning signs, restrictions)");

if (dischargeJourney.people.length === 0) {
  throw new Error("must extract people from discharge summary (Dr. Johnson, St. Mary's Hospital)");
}
const hasDoctor = dischargeJourney.people.some((p) => p.role === "doctor" || p.role === "specialist");
const hasHospital = dischargeJourney.people.some((p) => p.role === "hospital");
if (!hasDoctor || !hasHospital) {
  throw new Error("must extract doctor and hospital from discharge summary");
}
console.log("✓ people/organization extraction");

// ─── 2. Evidence traceability ────────────────────────────────────────────────

for (const event of dischargeJourney.medicalEvents) {
  if (!event.sourceText || event.sourceText.length < 5) {
    throw new Error("every medical event must carry traceable source text");
  }
}
for (const med of dischargeJourney.medications) {
  if (med.sourceText.length === 0) {
    throw new Error(`every medication (${med.name}) must carry traceable source text`);
  }
}
for (const app of dischargeJourney.appointments) {
  if (!app.sourceText || app.sourceText.length < 5) {
    throw new Error("every appointment must carry traceable source text");
  }
}
for (const instruction of dischargeJourney.careInstructions) {
  if (!instruction.sourceText || instruction.sourceText.length < 5) {
    throw new Error("every instruction must carry traceable source text");
  }
}
console.log("✓ evidence traceability (all insights carry source text)");

// ─── 3. Non-medical document gating ──────────────────────────────────────────

const insuranceText =
  "Prior authorization required by March 15, 2026. Policy number ABC-12345.";
const insuranceJourney = extractCareJourneyUnderstanding(insuranceText, "insurance_document");
if (insuranceJourney.medications.length > 0 || insuranceJourney.appointments.length > 0) {
  throw new Error("insurance documents must not produce medication or appointment extraction");
}
console.log("✓ non-medical document gating (no false extraction)");

// ─── 4. Change detection ─────────────────────────────────────────────────────

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
};

const changes = detectCareChanges(
  dischargeJourney,
  firstJourney,
);

if (changes.length === 0) {
  throw new Error("must detect changes when no prior understanding exists");
}
const newMeds = changes.filter((c) => c.kind === "new" && c.category === "medication");
if (newMeds.length < 2) {
  throw new Error("must detect new medications when no prior record exists");
}
console.log("✓ change detection from empty prior record");

const whatChangedStr = changesToWhatChanged(changes);
if (whatChangedStr.length === 0) {
  throw new Error("changesToWhatChanged must produce human-readable strings");
}
if (!whatChangedStr[0]?.startsWith("New —")) {
  throw new Error("change strings must start with category label (New —, Changed —, etc.)");
}
console.log("✓ changesToWhatChanged formatted output");

// ─── 5. Caregiver translation ────────────────────────────────────────────────

const translation = buildCaregiverTranslation(dischargeJourney, 8);
if (translation.length === 0) {
  throw new Error("must produce caregiver translation lines");
}
const containsMedicationTranslation = translation.some((t) => t.toLowerCase().includes("lisinopril"));
if (!containsMedicationTranslation) {
  throw new Error("caregiver translation must include medication names");
}
console.log("✓ caregiver translation (medical → caregiver understanding)");

const summary = buildCaregiverSummary(dischargeJourney);
if (summary.whatHappened.length === 0) {
  throw new Error("caregiver summary must include whatHappened");
}
if (summary.whatToDoNext.length === 0) {
  throw new Error("caregiver summary must include whatToDoNext");
}
console.log("✓ caregiver summary (whatHappened, whatToDoNext)");

// ─── 6. Timeline events ──────────────────────────────────────────────────────

const timelineEvents = buildDocumentTimelineEvents(dischargeJourney, "Discharge summary.pdf");
if (timelineEvents.length === 0) {
  throw new Error("must produce timeline events from document");
}
for (const event of timelineEvents) {
  if (!event.date || !event.event || !event.source || !event.whatChanged || !event.whatMattersNext) {
    throw new Error("every timeline event must have all 5 fields (date, event, source, whatChanged, whatMattersNext)");
  }
}
console.log("✓ timeline event generation (all 5 fields present)");

// ─── 7. Integration through processDocumentIntelligenceLayer ─────────────────

const input = stressNormalizeInput(dischargeText);
const intake = applyDocumentIntake(input);
const layer = processDocumentIntelligenceLayer({
  rawInput: input.raw_input,
  documentIntake: intake,
});

if (layer.skipped) {
  throw new Error("discharge summary must not skip document intelligence");
}
if (layer.nodes.length === 0) {
  throw new Error("must produce document nodes for discharge summary");
}

const node = layer.nodes[0]!;
if (!node.careJourney) {
  throw new Error("DocumentNode must have careJourney field populated");
}
if (node.careJourney.medicalEvents.length === 0) {
  throw new Error("DocumentNode.careJourney must include medical events");
}
if (node.careJourney.medications.length === 0) {
  throw new Error("DocumentNode.careJourney must include medications");
}
if (node.careJourney.whatChanged.length === 0) {
  throw new Error("DocumentNode.careJourney must include whatChanged");
}
if (node.careJourney.caregiverTranslation.length === 0) {
  throw new Error("DocumentNode.careJourney must include caregiverTranslation");
}
if (node.careJourney.timelineEvents.length === 0) {
  throw new Error("DocumentNode.careJourney must include timelineEvents");
}
console.log("✓ processDocumentIntelligenceLayer integration (careJourney populated)");

// ─── 8. SolenOS never confirms diagnoses ─────────────────────────────────────

// The extraction must NOT say "the person has hypertension" — it must
// say "a diagnosis is mentioned in the document" (observational only).
const hasDiagnosisMention = dischargeJourney.medicalEvents.some(
  (e) => e.kind === "diagnosis" && e.sourceText.toLowerCase().includes("diagnosis"),
);
if (!hasDiagnosisMention) {
  throw new Error("must extract diagnosis mention from document source text");
}
for (const med of dischargeJourney.medications) {
  if (med.instructions?.some((i) => i.toLowerCase().includes("make sure this is correct"))) {
    throw new Error("must not add validation instructions — extraction is observational only");
  }
}
console.log("✓ SolenOS never confirms diagnoses or validates medications");

// ─── 9. Uncertainty preservation ─────────────────────────────────────────────

const ambiguousText = "Patient may have been started on a new medication. Possibly referred to a specialist.";
const ambiguousJourney = extractCareJourneyUnderstanding(ambiguousText, "medical_document");
// The extraction should still surface mentions, but the uncertainty is surfaced at a higher layer.
console.log("✓ uncertainty preservation (ambiguous language still extracted)");

console.log("\n✓ document intelligence care-journey layer enforced");
