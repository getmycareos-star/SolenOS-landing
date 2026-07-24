/**
 * Architecture map — documents migration of legacy modules into 3 layers.
 * SolenOS v1.4 ENGINEERING SPEC master contract (Situation-centric).
 * Used by verify-layered-architecture.mts and verify-solenos-v14.mts.
 *
 * Human living SoT (Documentation Governance):
 *   docs/17-canonical-architecture/
 *   docs/README.md
 * If code and docs conflict → documentation is source of truth (update both in-PR).
 */

/** Documentation Governance — machine pointer for agents and verify tooling. */
export const DOCUMENTATION_GOVERNANCE = {
  rule:
    "Feature complete only when: code works + tests/verify pass + docs updated + canonical architecture updated + PRDs updated if affected. If code and docs conflict, documentation is source of truth.",
  indexPath: "docs/README.md",
  canonicalArchitecturePath: "docs/17-canonical-architecture",
  adrsPath: "docs/15-architecture-decisions",
  prdsPath: "docs/02-product/prds",
  cursorRulePath: ".cursor/rules/documentation-governance.mdc",
} as const;

/** Root entity — if not a Situation or attached to one, not part of runtime logic. */
export const SITUATION_ROOT_ENTITY = {
  type: "Situation",
  fields: ["id", "title", "status", "priority"] as const,
  statuses: ["active", "resolved", "archived"] as const,
  priorities: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const,
  owns: [
    "documents (references only)",
    "timeline (WHAT)",
    "decisions (WHY — decision history)",
    "risks",
    "assumptions",
    "missing info",
    "recommendations",
    "emotional signals",
    "conflicts",
    "demands",
    "responsibilities",
  ],
  canonicalPath: "src/lib/solenos-layers/state",
  uiPath: "src/lib/ui-runtime/types.ts (Situation)",
  /**
   * Product spine mapping (ADR-012):
   * Case = long-lived care recipient; Situations are runtime episodes that attach to Case.
   * Case Memory lives in src/lib/case-memory — does not replace Situation as runtime root.
   */
  caseProductSpine: "src/lib/case-memory (Case owns Profile/Conditions/Timeline; Situations attach)",
} as const;

/**
 * Case-centered care memory — product identity layer.
 * Chat/voice is input only; Case is the durable product.
 */
export const CASE_MEMORY_PRODUCT = {
  identity:
    "Case-centered care memory infrastructure — structured decision snapshots grounded in selective case history",
  truth: "memory → intervention compression (Pattern Response Policy), NOT conversation recall",
  canonicalPath: "src/lib/case-memory",
  decisionSnapshotFields: [
    "what_is_happening",
    "what_matters_now",
    "what_to_ask_next",
    "risk_level",
    "what_can_wait",
    "follow_up_items",
  ] as const,
  patternResponseStates: ["A_new_event", "B_weak_similarity", "C_strong_intervention_mode"] as const,
  vsSituation:
    "Case = long-lived care recipient product; Situation = ADR-001 runtime STATE root attached to Case",
  antiPatterns: [
    "chatbot",
    "AI assistant",
    "reminder app",
    "task manager",
    "document storage",
    "health prediction engine",
    "conversation memory",
  ] as const,
  status: "implemented_in_memory" as const,
} as const;

/** v1.4 non-negotiable principles enforced by verify-solenos-v14.mts */
export const V14_PRINCIPLES = [
  "situation_centric",
  "uncertainty_first_class",
  "time_nonlinear",
  "emotional_state_required",
  "explanation_in_output",
  "safety_overrides_everything",
] as const;

/**
 * Governing Product North Star (non-negotiable scope gate).
 * Module: src/lib/product-north-star — evaluateFeatureAgainstNorthStar / classifyCaregiverDemand
 */
export const PRODUCT_MEMORY_NORTH_STAR = {
  statement:
    "A caregiver should never need to reconstruct the care journey from memory.",
  identity:
    "SolenOS is not an assistant. It is the memory system for caregiving reality.",
  test: "Does this reduce the caregiver's need to reconstruct the care journey from memory?",
  unclearDefault: "reject",
  modulePath: "src/lib/product-north-star",
  cursorRulePath: ".cursor/rules/solenos-product-north-star.mdc",
  migration: "db/migrations/070_product_north_star.sql",
  antiIdentity: [
    "chatbot",
    "answer engine",
    "dashboard without continuity",
    "medical encyclopedia",
    "AI doctor/therapist",
  ] as const,
  enforcement: [
    "evaluateFeatureAgainstNorthStar",
    "classifyCaregiverDemand",
    "applySearchDemandContinuityRedirect",
    "forbidden_build_zone",
  ] as const,
  mvpBuildOrder: [
    "care_event_store",
    "care_context_projection",
    "timeline_reconstruction",
    "state_of_care_generation",
    "diff_engine",
    "contradiction_detection",
    "trust_evidence_panel",
    "caregiver_feedback_learning_loop",
  ] as const,
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Product Constitution — worldview + CareRecord spine (state before UI).
 * Module: src/lib/product-constitution
 */
export const PRODUCT_CONSTITUTION = {
  worldview: "Care should never depend on someone's ability to remember everything.",
  mission: "To preserve the continuity of every person's care journey.",
  category: "Living Care Record",
  ultimateMetric:
    "Did the caregiver leave SolenOS more certain than when they entered?",
  primaryFeeling: "Relief",
  tagline: "The care journey, remembered.",
  motto: "Preserve continuity. Build trust. Reduce burden.",
  legacyOverVirality:
    "Will this still feel trustworthy in ten years?",
  careRecordSpine: [
    "person_profile",
    "events",
    "observations",
    "medications",
    "decisions",
    "outcomes",
    "tasks",
    "risks",
    "unknowns",
    "confidence_scores",
  ] as const,
  modulePath: "src/lib/product-constitution",
  cursorRulePath: ".cursor/rules/solenos-product-constitution.mdc",
  migration: "db/migrations/071_product_constitution.sql",
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Public Trust Layer — founder story / how-it-works / About SolenOS.
 * Discoverable, never interrupting care workflow. Content SoT: trust-content.
 */
export const PUBLIC_TRUST_LAYER = {
  purpose:
    "First-time caregivers land on /start so they understand what SolenOS solves before the Living Care Record; landing / uses Enter SolenOS → /start; returning caregivers continue at /workspace without interruption.",
  publicRoutes: [
    "/",
    "/start",
    "/workspace",
    "/welcome",
    "/why-solenos",
    "/our-story",
    "/about",
    "/mission",
    "/how-it-works",
    "/early-access",
    "/privacy",
    "/terms",
    "/contact",
    "/support",
    "/help",
    "/capabilities",
  ] as const,
  firstVisitLanding: "/start",
  enterCareRecord: "/workspace?enter=1",
  beginRestoresDurableReality:
    "Begin starts a new interaction session only — same durable care key restores ACS/CRS/CareContext (G11). Never mint a new care reality on Begin.",
  returnContinuity:
    "src/lib/return-continuity — G10 soft invite once after Done-for-now; G18 long-absence recent+unresolved; G57 history compression when ACS is long; verify:return-continuity",
  primaryNav: [
    "Home",
    "How It Works",
    "Why SolenOS",
    "About SolenOS",
    "Help",
    "Early Access",
  ] as const,
  footerLegal: [
    "How It Works",
    "About",
    "Terms of Service",
    "Privacy Policy",
    "Help",
    "Contact",
  ] as const,
  earlyAccessConsent:
    "EarlyAccessConsentForm — Terms + Privacy checkboxes; submit disabled until both checked; links open docs without a legal wall (verify:trust-consent)",
  researchPreview:
    "WelcomeTrustStack on /welcome + ResearchPreviewAckGate one-time ack; Free Early Access (not forever); Early Access badge; upload privacy notice; understanding feedback (src/lib/early-access-trust); MVP FAQ home excerpt + /support full + /capabilities (src/lib/mvp-faq; verify:mvp-faq)",
  inProduct: "sidebar → About SolenOS (Help, Privacy, Terms, About, Contact)",
  discovery: ["empty_state_link", "first_insight_footer"] as const,
  never: [
    "popup",
    "mandatory_gate_during_continuity",
    "inside_active_care_record_workflow",
    "force_read_entire_legal_doc_before_continue",
    "separate_legal_onboarding_wall",
    "free_forever_pricing_promise",
  ] as const,
  contentPath: "src/lib/trust-content",
  earlyAccessTrustPath: "src/lib/early-access-trust",
  legalDocsPath: "src/lib/trust-content/legal-documents.ts",
  shellPath: "src/components/public/PublicShell.tsx",
  entryGate: "src/lib/care-entry/first-visit.ts",
  sotPath: "docs/02-product/solenos-trust-consent-flow.md",
  status: "IMPLEMENTED" as const,
} as const;

/**
 * MVP Input Architecture — text + documents only (ADR-018).
 * Voice may join the same User Input → Understanding → Care Record path later.
 */
export const MVP_INPUT_ARCHITECTURE = {
  purpose:
    "Prove SolenOS can turn scattered caregiver information into understandable next steps.",
  mvpChannels: ["text", "document"] as const,
  futureChannels: ["voice"] as const,
  entryActions: ["scan", "snap", "upload", "share"] as const,
  entryContract:
    "docs/02-product/solenos-input-entry-contract.md — Scan=document scanner, Snap=live camera, Upload=file picker, Share=share target; same pipeline after evidence; docs/02-product/solenos-mvp-input-experience.md — no auth before value; anonymous care workspace; success = understand better (verify:mvp-input-experience; src/lib/mvp-input-experience); docs/02-product/solenos-learning-first-release.md — research preview: learning over polish; post-response understanding feedback (verify:learning-first-release; src/lib/research-feedback)",
  entryModulePath: "src/lib/input-entry-contract",
  shareTarget: "/share-target",
  flow: [
    "evidence_entry_scan_snap_upload_share_text",
    "evidence_understanding",
    "care_reality_update",
    "situation_relationship_engine",
    "response_contract",
  ] as const,
  forbiddenMvpSurfaces: [
    "voice_input_mic",
    "speech_recognition_ui",
    "voice_conversation_mode",
    "text_to_speech_hear_solenos",
  ] as const,
  principles: [
    "accept_messy_incomplete_unstructured_input",
    "no_perfect_structure_required_before_value",
    "pipeline_stays_generic_for_future_voice",
    "entry_method_never_changes_reasoning",
  ] as const,
  modulePath: "src/lib/mvp-input-architecture",
  adr: "docs/15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md",
  liveComposer: "src/components/mvp-workspace/AddSituationPanel.tsx",
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Living Care Record UX — caregiver-facing response (not chatbot / not AI reasoning dump).
 * Default: Care Event Added · Understood · Needs Context · Will Be Remembered.
 * Structural orientation: Response Contract (solenos-response-contract.md).
 */
export const LIVING_CARE_RECORD_UX = {
  purpose:
    "Every response should feel like updating a Living Care Record — AI stays almost invisible.",
  defaultSections: [
    "care_event_added",
    "what_understood",
    "what_needs_context",
    "what_will_be_remembered",
  ] as const,
  modulePath: "src/lib/living-care-record-ux",
  activeSituation: "src/lib/active-care-situation",
  ui: "src/components/mvp-workspace/LivingCareRecordPanel.tsx",
  appliesTo: ["text", "document"] as const,
  caregiverSurface: "LivingCareRecordPanel only — no engine panels in MVP workspace",
  caregiverMvpWorkspaceAllowlist: "src/lib/mvp-workspace/caregiver-surface.ts",
  enginePanelsQuarantine:
    "src/components/ops-devtools (+ ObservationPanel signals); /ops/devtools; never mount from CognitiveWorkspace",
  continuityRule: "Related observations update Active Care Situation — never restart the template",
  activeCareSituationPersistence:
    "Durable `.data/active-care-situation/` SoT; Map cache; ingest in processSituationInput; hydrate GET; Done-for-now pauses session (ACS+CRS persist)",
  careContextDurability:
    "Durable `.data/care-context/` SoT; Map cache only; survives process bounce; TrackedSituation hydrates from CareContext",
  careContextSpineLinking:
    "Classify relation server-side before append; soft same-day defaults to update; stamp situation_id + root_event_id; client entryIntent ignored; raw text never merged",
  uncertaintyBoundary:
    "Humanize at DARE→situation; ban signal tokens on response DTOs (caregiver-facing-uncertainty)",
  entryCopy:
    "Add to record / Preserving… / Reading document…; sanitizeCaregiverErrorMessage on errors",
  doneForNow:
    "Pause interaction session only; ACS + CRS + uncertainties persist; engine owns Active→Quiet→Resolved — never the Done button",
  careIdentity:
    "Durable care key (= caregiver_id = care_session_id); MVP upserts TrackedSituation; sidebar hydrates from /api/situation",
  caregiverChrome:
    "Care Reality visual language — care cards not chat bubbles; FAB Tell us what happened; docs/02-product/solenos-visual-language.md; verify:visual-language. Caregiver nav = Open situations + Care timeline + About; ops sections behind ?ops_key= / OPS_SECRET; plain-language situations from care_situation_groups/ACS",
  medicalBoundary:
    "Capture always; flag medical concern for output constraints — never refuse intake for worry/med-change",
  capturePolicy:
    "Always persist raw CareEvents; consent soft-prompts after capture; gate interpretation/sharing only",
  crisisFalsePositives:
    "Fall requires immediacy/severity for crisis; retrospective fall + care sought stays calm continuity",
  caregiverEntryPipeline:
    "POST /api/situation only; /api/analyze hard-gated (SOLENOS_ENABLE_ANALYZE / SOLENOS_VERIFY / ops key)",
  caregiverWorkspaceStates: "REAL_MOMENT → CARRYING (LCR only)",
  clarityDumpQuarantine:
    "CLARITY/CONTINUITY removed from caregiver SM; panels under src/components/ops-clarity; /ops/clarity",
  progressiveUnderstanding:
    "src/lib/progressive-understanding — after ACS; evolves understanding delta, patterns, matters, questions; not LLM",
  careRealityState:
    "src/lib/care-reality-state — SoT for current care belief; Response Evolution + progressive disclosure; supporting_evidence stored on CRS (UI reveals by maturity); caregiver responses project from CRS",
  caregiverResponseComposer:
    "src/lib/response-contract — Response Contract fields + never-say (docs/02-product/solenos-response-contract.md; verify:response-contract); src/lib/care-reality-output — Final Intelligence Refinement (baseline→change orientation; Observed/Interpretation/Concern; ban weak echo; docs/02-product/solenos-final-intelligence-refinement.md; verify:care-reality-output); src/lib/care-memory-maturity — first vs returning Care Reality (begin story vs compare to held memory; no fake continuity; docs/02-product/solenos-first-vs-returning-user.md; verify:care-memory-maturity); src/lib/output-quality — recognition + human language + connections + decision why + care story update (docs/02-product/solenos-output-quality.md; verify:output-quality); src/lib/response-acceptance-gate — transformation layer gate: reject summarization, empathy scripts, fake continuity, missing connections (docs/02-product/solenos-response-intelligence-upgrade.md; verify:response-intelligence-upgrade); src/lib/caregiver-understanding-output — communicate understanding not document summary (docs/02-product/solenos-communicate-understanding.md; verify:caregiver-understanding-output); src/lib/mvp-response-behavior — Care Reality Object + reasoning pipeline (examples = evaluation only; never keyword templates; docs/02-product/solenos-mvp-response-behavior.md + solenos-mvp-reasoning-examples.md; verify:mvp-response-behavior); src/lib/response-behavior — turn class + facet selection + evidence maturity ladder (L1→L10) from CRS observation_count/revision; composeEvidenceLine by consequence (never dump); src/lib/caregiver-response-composer — sole caregiver-facing copy (ADR-022); ≤3 situation-mapped asks; guidance = continuity symptom not advice engine; docs/02-product/caregiver-response-contract.md + solenos-evidence-visibility-directive.md; verify:caregiver-response-composer",
  careRecipientIdentity:
    "src/lib/care-recipient-identity — ask-once display_name (durable); CareRecipientNameGate after first capture (not pre-capture onboarding); composer uses subject_label; docs/02-product/solenos-mvp-identity-naming.md + solenos-first-time-caregiver.md; verify:care-recipient-identity",
  careEpistemics:
    "src/lib/care-epistemics — principle-based claim/signal/severity/views + G54/G55 language/continuity-worry (no illustration-keyword product); G44 durable restore; verify:golden-dementia-baseline",
  careHistoryCompression:
    "src/lib/care-history-compression — G57 graceful long-term: recent + important preserved, older noise reduced (never full dump); used by return-continuity",
  realCaregiverTest:
    "src/lib/real-caregiver-test — G61 2AM feature-approval; CI assert + optional compose-path gate (ADR-025 amended); verify:golden-dementia-baseline",
  sourceConflict:
    "src/lib/source-conflict — G12 doc vs note: keep both, flag conflict, clinical/document orients (Input Reality); durable source claims; verify:continuity-core-tier1",
  documentEvidence:
    "src/lib/document-evidence — original document source metadata + extract hash (evidence chain; binary blob later)",
  caregiverSituationDto:
    "src/lib/situation-entry/caregiver-response-dto — caregiver /api/situation strips engine layers (reasoning/confidence theater)",
  decisionMemory:
    "src/lib/decision-memory — what/when/who/context/evidence/alternatives/reason/outcome/status; G13 record questions + outcome linking; prep not advice; verify:continuity-core-tier1",
  mvpResearchValidation:
    "src/lib/mvp-research-validation — cognitive load / external memory; competing attention (not tasks); mental-load capture; retention hypothesis gate; Slice 5.6 weekly cohort metrics (ops only); verify:mvp-research-validation",
  responseIntelligence:
    "src/lib/response-intelligence — meaning over patterns; no keyword responses; golden soft orientation; AI product language bans; verify:response-intelligence",
  threadIngestion:
    "src/lib/thread-ingestion — G6 Locked B: long chats/emails → multiple linked ACS observations; raw newline detect (not sanitize-flatten); durable full source in thread-evidence; per-fragment kinds; LCR strips envelope; verify:continuity-core-tier1 + verify:live-thread-wire",
  perspectiveAttribution:
    "src/lib/perspective-attribution — G16 who-said perspective labels on shared Living Care Record (not chat feed); verify:continuity-core-tier1",
  dementiaEntryExtended:
    "src/lib/dementia-entry-extended — Tier 4 full set (G31–G33/G35–G36/G38–G39/G42/G49/G52–G53/G58–G60) + G7 hard-safety Clarity-faster; verify:dementia-entry-extended",
  situationRelationshipEngine:
    "src/lib/situation-relationship-engine — ordered signals (time/recipient/topic/uncertainty/pattern/decision); fall→mobility topic continuity; spine forceRelation single-flight; verify:situation-relationship-engine",
  productIdentityContracts:
    "src/lib/product-identity + src/lib/product-identity-architecture — SolenOS-only name; Living Care Record foundation; P1-9..P1-13 + P2-4 contracts; verify:product-identity",
  regressionCoverage:
    "verify:living-care-record-regression — persistence bounce, CareContext↔ACS link, continuity_home DTO sanitizer, crisis FP suite",
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Product truth path — caregiver-facing authority vs internal compile.
 * SoT: docs/17-canonical-architecture/product-truth-path.md
 */
export const PRODUCT_TRUTH_PATH = {
  purpose:
    "Caregiver product truth is the composer / Living Care Record path only — not final_output from runtime arbitration.",
  canonicalDoc: "docs/17-canonical-architecture/product-truth-path.md",
  caregiverPath: [
    "input_text_or_document",
    "dare_care_events",
    "situation_relationship_engine_spine",
    "active_care_situation_ingest",
    "care_epistemics",
    "progressive_understanding",
    "care_reality_state",
    "decision_memory",
    "compose_caregiver_response",
    "assert_response_acceptance_gate",
    "build_living_care_record_response",
    "living_care_record_panel",
  ] as const,
  internalCompilePath: [
    "runtime_arbitration",
    "enforce_compiled_dominant_output",
    "final_output",
    "post_hoc_care_reality_intelligence_snapshot",
  ] as const,
  productTruthModules: [
    "src/lib/caregiver-response-composer",
    "src/lib/response-contract/relief-decision",
    "src/lib/response-acceptance-gate",
    "src/lib/care-memory-maturity",
    "src/lib/living-care-record-ux/build-response",
  ] as const,
  notCaregiverProductTruth: ["final_output", "state_of_care_dominant_compile"] as const,
  disclosureMergeRule:
    "Relief tree (decideReliefDisclosure) wins Clarity/asks at buildLivingCareRecordResponse; CRS plan is secondary for evidence depth.",
  verifyScripts: [
    "verify:relief-reasoning",
    "verify:caregiver-response-composer",
    "verify:response-intelligence-upgrade",
    "verify:care-memory-maturity",
  ] as const,
  buildSequenceDoc: "docs/17-canonical-architecture/spine-build-sequence.md",
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Phase 4 scope lock — deferred surfaces until Phase 5 complete.
 * SoT: docs/17-canonical-architecture/scope-lock.md
 */
export const PHASE_SCOPE_LOCK = {
  status: "ACTIVE" as const,
  unlockAfter: "phase_5_complete" as const,
  canonicalDoc: "docs/17-canonical-architecture/scope-lock.md",
  modulePath: "src/lib/phase-scope-lock",
  verifyScripts: ["verify:scope-lock", "verify:golden-scenario-map", "verify:future-capabilities"] as const,
  deferList: [
    "situation_graph_ui",
    "pipeline_reorder",
    "future_capability_ui",
    "postgres_graph_tables",
    "runtime_north_star_block",
    "analyze_primary_caregiver_path",
  ] as const,
  gates: ["assertPhaseScopeLockNotMvp", "assertFutureCapabilityNotMvp"] as const,
} as const;

/**
 * Golden scenario map — G1–G19 + dementia + G61 → verify → composer.
 * SoT: docs/17-canonical-architecture/golden-scenario-map.md
 * CI: verify:golden-scenario-map (Phase 4 Slice 4.2)
 */
export const GOLDEN_SCENARIO_MAP = {
  canonicalDoc: "docs/17-canonical-architecture/golden-scenario-map.md",
  modulePath: "src/lib/golden-scenario-map",
  requiredCount: 50,
  metaVerifyScript: "verify:golden-scenario-map" as const,
  phase4BundleScript: "verify:phase4-scope-lock" as const,
  composerValues: ["yes", "partial", "no", "verify-only"] as const,
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Care Reality extraction — Observation / Event / Decision / Unknown / Relationship before Clarity.
 * SoT: docs/02-product/solenos-observation-extraction.md (+ event/decision/relationship/unknown)
 */
export const CARE_REALITY_EXTRACTION = {
  canonicalDocs: [
    "docs/02-product/solenos-observation-extraction.md",
    "docs/02-product/solenos-event-extraction.md",
    "docs/02-product/solenos-decision-extraction.md",
    "docs/02-product/solenos-relationship-extraction.md",
    "docs/02-product/solenos-unknown-extraction.md",
    "docs/02-product/solenos-outcome-extraction.md",
  ] as const,
  modulePath: "src/lib/care-reality-extraction",
  verifyScript: "verify:care-reality-extraction" as const,
  status: "IMPLEMENTED" as const,
  askKeys: {
    observation: "What was directly witnessed about the person receiving care?",
    event: "What happened, when, who was involved?",
    decision: "Was a choice made, by whom, with what evidence, and do we know why?",
    relationship:
      "What changed, what connects to it, and what evidence supports that connection?",
    unknown:
      "What important information is missing, uncertain, or requires confirmation?",
    outcome:
      "what changed after this event or decision, and what evidence shows that?",
  } as const,
  coreStack: [
    "observation",
    "event",
    "decision",
    "relationship",
    "response_contract",
  ] as const,
  knowledgeBoundary: "unknown" as const,
  never: [
    "keyword_only_links",
    "ui_relationship_enums",
    "causation_without_evidence",
    "uncertainty_converted_to_facts",
    "gaps_filled_for_completeness",
  ] as const,
} as const;

/**
 * Care Reality language — never notes/storage documentation framing.
 * SoT: docs/02-product/solenos-care-reality-language.md
 */
export const CARE_REALITY_LANGUAGE = {
  canonicalDocs: ["docs/02-product/solenos-care-reality-language.md"] as const,
  modulePath: "src/lib/response-acceptance-gate",
  verifyScript: "verify:care-reality-language" as const,
  status: "IMPLEMENTED" as const,
  pipeline: "Message → Care Reality → Meaning → Connection → Care Story Update → Understanding",
  neverPipeline: "Message → Note → Summary",
} as const;

/**
 * Intelligence Layer — never hardcode doc examples as keyword/symptom detectors.
 * SoT: docs/02-product/solenos-intelligence-no-hardcode.md
 */
export const INTELLIGENCE_NO_HARDCODE = {
  canonicalDocs: ["docs/02-product/solenos-intelligence-no-hardcode.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/no-hardcode-contract.ts",
  verifyScript: "verify:intelligence-no-hardcode" as const,
  status: "IMPLEMENTED" as const,
  ask: "What is happening with this person, what changed, what decisions happened, and what remains uncertain?",
  neverAsk: "What words appeared in the caregiver's message?",
} as const;

/**
 * Illustration vs Implementation Separation — doc examples never become product.
 * SoT: docs/02-product/solenos-illustration-vs-implementation.md
 */
export const ILLUSTRATION_VS_IMPLEMENTATION = {
  canonicalDocs: [
    "docs/02-product/solenos-illustration-vs-implementation.md",
  ] as const,
  modulePath:
    "src/lib/care-reality-intelligence/illustration-vs-implementation.ts",
  verifyScript: "verify:illustration-vs-implementation" as const,
  status: "IMPLEMENTED" as const,
  purpose:
    "Implement intelligence behind architecture examples — never the example as product data/UI/schema.",
  preCommitGate:
    "Am I implementing the intelligence behind this example, or the example itself?",
  universalObjects: [
    "care_recipient",
    "observation",
    "change_detection",
    "related_event",
    "decision",
    "outcome",
    "unknown",
  ] as const,
} as const;

/**
 * Care Reality Situation Model — build before caregiver language (baseline→change).
 * SoT: docs/02-product/solenos-care-reality-situation-model.md
 * Pipeline: ingestion → extraction → prioritization → situation modeling → response → UI
 */
export const CARE_REALITY_SITUATION_MODEL = {
  canonicalDocs: ["docs/02-product/solenos-care-reality-situation-model.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/situation-model.ts",
  verifyScript: "verify:care-reality-situation-model" as const,
  status: "IMPLEMENTED" as const,
  pipeline:
    "Ingestion → Extraction → Prioritization → Situation modeling → Response generation → UI",
  discipline: "Do not patch examples. Fix the reasoning architecture upstream of UI.",
} as const;

/**
 * Architecture Correction #1 — Care Recipient Anchor (center of gravity).
 * SoT: docs/02-product/solenos-care-recipient-anchor.md
 */
export const CARE_RECIPIENT_ANCHOR = {
  canonicalDocs: ["docs/02-product/solenos-care-recipient-anchor.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/care-recipient-anchor.ts",
  verifyScript: "verify:care-recipient-anchor" as const,
  status: "IMPLEMENTED" as const,
  processingOrder: [
    "care_recipient",
    "current_state_changes",
    "care_events",
    "care_decisions",
    "outcomes",
    "unknowns",
    "caregiver_context",
  ] as const,
  firstAsk: "Who is this situation about?",
} as const;

/**
 * Architecture Directive #2 — Baseline Comparison Engine (change-from-previous).
 * SoT: docs/02-product/solenos-baseline-comparison-engine.md
 */
export const BASELINE_COMPARISON_ENGINE = {
  canonicalDocs: ["docs/02-product/solenos-baseline-comparison-engine.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/baseline-comparison-engine.ts",
  verifyScript: "verify:baseline-comparison-engine" as const,
  status: "IMPLEMENTED" as const,
  chain: [
    "previous_reality",
    "new_observation",
    "difference_detected",
    "possible_meaning",
    "what_needs_attention",
  ] as const,
  coreQuestion: "What is different from before?",
} as const;

/**
 * Architecture 2B — Initial Care Reality Assessment (no comparable prior).
 * SoT: docs/02-product/solenos-initial-care-reality-assessment.md
 */
export const INITIAL_CARE_REALITY_ASSESSMENT = {
  canonicalDocs: ["docs/02-product/solenos-initial-care-reality-assessment.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/initial-care-reality-assessment.ts",
  verifyScript: "verify:initial-care-reality-assessment" as const,
  status: "IMPLEMENTED" as const,
  modes: ["initial_assessment", "change_detection"] as const,
  rule: "No comparable prior → first understanding; never hallucinate change history",
} as const;

/**
 * Situation Generator — Active Situation understanding from fragmented captures.
 * SoT: docs/02-product/solenos-situation-generator.md
 */
export const SITUATION_GENERATOR = {
  canonicalDocs: ["docs/02-product/solenos-situation-generator.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/situation-generator.ts",
  verifyScript: "verify:situation-generator" as const,
  status: "IMPLEMENTED" as const,
  coreQuestion: "What situation is this caregiver living through?",
  pipeline:
    "Extraction → Situation generation → Relationship mapping → Uncertainty → Human response",
} as const;

/**
 * Care Reality Memory — store journey objects, not text/conversation.
 * SoT: docs/02-product/solenos-care-reality-memory.md
 */
export const CARE_REALITY_MEMORY = {
  canonicalDocs: ["docs/02-product/solenos-care-reality-memory.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/care-reality-memory.ts",
  verifyScript: "verify:care-reality-memory" as const,
  status: "IMPLEMENTED" as const,
  stores: [
    "event",
    "observation",
    "decision",
    "outcome",
    "unknown",
    "change",
    "relationship",
    "contributor_context",
  ] as const,
  neverStore: [
    "full_sentences_as_memory",
    "phrase_frequency",
    "family_opinions_as_facts",
    "chat_history_as_primary",
  ] as const,
  coreFeel: "SolenOS understands what has been happening — not what I wrote.",
} as const;

/**
 * Hard Rejection & Intelligence Validation — reject summary theater; require understanding.
 * SoT: docs/02-product/solenos-intelligence-validation.md
 */
export const INTELLIGENCE_VALIDATION = {
  canonicalDocs: ["docs/02-product/solenos-intelligence-validation.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/intelligence-validation.ts",
  verifyScript: "verify:intelligence-validation" as const,
  status: "IMPLEMENTED" as const,
  gateQuestion:
    "Does this response help the caregiver understand the changing care reality better?",
  hardFailures: [
    "sentence_summary",
    "task_generator",
    "generic_safety",
    "family_distraction",
    "excessive_questioning",
  ] as const,
} as const;

/**
 * 30-Second Caregiver Understanding Test — midnight gate.
 * SoT: docs/02-product/solenos-caregiver-understanding-test.md
 */
export const CAREGIVER_UNDERSTANDING_TEST = {
  canonicalDocs: ["docs/02-product/solenos-caregiver-understanding-test.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/caregiver-understanding-test.ts",
  verifyScript: "verify:caregiver-understanding-test" as const,
  status: "IMPLEMENTED" as const,
  midnightQuestion:
    "If this caregiver reads this at midnight during a stressful moment, will they understand their situation better than before?",
  dimensions: [
    "understanding",
    "orientation",
    "uncertainty_reduction",
    "priority",
  ] as const,
} as const;

/**
 * Internal Clinical Situation Classification — reasoning only; never caregiver labels/diagnoses.
 * SoT: docs/02-product/solenos-clinical-situation-classification.md
 */
export const CLINICAL_SITUATION_CLASSIFICATION = {
  canonicalDocs: [
    "docs/02-product/solenos-clinical-situation-classification.md",
  ] as const,
  modulePath:
    "src/lib/care-reality-intelligence/clinical-situation-classification.ts",
  verifyScript: "verify:clinical-situation-classification" as const,
  status: "IMPLEMENTED" as const,
  purpose:
    "Internally classify what kind of care reality is changing — never medical labels or diagnoses in caregiver UI.",
  neverShow: [
    "clinical_category_detected",
    "risk_score_percent",
    "patient_declining",
    "category_enums",
  ] as const,
  priorityOrder: [
    "safety_concern",
    "functional_decline",
    "cognitive_behavioral",
    "medication_transition",
    "nutrition_sleep",
    "administrative_burden",
    "family_coordination",
    "caregiver_strain",
  ] as const,
} as const;

/**
 * Uncertainty Preservation Engine — what happened vs why; never correlation→cause.
 * SoT: docs/02-product/solenos-uncertainty-preservation.md
 */
export const UNCERTAINTY_PRESERVATION = {
  canonicalDocs: ["docs/02-product/solenos-uncertainty-preservation.md"] as const,
  modulePath: "src/lib/care-reality-intelligence/uncertainty-preservation.ts",
  verifyScript: "verify:uncertainty-preservation" as const,
  status: "IMPLEMENTED" as const,
  purpose:
    "Preserve uncertainty: hold what happened and what may be connected — never invent why.",
  never: [
    "observation_to_diagnosis",
    "correlation_to_cause",
    "conclusions_as_facts",
  ] as const,
  caregiverSees: [
    "what_we_know",
    "what_may_be_connected",
    "what_remains_unclear",
  ] as const,
} as const;

/**
 * Phase 5 — Compounding learning loop (~93–95).
 * SoT: docs/17-canonical-architecture/phase-5-compounding-loop.md
 * Slice 2.4 memory correction ingest is wired (`verify:memory-correction`).
 */
export const PHASE_5_COMPOUNDING_LOOP = {
  canonicalDoc: "docs/17-canonical-architecture/phase-5-compounding-loop.md",
  status: "IN_PROGRESS" as const,
  blockedBy: null,
  memoryCorrectionScript: "verify:memory-correction" as const,
  entryGateScript: "verify:phase5-entry-gate" as const,
  crsComposerSotScript: "verify:crs-composer-sot" as const,
  crsComposeModule: "src/lib/caregiver-response-composer/crs-compose-sot.ts",
  uncertaintyLifecycleModule: "src/lib/progressive-understanding/uncertainty-lifecycle.ts",
  openUncertaintiesReturnScript: "verify:open-uncertainties-return" as const,
  feedbackContainmentModule: "src/lib/telemetry-persistence/feedback-containment.ts",
  feedbackContainmentScript: "verify:feedback-containment" as const,
  epistemicsDepthScript: "verify:golden-dementia-baseline" as const,
  epistemicsThreadModule: "src/lib/care-epistemics/index.ts",
  g61ComposeGateModule: "src/lib/real-caregiver-test/index.ts",
  retentionInstrumentationModule: "src/lib/mvp-research-validation/retention-instrumentation.ts",
  retentionInstrumentationScript: "verify:mvp-research-validation" as const,
  targetMaturity: "93-95" as const,
  slices: ["5.1_crs_composer_sot", "5.2_uncertainty_lifecycle", "5.3_feedback_behavior", "5.4_epistemics_depth", "5.5_g61_runtime_gate", "5.6_retention_instrumentation"] as const,
  sliceStatus: {
    "5.1_crs_composer_sot": "IMPLEMENTED",
    "5.2_uncertainty_lifecycle": "IMPLEMENTED",
    "5.3_feedback_behavior": "IMPLEMENTED",
    "5.4_epistemics_depth": "IMPLEMENTED",
    "5.5_g61_runtime_gate": "IMPLEMENTED",
    "5.6_retention_instrumentation": "IMPLEMENTED",
  } as const,
  successQuestion: "Does turn N+1 clearly use memory from turn N — not restart?",
} as const;

/**
 * Progressive Understanding Engine — evolves ACS understanding (not note echo).
 * Chain: Input → Capture → CareContext → ACS → Progressive Understanding → Care Reality State → LCR → Timeline.
 */
export const PROGRESSIVE_UNDERSTANDING_ENGINE = {
  purpose:
    "Every new observation updates evolving understanding — what changed since last update, not a restarted response.",
  modulePath: "src/lib/progressive-understanding",
  position: "after_active_care_situation_before_care_reality_state",
  not: ["ui_feature", "prompt", "llm_call", "per_message_template_restart"],
  answers: "What changed in our understanding since the last update?",
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Care Reality State — continuously updated understanding of the person's care reality.
 * Not a note, event, or timeline. Single source of truth for caregiver-facing responses.
 * Chain position: after Progressive Understanding, before Living Care Record.
 */
export const CARE_REALITY_STATE = {
  purpose:
    "What solenos currently believes about this person's care reality from available evidence — responses evolve from this state, never the latest message alone.",
  modulePath: "src/lib/care-reality-state",
  position: "after_progressive_understanding_before_living_care_record",
  durableStore: ".data/care-reality-state/",
  responseEvolution: "P0-9 evaluate before copy — updates ACS / answers uncertainty / pattern / matters / invalidates",
  progressiveDisclosure: "P0-10 early | growing | established — Living Care Record stores all; UI reveals by stage",
  cognitiveLoadBudget: "P2-4 one primary screen question per disclosure stage",
  not: ["another_note", "another_event", "another_timeline", "response_from_latest_message_alone"],
  productIdentityContracts: "src/lib/product-identity-architecture",
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Care Reality Intelligence — category composition facade over existing engines.
 * Not a new pillar. Events→Changes→Decisions→Outcomes→Context→Confidence.
 */
export const CARE_REALITY_INTELLIGENCE = {
  category: "Care Reality Intelligence",
  notANewPillar: true,
  modulePath: "src/lib/care-reality-intelligence",
  foundationPath: "src/lib/care-reality-engine",
  foundationSot: "docs/02-product/solenos-care-reality-engine-foundation.md",
  principlesSot: "docs/02-product/solenos-care-reality-engine-principles.md",
  principlesModule: "src/lib/care-reality-engine-principles",
  principlesVerify: "verify:care-reality-engine-principles",
  foundationVerify: "verify:care-reality-engine",
  moatTest:
    "Messy document + text + observation → coherent Care Reality (not PDF summary)",
  migration: "db/migrations/074_care_reality_intelligence.sql",
  composes: [
    "baseline_intelligence_engine",
    "care_reality_profile_engine",
    "care_state_engine",
    "continuity_properties",
    "moment_of_need_engine",
    "evidence_preservation",
    "care_reality_engine_foundation",
  ] as const,
  intelligenceChain: [
    "events",
    "changes",
    "decisions",
    "outcomes",
    "context",
    "confidence",
  ] as const,
  coreCapabilities: [
    "living_care_record",
    "care_state_understanding",
    "moment_of_need_guidance",
    "person_specific_understanding",
    "decision_memory",
    "human_context",
  ] as const,
  careTransitionMode: "FUTURE",
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Future capabilities — Phase 2/3 extensions of Care Reality Engine (NOT MVP).
 * Module: src/lib/future-capabilities
 */
export const FUTURE_CAPABILITIES = {
  notANewPillar: true,
  modulePath: "src/lib/future-capabilities",
  readinessGate:
    "Trusted care reality understanding must exist before communication or clarity UX ships.",
  phase2: [
    "care_moment",
    "i_need_clarity",
    "care_understanding_confidence",
    "confidence_collapse_support",
  ] as const,
  phase3: ["care_communication_support", "help_me_communicate_this"] as const,
  chaosFirstIngestion: {
    status: "IMPLEMENTED",
    modulePath: "src/lib/adoption-wedge-engine",
  },
  humanContextLayers: "src/lib/future-capabilities/human-context",
  status: "FUTURE" as const,
} as const;

/**
 * Ops Console — internal analytics / system health (NOT user-facing product).
 */
export const OPS_CONSOLE = {
  notANewPillar: true,
  routes: ["/ops", "/metrics"] as const,
  ingest: "POST /api/track",
  table: "solen_events",
  migration: "db/migrations/075_solen_ops_events.sql",
  modulePath: "src/lib/ops-console",
  clientEmitter: "src/lib/trackEvent.ts",
  noExternalAnalytics: true,
  status: "IMPLEMENTED" as const,
} as const;

/**
 * Continuity properties — vertical refinements of ONE CareEvent→CareContext runtime.
 * Not separate products: SRL, Explicit Unknowns, OML, FDLL, failure→engine map.
 */
export const CONTINUITY_PROPERTIES = {
  principle: "Build deeper CareContext, not wider feature lists.",
  modulePath: "src/lib/continuity-properties",
  properties: [
    "source_reliability",
    "explicit_unknowns",
    "outcome_measurement",
    "inference_feedback_learning",
    "failure_to_engine_map",
  ] as const,
  distinguishes: {
    reliability: "input truth quality",
    confidence: "system certainty given inputs",
  },
  omlModule: "src/lib/oml",
  migration: "db/migrations/072_continuity_properties.sql",
  status: "IMPLEMENTED" as const,
  notANewPillar: true,
} as const;

/**
 * Unknowns Engine — disease-agnostic; dementia is first clinical profile.
 * Clinical profile SoT: src/lib/clinical-profile (DEFAULT_CLINICAL_PROFILE_ID).
 * Presentation Engine — projection only over one CareContext.
 * Evidence + Privacy/Institutional — contracts, not forked products.
 */
export const UNKNOWNS_AND_PROJECTION_LAYERS = {
  clinicalProfile: "src/lib/clinical-profile",
  clinicalProfileCaregiverInfluence: "src/lib/clinical-profile/caregiver-influence",
  clinicalProfileDocs: "docs/architecture/CLINICAL_PROFILE.md",
  unknownsEngine: "src/lib/unknowns-engine",
  dementiaProfile: "src/lib/unknowns-engine/profiles/dementia.ts",
  careContextsDementia: "src/lib/care-contexts/dementia",
  presentationEngine: "src/lib/presentation-engine",
  evidencePreservation: "src/lib/evidence-preservation",
  privacyInstitutionalContracts: "src/lib/privacy-institutional-contracts",
  rules: [
    "dementia_is_first_profile_not_architecture",
    "dementia_is_entry_market_not_product_identity",
    "default_clinical_profile_id_is_dementia",
    "future_profiles_via_registry_not_spine_fork",
    "caregiver_ui_never_leads_with_generic_dementia_education",
    "profile_unknowns_influence_composer_via_gather_asks_never_diagnosis",
    "presentation_never_mutates_care_context",
    "every_conclusion_needs_evidence_object",
    "institutions_are_projection_layers_only",
    "roles_are_metadata_not_structure",
  ] as const,
  migration: "db/migrations/073_unknowns_evidence_privacy.sql",
  status: "IMPLEMENTED" as const,
  notANewPillar: true,
} as const;

/** Dementia Entry Market — Caregiver Load Engine framing (subordinate to PRODUCT_MEMORY_NORTH_STAR). */
export const V14_PRODUCT_NORTH_STAR =
  "SolenOS IS a caregiver load detection and attention prioritization system — NOT medical advice, dementia diagnosis, or care-plan generation.";


/** Behavioral Specification v1 — core product identity. */
export const BEHAVIORAL_SPEC_V1_IDENTITY =
  "SolenOS models caregiver overload from progressive dependency conditions — dementia is entry path, not the product.";

/** What SolenOS must NEVER become (MVP anti-patterns). */
export const V14_ANTI_PATTERNS = [
  "medical diagnosis or symptom checker as primary output",
  "disease encyclopedia or neuroscience education",
  "care plan generator as MVP deliverable",
  "clinical decision support as MVP deliverable",
  "leading with dementia tips when caregiver load is detected",
  "modeling dementia medically instead of caregiver overload",
  "ChatGPT-style ten tips or care plans when load signals present",
  "diagnosing dementia or Alzheimer's from caregiver observations",
  "predicting disease timeline from observation frequency trends",
] as const;

/** Observation Intelligence — text capture is MVP-compatible; voice tabs are FUTURE (ADR-018). */
export const OBSERVATION_INTELLIGENCE_MVP = {
  identity:
    "Caregiver Observation Intelligence System — understands what caregivers observe, not medical truth",
  philosophy: "Capture → Structure → Summarize → Reveal Patterns",
  successKpi: "observations_per_caregiver_per_week",
  canonicalPath: "src/lib/observation-intelligence",
  apiRoutes: [
    "POST /api/observations",
    "GET /api/observations/weekly-summary",
    "GET /api/observations/export",
  ],
  futureApiRoutes: [
    "POST /api/observations/voice",
    "POST /api/tts/synthesize",
  ] as const,
  ontologyCategories: ["memory", "orientation", "communication", "mood", "behavior", "daily_function"],
  antiPatterns: [
    "dementia diagnosis from observations",
    "Alzheimer's classifier",
    "treatment recommendations",
    "disease progression predictor",
    "clinical decision support from observation trends",
    "conversational AI companion for observation intake",
  ],
  feedsLoadEngine: true,
} as const;

/**
 * Voice Observation Capture — FUTURE (ADR-018).
 * Libraries remain; do not mount mic / Hear SolenOS in MVP UI.
 */
export const VOICE_OBSERVATION_MVP = {
  identity: "SolenOS Voice Observation Capture — record observations, not chat",
  purpose: "Future: test whether caregivers will consistently record observations by voice",
  status: "FUTURE" as const,
  successKpi: "observations_per_caregiver_per_week",
  stt: "browser Web Speech preferred; server STT FUTURE in src/lib/voice/speech-to-text/future",
  ttsEngines: ["browser-speech-synthesis"] as const,
  ttsFuture: ["polly", "google"] as const,
  ttsForbidden: ["elevenlabs", "piper", "mystery"],
  languages: ["en", "es", "zh", "tl", "vi", "ko", "fa", "ar", "ru", "hy"] as const,
  pollyLanguages: ["en", "es", "zh", "ko", "ru", "ar"] as const,
  googleLanguages: ["tl", "vi", "fa", "hy"] as const,
  paths: {
    voice: "src/lib/voice",
    voiceObservation: "src/lib/voice-observation",
    tts: "src/lib/tts",
    observationIntelligence: "src/lib/observation-intelligence",
  },
  voiceSurfaces: [
    "voice_mode_3am",
    "weekly_care_briefing",
    "crisis_guidance",
    "benefit_tracker_guidance",
  ] as const,
  migration: "db/migrations/013_voice_observation_tts.sql",
  languagePreferenceMigration: "db/migrations/010_multilingual_execution.sql",
  adr: "docs/15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md",
} as const;

/**
 * Voice Conversation Mode — FUTURE modular contract (ADR-017), not MVP UI (ADR-018).
 * Keep unmounted; same User Input → Understanding → Care Record path when enabled.
 */
export const VOICE_CONVERSATION_MVP = {
  identity: "SolenOS Voice Conversation — caregiver speaks, SolenOS responds aloud",
  purpose: "Future: validate voice reduces cognitive load during stress",
  status: "FUTURE" as const,
  speechInput: "browser-web-speech",
  speechOutput: "browser-speech-synthesis",
  reasoning: "Gemini via POST /api/analyze only — no server STT",
  moduleRoot: "src/lib/voice",
  ui: "src/components/ops-devtools/VoiceConversationPanel.tsx",
  states: ["idle", "listening", "processing", "responding"] as const,
  adr: "docs/15-architecture-decisions/ADR-017-voice-conversation-browser-io-mvp.md",
  supersededForMvpBy: "docs/15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md",
} as const;

/**
 * v1.4 engine module audit matrix — spec item → implementation path → status.
 * status: implemented | partial | stub
 */
export const V14_ENGINE_MODULES = [
  {
    spec: "Context Engine",
    path: "src/lib/input-classification + input-stress-normalizer + care-context/situational",
    layer: "pre-STATE input",
    status: "implemented",
  },
  {
    spec: "Memory Layer",
    path: "src/lib/memory-influence (influence only) + solenos-layers/belief sync",
    layer: "BELIEF influence + MEMORY facade",
    status: "implemented",
  },
  {
    spec: "Assumption + Missing Info",
    path: "src/lib/solenos-layers/belief (unified BeliefItem)",
    layer: "BELIEF",
    status: "implemented",
  },
  {
    spec: "Priority Engine + Priority Contract",
    path: "src/lib/solenos-layers/derived/priority-contract + priority-engine facade",
    layer: "DERIVED",
    status: "implemented",
  },
  {
    spec: "Deterministic Prioritization Engine (issue → 6-field Decision Snapshot)",
    path: "src/lib/deterministic-prioritization",
    layer: "DERIVED compression — after Priority facade, before final SolenOS assembly",
    status: "implemented",
  },
  {
    spec: "Time Engine + nonlinear curves",
    path: "src/lib/time-engine + time-weighting/curves",
    layer: "DERIVED input signals",
    status: "implemented",
  },
  {
    spec: "Conflict Detection",
    path: "src/lib/conflict-detection",
    layer: "BELIEF confidence modulation + operational registry",
    status: "implemented",
  },
  {
    spec: "Decision Engine",
    path: "src/lib/analyze-pipeline (LLM + PriorityContract assembly)",
    layer: "ACTION_SELECTION",
    status: "implemented",
  },
  {
    spec: "Safety Override",
    path: "src/lib/safety-enforcement + safety-override (SAFETY ALWAYS WINS)",
    layer: "post-trust gate",
    status: "implemented",
  },
  {
    spec: "Explanation / Human Trust",
    path: "src/lib/human-trust-layer + solenos-layers/explanation",
    layer: "EXPLANATION",
    status: "implemented",
  },
  {
    spec: "Timeline",
    path: "src/lib/ui-runtime/timeline-store + solenos-layers/explanation/timeline",
    layer: "EXPLANATION (WHAT ≠ WHY)",
    status: "implemented",
  },
  {
    spec: "Emotional Load",
    path: "src/lib/emotional-load-signal + solenos-layers/derived/compute-emotional-load",
    layer: "DERIVED (influences Priority)",
    status: "implemented",
  },
  {
    spec: "Caregiver Psychological Load",
    path: "src/lib/caregiver-psychological-load (moral injury, identity drift, validation, high-signal stress → containment)",
    layer: "DERIVED + EXPLANATION adjunct",
    status: "implemented",
  },
  {
    spec: "High-Signal Stress Pattern",
    path: "src/lib/caregiver-psychological-load/detect-high-signal-stress (acute burnout → Containment Mode)",
    layer: "DERIVED early detection + output enforcement",
    status: "implemented",
  },
  {
    spec: "Caregiver Load Engine (master product module)",
    path: "src/lib/caregiver-load-engine (5 load dimensions + unified burnout + burden messages + action reduction)",
    layer: "DERIVED pre-CLI/ELS — master burden facade",
    status: "implemented",
  },
  {
    spec: "Attention Engine (Behavioral Spec v1)",
    path: "src/lib/attention-engine (Class A/B/C → Now/Watch/Later + behavioral response shaping)",
    layer: "DERIVED pre-Priority — attention prioritization",
    status: "implemented",
  },
  {
    spec: "Load-First Interpretation",
    path: "src/lib/load-interpretation + caregiver-load-engine facade",
    layer: "DERIVED pre-CLI/ELS",
    status: "implemented",
  },
  {
    spec: "Interaction Load Signal",
    path: "src/lib/interaction-load-signal (repetition loops, boundary stress, sleep protection)",
    layer: "DERIVED (influences CLI + ELS + output strategy)",
    status: "implemented",
  },
  {
    spec: "Caregiver Load Index",
    path: "src/lib/caregiver-load-index + derived/compute-caregiver-load",
    layer: "DERIVED",
    status: "implemented",
  },
  {
    spec: "Responsibility Graph",
    path: "src/lib/responsibility-graph",
    layer: "STATE ownership",
    status: "implemented",
  },
  {
    spec: "Decision Surface",
    path: "src/lib/ui-runtime/decision-mapper (ONE DecisionCard)",
    layer: "UI runtime",
    status: "implemented",
  },
  {
    spec: "MVP Cognitive Workspace (4-state B&W)",
    path: "src/components/mvp-workspace + src/lib/mvp-workspace (ADR-016)",
    layer: "UI primary landing",
    status: "implemented",
  },
  {
    spec: "Document extract helper (Tika/Tesseract)",
    path: "src/app/api/extract + src/lib/tika-extractor",
    layer: "Pre-cognition extraction",
    status: "implemented",
  },
  {
    spec: "Fail-Safe Mode",
    path: "src/lib/fail-safe-mode + solenos-layers/derived/fail-safe",
    layer: "DERIVED gate (post-decision)",
    status: "implemented",
  },
  {
    spec: "Caregiver Confidence Score",
    path: "src/lib/confidence-layer + solenos-layers/derived/compute-confidence",
    layer: "DERIVED (post-decision reassurance)",
    status: "implemented",
  },
  {
    spec: "Crisis Prevention",
    path: "src/lib/crisis-prevention-layer + solenos-layers/derived/compute-crisis-risks",
    layer: "DERIVED (predictive failure)",
    status: "implemented",
  },
  {
    spec: "Delegation Layer",
    path: "src/lib/delegation-layer + solenos-layers/derived/compute-delegation",
    layer: "DERIVED (load-aware suggest-only)",
    status: "implemented",
  },
  {
    spec: "Demand Engine",
    path: "src/lib/demand-engine",
    layer: "STATE demands",
    status: "implemented",
  },
  {
    spec: "Resolution",
    path: "src/lib/resolution-engine + solenos-layers/state",
    layer: "STATE lifecycle",
    status: "implemented",
  },
  {
    spec: "Human Override",
    path: "src/lib/human-override + src/app/api/human-override",
    layer: "EXPLANATION audit stub",
    status: "stub",
  },
  {
    spec: "Reality Drift Detection",
    path: "src/lib/reality-drift",
    layer: "EXPLANATION audit stub",
    status: "stub",
  },
  {
    spec: "Observation Intelligence MVP",
    path: "src/lib/observation-intelligence (text); voice STT FUTURE",
    layer: "PARALLEL to analyze-pipeline — caregiver observation language",
    status: "implemented",
  },
  {
    spec: "Voice Observation Capture + TTS",
    path: "src/lib/voice + src/lib/tts (FUTURE — ADR-018; not mounted in MVP)",
    layer: "I/O — STT capture + TTS readback — post-MVP",
    status: "stub",
  },
  {
    spec: "MVP Input Architecture (text + documents)",
    path: "src/lib/mvp-input-architecture + AddSituationPanel + /api/extract + /api/situation",
    layer: "User Input → Understanding → Care Record (ADR-018)",
    status: "implemented",
  },
  {
    spec: "Family Intelligence (Strategic Architecture)",
    path: "src/lib/family-intelligence (Family Memory + Care Graph + Decision History + Delegation Network + Crisis Prediction facades)",
    layer: "STRATEGIC continuity facade over STATE/BELIEF/EXPLANATION/DERIVED",
    status: "implemented",
  },
  {
    spec: "Case Memory + Pattern Response Policy",
    path: "src/lib/case-memory (Case product spine + selective recall + PRP State A/B/C + 6-field Decision Snapshot)",
    layer: "PRODUCT continuity — Case owns facts/events/interventions; Situations attach (ADR-001 runtime preserved)",
    status: "implemented",
  },
] as const;

/** v1.4 spec pipeline order (conceptual contract). */
export const V14_PIPELINE_SPEC_ORDER = [
  "Input",
  "Context",
  "Memory",
  "Assumption/Missing Info",
  "Priority",
  "Time",
  "Conflict",
  "Decision",
  "Safety",
  "Explanation",
  "Output",
] as const;

/**
 * Actual analyze-pipeline order (reconciled with implementation).
 * Intentional deviations from spec order are documented in V14_PIPELINE_NOTES.
 */
export const V14_PIPELINE_ACTUAL_ORDER = [
  "Input (stress-normalizer)",
  "Case Memory (identify Case → extract facts → update Case/Timeline → selective recall → Pattern Response Policy)",
  "Context (input-classification + care-context + care-profile)",
  "Load Interpretation + High-Signal Stress + Interaction Load + Caregiver Load Engine (early burden / repetition / sleep / dependency)",
  "Attention Engine (Class A/B/C → Now/Watch/Later — after load scoring, before Priority)",
  "Memory (memory-influence)",
  "STATE UPDATE (resolution-engine → situations)",
  "BELIEF UPDATE (assumption-registry + missing-information-queue → BeliefItem)",
  "Time Engine (weight signals — before priority facade)",
  "Demand Engine (STATE demands)",
  "Responsibility Graph (STATE ownership)",
  "Caregiver Load Index (DERIVED surface limit)",
  "Emotional Load Signal (DERIVED — influences Priority topN)",
  "Conflict Detection (early pass → PriorityContract)",
  "DERIVED Priority (computePriority / PriorityContract)",
  "Priority Engine facade (emotional load + time + beliefs)",
  "Deterministic Prioritization (issue extract → HIGH_IMPACT → score → compress → Decision Snapshot)",
  "Conflict Detection (full pass with priority conflicts)",
  "LLM Decision (structured response generation)",
  "Document Intelligence refresh → BELIEF re-sync",
  "Decision Engine assembly (chosen action)",
  "Emotional Load post-decision (protection mode constraints)",
  "Fail-Safe Mode (derived gate — pause under uncertainty)",
  "Crisis Prevention (predictive failure — medical/caregiver/family/financial)",
  "Caregiver Confidence Score (plain-English reassurance)",
  "Delegation Layer (suggest-only when load HIGH/CRITICAL)",
  "Family Intelligence compound (strategic 5-asset snapshot — non-blocking)",
  "Human Trust (RecommendationExplanation — EXPLANATION)",
  "Safety Enforcement (SAFETY ALWAYS WINS)",
  "Case Memory PRP shapes SolenOS fields from Decision Snapshot (before Trust Assembly)",
  "Trust/disclaimer Output Assembly",
  "EXPLANATION write (decision history WHY)",
] as const;

/** Intentional order notes — v1.4 spec vs runtime. */
export const V14_PIPELINE_NOTES = [
  "Emotional Load influences Priority via adjustedTopN — spec lists Emotional Load before Priority; runtime runs CLI then ELS then Attention Engine then Priority facade (equivalent influence).",
  "Time Engine runs before BELIEF sync in analyze-pipeline for missing-info hints; PriorityContract consumes nonlinear time-weighting curves at DERIVED stage.",
  "Fail-Safe runs AFTER Decision assembly and BEFORE Crisis/Confidence/Delegation/Human Trust — later v1.4 specs list Fail-Safe before Trust before Safety; implemented order is Decision → ELS post → Fail-Safe → Crisis → Confidence → Delegation → Human Trust → Safety.",
  "Safety Enforcement is terminal over Fail-Safe and Human Trust — SAFETY ALWAYS WINS.",
  "Conflict Detection runs twice: early (belief penalty for PriorityContract) and late (priority conflicts + CRITICAL medical gate).",
  "Case Memory runs early after urgency (Identify→Extract→Update→Selective Recall→PRP); Decision Snapshot (6 fields) lives on case_memory_layer; PRP shapes SolenOS 5-field display before Trust Assembly. Case ≠ Situation: Case is long-lived product spine; Situation remains ADR-001 runtime root attached to Case.",
  "Deterministic Prioritization (ADR-014) runs after Priority Engine facade and overlays case_memory Decision Snapshot compression when guarantee passes — issue ranking compressor; Priority Contract still ranks Situations. Public compress is exactly 6 fields; internal DO_FIRST/SAFE_TO_DELAY/WATCH_CLOSELY never leak into public JSON.",
] as const;

/** v1.4 gap stubs — teams commonly miss these. */
export const V14_GAP_STUBS = [
  {
    gap: "Caregiver fatigue feedback / degradation mode (top 1 situation when overloaded)",
    path: "src/lib/emotional-load-signal/protection-mode.ts (FATIGUE_SURFACE_LIMITS CRITICAL=1)",
    status: "implemented",
  },
  {
    gap: "Human override (dismiss priorities, override assumptions, mark wrong reasoning)",
    path: "src/lib/human-override + src/app/api/human-override/route.ts",
    status: "stub",
  },
  {
    gap: "Reality drift detection",
    path: "src/lib/reality-drift/detect.ts",
    status: "stub",
  },
] as const;

export const LAYER_ARCHITECTURE_MAP = {
  STATE: {
    owns: [
      "Situation (status active|resolved|archived, priority, summary)",
      "Demand action state (pending|in_progress|completed|cancelled) attached to situations",
      "Responsibility ownership (Person → Responsibility → Demand) — objective accountability",
      "Action state (pending|completed|blocked) if used internally",
      "Document references (pointers only)",
    ],
    canonicalPath: "src/lib/solenos-layers/state",
    migratedFrom: [
      "resolution-engine TrackedSituation",
      "ui-runtime Situation",
      "core-runtime Situation",
      "demand-engine Demand",
      "responsibility-graph ownership",
    ],
    facadeModules: [
      "resolution-engine",
      "core-runtime/situation",
      "demand-engine",
      "responsibility-graph",
    ],
  },
  BELIEF: {
    owns: [
      "BeliefItem (type assumption | missing_information)",
      "Unified influence envelope (bias / confidence penalty)",
      "Conflict Detection soft-lowers Belief confidence / creates clarification needs — registry is operational, not a 4th truth layer",
    ],
    canonicalPath: "src/lib/solenos-layers/belief",
    migratedFrom: ["assumption-registry", "missing-information-queue"],
    facadeModules: ["assumption-registry", "missing-information-queue", "conflict-detection"],
  },
  EXPLANATION: {
    owns: [
      "Decision History (WHY)",
      "Timeline (WHAT) — including completed demand events",
      "System Health (derived summary ONLY)",
      "Human Trust Layer (RecommendationExplanation — understand / challenge / undo)",
    ],
    canonicalPath: "src/lib/solenos-layers/explanation",
    migratedFrom: [
      "decision-history",
      "ui-runtime/timeline-store",
      "system-health",
      "human-trust-layer",
    ],
    facadeModules: ["decision-history", "system-health", "human-trust-layer"],
  },
  DERIVED: {
    owns: [
      "computeRisk(situations, beliefs)",
      "computePriority = PriorityContract.calculate (Situation Priority Contract) — ranks situations by risk×severity, time, uncertainty, dependency, completion; CRITICAL×NOW override",
      "TIME WEIGHTING: RiskOverTime(t)=BaseRisk×TimeCurveType(t) — acute/medication exp, chronic linear, social log, safety step; feeds TimeUrgency×TimeDecayFactor",
      "computeHealthSummary / computeAutonomyGate",
      "computePressureScore(demand metrics) — effort excluded",
      "computeCaregiverLoad(demands, beliefs, context) — not a dashboard engine",
      "computeEmotionalLoadSignal(state, belief, CLI) — stress/burnout/fatigue; load-aware priority + protection mode",
      "Fail-Safe Mode (post-decision derived gate — pause under uncertainty / unresolved conflict; not a truth store)",
      "computeConfidenceState — caregiver reassurance score (0-100) with plain-English explanation",
      "computeCrisisRisks — predictive failure probability (medical/caregiver/family/financial)",
      "computeDelegationSuggestions — suggest-only when CLI HIGH/CRITICAL",
    ],
    canonicalPath: "src/lib/solenos-layers/derived",
    migratedFrom: [
      "situation-risk-register",
      "priority-engine",
      "time-weighting (pure curve math)",
      "system-health gate",
      "caregiver-load-index",
      "emotional-load-signal",
      "fail-safe-mode",
      "confidence-layer",
      "crisis-prevention-layer",
      "delegation-layer",
    ],
    facadeModules: [
      "situation-risk-register",
      "priority-engine",
      "time-weighting",
      "system-health",
      "caregiver-load-index",
      "emotional-load-signal",
      "fail-safe-mode",
      "confidence-layer",
      "crisis-prevention-layer",
      "delegation-layer",
    ],
    note: "Pure functions only — no persistent risk/priority/health/load databases. B2B2C future: Caregiver Risk Infrastructure for employers/insurers (burnout/productivity/absenteeism) — document only, not MVP.",
  },
} as const;

/**
 * STRATEGIC ARCHITECTURE — SolenOS continuity intelligence moat.
 * Product evaluation: Does this increase SolenOS' understanding of the
 * family responsibility system over time?
 */
export const STRATEGIC_ARCHITECTURE = {
  identity:
    "SolenOS IS a continuity intelligence system — NOT a task manager, reminder app, or caregiving dashboard.",
  primaryAsset: "accumulated family intelligence (compounding value over time)",
  longTermVision: "OS for family responsibility continuity",
  evaluationQuestion:
    "Does this increase SolenOS' understanding of the family responsibility system over time?",
  productRule:
    "Every feature must improve at least one of: Family Memory, Care Graph, Decision History, Delegation Network, Crisis Prediction, User Trust, Confidence Engine.",
  facadePath: "src/lib/family-intelligence",
  intelligenceAssets: [
    {
      asset: "Family Memory Layer",
      strategicType: "FamilyMemory",
      facadePath: "src/lib/family-intelligence/family-memory.ts",
      existingPaths: [
        "src/lib/care-profile",
        "src/lib/memory-influence",
        "src/lib/observation-intelligence",
      ],
      gapStatus: "bridged" as const,
      notes: "People/relationships from care-profile; patterns from memory-influence; events compound in facade store",
    },
    {
      asset: "Care Graph",
      strategicType: "CareGraph",
      facadePath: "src/lib/family-intelligence/care-graph.ts",
      existingPaths: ["src/lib/responsibility-graph", "src/lib/care-profile"],
      gapStatus: "bridged" as const,
      notes: "Ownership edges from responsibility-graph; dependence/support from care-profile",
    },
    {
      asset: "Decision History Layer",
      strategicType: "DecisionHistory",
      facadePath: "src/lib/family-intelligence/decision-history.ts",
      existingPaths: [
        "src/lib/decision-history",
        "src/lib/solenos-layers/explanation",
      ],
      gapStatus: "bridged_extended" as const,
      notes: "WHY history exists; strategic store adds accepted + outcome for learning",
    },
    {
      asset: "Delegation Network Layer",
      strategicType: "DelegationNetwork",
      facadePath: "src/lib/family-intelligence/delegation-network.ts",
      existingPaths: [
        "src/lib/delegation-layer",
        "src/lib/solenos-layers/derived/compute-delegation.ts",
      ],
      gapStatus: "bridged_extended" as const,
      notes: "Suggestions exist; network store compounds successRate / overload concentration",
    },
    {
      asset: "Crisis Prediction Layer",
      strategicType: "CrisisSignal",
      facadePath: "src/lib/family-intelligence/crisis-prediction.ts",
      existingPaths: [
        "src/lib/crisis-prevention-layer",
        "src/lib/solenos-layers/derived/compute-crisis-risks.ts",
      ],
      gapStatus: "bridged" as const,
      notes: "Future-focused CrisisRisk already requires explanation; facade compounds signals",
    },
  ],
  trustMechanisms: [
    {
      mechanism: "Remember",
      path: "src/lib/family-intelligence/trust-mechanisms.ts",
      bridges: ["Family Memory"],
    },
    {
      mechanism: "Explain",
      path: "src/lib/family-intelligence/trust-mechanisms.ts",
      bridges: ["human-trust-layer", "Decision History", "Crisis Prediction"],
    },
    {
      mechanism: "Reduce Guilt",
      path: "src/lib/family-intelligence/confidence-state.ts",
      bridges: ["confidence-layer", "computeConfidenceState"],
    },
    {
      mechanism: "Prevent Mistakes",
      path: "src/lib/family-intelligence/trust-mechanisms.ts",
      bridges: ["Crisis Prediction", "Care Graph"],
    },
  ],
  productRuleChecklist: [
    { module: "care-profile", improves: "Family Memory + Care Graph" },
    { module: "memory-influence", improves: "Family Memory" },
    { module: "observation-intelligence", improves: "Family Memory" },
    { module: "case-memory", improves: "Family Memory + Case Timeline + intervention compression (PRP)" },
    { module: "responsibility-graph", improves: "Care Graph" },
    { module: "decision-history / explanation", improves: "Decision History + User Trust" },
    { module: "delegation-layer", improves: "Delegation Network" },
    { module: "crisis-prevention-layer", improves: "Crisis Prediction" },
    { module: "confidence-layer", improves: "Confidence Engine + User Trust" },
    { module: "human-trust-layer", improves: "User Trust (Explain)" },
    { module: "family-intelligence", improves: "all five assets + trust + confidence (facade)" },
  ],
} as const;

export const FACADE_DEPRECATION = {
  "assumption-registry": "BELIEF (type=assumption)",
  "missing-information-queue": "BELIEF (type=missing_information)",
  "situation-risk-register": "derived/computeRisk",
  "priority-engine": "derived/computePriority",
  "deterministic-prioritization":
    "issue-level deterministic score + Decision Snapshot compression (ADR-014); Priority Contract remains situation ranking",
  "time-weighting": "derived PriorityContract time curve path + src/lib/time-weighting",
  "system-health": "explanation health view + derived/computeHealthSummary",
  "resolution-engine": "STATE situations (lifecycle ops remain as state transitions)",
  "demand-engine": "STATE demands (pressureScore via derived/computePressureScore)",
  "caregiver-load-index": "derived/computeCaregiverLoad",
  "emotional-load-signal": "derived/computeEmotionalLoad",
  "conflict-detection": "BELIEF confidence modulation + operational ConflictRegistry (not persistent truth)",
  "human-trust-layer": "EXPLANATION RecommendationExplanation (post-hoc; no STATE/BELIEF write)",
  "fail-safe-mode": "derived Fail-Safe gate + HIGH missing-info escalation (not a 4th truth layer)",
  "confidence-layer": "derived computeConfidenceState — caregiver reassurance (not priority engine)",
  "crisis-prevention-layer": "derived computeCrisisRisks — predictive failure (not reactive priority)",
  "delegation-layer": "derived computeDelegationSuggestions — suggest-only when load elevated",
  "caregiver-load-engine": "master product facade — 5 load dimensions + unified burnout + burden messages",
  "load-interpretation": "facaded by caregiver-load-engine; backward-compat burden recognition",
  "human-override": "EXPLANATION audit stub — dismiss priority / override assumption / mark wrong reasoning",
  "reality-drift": "EXPLANATION audit stub — detect lived-reality divergence from STATE/BELIEF",
  "observation-intelligence":
    "parallel MVP — caregiver observation language → structured patterns (feeds load engine; never diagnoses); text capture MVP; voice FUTURE",
  "mvp-input-architecture":
    "text + documents only → understanding → Care Record / timeline / actions — ADR-018; voice later on same path",
  "voice-conversation":
    "FUTURE — browser Web Speech in + speechSynthesis out + Gemini analyze — ADR-017 superseded for MVP by ADR-018",
  "voice-observation":
    "FUTURE — browser dictation → observation records; server STT also FUTURE",
  tts: "FUTURE — browser speechSynthesis first path (ADR-017); Polly + Google Cloud TTS upgrade (ADR-013); not MVP UI",
  "family-intelligence":
    "strategic continuity facade — 5 intelligence assets + trust/confidence; bridges existing layers, does not replace them",
} as const;
