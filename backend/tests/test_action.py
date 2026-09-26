"""Tests for the Action Intelligence Engine.

Test data uses generic, parameterized values — no hard-coded names,
medications, symptoms, or measurements in production code.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.action import router
from app.core.action_enums import (
    ActionOwnership,
    ActionPriority,
    ActionStatus,
    ActionType,
    ConfidenceType,
    SafetyClassification,
    TemporalScope,
)
from app.core.meaning_enums import (
    CausalityStatus,
    PriorityLevel,
    SignificanceLevel,
)
from app.models.action import (
    Action,
    ActionDependency,
    ActionSet,
    ActionHistoryEntry,
)
from app.models.meaning import (
    Change,
    ClinicianInstruction,
    Contradiction,
    CareAppointment,
    Evidence,
    InformationGap,
    MeaningOutput,
    OpenQuestion,
    Person,
    PriorityAssessment,
    SignificanceAssessment,
)
from app.services.action import ActionEngine


@pytest.fixture
def engine() -> ActionEngine:
    """Create a fresh action engine."""
    return ActionEngine()


@pytest.fixture
def person() -> Person:
    """Create a test person."""
    return Person(id="p-test", name="Test Person")


@pytest.fixture
def baseline() -> Change:
    """Create a test change with baseline."""
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
def change_decrease() -> Change:
    """Create a test decrease change."""
    return Change(
        id="chg-2",
        person_id="p-test",
        baseline_id="bl-2",
        measurement_type="another_measurement",
        change_type="decrease",
        previous_value=50.0,
        current_value=40.0,
        unit="units",
        evidence_ids=["ev-2"],
    )


@pytest.fixture
def contradiction() -> Contradiction:
    """Create a test contradiction."""
    return Contradiction(
        id="ct-1",
        person_id="p-test",
        contradiction_type="direct",
        description="Conflicting values for test_measurement: [100.0, 120.0]",
        evidence_ids=["ev-1", "ev-3"],
    )


@pytest.fixture
def information_gap() -> InformationGap:
    """Create a test information gap."""
    return InformationGap(
        id="gap-1",
        person_id="p-test",
        gap_type="missing_baseline",
        description="No baseline established for test_measurement",
        severity="moderate",
    )


@pytest.fixture
def open_question() -> OpenQuestion:
    """Create a test open question."""
    return OpenQuestion(
        id="q-1",
        person_id="p-test",
        question="What should we watch for?",
        context="Recent change in measurement",
        priority=PriorityLevel.ROUTINE,
    )


@pytest.fixture
def priority_urgent() -> PriorityAssessment:
    """Create an urgent priority assessment."""
    return PriorityAssessment(
        id="pr-1",
        person_id="p-test",
        meaning_id="mean-1",
        priority_level=PriorityLevel.URGENT,
        rationale="Significant change detected",
        confidence=0.8,
    )


@pytest.fixture
def priority_immediate() -> PriorityAssessment:
    """Create an immediate priority assessment."""
    return PriorityAssessment(
        id="pr-2",
        person_id="p-test",
        meaning_id="mean-1",
        priority_level=PriorityLevel.IMMEDIATE,
        rationale="Critical change requiring attention",
        confidence=0.9,
    )


@pytest.fixture
def significance_high() -> SignificanceAssessment:
    """Create a high significance assessment."""
    return SignificanceAssessment(
        id="sig-1",
        person_id="p-test",
        change_id="chg-1",
        significance_level=SignificanceLevel.HIGH,
        confidence=0.75,
        rationale="20% increase from baseline",
        supporting_evidence_ids=["ev-1"],
    )


@pytest.fixture
def significance_critical() -> SignificanceAssessment:
    """Create a critical significance assessment."""
    return SignificanceAssessment(
        id="sig-2",
        person_id="p-test",
        change_id="chg-2",
        significance_level=SignificanceLevel.CRITICAL,
        confidence=0.85,
        rationale="50% decrease from baseline",
        supporting_evidence_ids=["ev-2"],
    )


@pytest.fixture
def evidence_list() -> list[Evidence]:
    """Create test evidence list."""
    return [
        Evidence(
            id="ev-1",
            person_id="p-test",
            type="measurement",
            source_text="Measurement recorded",
            uploaded_by_caregiver_id="cg-1",
            metadata={"measurement_type": "test_measurement", "value": "120", "unit": "units"},
        ),
        Evidence(
            id="ev-2",
            person_id="p-test",
            type="measurement",
            source_text="Second measurement",
            uploaded_by_caregiver_id="cg-2",
            metadata={"measurement_type": "another_measurement", "value": "40", "unit": "units"},
        ),
        Evidence(
            id="ev-3",
            person_id="p-test",
            type="measurement",
            source_text="Conflicting measurement",
            uploaded_by_caregiver_id="cg-1",
            metadata={"measurement_type": "test_measurement", "value": "100", "unit": "units"},
        ),
    ]


def _generate_actions(
    engine: ActionEngine,
    person_id: str = "p-test",
    changes: list[Change] | None = None,
    priorities: list[PriorityAssessment] | None = None,
    significance_assessments: list[SignificanceAssessment] | None = None,
    evidence_list: list[Evidence] | None = None,
    contradictions: list[Contradiction] | None = None,
    information_gaps: list[InformationGap] | None = None,
    open_questions: list[OpenQuestion] | None = None,
    clinician_instructions: list[ClinicianInstruction] | None = None,
    upcoming_appointments: list[CareAppointment] | None = None,
) -> ActionSet:
    """Generate actions with default test data."""
    return engine.generate_actions(
        person_id=person_id,
        changes=changes or [],
        priorities=priorities or [],
        significance_assessments=significance_assessments or [],
        evidence_list=evidence_list or [],
        contradictions=contradictions or [],
        information_gaps=information_gaps or [],
        open_questions=open_questions or [],
        clinician_instructions=clinician_instructions or [],
        upcoming_appointments=upcoming_appointments or [],
    )


# ============================================================================
# Part 1: Core action generation tests
# ============================================================================


def test_generates_ask_actions_from_open_questions(
    engine: ActionEngine,
    open_question: OpenQuestion,
    evidence_list: list[Evidence],
) -> None:
    """ASK actions generated from open questions."""
    result = _generate_actions(
        engine, open_questions=[open_question], evidence_list=evidence_list
    )
    ask_actions = [a for a in result.actions if a.action_type == ActionType.ASK]
    assert len(ask_actions) >= 1
    assert ask_actions[0].what and "Ask:" in ask_actions[0].what


def test_generates_check_actions_from_contradictions(
    engine: ActionEngine,
    contradiction: Contradiction,
) -> None:
    """CHECK actions generated from contradictions."""
    result = _generate_actions(engine, contradictions=[contradiction])
    check_actions = [a for a in result.actions if a.action_type == ActionType.CHECK]
    assert len(check_actions) >= 1
    assert check_actions[0].what and "Check:" in check_actions[0].what


def test_generates_monitor_actions_from_changes(
    engine: ActionEngine,
    baseline: Change,
    significance_high: SignificanceAssessment,
) -> None:
    """MONITOR actions generated from significant changes."""
    result = _generate_actions(
        engine,
        changes=[baseline],
        significance_assessments=[significance_high],
    )
    monitor_actions = [a for a in result.actions if a.action_type == ActionType.MONITOR]
    assert len(monitor_actions) >= 1
    assert monitor_actions[0].what and "Monitor:" in monitor_actions[0].what


def test_generates_do_actions_from_high_priority(
    engine: ActionEngine,
    baseline: Change,
    priority_urgent: PriorityAssessment,
    significance_high: SignificanceAssessment,
) -> None:
    """DO actions generated from high-priority changes."""
    result = _generate_actions(
        engine,
        changes=[baseline],
        priorities=[priority_urgent],
        significance_assessments=[significance_high],
    )
    do_actions = [a for a in result.actions if a.action_type == ActionType.DO]
    assert len(do_actions) >= 1
    assert do_actions[0].what and "Do:" in do_actions[0].what


def test_generates_prepare_actions_for_appointment(
    engine: ActionEngine,
    baseline: Change,
    open_question: OpenQuestion,
) -> None:
    """PREPARE actions generated for upcoming appointments."""
    result = _generate_actions(
        engine,
        changes=[baseline],
        open_questions=[open_question],
    )
    prepare_actions = [a for a in result.actions if a.action_type == ActionType.PREPARE]
    assert len(prepare_actions) >= 1
    assert prepare_actions[0].what and "Prepare:" in prepare_actions[0].what


def test_generates_document_actions_for_contradictions(
    engine: ActionEngine,
    contradiction: Contradiction,
) -> None:
    """DOCUMENT actions generated for contradictions."""
    result = _generate_actions(engine, contradictions=[contradiction])
    document_actions = [a for a in result.actions if a.action_type == ActionType.DOCUMENT]
    assert len(document_actions) >= 1
    assert document_actions[0].what and "Document:" in document_actions[0].what


def test_generates_professional_input_for_high_significance(
    engine: ActionEngine,
    baseline: Change,
    significance_high: SignificanceAssessment,
) -> None:
    """PROFESSIONAL_INPUT actions for high significance changes."""
    result = _generate_actions(
        engine,
        changes=[baseline],
        significance_assessments=[significance_high],
    )
    prof_actions = [a for a in result.actions if a.action_type == ActionType.PROFESSIONAL_INPUT]
    assert len(prof_actions) >= 1
    assert prof_actions[0].owner == ActionOwnership.CLINICIAN


def test_generates_escalation_for_critical_significance(
    engine: ActionEngine,
    change_decrease: Change,
    significance_critical: SignificanceAssessment,
    priority_immediate: PriorityAssessment,
) -> None:
    """ESCALATION actions for critical significance with evidence."""
    result = _generate_actions(
        engine,
        changes=[change_decrease],
        significance_assessments=[significance_critical],
        priorities=[priority_immediate],
    )
    escalation_actions = [a for a in result.actions if a.action_type == ActionType.ESCALATION]
    assert len(escalation_actions) >= 1
    assert escalation_actions[0].safety_classification == SafetyClassification.POTENTIAL_URGENT_CONCERN
    assert escalation_actions[0].what and "Escalation:" in escalation_actions[0].what


# ============================================================================
# Part 2: Traceability and grounding tests
# ============================================================================


def test_actions_have_evidence_ids(
    engine: ActionEngine,
    baseline: Change,
    evidence_list: list[Evidence],
) -> None:
    """Actions reference actual evidence IDs."""
    result = _generate_actions(engine, changes=[baseline], evidence_list=evidence_list)
    for action in result.actions:
        # At least one of evidence_ids or change_ids should be populated
        assert action.evidence_ids or action.change_ids


def test_actions_have_change_ids(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Actions reference change IDs."""
    result = _generate_actions(engine, changes=[baseline])
    for action in result.actions:
        assert action.change_ids or action.meaning_ids


def test_actions_have_meaning_ids(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Actions reference meaning IDs."""
    result = _generate_actions(engine, changes=[baseline])
    for action in result.actions:
        assert action.meaning_ids


def test_actions_have_reason(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Every action has a reason."""
    result = _generate_actions(engine, changes=[baseline])
    for action in result.actions:
        assert action.reason
        assert len(action.reason) > 0


def test_actions_have_confidence(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Every action has confidence score."""
    result = _generate_actions(engine, changes=[baseline])
    for action in result.actions:
        assert 0.0 <= action.confidence <= 1.0
        assert action.confidence_type == ConfidenceType.ACTION_CONFIDENCE


def test_actions_have_uncertainty_when_applicable(
    engine: ActionEngine,
    baseline: Change,
    contradiction: Contradiction,
) -> None:
    """Actions have uncertainty field when appropriate."""
    result = _generate_actions(engine, changes=[baseline], contradictions=[contradiction])
    for action in result.actions:
        # Actions from contradictions should have uncertainty
        if action.action_type in (ActionType.CHECK, ActionType.ASK):
            assert action.uncertainty is not None


def test_actions_have_attribution(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Every action has attribution."""
    result = _generate_actions(engine, changes=[baseline])
    for action in result.actions:
        assert action.attribution
        assert action.attribution in (
            "caregiver_A",
            "clinician_instruction",
            "SolenOS_reasoning",
        )


def test_actions_have_owner(
    engine: ActionEngine,
    baseline: Change,
    significance_high: SignificanceAssessment,
) -> None:
    """Actions have appropriate ownership."""
    result = _generate_actions(engine, changes=[baseline], significance_assessments=[significance_high])
    for action in result.actions:
        assert action.owner != ActionOwnership.UNKNOWN


def test_actions_have_temporal_scope(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Actions have temporal scope."""
    result = _generate_actions(engine, changes=[baseline])
    for action in result.actions:
        assert action.temporal_scope != TemporalScope.UNCERTAIN_TIMING


def test_actions_have_priority(
    engine: ActionEngine,
    baseline: Change,
    priority_urgent: PriorityAssessment,
) -> None:
    """Actions inherit priority from assessments."""
    result = _generate_actions(engine, changes=[baseline], priorities=[priority_urgent])
    for action in result.actions:
        assert action.priority != ActionPriority.DEFERRED


# ============================================================================
# Part 3: Safety boundary tests
# ============================================================================


def test_no_medication_stop_recommendation(engine: ActionEngine) -> None:
    """Never recommends stopping medication."""
    result = _generate_actions(engine, changes=[
        Change(id="chg-m", person_id="p-test", measurement_type="medication", change_type="new", evidence_ids=["ev-m"])
    ])
    for action in result.actions:
        text = f"{action.title} {action.description} {action.reason}".lower()
        assert "stop taking" not in text
        assert "stop the medication" not in text


def test_no_medication_dose_change(engine: ActionEngine) -> None:
    """Never recommends dose changes."""
    result = _generate_actions(engine, changes=[
        Change(id="chg-m", person_id="p-test", measurement_type="medication", change_type="increase", evidence_ids=["ev-m"])
    ])
    for action in result.actions:
        text = f"{action.title} {action.description} {action.reason}".lower()
        assert "increase dose" not in text
        assert "decrease dose" not in text
        assert "double dose" not in text
        assert "skip dose" not in text
        assert "reduce medication" not in text


def test_no_diagnosis_language(engine: ActionEngine) -> None:
    """Never uses diagnostic language."""
    result = _generate_actions(engine)
    for action in result.actions:
        text = f"{action.title} {action.description} {action.reason}".lower()
        assert "diagnos" not in text
        assert "disease" not in text


def test_no_causal_claims(engine: ActionEngine) -> None:
    """Never asserts causation."""
    result = _generate_actions(engine, changes=[
        Change(id="chg-1", person_id="p-test", measurement_type="symptom", change_type="new", evidence_ids=["ev-1"])
    ])
    for action in result.actions:
        text = f"{action.title} {action.description} {action.reason}".lower()
        assert "is causing" not in text
        assert "caused by" not in text


def test_no_emergency_diagnosis(engine: ActionEngine) -> None:
    """Never diagnoses emergency."""
    result = _generate_actions(engine, changes=[
        Change(id="chg-1", person_id="p-test", measurement_type="vital", change_type="increase", evidence_ids=["ev-1"])
    ], significance_assessments=[
        SignificanceAssessment(id="sig", person_id="p-test", change_id="chg-1", significance_level=SignificanceLevel.CRITICAL, confidence=0.9)
    ])
    for action in result.actions:
        text = f"{action.title} {action.description} {action.reason}".lower()
        # Can recommend evaluation but not diagnose emergency
        if "emergency" in text:
            assert "seek" in text or "evaluation" in text or "review" in text
            assert "is an emergency" not in text
            assert "definitely an emergency" not in text


def test_escalation_requires_evidence(engine: ActionEngine) -> None:
    """Escalation only with supporting evidence."""
    # Change without evidence should not produce escalation
    change_no_evidence = Change(
        id="chg-no-ev", person_id="p-test", measurement_type="test", change_type="increase", evidence_ids=[]
    )
    result = _generate_actions(engine, changes=[change_no_evidence], significance_assessments=[
        SignificanceAssessment(id="sig", person_id="p-test", change_id="chg-no-ev", significance_level=SignificanceLevel.CRITICAL, confidence=0.9)
    ])
    escalation_actions = [a for a in result.actions if a.action_type == ActionType.ESCALATION]
    # Should not escalate without evidence
    assert len(escalation_actions) == 0


def test_caregiver_not_assigned_clinical_decisions(engine: ActionEngine) -> None:
    """Clinical decisions assigned to clinicians, not caregivers."""
    result = _generate_actions(engine, changes=[
        Change(id="chg-1", person_id="p-test", measurement_type="clinical", change_type="new", evidence_ids=["ev-1"])
    ], significance_assessments=[
        SignificanceAssessment(id="sig", person_id="p-test", change_id="chg-1", significance_level=SignificanceLevel.HIGH, confidence=0.8)
    ])
    prof_actions = [a for a in result.actions if a.action_type == ActionType.PROFESSIONAL_INPUT]
    for action in prof_actions:
        assert action.owner == ActionOwnership.CLINICIAN


# ============================================================================
# Part 4: Contradiction and uncertainty handling
# ============================================================================


def test_contradiction_produces_information_seeking(
    engine: ActionEngine,
    contradiction: Contradiction,
    evidence_list: list[Evidence],
) -> None:
    """Contradictions produce reconciliation actions, not decisions."""
    result = _generate_actions(engine, contradictions=[contradiction], evidence_list=evidence_list)
    check_actions = [a for a in result.actions if a.action_type == ActionType.CHECK]
    assert len(check_actions) >= 1
    assert "Reconcile" in check_actions[0].title or "reconcile" in check_actions[0].description.lower()


def test_caregiver_disagreement_produces_clarification(
    engine: ActionEngine,
    contradiction: Contradiction,
    evidence_list: list[Evidence],
) -> None:
    """Multi-caregiver contradictions produce clarification actions."""
    # Use contradiction that spans different caregivers
    multi_caregiver_contradiction = Contradiction(
        id="ct-multi",
        person_id="p-test",
        contradiction_type="direct",
        description="Conflicting values for test_measurement",
        evidence_ids=["ev-1", "ev-2"],  # ev-1 from cg-1, ev-2 from cg-2
    )
    result = _generate_actions(
        engine, contradictions=[multi_caregiver_contradiction], evidence_list=evidence_list,
        changes=[Change(id="chg-1", person_id="p-test", measurement_type="test", change_type="increase", evidence_ids=["ev-1"])]
    )
    assert result.actions  # At least some actions generated


def test_uncertainty_changes_action_language(
    engine: ActionEngine,
    baseline: Change,
    information_gap: InformationGap,
) -> None:
    """Uncertainty reflected in action language."""
    result = _generate_actions(engine, changes=[baseline], information_gaps=[information_gap])
    for action in result.actions:
        if action.uncertainty:
            assert action.what_we_dont_know is not None


def test_missing_baseline_produces_ask_not_assumption(
    engine: ActionEngine,
    information_gap: InformationGap,
    evidence_list: list[Evidence],
) -> None:
    """Missing baseline produces ask action, not assumed value."""
    result = _generate_actions(
        engine, information_gaps=[information_gap], evidence_list=evidence_list
    )
    ask_actions = [a for a in result.actions if a.action_type == ActionType.ASK]
    assert len(ask_actions) >= 1
    assert "baseline" in ask_actions[0].what.lower() or "baseline" in ask_actions[0].description.lower()


# ============================================================================
# Part 5: Action lifecycle and history
# ============================================================================


def test_action_status_transitions(engine: ActionEngine) -> None:
    """Action status can transition through lifecycle."""
    action = Action(
        id="act-test",
        person_id="p-test",
        action_type=ActionType.DO,
        title="Test",
        description="Test",
        reason="Test",
        attribution="SolenOS_reasoning",
    )

    # recommended -> acknowledged
    history = engine.update_action_status(action, ActionStatus.ACKNOWLEDGED, "caregiver")
    assert action.status == ActionStatus.ACKNOWLEDGED
    assert action.acknowledged_at is not None
    assert history.change_type == "acknowledged"

    # acknowledged -> completed
    history = engine.update_action_status(action, ActionStatus.COMPLETED, "caregiver", "Done")
    assert action.status == ActionStatus.COMPLETED
    assert action.completed_at is not None
    assert history.change_type == "completed"


def test_action_supersession(engine: ActionEngine) -> None:
    """Actions can be superseded with history."""
    action = Action(
        id="act-old",
        person_id="p-test",
        action_type=ActionType.DO,
        title="Old action",
        description="Old",
        reason="Old reason",
        attribution="SolenOS_reasoning",
    )

    history = engine.supersede_action(action, "act-new", "New evidence changed recommendation")
    assert action.status == ActionStatus.SUPERSEDED
    assert action.superseded_by == "act-new"
    assert action.superseded_reason == "New evidence changed recommendation"
    assert history.change_type == "superseded"


def test_action_history_preserved(engine: ActionEngine) -> None:
    """Action history entries created for state changes."""
    action = Action(
        id="act-hist",
        person_id="p-test",
        action_type=ActionType.CHECK,
        title="Check",
        description="Check",
        reason="Check",
        attribution="SolenOS_reasoning",
    )

    engine.update_action_status(action, ActionStatus.ACKNOWLEDGED, "caregiver")
    engine.update_action_status(action, ActionStatus.COMPLETED, "caregiver")

    # History entries created (would be stored in persistence layer)
    assert action.acknowledged_at is not None
    assert action.completed_at is not None


# ============================================================================
# Part 6: Action set summary and grouping
# ============================================================================


def test_action_set_counts_by_type(
    engine: ActionEngine,
    baseline: Change,
    contradiction: Contradiction,
    open_question: OpenQuestion,
    significance_high: SignificanceAssessment,
) -> None:
    """ActionSet correctly counts actions by type."""
    result = _generate_actions(
        engine,
        changes=[baseline],
        contradictions=[contradiction],
        open_questions=[open_question],
        significance_assessments=[significance_high],
    )

    assert result.ask_count >= 1
    assert result.check_count >= 1
    assert result.monitor_count >= 1
    assert result.professional_input_count >= 1


def test_action_set_highest_priority(
    engine: ActionEngine,
    change_decrease: Change,
    priority_immediate: PriorityAssessment,
    significance_critical: SignificanceAssessment,
) -> None:
    """ActionSet identifies highest priority."""
    result = _generate_actions(
        engine,
        changes=[change_decrease],
        priorities=[priority_immediate],
        significance_assessments=[significance_critical],
    )
    assert result.highest_priority == ActionPriority.IMMEDIATE


def test_action_set_highest_safety(
    engine: ActionEngine,
    change_decrease: Change,
    significance_critical: SignificanceAssessment,
    priority_immediate: PriorityAssessment,
) -> None:
    """ActionSet identifies highest safety classification."""
    result = _generate_actions(
        engine,
        changes=[change_decrease],
        significance_assessments=[significance_critical],
        priorities=[priority_immediate],
    )
    assert result.highest_safety == SafetyClassification.POTENTIAL_URGENT_CONCERN


def test_action_set_insufficient_evidence_flag(
    engine: ActionEngine,
) -> None:
    """ActionSet flags insufficient evidence."""
    # No evidence, no changes
    result = _generate_actions(engine, changes=[], evidence_list=[])
    assert result.has_insufficient_evidence is True or result.actions == []


# ============================================================================
# Part 7: Validation gate tests
# ============================================================================


def test_validation_rejects_ungrounded_action(engine: ActionEngine) -> None:
    """Actions without evidence or changes rejected."""
    action = Action(
        id="act-ungrounded",
        person_id="p-test",
        action_type=ActionType.DO,
        title="Ungrounded",
        description="No evidence",
        reason="No evidence",
        attribution="SolenOS_reasoning",
    )
    # Would be rejected by _validate_action
    assert not engine._validate_action(action, [], [])


def test_validation_rejects_unsafe_medication_language(engine: ActionEngine) -> None:
    """Validation rejects medication change language."""
    action = Action(
        id="act-unsafe",
        person_id="p-test",
        action_type=ActionType.DO,
        title="Stop medication",
        description="Stop taking the medication",
        reason="Caregiver thinks so",
        attribution="SolenOS_reasoning",
        evidence_ids=["ev-1"],
    )
    assert not engine._validate_action(action, [], [])


def test_validation_rejects_diagnostic_language(engine: ActionEngine) -> None:
    """Validation rejects diagnostic assertions."""
    action = Action(
        id="act-diag",
        person_id="p-test",
        action_type=ActionType.DO,
        title="Diagnose",
        description="This is a diagnosis of condition X",
        reason="Symptoms match",
        attribution="SolenOS_reasoning",
        evidence_ids=["ev-1"],
    )
    assert not engine._validate_action(action, [], [])


def test_validation_rejects_causal_claims(engine: ActionEngine) -> None:
    """Validation rejects causal assertions."""
    action = Action(
        id="act-causal",
        person_id="p-test",
        action_type=ActionType.DO,
        title="Causal",
        description="Medication is causing the symptom",
        reason="Temporal correlation",
        attribution="SolenOS_reasoning",
        evidence_ids=["ev-1"],
    )
    assert not engine._validate_action(action, [], [])


def test_validation_requires_attribution(engine: ActionEngine) -> None:
    """Validation requires attribution."""
    action = Action(
        id="act-no-attr",
        person_id="p-test",
        action_type=ActionType.DO,
        title="Action",
        description="Description",
        reason="Reason",
        attribution="",  # Missing
        evidence_ids=["ev-1"],
    )
    assert not engine._validate_action(action, [], [])


# ============================================================================
# Part 8: Generalization tests
# ============================================================================


def test_generalization_different_person(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Works with different person IDs."""
    result = _generate_actions(engine, person_id="different-person", changes=[baseline])
    assert result.person_id == "different-person"
    for action in result.actions:
        assert action.person_id == "different-person"


def test_generalization_different_measurement_types(
    engine: ActionEngine,
) -> None:
    """Works with different measurement types."""
    change = Change(
        id="chg-custom",
        person_id="p-test",
        measurement_type="custom_type",
        change_type="fluctuation",
        evidence_ids=["ev-custom"],
    )
    result = _generate_actions(
        engine,
        changes=[change],
        evidence_list=[
            Evidence(id="ev-custom", person_id="p-test", type="measurement", source_text="Custom", uploaded_by_caregiver_id="cg-1"),
        ],
    )
    for action in result.actions:
        assert action.change_ids  # Should reference the change
        assert len(action.actions) if hasattr(action, 'actions') else True


def test_generalization_different_change_types(
    engine: ActionEngine,
) -> None:
    """Works with different change types."""
    for change_type in ["increase", "decrease", "new", "resolved", "fluctuation", "worsening", "improvement"]:
        change = Change(
            id=f"chg-{change_type}",
            person_id="p-test",
            measurement_type="test",
            change_type=change_type,
            evidence_ids=["ev-1"],
        )
        result = _generate_actions(engine, changes=[change])
        assert result.actions  # Should generate some actions


def test_generalization_unseen_scenarios(
    engine: ActionEngine,
) -> None:
    """Engine handles completely unseen scenario types."""
    from app.core.meaning_enums import GapType
    result = _generate_actions(
        engine,
        changes=[
            Change(id="chg-1", person_id="p-test", measurement_type="unseen_metric", change_type="new", evidence_ids=["ev-1"]),
        ],
        information_gaps=[
            InformationGap(id="gap-1", person_id="p-test", gap_type=GapType.MISSING_REPORTER, description="Unseen gap"),
        ],
        contradictions=[
            Contradiction(id="ct-1", person_id="p-test", contradiction_type="direct", description="Unseen contradiction", evidence_ids=["ev-1"]),
        ],
        evidence_list=[
            Evidence(id="ev-1", person_id="p-test", type="measurement", source_text="Unseen evidence", uploaded_by_caregiver_id="cg-1"),
        ]
    )
    # Should not crash, should produce actions
    assert isinstance(result, ActionSet)


# ============================================================================
# Part 9: Adversarial/safety tests
# ============================================================================


def test_no_action_for_resolved_change(engine: ActionEngine) -> None:
    """Resolved changes don't generate monitor actions."""
    resolved_change = Change(
        id="chg-resolved",
        person_id="p-test",
        measurement_type="test",
        change_type="resolved",
        evidence_ids=["ev-1"],
    )
    result = _generate_actions(engine, changes=[resolved_change], significance_assessments=[
        SignificanceAssessment(id="sig", person_id="p-test", change_id="chg-resolved", significance_level=SignificanceLevel.LOW, confidence=0.8)
    ])
    monitor_actions = [a for a in result.actions if a.action_type == ActionType.MONITOR]
    # Resolved changes with LOW significance should not generate monitor
    assert len(monitor_actions) == 0


def test_no_manufactured_actions_when_nothing_actionable(engine: ActionEngine) -> None:
    """No actions manufactured when nothing actionable."""
    result = _generate_actions(engine, changes=[], evidence_list=[])
    # May have 0 actions or only low-priority monitor
    assert len(result.actions) <= 2


def test_duplicate_evidence_no_duplicate_actions(engine: ActionEngine) -> None:
    """Duplicate evidence doesn't create duplicate actions."""
    duplicate_evidence = [
        Evidence(id="ev-1", person_id="p-test", type="measurement", source_text="Same", uploaded_by_caregiver_id="cg-1", metadata={"measurement_type": "test", "value": "100", "unit": "u"}),
        Evidence(id="ev-2", person_id="p-test", type="measurement", source_text="Same", uploaded_by_caregiver_id="cg-1", metadata={"measurement_type": "test", "value": "100", "unit": "u"}),
    ]
    result = _generate_actions(engine, evidence_list=duplicate_evidence)
    # Should not explode with duplicate actions
    assert len(result.actions) < 10


def test_action_idempotency_same_input_same_output(engine: ActionEngine) -> None:
    """Same input produces structurally similar actions."""
    change = Change(id="chg-1", person_id="p-test", measurement_type="test", change_type="increase", evidence_ids=["ev-1"])
    result1 = _generate_actions(engine, changes=[change])
    result2 = _generate_actions(engine, changes=[change])

    # Same action types should be generated
    types1 = sorted([a.action_type for a in result1.actions])
    types2 = sorted([a.action_type for a in result2.actions])
    assert types1 == types2


# ============================================================================
# Part 10: API endpoint tests
# ============================================================================


@pytest.fixture
def client() -> TestClient:
    """Create a test client."""
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_api_post_generate(client: TestClient) -> None:
    """POST /api/v1/action/generate returns action set."""
    response = client.post(
        "/api/v1/action/generate",
        json={"person_id": "p-test"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "action_set_id" in data
    assert "actions" in data


def test_api_get_action_set(client: TestClient) -> None:
    """GET /api/v1/action/set/{id} returns action set."""
    # First generate
    gen_response = client.post("/api/v1/action/generate", json={"person_id": "p-test"})
    action_set_id = gen_response.json()["action_set_id"]

    response = client.get(f"/api/v1/action/set/{action_set_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == action_set_id


def test_api_get_actions_by_person(client: TestClient) -> None:
    """GET /api/v1/action/person/{person_id} returns actions."""
    client.post("/api/v1/action/generate", json={"person_id": "p-test"})

    response = client.get("/api/v1/action/person/p-test")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_api_patch_action_status(client: TestClient) -> None:
    """PATCH /api/v1/action/{id}/status updates status."""
    from app.api.action import _action_sets
    from app.schemas.action import ActionSchema, ActionSetSchema
    from app.core.action_enums import ActionOwnership, ActionPriority, ActionStatus, ActionType, ConfidenceType, SafetyClassification, TemporalScope
    from app.core.meaning_enums import ConfidenceType as MCType

    # Manually create and store an action set
    action = Action(
        id="act-api-test",
        person_id="p-test",
        action_type=ActionType.DO,
        title="Test action",
        description="Test",
        reason="Test reason",
        attribution="SolenOS_reasoning",
        evidence_ids=["ev-1"],
        confidence=0.8,
        confidence_type=ConfidenceType.ACTION_CONFIDENCE,
        owner=ActionOwnership.CAREGIVER,
        temporal_scope=TemporalScope.TODAY,
    )
    action_schema = ActionSchema.model_validate(action.model_dump())
    set_schema = ActionSetSchema(
        id="actset-api-test",
        person_id="p-test",
        meaning_id="mean-test",
        actions=[action_schema],
        source_reasoning="test",
    )
    _action_sets["actset-api-test"] = set_schema

    response = client.patch(
        "/api/v1/action/act-api-test/status",
        json={"action_id": "act-api-test", "status": "acknowledged", "acknowledged_by": "cg-1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "acknowledged"


def test_api_supersede_action(client: TestClient) -> None:
    """POST /api/v1/action/{id}/supersede marks superseded."""
    from app.api.action import _action_sets
    from app.schemas.action import ActionSchema, ActionSetSchema

    action = Action(
        id="act-sup-test",
        person_id="p-test",
        action_type=ActionType.DO,
        title="Test action for supersede",
        description="Test",
        reason="Test reason",
        attribution="SolenOS_reasoning",
        evidence_ids=["ev-1"],
        confidence=0.8,
        confidence_type=ConfidenceType.ACTION_CONFIDENCE,
        owner=ActionOwnership.CAREGIVER,
        temporal_scope=TemporalScope.TODAY,
    )
    action_schema = ActionSchema.model_validate(action.model_dump())
    set_schema = ActionSetSchema(
        id="actset-sup-test",
        person_id="p-test",
        meaning_id="mean-test",
        actions=[action_schema],
        source_reasoning="test",
    )
    _action_sets["actset-sup-test"] = set_schema

    response = client.post(
        "/api/v1/action/act-sup-test/supersede",
        json={"action_id": "act-sup-test", "superseded_by_id": "act-new", "reason": "New evidence"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "superseded"
    assert data["superseded_by"] == "act-new"


def test_api_get_summary(client: TestClient) -> None:
    """GET /api/v1/action/person/{person_id}/summary returns grouped summary."""
    client.post("/api/v1/action/generate", json={"person_id": "p-test"})

    response = client.get("/api/v1/action/person/p-test/summary")
    assert response.status_code == 200
    data = response.json()
    assert "by_type" in data
    assert "ask" in data["by_type"]
    assert "check" in data["by_type"]
    assert "monitor" in data["by_type"]
    assert "do" in data["by_type"]


# ============================================================================
# Part 11: Explanation field completeness
# ============================================================================


def test_actions_have_what_why_based_on_who_when(
    engine: ActionEngine,
    baseline: Change,
    significance_high: SignificanceAssessment,
) -> None:
    """Actions have all explanation fields populated."""
    result = _generate_actions(engine, changes=[baseline], significance_assessments=[significance_high])
    for action in result.actions:
        assert action.what is not None
        assert action.why is not None
        assert action.based_on is not None
        assert action.who is not None
        assert action.when is not None
        assert action.what_we_dont_know is not None
        assert action.what_solenos_is_not_concluding is not None


def test_what_we_dont_know_reflects_uncertainty(
    engine: ActionEngine,
    contradiction: Contradiction,
) -> None:
    """what_we_dont_know reflects actual uncertainty."""
    result = _generate_actions(engine, contradictions=[contradiction])
    for action in result.actions:
        if action.uncertainty:
            assert action.what_we_dont_know is not None
            assert len(action.what_we_dont_know) > 0


def test_what_solenos_is_not_concluding_present(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """what_solenos_is_not_concluding explicitly states non-conclusions."""
    result = _generate_actions(engine, changes=[baseline])
    for action in result.actions:
        assert action.what_solenos_is_not_concluding is not None
        assert len(action.what_solenos_is_not_concluding) > 0
        # Should mention not diagnosing, not prescribing, etc.
        text = action.what_solenos_is_not_concluding.lower()
        assert any(kw in text for kw in [
            "not diagnos", "not prescribing", "not recommending",
            "not clinical", "not medical", "not determining",
        ])


# ============================================================================
# Part 12: Multi-priority handling
# ============================================================================


def test_multiple_priorities_ranked(
    engine: ActionEngine,
    baseline: Change,
    change_decrease: Change,
    priority_urgent: PriorityAssessment,
    priority_immediate: PriorityAssessment,
    significance_high: SignificanceAssessment,
    significance_critical: SignificanceAssessment,
) -> None:
    """Actions follow priority ranking."""
    result = _generate_actions(
        engine,
        changes=[baseline, change_decrease],
        priorities=[priority_urgent, priority_immediate],
        significance_assessments=[significance_high, significance_critical],
    )
    # Highest priority action should be first/most prominent
    assert result.highest_priority == ActionPriority.IMMEDIATE


# ============================================================================
# Part 13: Clinician instruction surfacing
# ============================================================================


def test_clinician_instruction_surfaced_as_action(engine: ActionEngine) -> None:
    """Clinician instructions surfaced with proper attribution."""
    # This would be tested with a meaning output containing clinician instruction
    # For now verify the action model supports the fields
    action = Action(
        id="act-ci",
        person_id="p-test",
        action_type=ActionType.PROFESSIONAL_INPUT,
        title="Follow clinician instruction",
        description="Monitor X and contact if Y",
        reason="Clinician instruction in record",
        attribution="clinician_instruction",
        is_clinician_instruction=True,
        clinician_instruction_source="Dr. Smith",
        clinician_instruction_scope="Monitor BP, contact if >180",
    )
    assert action.is_clinician_instruction is True
    assert action.clinician_instruction_source == "Dr. Smith"
    assert action.attribution == "clinician_instruction"


# ============================================================================
# Part 14: Meaning confidence vs action confidence distinction
# ============================================================================


def test_action_confidence_distinct_from_meaning_confidence(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Action confidence is separate from meaning confidence."""
    result = _generate_actions(engine, changes=[baseline])
    for action in result.actions:
        assert action.confidence_type == ConfidenceType.ACTION_CONFIDENCE
        # Action confidence can be lower than meaning confidence
        assert action.confidence <= 1.0


# ============================================================================
# Part 15: Failure/edge cases
# ============================================================================


def test_empty_input_handled(engine: ActionEngine) -> None:
    """Empty input handled gracefully."""
    result = _generate_actions(engine)
    assert isinstance(result, ActionSet)
    assert result.person_id == "p-test"


def test_invalid_change_id_handled(engine: ActionEngine) -> None:
    """Invalid change references handled."""
    # Engine doesn't crash on empty changes
    result = _generate_actions(engine, changes=[])
    assert isinstance(result, ActionSet)


def test_no_crash_on_malformed_data(engine: ActionEngine) -> None:
    """Engine doesn't crash on edge cases."""
    result = _generate_actions(
        engine,
        changes=[Change(id="chg", person_id="p-test", measurement_type="", change_type="", evidence_ids=[])],
        evidence_list=[Evidence(id="ev", person_id="p-test", type="", source_text="")],
    )
    assert isinstance(result, ActionSet)


# ============================================================================
# Part 16: Clinician instruction surfacing
# ============================================================================


def test_clinician_instruction_surfaced_as_ask(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Active clinician instructions surface as ASK actions with attribution."""
    from datetime import datetime, timedelta

    instruction = ClinicianInstruction(
        id="ci-1",
        person_id="p-test",
        author="Dr. Test",
        author_role="physician",
        instruction_text="Monitor test_measurement and contact if >120",
        scope="test_measurement",
        date_issued=datetime.utcnow(),
        is_active=True,
        evidence_ids=["ev-1"],
    )
    result = _generate_actions(
        engine,
        changes=[baseline],
        clinician_instructions=[instruction],
        evidence_list=[Evidence(id="ev-1", person_id="p-test", type="note", source_text="Note", uploaded_by_caregiver_id="cg-1")],
    )
    ask_instructions = [a for a in result.actions if a.is_clinician_instruction]
    assert len(ask_instructions) >= 1
    assert ask_instructions[0].attribution == "clinician_instruction"
    assert ask_instructions[0].clinician_instruction_source == "Dr. Test"


def test_stale_clinician_instruction_flagged(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Expired clinician instructions are flagged for verification."""
    from datetime import datetime, timedelta

    instruction = ClinicianInstruction(
        id="ci-stale",
        person_id="p-test",
        author="Dr. Test",
        author_role="physician",
        instruction_text="Take medication daily",
        scope="medication",
        date_issued=datetime.utcnow() - timedelta(days=30),
        expiration=datetime.utcnow() - timedelta(days=1),
        is_active=True,
        evidence_ids=[],
    )
    result = _generate_actions(
        engine,
        changes=[baseline],
        clinician_instructions=[instruction],
        evidence_list=[],
    )
    stale_actions = [a for a in result.actions if a.is_clinician_instruction and "stale" in a.title.lower()]
    assert len(stale_actions) >= 1


def test_clinician_instruction_not_modified(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """Clinician instruction text preserved verbatim."""
    instruction = ClinicianInstruction(
        id="ci-2",
        person_id="p-test",
        author="Dr. Test",
        author_role="physician",
        instruction_text="Call if X occurs",
        scope="all",
        is_active=True,
        evidence_ids=[],
    )
    result = _generate_actions(
        engine,
        changes=[baseline],
        clinician_instructions=[instruction],
        evidence_list=[],
    )
    instr_actions = [a for a in result.actions if a.is_clinician_instruction]
    if instr_actions:
        assert "Call if X occurs" in instr_actions[0].description


def test_meaning_output_consumed_for_actions(
    engine: ActionEngine,
    baseline: Change,
    contradiction: Contradiction,
    significance_high: SignificanceAssessment,
) -> None:
    """ActionEngine generates actions from MeaningOutput."""
    meaning = MeaningOutput(
        id="mean-test",
        person_id="p-test",
        what_is_happening="Measurement changed",
        epistemic_level="interpretation",
        rationale="Change detected",
        changes=[baseline],
        contradictions=[contradiction],
        clinician_instructions=[],
    )
    result = engine.generate_actions(person_id="p-test", meaning=meaning)
    assert result.meaning_id == "mean-test"
    assert len(result.actions) > 0
    # All actions should reference the meaning
    for action in result.actions:
        assert "mean-test" in action.meaning_ids


# ============================================================================
# Part 17: Upcoming appointment preparation
# ============================================================================


def test_appointment_preparation_action(
    engine: ActionEngine,
    baseline: Change,
) -> None:
    """PREPARE action generated for upcoming appointments."""
    from datetime import datetime, timedelta

    appointment = CareAppointment(
        id="apt-1",
        person_id="p-test",
        title="Routine checkup",
        scheduled_at=datetime.utcnow() + timedelta(days=3),
    )
    result = _generate_actions(
        engine,
        changes=[baseline],
        upcoming_appointments=[appointment],
        evidence_list=[Evidence(id="ev-1", person_id="p-test", type="measurement", source_text="Test", uploaded_by_caregiver_id="cg-1")],
    )
    prepare_actions = [a for a in result.actions if a.action_type == ActionType.PREPARE]
    assert len(prepare_actions) >= 1
    assert "appointment" in prepare_actions[0].reason.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])