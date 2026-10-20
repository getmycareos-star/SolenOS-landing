import type {

  DOCUMENT_EXTRACTION_FIELD_KEYS,

  DOCUMENT_SIGNAL_URGENCY_LEVELS,

  SOLENOS_DOCUMENT_TYPES,

} from "./contract-constants";

import type { MemoryCategory } from "../memory-influence/types";



export type SolenOSDocument = (typeof SOLENOS_DOCUMENT_TYPES)[number];



export type DocumentSignalUrgency = (typeof DOCUMENT_SIGNAL_URGENCY_LEVELS)[number];



export type DocumentExtractionFieldKey = (typeof DOCUMENT_EXTRACTION_FIELD_KEYS)[number];



export type ExtractedDocument = {

  sourceType: SolenOSDocument;

  rawText: string;

  extractedFields: Record<string, unknown>;

  entities: string[];

  timestamps: string[];

  obligations: string[];

  constraints: string[];

};



export type InferredDocument = {

  /** System-derived labels — NEVER merged into extractedFields. */

  inferredFields: Record<string, unknown>;

  inferredCategories: string[];

  ambiguityFlags: string[];

  /** Explicitly labeled suggestions — not extracted truth. */

  suggestedInterpretations: string[];

};



export type DocumentConfidence = {

  extraction: number;

  structure: number;

  inference: number;

  overall: number;

  uncertaintyFlagged: boolean;

};



export type DocumentSignals = {

  urgency: DocumentSignalUrgency;

  category: SolenOSDocument;

  actionRequired: boolean;

};



export type DocumentNode = {

  id: string;

  type: SolenOSDocument;

  extracted: ExtractedDocument;

  inference: InferredDocument;

  linkedMemoryIds: string[];

  linkedCareContextIds: string[];

  prioritySignals: string[];

  confidence: DocumentConfidence;

  /** Care-journey understanding — how this document changes the person's care journey. */

  careJourney: CareJourneyUnderstanding;

};



export type DocumentMemoryProposalStatus = "pending";



export type DocumentMemoryProposal = {

  id: string;

  documentNodeId: string;

  category: MemoryCategory;

  suggestedKey: string;

  suggestedInfluenceLabel: string;

  confidence: number;

  status: DocumentMemoryProposalStatus;

};



export type DocumentConflictCandidate = {

  id: string;

  documentNodeId: string;

  field: string;

  extractedValue: string;

  reason: string;

};



export type DocumentIntelligenceMemoryLink = {

  suggestedUpdates: readonly DocumentMemoryProposal[];

  pendingWrites: readonly DocumentMemoryProposal[];

  conflictCandidates: readonly DocumentConflictCandidate[];

};



export type DocumentIntelligenceSystemGuaranteeResult = {

  ok: boolean;

  violations: string[];

};



export type DocumentIntelligenceLayerResult = {

  nodes: readonly DocumentNode[];

  signals: readonly DocumentSignals[];

  memoryLinks: DocumentIntelligenceMemoryLink;

  guarantee: DocumentIntelligenceSystemGuaranteeResult;

  skipped: boolean;

};



export type DocumentIntelligenceLayerPayload = {

  nodeCount: number;

  documentTypes: readonly SolenOSDocument[];

  overallConfidence: number;

  uncertaintyFlagged: boolean;

  signals: readonly DocumentSignals[];

  pendingMemoryWriteCount: number;

};



export type DocumentReasoningOutput = {

  extractionSection: ExtractedDocument[];

  inferenceSection: InferredDocument[];

  confidenceScores: DocumentConfidence[];

  uncertaintyFlags: string[];

};



// ─── DOCUMENT INTELLIGENCE — CARE JOURNEY UNDERSTANDING ──────────────────────

// Documents are treated as care events, not just files. SolenOS answers:

// "How does this document change the person's care journey?" — never

// "Read this PDF and summarize it."



/** Medical events named/shown in a document (hospital care, diagnoses, procedures). */

export type MedicalEvent = {

  kind: "hospital_visit" | "diagnosis" | "procedure" | "discharge" | "provider_instruction";

  /** Raw verbatim text this insight came from — evidence traceability. */

  sourceText: string;

  /** When known — e.g. "March 15, 2026"; empty when the document does not state it. */

  date?: string;

};



/** Medication information in a document. */

export type MedicationInfo = {

  name: string;

  status: "new" | "continuing" | "discontinued" | "dosage_changed" | "unknown";

  dose?: string;

  frequency?: string;

  instructions?: string[];

refill?: string;

  concern?: string;

  /** High-priority medication safety signals — surfaced for care coordination. */

  duplicateDose?: boolean;

  missedDose?: boolean;

  refillProblem?: boolean;

  unclearInstructions?: boolean;

  /** Uncertainty about the current medication (name, dose, purpose, or list). */

  uncertainty?: boolean;

  /** Verbatim source sentences. */

  sourceText: string[];

};



/** Appointments and follow-ups in a document. */

export type AppointmentInfo = {

  kind:

    | "upcoming_visit"

    | "specialist_referral"

    | "recommended_follow_up"

    | "deadline"

    | "family_discussion"

    | "planned_care_decision";

  description: string;

  /** What is happening (structured). */

  what: string;

  /** Who is involved — doctor, specialist, family member, organization. */

  who?: string;

  /** When known — e.g. "within 4 weeks" / "March 20, 2026". */

  timeframe?: string;

  /** What preparation may be needed before the event. */

  preparation?: string;

  sourceText: string;

};



/** Care instructions in a document. */

export type CareInstruction = {

  kind:

    | "restriction"

    | "monitoring_requirement"

    | "warning_sign"

    | "recommended_action"

    | "provider_instruction";

  description: string;

  sourceText: string;

};



/** People / organizations named in a document. */

export type CarePerson = {

  name: string;

  role: "doctor" | "specialist" | "hospital" | "pharmacy" | "caregiver" | "other";

  sourceText: string;

};



/** Aggregate care-journey understanding extracted from a document. */

export type CareJourneyUnderstanding = {

  medicalEvents: MedicalEvent[];

  medications: MedicationInfo[];

  appointments: AppointmentInfo[];

  careInstructions: CareInstruction[];

  people: CarePerson[];

  /** "What changed in the care journey because of this document?" */

  whatChanged: string[];

  /** Conflicts / missing / uncertain — never resolved automatically. */

  uncertainties: string[];

/** Human-language answer to "what does this mean for managing care?". */

  caregiverTranslation: string[];

  /** Caregiver-impact prioritization — what needs action soon vs can wait. */

  prioritization: {

    /** Things that may require action soon. */

    immediateAttention: string[];

    /** Changes or patterns that may become significant. */

    importantToTrack: string[];

    /** Useful information that does not require immediate focus. */

    canWait: string[];

  };

  /** Timeline events this document should create/update. */

  timelineEvents: CareTimelineEvent[];

};



export type CareTimelineEvent = {

  date: string;

  event: string;

  source: string;

  whatChanged: string;

  whatMattersNext: string;

};



/** Change classification when comparing a new document to existing understanding. */

export type CareChangeKind = "new" | "changed" | "missing" | "unclear";



export type CareChange = {

  kind: CareChangeKind;

  category:

    | "medication"

    | "diagnosis"

    | "provider"

    | "appointment"

    | "care_instruction"

    | "medical_event"

    | "other";

  label: string;

  detail: string;

  /** Field in the prior understanding that changed, when known. */

  field?: string;

};


