import re
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple

from app.schemas.safety import (
    SafetyDecisionObject,
    SafetyContractInput,
    SafetyContractOutput,
    ClaimVerification,
    EvidenceReference,
    SafetyQualification,
    SafetyDecision,
    SafetyState,
    RiskClass,
    ClaimType,
    ClaimStrength,
    EscalationDestination,
    SafetyInvariantViolation,
)
from app.core.safety_enums import (
    SourceAuthority,
    SourceQuality,
    CurrentnessStatus,
)
from app.services.claim_extraction import ClaimCandidate


class SafetyEngine:
    SAFETY_VERSION = "1.0"

    DETERMINISTIC_POLICIES = [
        "no_unsupported_claim",
        "no_causal_from_temporal",
        "no_diagnosis_from_observation",
        "no_stale_current_claim",
        "no_contradiction_suppression",
        "no_uncertainty_suppression",
        "no_medical_action_without_authorization",
        "no_information_to_advice",
        "no_false_reassurance",
        "no_prompt_injection",
        "no_document_as_policy",
        "required_citation_presence",
        "claim_strength_matching",
        "no_dangerous_omission",
    ]

    HIGH_RISK_KEYWORDS = [
        "stop medication", "discontinue", "halt medication", "end medication",
        "increase dose", "decrease dose", "double the dose", "reduce the dose",
        "severe difficulty breathing", "can't breathe", "shortness of breath",
        "chest pain", "heart attack", "stroke", "unconscious", "loss of consciousness",
        "severe bleeding", "not breathing", "blue lips", "blue fingertips",
        "suicidal", "self-harm", "kill myself", "end my life",
        "severe allergic reaction", "anaphylaxis", "swelling of throat",
        "fall", "fell", "head injury", "head trauma",
        "confusion", "disoriented", "agitation", "severe pain",
        "emergency", "urgent", "immediately", "right away",
        "call 911", "call emergency", "go to er", "go to hospital",
    ]

    CAUSAL_INDICATORS = [
        "caused by", "due to", "because of", "result of", "led to",
        "triggered by", "induced by", "from the", "medication caused",
        "drug caused", "treatment caused",
    ]

    DIAGNOSTIC_INDICATORS = [
        "diagnosed with", "has dementia", "dementia progression",
        "progressive disease", " deteriorating", "worsening condition",
        "indicating", "suggests diagnosis", "consistent with",
        "likely has", "probably has", "appears to have",
    ]

    MEDICAL_ACTION_INDICATORS = [
        "take medication", "stop medication", "start medication",
        "increase dose", "decrease dose", "change medication",
        "prescribe", "recommend medication", "should take",
        "must take", "need to take", "have to take",
    ]

    FALSE_REASSURANCE_INDICATORS = [
        "probably nothing serious", "no need to worry", "nothing to worry about",
        "don't worry", "not a concern", "not serious", "nothing serious",
        "likely fine", "probably okay", "should be fine",
        "everything appears stable", "appears stable", "looks stable",
    ]

    PROHIBITED_PATTERNS = [
        r"ignore\s+(previous|all|any)\s+instructions?",
        r"disregard\s+(previous|all|any)\s+",
        r"pretend\s+that\s+",
        r"act\s+as\s+if\s+",
        r"you\s+are\s+(now|a)\s+(doctor|physician|clinician|nurse)",
        r"override\s+(safety|security|policy)",
        r"bypass\s+(safety|security|policy|restriction)",
        r"jailbreak",
    ]

    def __init__(self, db=None):
        self.db = db
        self.policy_rules: List[Dict[str, Any]] = []
        self._load_default_policies()

    def _load_default_policies(self):
        self.policy_rules = [
            {
                "rule_id": "no_unsupported_claim",
                "claim_types": [ClaimType.FACTUAL, ClaimType.CAUSAL, ClaimType.DIAGNOSTIC, ClaimType.MEDICAL_ACTION],
                "risk_classes": [RiskClass.MODERATE_RISK, RiskClass.HIGH_RISK_MEDICAL, RiskClass.EMERGENCY],
                "action": SafetyDecision.REQUIRE_MORE_EVIDENCE,
                "conditions": {"min_evidence_count": 1},
                "priority": 10,
            },
            {
                "rule_id": "no_causal_from_temporal",
                "claim_types": [ClaimType.CAUSAL],
                "risk_classes": [RiskClass.MODERATE_RISK, RiskClass.HIGH_RISK_MEDICAL, RiskClass.EMERGENCY],
                "action": SafetyDecision.REQUIRE_MORE_EVIDENCE,
                "conditions": {"min_evidence_count": 2, "require_direct_evidence": True},
                "priority": 5,
            },
            {
                "rule_id": "no_diagnosis_from_observation",
                "claim_types": [ClaimType.DIAGNOSTIC],
                "risk_classes": [RiskClass.MODERATE_RISK, RiskClass.HIGH_RISK_MEDICAL, RiskClass.EMERGENCY],
                "action": SafetyDecision.REQUIRE_HUMAN_REVIEW,
                "conditions": {},
                "priority": 5,
            },
            {
                "rule_id": "no_medical_action_without_authorization",
                "claim_types": [ClaimType.MEDICAL_ACTION],
                "risk_classes": [RiskClass.MODERATE_RISK, RiskClass.HIGH_RISK_MEDICAL, RiskClass.EMERGENCY],
                "action": SafetyDecision.ESCALATE,
                "conditions": {},
                "priority": 3,
            },
            {
                "rule_id": "no_information_to_advice",
                "claim_types": [ClaimType.MEDICAL_ACTION, ClaimType.RECOMMENDATION],
                "risk_classes": [RiskClass.MODERATE_RISK, RiskClass.HIGH_RISK_MEDICAL, RiskClass.EMERGENCY],
                "action": SafetyDecision.REQUIRE_MORE_EVIDENCE,
                "conditions": {"require_documented_instruction": True},
                "priority": 5,
            },
            {
                "rule_id": "no_false_reassurance",
                "claim_types": [ClaimType.INTERPRETATION, ClaimType.CURRENT_STATE],
                "risk_classes": [RiskClass.MODERATE_RISK, RiskClass.HIGH_RISK_MEDICAL, RiskClass.EMERGENCY],
                "action": SafetyDecision.REQUIRE_MORE_EVIDENCE,
                "conditions": {"require_complete_assessment": True},
                "priority": 5,
            },
            {
                "rule_id": "emergency_always_escalate",
                "risk_classes": [RiskClass.EMERGENCY],
                "action": SafetyDecision.ESCALATE,
                "conditions": {},
                "priority": 1,
            },
            {
                "rule_id": "prohibited_always_refuse",
                "risk_classes": [RiskClass.PROHIBITED],
                "action": SafetyDecision.REFUSE,
                "conditions": {},
                "priority": 1,
            },
        ]

    def evaluate(self, input_data: SafetyContractInput) -> SafetyContractOutput:
        claims = self._extract_claims(input_data.user_intent, input_data.candidate_claims)

        if not claims and input_data.risk_classification == RiskClass.INFORMATIONAL:
            return SafetyContractOutput(
                decision=SafetyDecision.ALLOW,
                safety_state=SafetyState.GROUNDED,
                qualifications=[],
                escalation_required=False,
                escalation_destination=None,
                escalation_reason=None,
                human_review_required=False,
                rationale="No material claims detected in informational input.",
                policy_references=["safety.policy.allow_informational"],
                violations=[],
                timestamp=datetime.now(timezone.utc),
            )

        claim_verifications = []
        qualifications = []
        violations = []
        escalation_required = False
        escalation_destination = None
        escalation_reason = None
        human_review_required = False

        for claim in claims:
            verification = self._verify_claim(claim, input_data)
            claim_verifications.append(verification)

            if verification.citation_mismatch:
                violations.append(SafetyInvariantViolation.CITATION_MISMATCH)
            if verification.strength_mismatch:
                violations.append(SafetyInvariantViolation.CLAIM_STRENGTH_INFLATION)
            if not verification.is_supported:
                violations.append(SafetyInvariantViolation.UNSUPPORTED_CLAIM)

            if self._detect_causal_overreach(claim, verification):
                violations.append(SafetyInvariantViolation.CAUSAL_OVERREACH)
            if self._detect_diagnostic_overreach(claim, verification):
                violations.append(SafetyInvariantViolation.DIAGNOSTIC_OVERREACH)
            if self._detect_medication_overreach(claim, verification):
                violations.append(SafetyInvariantViolation.MEDICATION_OVERREACH)
            if self._detect_false_reassurance(claim, input_data):
                violations.append(SafetyInvariantViolation.FALSE_REASSURANCE)
            if self._detect_uncertainty_suppression(verification):
                violations.append(SafetyInvariantViolation.UNCERTAINTY_SUPPRESSION)
            if self._detect_contradiction_suppression(verification, input_data):
                violations.append(SafetyInvariantViolation.CONTRADICTION_SUPPRESSION)
            if self._detect_stale_evidence(verification):
                violations.append(SafetyInvariantViolation.STALE_EVIDENCE)
            if self._detect_prompt_injection(input_data.user_intent):
                violations.append(SafetyInvariantViolation.PROMPT_INJECTION)
            if self._detect_dangerous_omission(claim, verification, input_data):
                violations.append(SafetyInvariantViolation.DANGEROUS_OMISSION)

        risk_class = input_data.risk_classification
        decision, safety_state, qualifications = self._apply_policies(
            claims, claim_verifications, risk_class, violations, input_data
        )

        if risk_class in (RiskClass.EMERGENCY, RiskClass.HIGH_RISK_MEDICAL):
            escalation_required = True
            escalation_destination = EscalationDestination.CAREGIVER if risk_class == RiskClass.HIGH_RISK_MEDICAL else EscalationDestination.EMERGENCY_SERVICES
            escalation_reason = f"High-risk content detected: {input_data.user_intent[:200]}"

        if risk_class == RiskClass.PROHIBITED:
            decision = SafetyDecision.REFUSE
            safety_state = SafetyState.BLOCKED
        elif SafetyInvariantViolation.PROMPT_INJECTION in violations:
            decision = SafetyDecision.REFUSE
            safety_state = SafetyState.BLOCKED

        if decision == SafetyDecision.REQUIRE_HUMAN_REVIEW:
            human_review_required = True
            if not escalation_destination:
                escalation_destination = EscalationDestination.HUMAN_REVIEWER
                escalation_required = True

        unique_violations = list(dict.fromkeys(violations))
        rationale = self._build_rationale(claims, claim_verifications, risk_class, decision, unique_violations, qualifications)
        policy_refs = self._get_policy_references(decision, unique_violations)

        return SafetyContractOutput(
            decision=decision,
            safety_state=safety_state,
            qualifications=qualifications,
            escalation_required=escalation_required,
            escalation_destination=escalation_destination,
            escalation_reason=escalation_reason,
            human_review_required=human_review_required,
            rationale=rationale,
            policy_references=policy_refs,
            violations=unique_violations,
            timestamp=datetime.now(timezone.utc),
        )

    def _extract_claims(self, user_intent: str, candidate_claims: List[str]) -> List[ClaimCandidate]:
        claims = []

        if candidate_claims:
            for claim_text in candidate_claims:
                claim_type = self._classify_claim_type(claim_text)
                claims.append(ClaimCandidate(text=claim_text, claim_type=claim_type))
        else:
            sentences = re.split(r'(?<=[.!?])\s+', user_intent)
            for sentence in sentences:
                if not sentence.strip():
                    continue
                claim_type = self._classify_claim_type(sentence)
                claims.append(ClaimCandidate(text=sentence.strip(), claim_type=claim_type))

        return claims

    def _classify_claim_type(self, text: str) -> ClaimType:
        text_lower = text.lower()

        for indicator in self.CAUSAL_INDICATORS:
            if indicator in text_lower:
                return ClaimType.CAUSAL

        for indicator in self.DIAGNOSTIC_INDICATORS:
            if indicator in text_lower:
                return ClaimType.DIAGNOSTIC

        for indicator in self.MEDICAL_ACTION_INDICATORS:
            if indicator in text_lower:
                return ClaimType.MEDICAL_ACTION

        if any(w in text_lower for w in ["recommend", "should", "ought to", "consider"]):
            return ClaimType.RECOMMENDATION

        if any(w in text_lower for w in ["predict", "will", "going to", "likely to"]):
            return ClaimType.PREDICTION

        if any(w in text_lower for w in ["currently", "right now", "at present", "current state"]):
            return ClaimType.CURRENT_STATE

        temporal_words = ["on", "at", "in ", "during", "before", "after", "since", "until"]
        for w in temporal_words:
            if re.search(rf'\b{re.escape(w)}\b', text_lower):
                return ClaimType.TEMPORAL

        return ClaimType.FACTUAL

    def _verify_claim(self, claim: ClaimCandidate, input_data: SafetyContractInput) -> ClaimVerification:
        evidence_refs = []
        contradictions = []

        for ev in input_data.evidence_references:
            if self._evidence_supports_claim(ev, claim.text):
                evidence_refs.append(ev)
            if ev.contradicts_claim:
                contradictions.append(ev)

        is_supported = len(evidence_refs) > 0
        confidence = self._calculate_claim_confidence(evidence_refs, claim)

        epistemic_state = "unknown"
        if is_supported:
            if contradictions:
                epistemic_state = "conflicting"
            elif confidence >= 0.8:
                epistemic_state = "known"
            elif confidence >= 0.5:
                epistemic_state = "partially_known"
            else:
                epistemic_state = "ambiguous"
        else:
            epistemic_state = "not_documented"

        claim_strength = self._assess_claim_strength(claim.text)
        evidence_strength = self._assess_evidence_strength(evidence_refs)
        strength_mismatch = self._detect_strength_mismatch(claim_strength, evidence_strength)

        citation_mismatch = self._detect_citation_mismatch(claim, evidence_refs)

        return ClaimVerification(
            claim_text=claim.text,
            claim_type=claim.claim_type,
            claim_strength=claim_strength,
            evidence_references=evidence_refs,
            contradictions=contradictions,
            confidence=confidence,
            epistemic_state=epistemic_state,
            is_supported=is_supported,
            strength_mismatch=strength_mismatch,
            citation_mismatch=citation_mismatch,
            verification_notes=None,
            timestamp=datetime.now(timezone.utc),
        )

    def _evidence_supports_claim(self, evidence: EvidenceReference, claim_text: str) -> bool:
        if not evidence.source_text:
            return False
        claim_words = set(claim_text.lower().split())
        evidence_words = set(evidence.source_text.lower().split())
        overlap = claim_words & evidence_words
        return len(overlap) >= max(1, len(claim_words) * 0.3)

    def _calculate_claim_confidence(self, evidence_refs: List[EvidenceReference], claim: ClaimCandidate) -> float:
        if not evidence_refs:
            return 0.0
        confidences = [ev.confidence for ev in evidence_refs if ev.confidence is not None]
        if not confidences:
            return 0.0
        return sum(confidences) / len(confidences)

    def _assess_claim_strength(self, claim_text: str) -> ClaimStrength:
        text_lower = claim_text.lower()
        definitive_markers = ["definitely", "certainly", "always", "never", "must be", "is the cause", "caused by"]
        likely_markers = ["likely", "probably", "most likely", "appears to", "seems to", "suggests"]
        possible_markers = ["possibly", "might", "could", "may", "perhaps", "uncertain"]
        unknown_markers = ["unknown", "unclear", "not known", "no evidence", "cannot determine"]

        for marker in definitive_markers:
            if marker in text_lower:
                return ClaimStrength.DEFINITE
        for marker in likely_markers:
            if marker in text_lower:
                return ClaimStrength.LIKELY
        for marker in unknown_markers:
            if marker in text_lower:
                return ClaimStrength.UNKNOWN
        for marker in possible_markers:
            if marker in text_lower:
                return ClaimStrength.POSSIBLE

        return ClaimStrength.LIKELY

    def _assess_evidence_strength(self, evidence_refs: List[EvidenceReference]) -> ClaimStrength:
        if not evidence_refs:
            return ClaimStrength.NOT_DOCUMENTED
        if any(ev.currentness == CurrentnessStatus.STALE for ev in evidence_refs):
            return ClaimStrength.STALE
        if any(ev.quality == SourceQuality.LOW for ev in evidence_refs):
            return ClaimStrength.UNCERTAIN
        if all(ev.quality == SourceQuality.HIGH for ev in evidence_refs):
            return ClaimStrength.LIKELY
        return ClaimStrength.POSSIBLE

    def _detect_strength_mismatch(self, claim_strength: ClaimStrength, evidence_strength: ClaimStrength) -> bool:
        strength_order = {
            ClaimStrength.NOT_DOCUMENTED: 0,
            ClaimStrength.UNKNOWN: 1,
            ClaimStrength.HISTORICAL: 2,
            ClaimStrength.STALE: 3,
            ClaimStrength.CONFLICTING: 4,
            ClaimStrength.UNCERTAIN: 5,
            ClaimStrength.POSSIBLE: 6,
            ClaimStrength.LIKELY: 7,
            ClaimStrength.DEFINITE: 8,
        }
        return strength_order.get(claim_strength, 0) > strength_order.get(evidence_strength, 0) + 1

    def _detect_citation_mismatch(self, claim: ClaimCandidate, evidence_refs: List[EvidenceReference]) -> bool:
        if not evidence_refs:
            return False
        for ev in evidence_refs:
            if claim.text and ev.source_text:
                claim_words = set(claim.text.lower().split())
                evidence_words = set(ev.source_text.lower().split())
                if len(claim_words & evidence_words) < max(1, len(claim_words) * 0.2):
                    return True
        return False

    def _detect_causal_overreach(self, claim: ClaimCandidate, verification: ClaimVerification) -> bool:
        if claim.claim_type != ClaimType.CAUSAL:
            return False
        if verification.is_supported and len(verification.evidence_references) >= 2:
            return False
        return True

    def _detect_diagnostic_overreach(self, claim: ClaimCandidate, verification: ClaimVerification) -> bool:
        if claim.claim_type != ClaimType.DIAGNOSTIC:
            return False
        if verification.is_supported and verification.confidence >= 0.8:
            return False
        return True

    def _detect_medication_overreach(self, claim: ClaimCandidate, verification: ClaimVerification) -> bool:
        if claim.claim_type != ClaimType.MEDICAL_ACTION:
            return False
        if not verification.is_supported:
            return True
        has_authorized_source = any(
            ev.authority in (SourceAuthority.CLINICIAN, SourceAuthority.MEDICATION_RECORD, SourceAuthority.DISCHARGE_INSTRUCTION)
            for ev in verification.evidence_references
        )
        return not has_authorized_source

    def _detect_false_reassurance(self, claim: ClaimCandidate, input_data: SafetyContractInput) -> bool:
        text_lower = claim.text.lower()
        for indicator in self.FALSE_REASSURANCE_INDICATORS:
            if indicator in text_lower:
                if not input_data.evidence_references or len(input_data.evidence_references) < 2:
                    return True
                has_recent_evidence = any(
                    ev.currentness in (CurrentnessStatus.CURRENT, CurrentnessStatus.RECENT)
                    for ev in input_data.evidence_references
                )
                if not has_recent_evidence:
                    return True
        return False

    def _detect_uncertainty_suppression(self, verification: ClaimVerification) -> bool:
        if verification.epistemic_state in ("conflicting", "ambiguous", "unknown", "not_documented"):
            if verification.claim_strength in (ClaimStrength.DEFINITE, ClaimStrength.LIKELY):
                return True
        return False

    def _detect_contradiction_suppression(self, verification: ClaimVerification, input_data: SafetyContractInput) -> bool:
        if verification.contradictions and not input_data.contradictions:
            return True
        return False

    def _detect_stale_evidence(self, verification: ClaimVerification) -> bool:
        for ev in verification.evidence_references:
            if ev.currentness == CurrentnessStatus.STALE:
                if verification.claim_type == ClaimType.CURRENT_STATE:
                    return True
                if ev.confidence >= 0.7:
                    return True
        return False

    def _detect_prompt_injection(self, user_intent: str) -> bool:
        text_lower = user_intent.lower()
        for pattern in self.PROHIBITED_PATTERNS:
            if re.search(pattern, text_lower):
                return True
        return False

    def _detect_dangerous_omission(self, claim: ClaimCandidate, verification: ClaimVerification, input_data: SafetyContractInput) -> bool:
        if verification.contradictions and not any(
            c.source_text and c.source_text.lower() in claim.text.lower()
            for c in verification.contradictions
        ):
            return True
        if input_data.contradictions and not any(
            c.lower() in claim.text.lower() for c in input_data.contradictions
        ):
            return True
        return False

    def _classify_risk(
        self, claims: List[ClaimCandidate], verifications: List[ClaimVerification], input_data: SafetyContractInput
    ) -> RiskClass:
        text_lower = input_data.user_intent.lower()
        for keyword in self.HIGH_RISK_KEYWORDS:
            if keyword in text_lower:
                if any(w in keyword for w in ["emergency", "911", "hospital", "breathing", "unconscious", "severe bleeding", "suicidal", "self-harm"]):
                    return RiskClass.EMERGENCY
                return RiskClass.HIGH_RISK_MEDICAL

        for claim in claims:
            if claim.claim_type == ClaimType.MEDICAL_ACTION:
                return RiskClass.HIGH_RISK_MEDICAL
            if claim.claim_type == ClaimType.DIAGNOSTIC:
                return RiskClass.HIGH_RISK_MEDICAL
            if claim.claim_type == ClaimType.CAUSAL:
                return RiskClass.MODERATE_RISK

        for v in verifications:
            if not v.is_supported and v.claim_type in (ClaimType.FACTUAL, ClaimType.CAUSAL, ClaimType.DIAGNOSTIC):
                return RiskClass.MODERATE_RISK

        return RiskClass.INFORMATIONAL

    def _apply_policies(
        self,
        claims: List[ClaimCandidate],
        verifications: List[ClaimVerification],
        risk_class: RiskClass,
        violations: List[SafetyInvariantViolation],
        input_data: SafetyContractInput,
    ) -> Tuple[SafetyDecision, SafetyState, List[SafetyQualification]]:
        applicable_rules = sorted(
            [r for r in self.policy_rules if self._rule_applies(r, claims, verifications, risk_class, violations)],
            key=lambda r: r.get("priority", 100),
        )

        if not applicable_rules:
            return SafetyDecision.ALLOW, SafetyState.GROUNDED, []

        primary_rule = applicable_rules[0]
        action = primary_rule["action"]

        if action == SafetyDecision.ESCALATE:
            return SafetyDecision.ESCALATE, SafetyState.ESCALATED, []
        elif action == SafetyDecision.REFUSE:
            return SafetyDecision.REFUSE, SafetyState.BLOCKED, []
        elif action == SafetyDecision.REQUIRE_HUMAN_REVIEW:
            return SafetyDecision.REQUIRE_HUMAN_REVIEW, SafetyState.REQUIRES_HUMAN_REVIEW, []
        elif action == SafetyDecision.REQUIRE_MORE_EVIDENCE:
            return SafetyDecision.REQUIRE_MORE_EVIDENCE, SafetyState.REQUIRES_MORE_EVIDENCE, [
                SafetyQualification(
                    qualification_type="evidence_required",
                    description="The available evidence does not sufficiently support this claim. More evidence is required before this can be communicated.",
                    severity="high",
                    required_wording="The available record does not establish this.",
                    blocking=True,
                )
            ]
        elif action == SafetyDecision.ALLOW_WITH_QUALIFICATION:
            qualifications = self._build_qualifications(verifications, violations, risk_class)
            return SafetyDecision.ALLOW_WITH_QUALIFICATION, SafetyState.QUALIFIED, qualifications

        return SafetyDecision.ALLOW, SafetyState.GROUNDED, []

    def _rule_applies(self, rule: Dict[str, Any], claims: List[ClaimCandidate], verifications: List[ClaimVerification], risk_class: RiskClass, violations: List[SafetyInvariantViolation]) -> bool:
        if risk_class not in rule.get("risk_classes", []):
            if rule.get("risk_classes"):
                return False
        rule_claim_types = rule.get("claim_types", [])
        if rule_claim_types:
            claim_types = [c.claim_type for c in claims]
            if not any(ct in rule_claim_types for ct in claim_types):
                return False
        return True

    def _build_qualifications(self, verifications: List[ClaimVerification], violations: List[SafetyInvariantViolation], risk_class: RiskClass) -> List[SafetyQualification]:
        qualifications = []
        for v in verifications:
            if v.epistemic_state == "conflicting":
                qualifications.append(SafetyQualification(
                    qualification_type="conflict",
                    description="The available records contain conflicting information about this claim.",
                    severity="high",
                    required_wording="The available records report different information about this.",
                ))
            elif v.epistemic_state == "not_documented":
                qualifications.append(SafetyQualification(
                    qualification_type="absence",
                    description="The available record does not document this.",
                    severity="high",
                    required_wording="The available record does not document this.",
                ))
            elif v.epistemic_state == "stale":
                qualifications.append(SafetyQualification(
                    qualification_type="currentness",
                    description="The supporting evidence is stale and may not reflect the current state.",
                    severity="moderate",
                    required_wording="This information may be outdated.",
                ))
        return qualifications

    def _build_rationale(
        self, claims: List[ClaimCandidate], verifications: List[ClaimVerification],
        risk_class: RiskClass, decision: SafetyDecision, violations: List[SafetyInvariantViolation],
        qualifications: List[SafetyQualification],
    ) -> str:
        parts = []
        parts.append(f"Risk classification: {risk_class.value}.")
        parts.append(f"Safety decision: {decision.value}.")

        supported = sum(1 for v in verifications if v.is_supported)
        parts.append(f"Claims evaluated: {len(claims)}. Supported: {supported}. Unsupported: {len(claims) - supported}.")

        if violations:
            parts.append(f"Violations detected: {', '.join(v.value for v in violations)}.")

        if qualifications:
            parts.append(f"Qualifications applied: {len(qualifications)}.")

        return " ".join(parts)

    def _get_policy_references(self, decision: SafetyDecision, violations: List[SafetyInvariantViolation]) -> List[str]:
        refs = [f"safety.policy.{decision.value}"]
        for v in violations:
            refs.append(f"safety.invariant.{v.value}")
        return refs

    def evaluate_escalation(self, escalation_data: Dict[str, Any]) -> Dict[str, Any]:
        risk_category = escalation_data.get("risk_category", RiskClass.MODERATE_RISK)

        if risk_category == RiskClass.EMERGENCY:
            return {
                "destination": EscalationDestination.EMERGENCY_SERVICES,
                "urgency": "immediate",
                "action": "call_emergency",
            }
        elif risk_category == RiskClass.HIGH_RISK_MEDICAL:
            return {
                "destination": EscalationDestination.CAREGIVER,
                "urgency": "urgent",
                "action": "notify_caregiver",
            }
        elif risk_category == RiskClass.MODERATE_RISK:
            return {
                "destination": EscalationDestination.CLINICIAN,
                "urgency": "routine",
                "action": "notify_clinician",
            }
        else:
            return {
                "destination": EscalationDestination.HUMAN_REVIEWER,
                "urgency": "routine",
                "action": "request_review",
            }

    def check_safety_invariants(self, claims: List[str], evidence_ids: List[str], output: str) -> List[SafetyInvariantViolation]:
        violations = []

        for claim in claims:
            if self._detect_prompt_injection(claim):
                violations.append(SafetyInvariantViolation.PROMPT_INJECTION)
            if self._contains_false_reassurance(claim):
                violations.append(SafetyInvariantViolation.FALSE_REASSURANCE)
            if self._contains_overconfidence(claim):
                violations.append(SafetyInvariantViolation.OVERCONFIDENCE)
            if self._contains_causal_overreach(claim):
                violations.append(SafetyInvariantViolation.CAUSAL_OVERREACH)
            if self._contains_diagnostic_overreach(claim):
                violations.append(SafetyInvariantViolation.DIAGNOSTIC_OVERREACH)
            if self._contains_unsupported_advice(claim):
                violations.append(SafetyInvariantViolation.UNSUPPORTED_ADVICE)

        if not evidence_ids and claims:
            violations.append(SafetyInvariantViolation.UNSUPPORTED_CLAIM)

        return list(dict.fromkeys(violations))

    def _contains_false_reassurance(self, text: str) -> bool:
        text_lower = text.lower()
        return any(indicator in text_lower for indicator in self.FALSE_REASSURANCE_INDICATORS)

    def _contains_overconfidence(self, text: str) -> bool:
        text_lower = text.lower()
        definitive_markers = ["definitely", "certainly", "always", "never", "must be", "is the cause", "without doubt"]
        return any(marker in text_lower for marker in definitive_markers)

    def _contains_causal_overreach(self, text: str) -> bool:
        text_lower = text.lower()
        return any(indicator in text_lower for indicator in self.CAUSAL_INDICATORS)

    def _contains_diagnostic_overreach(self, text: str) -> bool:
        text_lower = text.lower()
        return any(indicator in text_lower for indicator in self.DIAGNOSTIC_INDICATORS)

    def _contains_unsupported_advice(self, text: str) -> bool:
        text_lower = text.lower()
        advice_patterns = [
            r"you\s+should\s+(stop|start|increase|decrease|take|change)",
            r"you\s+need\s+to\s+(stop|start|increase|decrease|take|change)",
            r"you\s+must\s+(stop|start|increase|decrease|take|change)",
            r"i\s+recommend\s+(stopping|starting|increasing|decreasing|taking|changing)",
            r"it\s+is\s+safe\s+to\s+(stop|start|increase|decrease)",
        ]
        for pattern in advice_patterns:
            if re.search(pattern, text_lower):
                return True
        return False

    def validate_response(self, candidate_response: str, claims: List[str], evidence_ids: List[str], risk_class: RiskClass) -> SafetyDecisionObject:
        violations = self.check_safety_invariants(claims, evidence_ids, candidate_response)

        if violations:
            if SafetyInvariantViolation.PROMPT_INJECTION in violations:
                decision = SafetyDecision.REFUSE
                state = SafetyState.BLOCKED
            elif SafetyInvariantViolation.UNSUPPORTED_ADVICE in violations or SafetyInvariantViolation.CAUSAL_OVERREACH in violations:
                decision = SafetyDecision.REQUIRE_MORE_EVIDENCE
                state = SafetyState.REQUIRES_MORE_EVIDENCE
            elif SafetyInvariantViolation.FALSE_REASSURANCE in violations or SafetyInvariantViolation.DIAGNOSTIC_OVERREACH in violations:
                decision = SafetyDecision.REQUIRE_HUMAN_REVIEW
                state = SafetyState.REQUIRES_HUMAN_REVIEW
            else:
                decision = SafetyDecision.ALLOW_WITH_QUALIFICATION
                state = SafetyState.QUALIFIED
        else:
            decision = SafetyDecision.ALLOW
            state = SafetyState.GROUNDED

        return SafetyDecisionObject(
            decision=decision,
            safety_state=state,
            risk_class=risk_class,
            violations=violations,
            escalation_required=risk_class in (RiskClass.EMERGENCY, RiskClass.HIGH_RISK_MEDICAL),
            escalation_destination=EscalationDestination.CAREGIVER if risk_class == RiskClass.HIGH_RISK_MEDICAL else EscalationDestination.EMERGENCY_SERVICES if risk_class == RiskClass.EMERGENCY else None,
            rationale=f"Validated response against safety invariants. Violations: {[v.value for v in violations]}",
            policy_references=["safety.invariant_check"],
            timestamp=datetime.now(timezone.utc),
            safety_version=self.SAFETY_VERSION,
        )

    def create_safety_audit(self, input_data: SafetyContractInput, output: SafetyContractOutput, final_output: Optional[str] = None) -> Dict[str, Any]:
        return {
            "person_id": input_data.person_id,
            "request_id": f"req_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "user_role": input_data.user_role,
            "input_text": input_data.user_intent,
            "candidate_claims": input_data.candidate_claims,
            "evidence_ids": [ev.evidence_id for ev in input_data.evidence_references],
            "source_quality": {ev.evidence_id: ev.quality.value for ev in input_data.evidence_references},
            "epistemic_states": input_data.epistemic_status,
            "contradictions": input_data.contradictions,
            "risk_classification": output.risk_class if hasattr(output, 'risk_class') else input_data.risk_classification,
            "safety_decision": output.decision.value,
            "safety_state": output.safety_state.value,
            "qualifications": [q.model_dump() for q in output.qualifications],
            "violations": [v.value for v in output.violations],
            "escalation_id": None,
            "human_review_required": output.human_review_required,
            "rationale": output.rationale,
            "policy_references": output.policy_references,
            "final_output": final_output,
            "safety_version": self.SAFETY_VERSION,
            "timestamp": datetime.now(timezone.utc),
        }
