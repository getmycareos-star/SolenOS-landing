from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.dementia import (
    DementiaBaselineModel,
    DementiaObservationModel,
    DementiaChangeAssessmentModel,
    DementiaCaregiverDisagreementModel,
    DementiaSafetyEventModel,
    DementiaTimelineEventModel,
    DementiaCarePlanModel,
    DementiaCaregiverOnboardingModel,
)
from app.schemas.dementia import (
    DementiaBaselineCreate,
    DementiaBaselineUpdate,
    DementiaBaselineResponse,
    DementiaObservationCreate,
    DementiaReasoningRequest,
    DementiaReasoningResponse,
    DementiaBaselineComparisonRequest,
    DementiaBaselineComparisonResponse,
    DementiaCaregiverLanguageAnalysis,
    DementiaSafetyEventCreate,
    DementiaReasoningSummary,
)
from app.core.dementia_enums import (
    DementiaDomain,
    DementiaChangeType,
    FluctuationPattern,
    SafetySignificance,
    CaregiverLanguageCategory,
    DementiaBaselineType,
)


class DementiaReasoningEngine:
    CAREGIVER_LANGUAGE_PATTERNS = {
        CaregiverLanguageCategory.NOT_THEMSELVES: [
            r"not\s+(him|her|them)self",
            r"not\s+themselves",
        ],
        CaregiverLanguageCategory.IN_OWN_WORLD: [
            r"in\s+(his|her|their)\s+own\s+world",
        ],
        CaregiverLanguageCategory.REPETITIVE_QUESTIONING: [
            r"(ask|asking|asks)\s+(the\s+)?same\s+(thing|question)",
            r"repeats?",
            r"keeps\s+asking",
        ],
        CaregiverLanguageCategory.SUNDOWNING: [
            r"sundown",
            r"evening\s+confusion",
            r"worse\s+(at|in)\s+(the\s+)?evening",
        ],
        CaregiverLanguageCategory.GETTING_LOST: [
            r"getting\s+lost",
            r"can't\s+find\s+(her|his|their)\s+way",
            r"lost\s+in\s+the\s+(house|home)",
        ],
        CaregiverLanguageCategory.HAVING_A_DAY: [
            r"having\s+(a\s+)?(one\s+of\s+those\s+)?days?",
        ],
        CaregiverLanguageCategory.DONT_KNOW_WHATS_GOING_ON: [
            r"doesn't\s+know\s+what'?s\s+going\s+on",
            r"don't\s+know\s+what'?s\s+happening",
        ],
        CaregiverLanguageCategory.AGGRESSION: [
            r"aggressive",
            r"aggression",
            r"violent",
            r"lash\s+out",
        ],
        CaregiverLanguageCategory.PARANOIA: [
            r"paranoi",
            r"stealing",
            r"thinks\s+someone\s+is",
            r"accuses",
            r"suspicious",
        ],
        CaregiverLanguageCategory.WITHDRAWAL: [
            r"withdraw",
            r"stopped\s+(joining|coming|participating)",
            r"won't\s+come",
            r"refuses\s+to\s+(join|come)",
        ],
        CaregiverLanguageCategory.CONFUSION: [
            r"confus",
            r"disorient",
            r"mixed\s+up",
        ],
    }

    DOMAIN_KEYWORDS = {
        DementiaDomain.MEMORY: [
            "forgot", "forget", "memory", "recall", "remember", "forgets",
        ],
        DementiaDomain.ORIENTATION: [
            "orient", "disorient", "place", "where", "location", "house", "home",
        ],
        DementiaDomain.RECOGNITION: [
            "recognize", "recognition", "didn't know", "did not know", "stranger",
        ],
        DementiaDomain.COMMUNICATION: [
            "word", "speak", "talk", "language", "aphasia", "find the words", "expression",
        ],
        DementiaDomain.JUDGMENT: [
            "judgment", "judgement", "decision", "poor choice", "judgment",
        ],
        DementiaDomain.EXECUTIVE_FUNCTION: [
            "organize", "plan", "sequence", "steps", "order", "executive",
            "put", "cupboard", "refrigerator", "milk", "cereal",
            "task", "procedure", "procedural",
        ],
        DementiaDomain.AGITATION: [
            "agitat", "pace", "pacing", "restless", "fidget",
        ],
        DementiaDomain.WANDERING: [
            "wander", "elop", "left the house", "walked off", "got lost",
        ],
        DementiaDomain.REPETITIVE_BEHAVIORS: [
            "repetit", "keeps doing", "over and over", "again and again",
        ],
        DementiaDomain.SLEEP_WAKE_PATTERNS: [
            "sleep", "wake", "night", "insomnia", "drowsy", "sleepy",
        ],
        DementiaDomain.ADLS_IADLS: [
            "dress", "bathe", "bath", "toilet", "eat", "cook", "medication", "finance", "bill", "drive",
            "clothes", "put on", "choosing", "groom", "shower", "meal", "prepare",
        ],
    }

    SAFETY_KEYWORDS = {
        "wandering": ["wander", "elop", "left the house", "walked off", "got lost", "found him", "found her"],
        "medication_safety": ["medication", "pill", "dose", "twice", "double", "forgot.*taken", "took.*again"],
        "fall": ["fall", "fell", "fallen", "trip", "slip"],
        "appliance_safety": ["stove", "oven", "burner", "appliance", "left.*on", "turn.*on"],
        "driving_safety": ["driving", "drove", "drive", "car", "lost.*driv", "navigation"],
    }

    CRITICAL_SAFETY_PATTERNS = [
        r"left.*(night|2\s*am|midnight|2am)",
        r"found.*(street|block|away|missing|hours)",
        r"wandering.*night",
        r"elop.*night",
        r"wander.*outside.*night",
        r"couldn't.*breathe",
        r"unresponsive",
        r"seizure",
    ]

    def __init__(self, db: Session):
        self.db = db

    def analyze_caregiver_language(self, text: str) -> DementiaCaregiverLanguageAnalysis:
        text_lower = text.lower()
        detected_categories = []

        for category, patterns in self.CAREGIVER_LANGUAGE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    detected_categories.append(category)
                    break

        structured_observation = self._generate_structured_observation(text, detected_categories)
        requires_concrete_evidence = len(detected_categories) > 0
        baseline_status = "unknown unless established"
        clinical_label_warning = None

        if CaregiverLanguageCategory.SUNDOWNING in detected_categories:
            clinical_label_warning = "Caregiver labels: sundowning. Observed phenomenon: unspecified evening confusion. Status: requires concrete evidence. Baseline: unknown unless established."

        return DementiaCaregiverLanguageAnalysis(
            original_text=text,
            detected_categories=detected_categories,
            structured_observation=structured_observation,
            requires_concrete_evidence=requires_concrete_evidence,
            baseline_status=baseline_status,
            clinical_label_warning=clinical_label_warning,
        )

    def _generate_structured_observation(self, text: str, categories: List[CaregiverLanguageCategory]) -> str:
        if not categories:
            return f"Observation: {text}"
        cat_str = ", ".join([c.value for c in categories])
        return f"Caregiver language suggests: {cat_str}. Raw: {text}"

    def identify_domain(self, text: str) -> List[DementiaDomain]:
        text_lower = text.lower()
        domains = []

        for domain, keywords in self.DOMAIN_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text_lower:
                    domains.append(domain)
                    break

        if not domains:
            domains = [DementiaDomain.COGNITIVE_BASELINE]

        return domains

    def assess_safety_significance(self, text: str, domains: List[DementiaDomain]) -> Tuple[SafetySignificance, List[str], Dict[str, bool]]:
        text_lower = text.lower()
        concerns = []
        safety_flags = {
            "wandering_risk": False,
            "medication_safety_risk": False,
            "fall_risk": False,
            "appliance_safety_risk": False,
            "driving_safety_risk": False,
        }

        for risk_type, keywords in self.SAFETY_KEYWORDS.items():
            for keyword in keywords:
                if re.search(keyword, text_lower):
                    safety_flags[f"{risk_type}_risk"] = True
                    concerns.append(f"Potential {risk_type.replace('_', ' ')} concern")

        significance = SafetySignificance.LOW
        if any(safety_flags.values()):
            significance = SafetySignificance.HIGH
        elif DementiaDomain.ADLS_IADLS in domains or DementiaDomain.SAFETY_IMPLICATIONS in domains:
            significance = SafetySignificance.MODERATE

        # Upgrade to CRITICAL for high-risk scenarios (night wandering, found far away, etc.)
        if significance == SafetySignificance.HIGH:
            for pattern in self.CRITICAL_SAFETY_PATTERNS:
                if re.search(pattern, text_lower):
                    significance = SafetySignificance.CRITICAL
                    concerns.append("Critical safety scenario detected: immediate action required")
                    break

        return significance, concerns, safety_flags

    def find_matching_baselines(self, person_id: str, domain: DementiaDomain) -> List[DementiaBaselineModel]:
        baselines = self.db.query(DementiaBaselineModel).filter(
            DementiaBaselineModel.person_id == person_id,
            DementiaBaselineModel.domain == domain,
            DementiaBaselineModel.is_active == True,
        ).order_by(DementiaBaselineModel.established_date.desc()).all()
        return baselines

    def compare_to_baseline(self, person_id: str, domain: DementiaDomain, observation_text: str) -> DementiaBaselineComparisonResponse:
        baselines = self.find_matching_baselines(person_id, domain)

        # If no baseline exists for this domain, this is a new change in an unmonitored domain
        if not baselines:
            safety_sig, concerns, _ = self.assess_safety_significance(observation_text, [domain])
            return DementiaBaselineComparisonResponse(
                is_consistent_with_baseline=False,
                deviation_description="No established baseline for this domain; new symptom presentation",
                baseline=None,
                change_type=DementiaChangeType.NEW_CHANGE,
                safety_significance=safety_sig,
                uncertainty="No baseline established for comparison",
                next_action="Establish baseline through caregiver history or clinical assessment",
            )

        baseline = baselines[0]
        baseline_text = baseline.description.lower()
        observation_lower = observation_text.lower()

        # Check for explicit change indicators that override keyword similarity
        change_indicators = [
            r"but today",
            r"but now",
            r"suddenly",
            r"much more",
            r"much worse",
            r"new.*confus",
            r"new.*difficult",
            r"now needs",
            r"now cannot",
            r"first time",
            r"never before",
            r"acute",
            r"sharp.*increase",
            r"sudden",
        ]
        has_change_indicator = any(re.search(pattern, observation_lower) for pattern in change_indicators)

        # Use keyword-based matching for better semantic similarity
        baseline_keywords = set(baseline_text.split())
        observation_keywords = set(observation_lower.split())
        common_words = baseline_keywords & observation_keywords
        
        # Also check for semantic matches
        semantic_matches = 0
        semantic_pairs = [
            ("forgot", "forget"), ("forgot", "forgets"), ("forget", "forgets"),
            ("misplaces", "put"), ("misplaces", "glasses"), ("objects", "glasses"),
            ("names", "where"), ("daily", "again"),
        ]
        for w1, w2 in semantic_pairs:
            if w1 in baseline_keywords and w2 in observation_keywords:
                semantic_matches += 1

        total_matches = len(common_words) + semantic_matches
        baseline_word_count = len(baseline_keywords)
        similarity = total_matches / max(baseline_word_count, 1)

        # Lower threshold for baseline consistency - 0.3 is more reasonable for caregiver language
        # But if there are explicit change indicators, treat as new change regardless of similarity
        if similarity > 0.3 and not has_change_indicator:
            change_type = DementiaChangeType.BASELINE_CONSISTENT
            is_consistent = True
            deviation = "Consistent with established baseline pattern"
        else:
            change_type = DementiaChangeType.NEW_CHANGE
            is_consistent = False
            if has_change_indicator:
                deviation = "New change indicated by caregiver language (e.g., 'but today', 'suddenly')"
            else:
                deviation = "New change relative to established baseline"

        safety_sig, concerns, _ = self.assess_safety_significance(observation_text, [domain])

        uncertainty = None
        if baseline.confidence < 0.5:
            uncertainty = "Baseline confidence is low; comparison reliability limited"

        next_action = "Monitor" if is_consistent else "Further assessment recommended"

        baseline_response = None
        try:
            baseline_response = DementiaBaselineResponse.model_validate(baseline)
        except Exception:
            pass

        return DementiaBaselineComparisonResponse(
            is_consistent_with_baseline=is_consistent,
            deviation_description=deviation,
            baseline=baseline_response,
            change_type=change_type,
            safety_significance=safety_sig,
            uncertainty=uncertainty,
            next_action=next_action,
        )

    def create_baseline(self, baseline_data: DementiaBaselineCreate) -> DementiaBaselineModel:
        baseline = DementiaBaselineModel(
            person_id=baseline_data.person_id,
            baseline_type=baseline_data.baseline_type,
            domain=baseline_data.domain,
            description=baseline_data.description,
            severity=baseline_data.severity,
            frequency=baseline_data.frequency,
            context=baseline_data.context,
            established_date=baseline_data.established_date,
            last_confirmed_date=baseline_data.last_confirmed_date,
            confidence=baseline_data.confidence,
            evidence_ids=baseline_data.evidence_ids,
            caregiver_reports=baseline_data.caregiver_reports,
        )
        self.db.add(baseline)
        self.db.flush()
        return baseline

    def create_observation(self, observation_data: DementiaObservationCreate) -> DementiaObservationModel:
        language_analysis = self.analyze_caregiver_language(observation_data.observation_text)
        domains = self.identify_domain(observation_data.observation_text)
        primary_domain = observation_data.domain or (domains[0] if domains else DementiaDomain.COGNITIVE_BASELINE)

        safety_sig, safety_concerns, safety_flags = self.assess_safety_significance(
            observation_data.observation_text, domains
        )

        fluctuation_pattern = observation_data.fluctuation_pattern or self._detect_fluctuation_pattern(observation_data.observation_text)
        time_of_day = observation_data.time_of_day or self._detect_time_of_day(observation_data.observation_text)

        baseline_comparison = None
        if observation_data.domain:
            baseline_comparison = self.compare_to_baseline(
                observation_data.person_id, primary_domain, observation_data.observation_text
            )

        # Use baseline comparison change_type if available, otherwise use provided change_type
        change_type = baseline_comparison.change_type if baseline_comparison else observation_data.change_type

        observation = DementiaObservationModel(
            person_id=observation_data.person_id,
            domain=primary_domain,
            change_type=change_type,
            observation_text=observation_data.observation_text,
            structured_summary=language_analysis.structured_observation,
            caregiver_id=observation_data.caregiver_id,
            caregiver_language=observation_data.caregiver_language,
            caregiver_language_category=language_analysis.detected_categories[0] if language_analysis.detected_categories else None,
            occurred_at=observation_data.occurred_at,
            observation_window_start=observation_data.observation_window_start,
            observation_window_end=observation_data.observation_window_end,
            fluctuation_pattern=fluctuation_pattern,
            time_of_day=time_of_day,
            compared_to_baseline=baseline_comparison is not None,
            baseline_id=baseline_comparison.baseline.id if baseline_comparison and baseline_comparison.baseline else None,
            deviation_description=baseline_comparison.deviation_description if baseline_comparison else None,
            safety_significance=safety_sig,
            safety_concerns=safety_concerns,
            possible_contributors=[],
            uncertainty_notes=None,
            evidence_ids=observation_data.evidence_ids,
        )
        self.db.add(observation)
        self.db.flush()

        if any(safety_flags.values()):
            safety_event = DementiaSafetyEventModel(
                person_id=observation_data.person_id,
                observation_id=observation.id,
                event_type="safety_concern",
                description=observation_data.observation_text,
                safety_significance=safety_sig,
                immediate_action_required=safety_sig in [SafetySignificance.HIGH, SafetySignificance.CRITICAL],
                recommended_actions=["Assess safety risk", "Consider environmental modifications"],
                **safety_flags,
            )
            self.db.add(safety_event)

        return observation

    def _detect_fluctuation_pattern(self, text: str) -> Optional[FluctuationPattern]:
        text_lower = text.lower()
        if re.search(r"morning.*evening|evening.*morning|all morning.*confused|clear.*confused|normal.*confused", text_lower):
            return FluctuationPattern.MORNING_CLEAR_EVENING_CONFUSED
        if re.search(r"monday.*tuesday|tuesday.*wednesday|alternating|day.*day|one day.*next day", text_lower):
            return FluctuationPattern.ALTERNATING_DAYS
        if "sundown" in text_lower:
            return FluctuationPattern.SUNDOWNING
        if re.search(r"episod|comes and goes|on and off|intermittent", text_lower):
            return FluctuationPattern.EPISODIC
        return None

    def _detect_time_of_day(self, text: str) -> Optional[str]:
        text_lower = text.lower()
        if re.search(r"\b(morning|am)\b", text_lower):
            return "morning"
        if re.search(r"\b(afternoon|pm)\b", text_lower):
            return "afternoon"
        if re.search(r"\b(evening|night|tonight)\b", text_lower):
            return "evening"
        return None

    def assess_change(self, observation: DementiaObservationModel, baseline: Optional[DementiaBaselineModel]) -> DementiaChangeAssessmentModel:
        is_new_change = observation.change_type == DementiaChangeType.NEW_CHANGE

        if observation.fluctuation_pattern == FluctuationPattern.ALTERNATING_DAYS:
            progression_vs_episode = "fluctuation"
            acute_vs_gradual = "fluctuating"
        elif observation.fluctuation_pattern == FluctuationPattern.MORNING_CLEAR_EVENING_CONFUSED:
            progression_vs_episode = "fluctuation"
            acute_vs_gradual = "diurnal fluctuation"
        elif is_new_change:
            progression_vs_episode = "episode"
            acute_vs_gradual = "acute"
        else:
            progression_vs_episode = "progression"
            acute_vs_gradual = "gradual"

        dementia_as_explanation_flag = False
        baseline_erasure_flag = False

        observation_lower = observation.observation_text.lower()
        if "dementia" in observation_lower and ("worse" in observation_lower or "progress" in observation_lower or "declin" in observation_lower):
            if is_new_change:
                dementia_as_explanation_flag = True

        if baseline and not is_new_change:
            baseline_erasure_flag = False

        change_classification = f"{acute_vs_gradual} {progression_vs_episode}"

        assessment = DementiaChangeAssessmentModel(
            person_id=observation.person_id,
            observation_id=observation.id,
            baseline_id=baseline.id if baseline else None,
            is_new_change=is_new_change,
            change_classification=change_classification,
            acute_vs_gradual=acute_vs_gradual,
            progression_vs_episode=progression_vs_episode,
            recurrence_assessment="single" if not observation.fluctuation_pattern else "recurrent",
            cognitive_domain_specific=observation.domain in [
                DementiaDomain.MEMORY, DementiaDomain.ORIENTATION, DementiaDomain.RECOGNITION,
                DementiaDomain.COMMUNICATION, DementiaDomain.JUDGMENT, DementiaDomain.EXECUTIVE_FUNCTION
            ],
            functional_domain_specific=observation.domain == DementiaDomain.ADLS_IADLS,
            behavioral_domain_specific=observation.domain in [
                DementiaDomain.AGITATION, DementiaDomain.WANDERING, DementiaDomain.REPETITIVE_BEHAVIORS,
                DementiaDomain.SLEEP_WAKE_PATTERNS
            ],
            domain_identified=observation.domain,
            safety_significance=observation.safety_significance,
            safety_implications=observation.safety_concerns or [],
            possible_contributing_factors=[],
            uncertainty=observation.uncertainty_notes,
            next_appropriate_action="Monitor and compare to baseline" if not is_new_change else "Clinical assessment recommended",
            dementia_as_explanation_flag=dementia_as_explanation_flag,
            baseline_erasure_flag=baseline_erasure_flag,
        )
        self.db.add(assessment)
        self.db.flush()
        return assessment

    def process_reasoning_request(self, request: DementiaReasoningRequest) -> DementiaReasoningResponse:
        observation_data = DementiaObservationCreate(
            person_id=request.person_id,
            domain=request.domain or DementiaDomain.COGNITIVE_BASELINE,
            change_type=DementiaChangeType.NEW_CHANGE,
            observation_text=request.observation_text,
            caregiver_id=request.caregiver_id,
            occurred_at=request.occurred_at or datetime.now(timezone.utc),
            evidence_ids=request.evidence_ids,
        )
        observation = self.create_observation(observation_data)

        baseline = None
        if observation.baseline_id:
            baseline = self.db.query(DementiaBaselineModel).filter(
                DementiaBaselineModel.id == observation.baseline_id
            ).first()

        assessment = self.assess_change(observation, baseline)

        matched_baselines = self.find_matching_baselines(request.person_id, observation.domain)
        language_analysis = self.analyze_caregiver_language(request.observation_text)

        safety_events = self.db.query(DementiaSafetyEventModel).filter(
            DementiaSafetyEventModel.observation_id == observation.id
        ).all()

        # Multi-observation comparison: look at recent observations in same domain
        recent_observations = self._get_recent_observations(
            request.person_id, observation.domain, days=30
        )
        recent_observations_excl_current = [
            obs for obs in recent_observations if obs.id != observation.id
        ][:5]
        multi_obs_insight = self._compare_against_recent(
            observation, recent_observations_excl_current
        )

        # Build reasoning trace
        reasoning_trace = self._build_reasoning_trace(
            observation=observation,
            baseline=baseline,
            matched_baselines=matched_baselines,
            language_analysis=language_analysis,
            assessment=assessment,
        )

        # Build counterfactuals
        counterfactuals = self._build_counterfactuals(
            observation=observation,
            baseline=baseline,
            matched_baselines=matched_baselines,
        )

        return DementiaReasoningResponse(
            observation=observation,
            assessment=assessment,
            baseline_used=baseline,
            matched_baselines=matched_baselines,
            caregiver_language_analysis=language_analysis.model_dump(),
            safety_events=[{"type": e.event_type, "significance": e.safety_significance.value} for e in safety_events],
            reasoning_trace=reasoning_trace,
            counterfactuals=counterfactuals,
            recent_observations=[
                {
                    "id": obs.id,
                    "date": obs.occurred_at.isoformat() if obs.occurred_at else None,
                    "domain": obs.domain.value,
                    "change_type": obs.change_type.value,
                    "text_snippet": obs.observation_text[:100],
                    "safety_significance": obs.safety_significance.value if obs.safety_significance else None,
                }
                for obs in recent_observations_excl_current
            ],
            multi_observation_insight=multi_obs_insight,
        )

    def _get_recent_observations(
        self, person_id: str, domain: DementiaDomain, days: int = 30
    ) -> List[DementiaObservationModel]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        return self.db.query(DementiaObservationModel).filter(
            DementiaObservationModel.person_id == person_id,
            DementiaObservationModel.domain == domain,
            DementiaObservationModel.occurred_at >= since,
        ).order_by(DementiaObservationModel.occurred_at.desc()).all()

    def _compare_against_recent(
        self,
        current: DementiaObservationModel,
        recent: List[DementiaObservationModel],
    ) -> Optional[Dict[str, Any]]:
        if not recent:
            return None

        current_lower = current.observation_text.lower()
        trends = []
        for obs in recent:
            obs_lower = obs.observation_text.lower()
            baseline_keywords = set(obs_lower.split())
            observation_keywords = set(current_lower.split())
            common_words = baseline_keywords & observation_keywords
            similarity = len(common_words) / max(len(baseline_keywords), 1) if baseline_keywords else 0

            trends.append({
                "observation_id": obs.id,
                "date": obs.occurred_at.isoformat() if obs.occurred_at else None,
                "change_type": obs.change_type.value,
                "similarity_to_current": round(similarity, 3),
                "text_snippet": obs.observation_text[:80],
            })

        avg_similarity = sum(t["similarity_to_current"] for t in trends) / len(trends)
        new_changes = [t for t in trends if t["change_type"] == DementiaChangeType.NEW_CHANGE.value]
        change_frequency = len(new_changes) / len(trends) if trends else 0

        if change_frequency > 0.5 and len(trends) >= 3:
            pattern = "accelerating"
        elif change_frequency > 0.3:
            pattern = "increasing"
        elif avg_similarity > 0.5:
            pattern = "consistent_with_recent"
        else:
            pattern = "variable"

        return {
            "recent_observations_analyzed": len(trends),
            "average_similarity_to_current": round(avg_similarity, 3),
            "new_change_frequency": round(change_frequency, 2),
            "pattern_detected": pattern,
            "insight": self._generate_trend_insight(pattern, len(trends), avg_similarity, change_frequency),
            "trends": trends,
        }

    def _generate_trend_insight(
        self, pattern: str, count: int, avg_similarity: float, change_freq: float
    ) -> str:
        if pattern == "accelerating":
            return f"Recent {count} observations show accelerating changes (new change rate: {change_freq:.0%}). Monitor closely."
        elif pattern == "increasing":
            return f"Recent {count} observations show an increasing trend of new changes. Clinical review recommended."
        elif pattern == "consistent_with_recent":
            return f"Current observation is consistent with {count} recent observations (avg similarity: {avg_similarity:.1%})."
        elif pattern == "variable":
            return f"Observation pattern over {count} recent observations is variable. Context needed for interpretation."
        return f"Analyzed {count} recent observations."

    def generate_care_plan(
        self,
        person_id: str,
        title: str,
        description: Optional[str] = None,
        priority_level: str = "moderate",
        assigned_to: Optional[str] = None,
        due_date: Optional[datetime] = None,
        observation_ids: Optional[List[str]] = None,
        safety_event_ids: Optional[List[str]] = None,
    ) -> DementiaCarePlanModel:
        observations = []
        if observation_ids:
            observations = self.db.query(DementiaObservationModel).filter(
                DementiaObservationModel.id.in_(observation_ids)
            ).all()

        safety_events = []
        if safety_event_ids:
            safety_events = self.db.query(DementiaSafetyEventModel).filter(
                DementiaSafetyEventModel.id.in_(safety_event_ids)
            ).all()

        actions = self._generate_actions(observations, safety_events, description or "")
        actions_json = json.dumps(actions) if actions else None

        care_plan = DementiaCarePlanModel(
            person_id=person_id,
            title=title,
            description=description,
            priority_level=priority_level,
            assigned_to=assigned_to,
            due_date=due_date,
            related_observations=observation_ids or [],
            related_safety_events=safety_event_ids or [],
            actions_json=actions_json,
            status="active",
        )
        self.db.add(care_plan)
        self.db.commit()
        return care_plan

    def _generate_actions(
        self,
        observations: List[DementiaObservationModel],
        safety_events: List[DementiaSafetyEventModel],
        reason: str,
    ) -> List[Dict[str, Any]]:
        actions = []
        safety_urgent = any(
            se.safety_significance in [SafetySignificance.CRITICAL, SafetySignificance.HIGH]
            for se in safety_events
        )

        if safety_urgent:
            actions.append({
                "action_type": "safety_assessment",
                "description": "Conduct immediate safety evaluation and environmental review",
                "priority_level": "critical",
                "timeframe": "within 24 hours",
                "evidence_required": True,
            })
        else:
            for obs in observations:
                if obs.safety_significance == SafetySignificance.HIGH:
                    actions.append({
                        "action_type": "safety_review",
                        "description": f"Review safety concerns in {obs.domain.value} domain",
                        "priority_level": "high",
                        "timeframe": "within 7 days",
                        "target_domain": obs.domain.value,
                    })

        has_new_changes = any(
            obs.change_type == DementiaChangeType.NEW_CHANGE for obs in observations
        )
        if has_new_changes:
            actions.append({
                "action_type": "clinical_review",
                "description": "Schedule clinical assessment for new changes not consistent with baseline",
                "priority_level": "high" if safety_urgent else "moderate",
                "timeframe": "within 2 weeks",
                "evidence_required": True,
            })

        has_fluctuation = any(
            obs.fluctuation_pattern is not None for obs in observations
        )
        if has_fluctuation:
            actions.append({
                "action_type": "pattern_monitoring",
                "description": "Set up daily check-in schedule to track fluctuation patterns",
                "priority_level": "moderate",
                "timeframe": "daily for 2 weeks",
            })

        if not actions:
            actions.append({
                "action_type": "monitoring",
                "description": "Continue routine monitoring and baseline tracking",
                "priority_level": "low",
                "timeframe": "ongoing",
            })

        return actions

    def init_caregiver_onboarding(
        self, person_id: str, caregiver_id: Optional[str] = None
    ) -> DementiaCaregiverOnboardingModel:
        baseline_questions = [
            "What does a typical good day look like for [person]?",
            "What does a typical challenging day look like?",
            "Are there behaviors that happen daily vs. occasionally?",
            "How does [person] communicate when they need help?",
            "What time of day is [person] most alert/confused?",
            "What activities can [person] still do independently?",
            "Has [person] ever wandered or gotten lost?",
            "What triggers agitation or difficult behaviors?",
            "How does [person] sleep at night?",
            "What medications does [person] take regularly?",
        ]
        daily_checkin_questions = [
            "Did [person] seem confused or disoriented today?",
            "Were there any safety incidents?",
            "Any changes in mood or behavior?",
            "Did [person] need help with daily activities?",
        ]
        safety_monitor_items = [
            "Wandering/exit seeking behavior",
            "Stove/appliances left on",
            "Medication adherence",
            "Falls or near-falls",
            "Driving safety",
            "Nighttime wandering",
        ]

        onboarding = DementiaCaregiverOnboardingModel(
            person_id=person_id,
            caregiver_id=caregiver_id,
            status="in_progress",
            baseline_questions_json=json.dumps(baseline_questions),
            baseline_progress_json=json.dumps({}),
            daily_checkin_questions_json=json.dumps(daily_checkin_questions),
            safety_monitor_items_json=json.dumps(safety_monitor_items),
            emergency_contacts_json=json.dumps([]),
        )
        self.db.add(onboarding)
        self.db.commit()
        return onboarding

    def update_onboarding_progress(
        self, person_id: str, domain: str, progress_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        onboarding = self.db.query(DementiaCaregiverOnboardingModel).filter(
            DementiaCaregiverOnboardingModel.person_id == person_id
        ).order_by(DementiaCaregiverOnboardingModel.created_at.desc()).first()

        if not onboarding:
            onboarding = self.init_caregiver_onboarding(person_id)

        progress = json.loads(onboarding.baseline_progress_json or "{}")
        progress[domain] = progress_data
        onboarding.baseline_progress_json = json.dumps(progress)

        if len(progress) >= 6:
            onboarding.status = "baseline_established"

        self.db.commit()
        return json.loads(onboarding.baseline_progress_json or "{}")

    def _build_reasoning_trace(
        self,
        observation: DementiaObservationModel,
        baseline: Optional[DementiaBaselineModel],
        matched_baselines: List[DementiaBaselineModel],
        language_analysis,
        assessment: DementiaChangeAssessmentModel,
    ) -> Dict[str, Any]:
        """Build detailed reasoning trace for auditability and explainability."""
        trace = {
            "observation_id": observation.id,
            "person_id": observation.person_id,
            "domain": observation.domain.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Language analysis trace
        trace["language_analysis"] = {
            "detected_categories": [c.value for c in language_analysis.detected_categories],
            "clinical_label_warning": language_analysis.clinical_label_warning,
            "requires_concrete_evidence": language_analysis.requires_concrete_evidence,
        }

        # Domain identification trace
        trace["domain_identification"] = {
            "identified_domain": observation.domain.value,
            "keywords_matched": self._get_matched_keywords(observation.observation_text, observation.domain),
        }

        # Baseline comparison trace
        if baseline:
            baseline_text = baseline.description.lower()
            observation_lower = observation.observation_text.lower()
            baseline_keywords = set(baseline_text.split())
            observation_keywords = set(observation_lower.split())
            common_words = baseline_keywords & observation_keywords
            similarity = len(common_words) / max(len(baseline_keywords), 1)

            trace["baseline_comparison"] = {
                "baseline_id": baseline.id,
                "baseline_description": baseline.description,
                "baseline_confidence": baseline.confidence,
                "baseline_domain": baseline.domain.value,
                "similarity_score": round(similarity, 3),
                "common_keywords": list(common_words),
                "baseline_keywords": list(baseline_keywords),
                "observation_keywords": list(observation_keywords),
                "threshold_used": 0.3,
                "change_indicators_detected": self._detect_change_indicators(observation.observation_text),
                "result": "consistent" if assessment.is_new_change is False else "new_change",
            }
        else:
            trace["baseline_comparison"] = {
                "baseline_id": None,
                "result": "no_baseline",
                "note": "No established baseline for this domain; treated as new change",
            }

        # Safety assessment trace
        trace["safety_assessment"] = {
            "significance": observation.safety_significance.value if observation.safety_significance else None,
            "concerns": observation.safety_concerns or [],
            "flags": {
                "wandering": any("wander" in c.lower() for c in observation.safety_concerns or []),
                "medication": any("medication" in c.lower() or "pill" in c.lower() for c in observation.safety_concerns or []),
                "fall": any("fall" in c.lower() for c in observation.safety_concerns or []),
                "appliance": any("stove" in c.lower() or "oven" in c.lower() or "appliance" in c.lower() for c in observation.safety_concerns or []),
                "driving": any("driv" in c.lower() for c in observation.safety_concerns or []),
            },
        }

        # Change classification trace
        trace["change_classification"] = {
            "is_new_change": assessment.is_new_change,
            "change_type": assessment.change_classification,
            "acute_vs_gradual": assessment.acute_vs_gradual,
            "progression_vs_episode": assessment.progression_vs_episode,
            "dementia_as_explanation_flag": assessment.dementia_as_explanation_flag,
            "baseline_erasure_flag": assessment.baseline_erasure_flag,
            "domain_specific": {
                "cognitive": assessment.cognitive_domain_specific,
                "functional": assessment.functional_domain_specific,
                "behavioral": assessment.behavioral_domain_specific,
            },
        }

        # Uncertainty trace
        trace["uncertainty"] = {
            "notes": assessment.uncertainty,
            "baseline_confidence": baseline.confidence if baseline else None,
            "language_ambiguity": len(language_analysis.detected_categories) == 0,
        }

        return trace

    def _build_counterfactuals(
        self,
        observation: DementiaObservationModel,
        baseline: Optional[DementiaBaselineModel],
        matched_baselines: List[DementiaBaselineModel],
    ) -> List[Dict[str, Any]]:
        """Generate counterfactual explanations: what would change if baselines were different."""
        counterfactuals = []

        if not baseline:
            counterfactuals.append({
                "scenario": "no_baseline_exists",
                "description": "No baseline established for this domain",
                "current_result": "NEW_CHANGE (no baseline to compare against)",
                "if_baseline_existed": "Would compare against baseline; could be BASELINE_CONSISTENT if similarity > 0.3",
                "action": "Establish baseline through caregiver history or clinical assessment",
            })
            return counterfactuals

        # Current similarity
        baseline_text = baseline.description.lower()
        observation_lower = observation.observation_text.lower()
        baseline_keywords = set(baseline_text.split())
        observation_keywords = set(observation_lower.split())
        common_words = baseline_keywords & observation_keywords
        current_similarity = len(common_words) / max(len(baseline_keywords), 1)
        change_indicators = self._detect_change_indicators(observation.observation_text)
        has_change_indicators = len(change_indicators) > 0

        # Counterfactual 1: Without change indicators
        if has_change_indicators:
            counterfactuals.append({
                "scenario": "remove_change_indicators",
                "description": "If observation lacked explicit change language ('but today', 'suddenly', 'now needs')",
                "current_result": "NEW_CHANGE (change indicators override similarity)",
                "hypothetical_result": "BASELINE_CONSISTENT" if current_similarity > 0.3 else "NEW_CHANGE",
                "hypothetical_similarity": round(current_similarity, 3),
                "change_indicators_removed": change_indicators,
                "insight": "Explicit caregiver language about change overrides keyword similarity",
            })

        # Counterfactual 2: If baseline description were different
        # Show what baseline content would flip the decision
        if current_similarity > 0.3 and not has_change_indicators:
            # Currently consistent - what would make it new?
            counterfactuals.append({
                "scenario": "baseline_missing_key_terms",
                "description": "If baseline didn't include the overlapping terms",
                "current_result": "BASELINE_CONSISTENT",
                "hypothetical_result": "NEW_CHANGE",
                "critical_baseline_terms": list(common_words),
                "insight": f"Baseline terms {list(common_words)} drive consistency; without them, similarity would drop below 0.3",
            })
        elif current_similarity <= 0.3 and not has_change_indicators:
            # Currently new change - what would make it consistent?
            counterfactuals.append({
                "scenario": "baseline_included_observation_terms",
                "description": "If baseline included more terms from current observation",
                "current_result": "NEW_CHANGE (similarity below threshold)",
                "hypothetical_result": "BASELINE_CONSISTENT",
                "missing_terms": list(observation_keywords - baseline_keywords),
                "current_similarity": round(current_similarity, 3),
                "insight": f"Adding observation terms {list(observation_keywords - baseline_keywords)[:5]} to baseline would raise similarity above 0.3",
            })

        # Counterfactual 3: Different domain baseline
        other_baselines = [b for b in matched_baselines if b.id != baseline.id]
        for other in other_baselines[:2]:  # Limit to 2 alternatives
            other_text = other.description.lower()
            other_keywords = set(other_text.split())
            other_common = other_keywords & observation_keywords
            other_similarity = len(other_common) / max(len(other_keywords), 1)
            counterfactuals.append({
                "scenario": f"compared_to_{other.domain.value}_baseline",
                "description": f"If compared against {other.domain.value} baseline instead",
                "current_result": f"{'BASELINE_CONSISTENT' if not assessment.is_new_change else 'NEW_CHANGE'} (vs {baseline.domain.value})",
                "hypothetical_result": "BASELINE_CONSISTENT" if other_similarity > 0.3 and not has_change_indicators else "NEW_CHANGE",
                "hypothetical_similarity": round(other_similarity, 3),
                "insight": f"Different domain baseline yields different similarity ({round(other_similarity, 3)} vs {round(current_similarity, 3)})",
            })

        # Counterfactual 4: Threshold sensitivity
        counterfactuals.append({
            "scenario": "threshold_sensitivity",
            "description": "How decision changes with different similarity thresholds",
            "current_threshold": 0.3,
            "current_similarity": round(current_similarity, 3),
            "at_0_2": "BASELINE_CONSISTENT" if current_similarity > 0.2 else "NEW_CHANGE",
            "at_0_4": "BASELINE_CONSISTENT" if current_similarity > 0.4 else "NEW_CHANGE",
            "at_0_5": "BASELINE_CONSISTENT" if current_similarity > 0.5 else "NEW_CHANGE",
            "insight": f"Decision is {'stable' if (current_similarity > 0.4 or current_similarity < 0.2) else 'threshold-sensitive'} around current threshold",
        })

        return counterfactuals

    def _get_matched_keywords(self, text: str, domain: DementiaDomain) -> List[str]:
        """Get domain-specific keywords matched in text."""
        text_lower = text.lower()
        domain_keywords = self.DOMAIN_KEYWORDS.get(domain, [])
        return [kw for kw in domain_keywords if kw in text_lower]

    def _detect_change_indicators(self, text: str) -> List[str]:
        """Detect explicit change indicator phrases."""
        text_lower = text.lower()
        patterns = [
            "but today", "but now", "suddenly", "much more", "much worse",
            "new confus", "new difficult", "now needs", "now cannot",
            "first time", "never before", "acute", "sharp increase",
            "sudden", "worse than", "different from", "not like before",
        ]
        return [p for p in patterns if p in text_lower]

    def get_summary(self, person_id: str) -> DementiaReasoningSummary:
        baselines = self.db.query(DementiaBaselineModel).filter(
            DementiaBaselineModel.person_id == person_id,
            DementiaBaselineModel.is_active == True,
        ).count()

        recent_obs = self.db.query(DementiaObservationModel).filter(
            DementiaObservationModel.person_id == person_id,
            DementiaObservationModel.occurred_at >= datetime.now(timezone.utc) - timedelta(days=30),
        ).count()

        new_changes = self.db.query(DementiaChangeAssessmentModel).filter(
            DementiaChangeAssessmentModel.person_id == person_id,
            DementiaChangeAssessmentModel.is_new_change == True,
            DementiaChangeAssessmentModel.assessed_at >= datetime.now(timezone.utc) - timedelta(days=30),
        ).count()

        fluctuations = self.db.query(DementiaObservationModel).filter(
            DementiaObservationModel.person_id == person_id,
            DementiaObservationModel.fluctuation_pattern.isnot(None),
            DementiaObservationModel.occurred_at >= datetime.now(timezone.utc) - timedelta(days=30),
        ).count()

        progressions = self.db.query(DementiaChangeAssessmentModel).filter(
            DementiaChangeAssessmentModel.person_id == person_id,
            DementiaChangeAssessmentModel.progression_vs_episode == "progression",
            DementiaChangeAssessmentModel.assessed_at >= datetime.now(timezone.utc) - timedelta(days=30),
        ).count()

        safety_events = self.db.query(DementiaSafetyEventModel).filter(
            DementiaSafetyEventModel.person_id == person_id,
            DementiaSafetyEventModel.created_at >= datetime.now(timezone.utc) - timedelta(days=30),
        ).count()

        disagreements = self.db.query(DementiaCaregiverDisagreementModel).filter(
            DementiaCaregiverDisagreementModel.person_id == person_id,
            DementiaCaregiverDisagreementModel.resolution_status == "unresolved",
        ).count()

        last_assessed = self.db.query(DementiaChangeAssessmentModel).filter(
            DementiaChangeAssessmentModel.person_id == person_id
        ).order_by(DementiaChangeAssessmentModel.assessed_at.desc()).first()

        return DementiaReasoningSummary(
            person_id=person_id,
            active_baselines_count=baselines,
            recent_observations_count=recent_obs,
            new_changes_detected=new_changes,
            fluctuations_detected=fluctuations,
            progressions_detected=progressions,
            safety_events_count=safety_events,
            caregiver_disagreements_count=disagreements,
            last_assessed_at=last_assessed.assessed_at if last_assessed else None,
        )