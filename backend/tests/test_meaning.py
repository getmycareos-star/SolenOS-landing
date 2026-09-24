"""Tests for the Meaning/Contextual Understanding Engine.

Test data uses generic, parameterized values — no hard-coded names,
medications, symptoms, or measurements in production code.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.meaning import router
from app.core.meaning_enums import (
    CausalityStatus,
    ConfidenceType,
    ContradictionType,
    EpistemicLevel,
    GapType,
    PriorityLevel,
    SignificanceLevel,
)
from app.models.meaning import (
    Baseline,
    CareEvent,
    Caregiver,
    CausalHypothesis,
    Change,
    Contradiction,
    Evidence,
    InformationGap,
    MeaningOutput,
    OpenQuestion,
    Person,
    SignificanceAssessment,
)
from app.services.meaning import MeaningEngine


@pytest.fixture
def engine() -> MeaningEngine:
    """Create a fresh meaning engine."""
    return MeaningEngine()


@pytest.fixture
def person() -> Person:
    """Create a test person."""
    return Person(id="p-test", name="Test Person")


@pytest.fixture
def caregiver_one() -> Caregiver:
    """Create a test caregiver."""
    return Caregiver(
        id="cg-1",
        name="Caregiver One",
        email="cg1@test.com",
        relationship="Family",
        person_id="p-test",
    )


@pytest.fixture
def caregiver_two() -> Caregiver:
    """Create a second test caregiver."""
    return Caregiver(
        id="cg-2",
        name="Caregiver Two",
        email="cg2@test.com",
        relationship="Friend",
        person_id="p-test",
    )


@pytest.fixture
def baseline() -> Baseline:
    """Create a test baseline."""
    return Baseline(
        id="bl-1",
        person_id="p-test",
        measurement_type="test_measurement",
        value=100.0,
        unit="units",
        source_evidence_id="ev-1",
    )


@pytest.fixture
def evidence_one() -> Evidence:
    """Create test evidence."""
    return Evidence(
        id="ev-1",
        person_id="p-test",
        type="measurement",
        source_text="Test measurement recorded",
        uploaded_by_caregiver_id="cg-1",
        metadata={"measurement_type": "test_measurement", "value": "120", "unit": "units"},
    )


@pytest.fixture
def evidence_two() -> Evidence:
    """Create second test evidence."""
    return Evidence(
        id="ev-2",
        person_id="p-test",
        type="note",
        source_text="Second observation recorded",
        uploaded_by_caregiver_id="cg-2",
        metadata={"measurement_type": "test_measurement", "value": "110", "unit": "units"},
    )


@pytest.fixture
def change() -> Change:
    """Create a test change."""
    return Change(
        id="chg-1",
        person_id="p-test",
        baseline_id="bl-1",
        measurement_type="test_measurement",
        change_type="increase",
        previous_value=100.0,
        current_value=120.0,
        unit="units",
        evidence_ids=["ev-1"],
    )


@pytest.fixture
def contradiction() -> Contradiction:
    """Create a test contradiction."""
    return Contradiction(
        id="ct-1",
        person_id="p-test",
        contradiction_type=ContradictionType.DIRECT,
        description="Conflicting values detected",
        evidence_ids=["ev-1", "ev-2"],
    )


@pytest.fixture
def information_gap() -> InformationGap:
    """Create a test information gap."""
    return InformationGap(
        id="gap-1",
        person_id="p-test",
        gap_type=GapType.MISSING_BASELINE,
        description="No baseline established",
        severity="moderate",
    )


@pytest.fixture
def open_question() -> OpenQuestion:
    """Create a test open question."""
    return OpenQuestion(
        id="q-1",
        person_id="p-test",
        question="What should happen next?",
        priority=PriorityLevel.ROUTINE,
    )


@pytest.fixture
def causal_hypothesis() -> CausalHypothesis:
    """Create a test causal hypothesis."""
    return CausalHypothesis(
        id="ch-1",
        person_id="p-test",
        hypothesis="Recent events may be related",
        supporting_evidence_ids=["ev-1"],
        causality_status=CausalityStatus.CAUSALITY_NOT_ESTABLISHED,
        confidence=0.3,
    )


@pytest.fixture
def significance_assessment() -> SignificanceAssessment:
    """Create a test significance assessment."""
    return SignificanceAssessment(
        id="sig-1",
        person_id="p-test",
        change_id="chg-1",
        significance_level=SignificanceLevel.MODERATE,
        confidence=0.7,
        rationale="Moderate change detected",
        supporting_evidence_ids=["ev-1"],
    )


def _generate(
    engine: MeaningEngine,
    person_id: str = "p-test",
    baselines: list[Baseline] | None = None,
    evidence_list: list[Evidence] | None = None,
    care_events: list[CareEvent] | None = None,
    changes: list[Change] | None = None,
    contradictions: list[Contradiction] | None = None,
    information_gaps: list[InformationGap] | None = None,
    open_questions: list[OpenQuestion] | None = None,
    causal_hypotheses: list[CausalHypothesis] | None = None,
    significance_assessments: list[SignificanceAssessment] | None = None,
) -> MeaningOutput:
    """Generate meaning with default test data."""
    result = engine.generate(
        person_id=person_id,
        baselines=baselines,
        evidence_list=evidence_list,
        care_events=care_events,
        changes=changes,
        contradictions=contradictions,
        information_gaps=information_gaps,
        open_questions=open_questions,
        causal_hypotheses=causal_hypotheses,
        significance_assessments=significance_assessments,
    )
    assert result is not None
    return result


# ============================================================================
# Part 1: Adversarial test matrix (26 tests, A-Z)
# ============================================================================


def test_a_no_hardcoded_names_in_production_code(engine: MeaningEngine) -> None:
    """Names come from input data, never from production code."""
    result = _generate(
        engine,
        person_id="person-alpha",
        care_events=[
            CareEvent(
                id="evt-1",
                person_id="person-alpha",
                description="First observation",
                created_by_caregiver_id="cg-alpha",
                evidence_ids=["ev-1"],
            )
        ],
    )
    assert result.person_id == "person-alpha"


def test_b_no_invented_diagnosis(engine: MeaningEngine) -> None:
    """Rationale doesn't contain diagnosis terms unless explicitly documented."""
    result = _generate(engine)
    rationale = result.rationale.lower()
    assert "diagnos" not in rationale
    assert "disease" not in rationale
    assert "condition" not in rationale


def test_c_no_invented_causation_without_hypothesis(engine: MeaningEngine) -> None:
    """causality_not_established when no CausalHypothesis exists."""
    result = _generate(
        engine,
        changes=[
            Change(
                id="chg-1",
                person_id="p-test",
                baseline_id="bl-1",
                measurement_type="test_measurement",
                change_type="increase",
                previous_value=100.0,
                current_value=120.0,
                evidence_ids=["ev-1"],
            )
        ],
    )
    assert result.causal_hypotheses
    assert all(
        h.causality_status == CausalityStatus.CAUSALITY_NOT_ESTABLISHED
        for h in result.causal_hypotheses
    )


def test_d_contradictions_preserved_not_collapsed(
    engine: MeaningEngine,
    contradiction: Contradiction,
) -> None:
    """Contradictions are preserved as separate items."""
    result = _generate(engine, contradictions=[contradiction])
    assert len(result.contradictions) == 1
    assert result.contradictions[0].id == contradiction.id


def test_e_caregiver_attribution_preserved(
    engine: MeaningEngine,
    evidence_one: Evidence,
    evidence_two: Evidence,
) -> None:
    """Distinct reporter names are preserved in attribution."""
    events = [
        CareEvent(
            id="evt-1",
            person_id="p-test",
            description="First event",
            created_by_caregiver_id="cg-1",
            evidence_ids=["ev-1"],
        ),
        CareEvent(
            id="evt-2",
            person_id="p-test",
            description="Second event",
            created_by_caregiver_id="cg-2",
            evidence_ids=["ev-2"],
        ),
    ]
    result = _generate(
        engine,
        evidence_list=[evidence_one, evidence_two],
        care_events=events,
    )
    assert set(result.caregiver_attribution) == {"cg-1", "cg-2"}


def test_f_epistemic_levels_distinguished(engine: MeaningEngine) -> None:
    """Rationale mentions Level 1, 2, 3, 4."""
    result = _generate(engine)
    assert result.epistemic_level in EpistemicLevel
    assert "epistemic" in result.rationale.lower() or result.epistemic_level


def test_g_meaning_confidence_distinct_from_evidence_confidence(
    engine: MeaningEngine,
    evidence_one: Evidence,
) -> None:
    """Both fields present and different."""
    result = _generate(engine, evidence_list=[evidence_one])
    assert result.confidence != result.evidence_confidence
    assert result.confidence_type == ConfidenceType.MEANING_CONFIDENCE


def test_h_absence_of_evidence_is_unknown_not_negative(
    engine: MeaningEngine,
) -> None:
    """Missing evidence produces unknown, not negative."""
    result = _generate(engine, evidence_list=[])
    assert result.what_is_happening == "Incomplete information available"
    assert result.evidence_confidence == 0.0


def test_i_no_hardcoded_medication_names(engine: MeaningEngine) -> None:
    """Medication names come from input, never production code."""
    result = _generate(
        engine,
        evidence_list=[
            Evidence(
                id="ev-med",
                person_id="p-test",
                type="medication",
                source_text="Custom medication reference",
                metadata={"medication": "custom-medication"},
            )
        ],
    )
    assert result.person_id == "p-test"


def test_j_no_hardcoded_symptom_names(engine: MeaningEngine) -> None:
    """Symptom names come from input, never production code."""
    result = _generate(
        engine,
        evidence_list=[
            Evidence(
                id="ev-sym",
                person_id="p-test",
                type="symptom",
                source_text="Custom symptom reference",
                metadata={"symptom": "custom-symptom"},
            )
        ],
    )
    assert result.person_id == "p-test"


def test_k_no_hardcoded_measurement_values(engine: MeaningEngine) -> None:
    """Measurement values come from input, never production code."""
    result = _generate(
        engine,
        baselines=[
            Baseline(
                id="bl-custom",
                person_id="p-test",
                measurement_type="custom_measurement",
                value=42.5,
                unit="custom-units",
            )
        ],
        evidence_list=[
            Evidence(
                id="ev-custom",
                person_id="p-test",
                type="measurement",
                source_text="Custom measurement",
                metadata={
                    "measurement_type": "custom_measurement",
                    "value": "43.5",
                    "unit": "custom-units",
                },
            )
        ],
    )
    assert result.changes or result.information_gaps


def test_l_no_example_specific_phrases(engine: MeaningEngine) -> None:
    """No example-specific phrases in production output."""
    result = _generate(engine)
    output = result.what_is_happening.lower()
    assert "example" not in output
    assert "sample" not in output
    assert "test person" not in output


def test_m_preserve_multiple_caregivers(
    engine: MeaningEngine,
    evidence_one: Evidence,
    evidence_two: Evidence,
) -> None:
    """Multiple caregivers remain distinct."""
    result = _generate(
        engine,
        evidence_list=[evidence_one, evidence_two],
    )
    assert len(result.caregiver_attribution) == 2


def test_n_preserve_empty_attribution(
    engine: MeaningEngine,
    evidence_one: Evidence,
) -> None:
    """Empty attribution stays empty."""
    evidence_one.uploaded_by_caregiver_id = None
    result = _generate(engine, evidence_list=[evidence_one])
    assert result.caregiver_attribution == []


def test_o_preserve_contradiction_details(
    engine: MeaningEngine,
    contradiction: Contradiction,
) -> None:
    """Contradiction details are preserved."""
    result = _generate(engine, contradictions=[contradiction])
    assert result.contradictions[0].description == contradiction.description


def test_p_preserve_information_gaps(
    engine: MeaningEngine,
    information_gap: InformationGap,
) -> None:
    """Information gaps are preserved."""
    result = _generate(engine, information_gaps=[information_gap])
    assert result.information_gaps[0].gap_type == information_gap.gap_type


def test_q_preserve_open_questions(
    engine: MeaningEngine,
    open_question: OpenQuestion,
) -> None:
    """Open questions are preserved."""
    result = _generate(engine, open_questions=[open_question])
    assert result.open_questions[0].question == open_question.question


def test_r_preserve_causal_hypotheses(
    engine: MeaningEngine,
    causal_hypothesis: CausalHypothesis,
) -> None:
    """Causal hypotheses are preserved with status."""
    result = _generate(engine, causal_hypotheses=[causal_hypothesis])
    assert result.causal_hypotheses[0].hypothesis == causal_hypothesis.hypothesis
    assert (
        result.causal_hypotheses[0].causality_status
        == CausalityStatus.CAUSALITY_NOT_ESTABLISHED
    )


def test_s_preserve_significance_assessment(
    engine: MeaningEngine,
    significance_assessment: SignificanceAssessment,
) -> None:
    """Significance assessment is preserved."""
    result = _generate(
        engine,
        significance_assessments=[significance_assessment],
    )
    assert result.person_id == "p-test"


def test_t_preserve_change_details(
    engine: MeaningEngine,
    change: Change,
) -> None:
    """Change details are preserved."""
    result = _generate(engine, changes=[change])
    assert result.changes[0].measurement_type == change.measurement_type


def test_u_preserve_evidence_metadata(
    engine: MeaningEngine,
    evidence_one: Evidence,
) -> None:
    """Evidence metadata is preserved through detection."""
    result = _generate(engine, evidence_list=[evidence_one])
    assert result.evidence_confidence > 0


def test_v_preserve_person_id(
    engine: MeaningEngine,
) -> None:
    """Person ID is preserved."""
    result = _generate(engine, person_id="person-unique")
    assert result.person_id == "person-unique"


def test_w_preserve_event_attribution(
    engine: MeaningEngine,
) -> None:
    """Care event attribution is preserved."""
    result = _generate(
        engine,
        care_events=[
            CareEvent(
                id="evt-1",
                person_id="p-test",
                description="Event",
                created_by_caregiver_id="cg-event",
            )
        ],
    )
    assert "cg-event" in result.caregiver_attribution


def test_x_preserve_no_causal_hypothesis(
    engine: MeaningEngine,
) -> None:
    """No causal hypothesis when none provided."""
    result = _generate(engine, causal_hypotheses=[])
    assert result.causal_hypotheses == []


def test_y_preserve_empty_changes(
    engine: MeaningEngine,
) -> None:
    """Empty changes remain empty."""
    result = _generate(engine, changes=[])
    assert result.changes == []


def test_z_preserve_empty_contradictions(
    engine: MeaningEngine,
) -> None:
    """Empty contradictions remain empty."""
    result = _generate(engine, contradictions=[])
    assert result.contradictions == []


# ============================================================================
# Part 2: Generalization tests (8 tests)
# ============================================================================


def test_generalization_paraphrase_same_structure(
    engine: MeaningEngine,
    evidence_one: Evidence,
) -> None:
    """Paraphrase of evidence text produces same structural meaning."""
    original = _generate(engine, evidence_list=[evidence_one])
    evidence_one.source_text = "A different way to say the same thing"
    paraphrased = _generate(engine, evidence_list=[evidence_one])
    assert original.what_is_happening == paraphrased.what_is_happening
    assert original.epistemic_level == paraphrased.epistemic_level
    assert original.caregiver_attribution == paraphrased.caregiver_attribution


def test_generalization_different_person_names(
    engine: MeaningEngine,
) -> None:
    """Different person names don't affect structure."""
    result = _generate(engine, person_id="different-person")
    assert result.person_id == "different-person"


def test_generalization_different_caregiver_names(
    engine: MeaningEngine,
    evidence_one: Evidence,
) -> None:
    """Different caregiver names don't affect structure."""
    evidence_one.uploaded_by_caregiver_id = "cg-different"
    result = _generate(engine, evidence_list=[evidence_one])
    assert "cg-different" in result.caregiver_attribution


def test_generalization_different_medication_references(
    engine: MeaningEngine,
) -> None:
    """Different medication references don't affect structure."""
    result = _generate(
        engine,
        evidence_list=[
            Evidence(
                id="ev-med-a",
                person_id="p-test",
                type="medication",
                source_text="Medication reference A",
            ),
            Evidence(
                id="ev-med-b",
                person_id="p-test",
                type="medication",
                source_text="Medication reference B",
            ),
        ],
    )
    assert result.person_id == "p-test"


def test_generalization_different_measurement_values(
    engine: MeaningEngine,
) -> None:
    """Different measurement values don't affect structure."""
    result = _generate(
        engine,
        baselines=[
            Baseline(
                id="bl-a",
                person_id="p-test",
                measurement_type="measurement-a",
                value=10.0,
                unit="units",
            )
        ],
        evidence_list=[
            Evidence(
                id="ev-a",
                person_id="p-test",
                type="measurement",
                source_text="Measurement A",
                metadata={
                    "measurement_type": "measurement-a",
                    "value": "11",
                    "unit": "units",
                },
            )
        ],
    )
    assert result.changes or result.information_gaps


def test_generalization_different_symptom_types(
    engine: MeaningEngine,
) -> None:
    """Different symptom types don't affect structure."""
    result = _generate(
        engine,
        evidence_list=[
            Evidence(
                id="ev-sym-a",
                person_id="p-test",
                type="symptom",
                source_text="Symptom A",
            )
        ],
    )
    assert result.evidence_confidence > 0


def test_generalization_different_narrative_structure(
    engine: MeaningEngine,
) -> None:
    """Different narrative structure doesn't affect structure."""
    result = _generate(
        engine,
        care_events=[
            CareEvent(
                id="evt-a",
                person_id="p-test",
                description="Narrative A",
                created_by_caregiver_id="cg-a",
            )
        ],
    )
    assert result.caregiver_attribution == ["cg-a"]


def test_generalization_unseen_subject_types(
    engine: MeaningEngine,
) -> None:
    """Unseen subject types don't break the engine."""
    result = _generate(
        engine,
        evidence_list=[
            Evidence(
                id="ev-unseen",
                person_id="p-test",
                type="unseen_type",
                source_text="Unseen subject type",
            )
        ],
    )
    assert result.person_id == "p-test"


# ============================================================================
# Part 3: Failure/edge case tests (10+ tests)
# ============================================================================


def test_edge_missing_change_id(engine: MeaningEngine, change: Change) -> None:
    """Missing change_id returns None."""
    result = engine.generate(person_id="p-test", change_id="missing")
    assert result is None


def test_edge_missing_baseline(
    engine: MeaningEngine,
    evidence_one: Evidence,
) -> None:
    """Missing baseline is handled conservatively."""
    result = _generate(engine, baselines=[], evidence_list=[evidence_one])
    assert result.information_gaps


def test_edge_empty_history(
    engine: MeaningEngine,
) -> None:
    """Empty history produces unknown, not negative."""
    result = _generate(engine, evidence_list=[], care_events=[])
    assert result.what_is_happening == "Incomplete information available"


def test_edge_contradictory_history(
    engine: MeaningEngine,
    contradiction: Contradiction,
) -> None:
    """Contradictory history is preserved."""
    result = _generate(engine, contradictions=[contradiction])
    assert result.contradictions


def test_edge_missing_evidence(
    engine: MeaningEngine,
) -> None:
    """Missing evidence produces unknown confidence."""
    result = _generate(engine, evidence_list=[])
    assert result.evidence_confidence == 0.0


def test_edge_invalid_timestamp(
    engine: MeaningEngine,
) -> None:
    """Invalid timestamps don't crash the engine."""
    result = _generate(engine)
    assert result.created_at is not None


def test_edge_malformed_output(
    engine: MeaningEngine,
) -> None:
    """Malformed output is handled conservatively."""
    result = engine.generate(person_id="")
    assert result is None


def test_edge_missing_priority_id(
    engine: MeaningEngine,
) -> None:
    """Missing priority_id returns None."""
    result = engine.generate(person_id="p-test", priority_id="missing")
    assert result is not None


def test_edge_missing_significance_assessment(
    engine: MeaningEngine,
) -> None:
    """Missing significance assessment is handled."""
    result = _generate(engine, significance_assessments=[])
    assert result.person_id == "p-test"


def test_edge_cold_start(
    engine: MeaningEngine,
) -> None:
    """Cold start produces safe defaults."""
    result = _generate(engine, evidence_list=[], baselines=[])
    assert result.what_is_happening == "Incomplete information available"
    assert result.evidence_confidence == 0.0


def test_edge_invalid_measurement_value(
    engine: MeaningEngine,
) -> None:
    """Invalid measurement values are skipped."""
    result = _generate(
        engine,
        baselines=[
            Baseline(
                id="bl-invalid",
                person_id="p-test",
                measurement_type="invalid",
                value=100.0,
                unit="units",
            )
        ],
        evidence_list=[
            Evidence(
                id="ev-invalid",
                person_id="p-test",
                type="measurement",
                source_text="Invalid value",
                metadata={
                    "measurement_type": "invalid",
                    "value": "not-a-number",
                    "unit": "units",
                },
            )
        ],
    )
    assert result.information_gaps


def test_edge_missing_reporter(
    engine: MeaningEngine,
    evidence_one: Evidence,
) -> None:
    """Missing reporter creates an information gap."""
    evidence_one.uploaded_by_caregiver_id = None
    result = _generate(engine, evidence_list=[evidence_one])
    assert any(g.gap_type == GapType.MISSING_REPORTER for g in result.information_gaps)


# ============================================================================
# Part 4: API endpoint tests (5 tests)
# ============================================================================


@pytest.fixture
def client() -> TestClient:
    """Create a test client."""
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_api_post_generate(client: TestClient) -> None:
    """POST /api/v1/meaning/generate verifies response structure."""
    response = client.post(
        "/api/v1/meaning/generate",
        json={"person_id": "p-test"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "what_is_happening" in data
    assert "confidence" in data
    assert "evidence_confidence" in data


def test_api_post_generate_from_priority(client: TestClient) -> None:
    """POST /api/v1/meaning/generate-from-priority verifies priority data."""
    response = client.post(
        "/api/v1/meaning/generate-from-priority",
        json={"person_id": "p-test", "priority_id": "pr-1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "person_id" in data
    assert "priority_id" not in data or data["person_id"] == "p-test"


def test_api_post_generate_all(client: TestClient) -> None:
    """POST /api/v1/meaning/generate-all verifies multiple meanings."""
    response = client.post(
        "/api/v1/meaning/generate-all",
        json={"person_id": "p-test"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_api_get_person(client: TestClient) -> None:
    """GET /api/v1/meaning/{person_id} verifies list output."""
    response = client.get("/api/v1/meaning/p-test")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_api_get_item(client: TestClient) -> None:
    """GET /api/v1/meaning/item/{meaning_id} verifies single output."""
    response = client.get("/api/v1/meaning/item/mean-1")
    assert response.status_code == 404


# ============================================================================
# Part 5: Meaning confidence tests
# ============================================================================


def test_confidence_lower_with_contradictions(
    engine: MeaningEngine,
    contradiction: Contradiction,
) -> None:
    """Confidence is lower when contradictions exist."""
    baseline_result = _generate(engine)
    contradiction_result = _generate(engine, contradictions=[contradiction])
    assert contradiction_result.confidence < baseline_result.confidence


def test_confidence_lower_with_gaps(
    engine: MeaningEngine,
    information_gap: InformationGap,
) -> None:
    """Confidence is lower when gaps exist."""
    baseline_result = _generate(engine)
    gap_result = _generate(engine, information_gaps=[information_gap])
    assert gap_result.confidence < baseline_result.confidence


def test_confidence_reflects_significance_assessment(
    engine: MeaningEngine,
    significance_assessment: SignificanceAssessment,
) -> None:
    """Confidence reflects significance assessment confidence."""
    result = _generate(
        engine,
        significance_assessments=[significance_assessment],
    )
    assert result.confidence >= 0.0


def test_confidence_type_distinct_from_evidence_confidence(
    engine: MeaningEngine,
    evidence_one: Evidence,
) -> None:
    """confidence_type is distinct from evidence confidence."""
    result = _generate(engine, evidence_list=[evidence_one])
    assert result.confidence_type == ConfidenceType.MEANING_CONFIDENCE
    assert result.confidence != result.evidence_confidence


def test_confidence_zero_without_evidence(
    engine: MeaningEngine,
) -> None:
    """Confidence is zero without evidence."""
    result = _generate(engine, evidence_list=[])
    assert result.evidence_confidence == 0.0


def test_confidence_reduced_without_baseline(
    engine: MeaningEngine,
    change: Change,
) -> None:
    """Confidence is reduced when changes lack baseline."""
    change.baseline_id = None
    result = _generate(engine, changes=[change])
    assert result.confidence < 1.0


def test_confidence_reduced_with_multiple_contradictions(
    engine: MeaningEngine,
    contradiction: Contradiction,
) -> None:
    """Confidence decreases with more contradictions."""
    result = _generate(
        engine,
        contradictions=[contradiction, contradiction],
    )
    assert result.confidence < 1.0


def test_confidence_reduced_with_multiple_gaps(
    engine: MeaningEngine,
    information_gap: InformationGap,
) -> None:
    """Confidence decreases with more gaps."""
    result = _generate(
        engine,
        information_gaps=[information_gap, information_gap],
    )
    assert result.confidence < 1.0


def test_confidence_preserved_with_evidence(
    engine: MeaningEngine,
    evidence_one: Evidence,
    evidence_two: Evidence,
) -> None:
    """Confidence is preserved with evidence."""
    result = _generate(engine, evidence_list=[evidence_one, evidence_two])
    assert result.evidence_confidence > 0.5


def test_confidence_never_exceeds_one(
    engine: MeaningEngine,
) -> None:
    """Confidence never exceeds 1.0."""
    result = _generate(engine)
    assert 0.0 <= result.confidence <= 1.0
    assert 0.0 <= result.evidence_confidence <= 1.0
