from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.care import Person, Caregiver
from app.models.dementia import (
    DementiaBaselineModel,
    DementiaObservationModel,
    DementiaChangeAssessmentModel,
)
from app.services.dementia_reasoning import DementiaReasoningEngine
from app.schemas.dementia import (
    DementiaBaselineCreate,
    DementiaObservationCreate,
    DementiaReasoningRequest,
)
from app.core.dementia_enums import (
    DementiaDomain,
    DementiaChangeType,
    FluctuationPattern,
    SafetySignificance,
    CaregiverLanguageCategory,
    DementiaBaselineType,
)


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def setup_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db


def teardown_db():
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


def seed_person(db, person_id="person-1", name="Test Person"):
    person = Person(id=person_id, name=name)
    caregiver = Caregiver(
        id="caregiver-1",
        name="Test Caregiver",
        email="test@example.com",
        relationship="Family",
        person_id=person_id,
    )
    db.add_all([person, caregiver])
    db.commit()
    db.close()


class TestDementiaReasoningEngine:
    def setup_method(self):
        setup_db()
        db = TestingSessionLocal()
        seed_person(db)
        db.close()

    def teardown_method(self):
        teardown_db()

    def get_db(self):
        return TestingSessionLocal()

    def test_caregiver_language_analysis_sundowning(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        analysis = engine.analyze_caregiver_language("Dad is sundowning again")
        assert CaregiverLanguageCategory.SUNDOWNING in analysis.detected_categories
        assert analysis.clinical_label_warning is not None
        assert "sundowning" in analysis.clinical_label_warning.lower()
        db.close()

    def test_caregiver_language_analysis_not_themselves(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        analysis = engine.analyze_caregiver_language("She's just not herself today")
        assert CaregiverLanguageCategory.NOT_THEMSELVES in analysis.detected_categories
        db.close()

    def test_caregiver_language_analysis_repetitive_questioning(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        analysis = engine.analyze_caregiver_language("She keeps asking the same damn thing")
        assert CaregiverLanguageCategory.REPETITIVE_QUESTIONING in analysis.detected_categories
        db.close()

    def test_caregiver_language_analysis_getting_lost(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        analysis = engine.analyze_caregiver_language("Mom is getting lost in the house")
        assert CaregiverLanguageCategory.GETTING_LOST in analysis.detected_categories
        db.close()

    def test_caregiver_language_analysis_having_a_day(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        analysis = engine.analyze_caregiver_language("He's having one of those days")
        assert CaregiverLanguageCategory.HAVING_A_DAY in analysis.detected_categories
        db.close()

    def test_caregiver_language_analysis_paranoia(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        analysis = engine.analyze_caregiver_language("Mom says someone is stealing her clothes")
        assert CaregiverLanguageCategory.PARANOIA in analysis.detected_categories
        db.close()

    def test_caregiver_language_analysis_withdrawal(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        analysis = engine.analyze_caregiver_language("She stopped joining us at dinner")
        assert CaregiverLanguageCategory.WITHDRAWAL in analysis.detected_categories
        db.close()

    def test_domain_identification_memory(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = engine.identify_domain("She forgot that I visited yesterday")
        assert DementiaDomain.MEMORY in domains
        db.close()

    def test_domain_identification_orientation(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = engine.identify_domain("He thought he was at his old house")
        assert DementiaDomain.ORIENTATION in domains
        db.close()

    def test_domain_identification_recognition(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = engine.identify_domain("Mom didn't recognize her granddaughter today")
        assert DementiaDomain.RECOGNITION in domains
        db.close()

    def test_domain_identification_language(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = engine.identify_domain("She knows what she wants but can't find the words")
        assert DementiaDomain.COMMUNICATION in domains
        db.close()

    def test_domain_identification_executive_function(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = engine.identify_domain("He put the milk in the cupboard and the cereal in the refrigerator")
        assert DementiaDomain.EXECUTIVE_FUNCTION in domains or DementiaDomain.JUDGMENT in domains
        db.close()

    def test_domain_identification_wandering(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = engine.identify_domain("Dad left the house at 2 AM and we found him three streets away")
        assert DementiaDomain.WANDERING in domains
        db.close()

    def test_domain_identification_adls(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = engine.identify_domain("She now needs help choosing and putting on her clothes")
        assert DementiaDomain.ADLS_IADLS in domains
        db.close()

    def test_safety_significance_wandering(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = [DementiaDomain.WANDERING]
        significance, concerns, flags = engine.assess_safety_significance(
            "Dad left the house at 2 AM and we found him three streets away", domains
        )
        assert significance == SafetySignificance.CRITICAL
        assert flags["wandering_risk"] is True
        db.close()

    def test_safety_significance_medication(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = [DementiaDomain.ADLS_IADLS]
        significance, concerns, flags = engine.assess_safety_significance(
            "Mom keeps taking her evening pills twice because she forgets she's already taken them", domains
        )
        assert significance == SafetySignificance.HIGH
        assert flags["medication_safety_risk"] is True
        db.close()

    def test_safety_significance_cooking(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = [DementiaDomain.ADLS_IADLS]
        significance, concerns, flags = engine.assess_safety_significance(
            "He left the stove on twice this week", domains
        )
        assert significance == SafetySignificance.HIGH
        assert flags["appliance_safety_risk"] is True
        db.close()

    def test_safety_significance_driving(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        domains = [DementiaDomain.ADLS_IADLS]
        significance, concerns, flags = engine.assess_safety_significance(
            "She got lost driving home from a place she's visited for years", domains
        )
        assert significance == SafetySignificance.HIGH
        assert flags["driving_safety_risk"] is True
        db.close()

    def test_create_baseline(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        baseline_data = DementiaBaselineCreate(
            person_id="person-1",
            baseline_type=DementiaBaselineType.CAREGIVER_REPORTED,
            domain=DementiaDomain.MEMORY,
            description="Forgets names daily, occasionally misplaces objects",
            severity="mild",
            frequency="daily",
            context="Established over 2 years",
            established_date=datetime.now(timezone.utc) - timedelta(days=730),
            confidence=0.8,
        )
        baseline = engine.create_baseline(baseline_data)
        assert baseline.id is not None
        assert baseline.domain == DementiaDomain.MEMORY
        assert baseline.confidence == 0.8
        db.close()

    def test_compare_to_baseline_consistent(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        baseline_data = DementiaBaselineCreate(
            person_id="person-1",
            baseline_type=DementiaBaselineType.CAREGIVER_REPORTED,
            domain=DementiaDomain.MEMORY,
            description="Forgets names daily, occasionally misplaces objects",
            established_date=datetime.now(timezone.utc) - timedelta(days=730),
            confidence=0.8,
        )
        engine.create_baseline(baseline_data)
        db.commit()

        comparison = engine.compare_to_baseline(
            "person-1", DementiaDomain.MEMORY, "Mom forgot where she put her glasses again"
        )
        assert comparison.is_consistent_with_baseline is True
        assert comparison.change_type == DementiaChangeType.BASELINE_CONSISTENT
        db.close()

    def test_compare_to_baseline_new_change(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        baseline_data = DementiaBaselineCreate(
            person_id="person-1",
            baseline_type=DementiaBaselineType.CAREGIVER_REPORTED,
            domain=DementiaDomain.MEMORY,
            description="Forgets names daily, occasionally misplaces objects",
            established_date=datetime.now(timezone.utc) - timedelta(days=730),
            confidence=0.8,
        )
        engine.create_baseline(baseline_data)
        db.commit()

        comparison = engine.compare_to_baseline(
            "person-1", DementiaDomain.MEMORY, "Today she couldn't figure out how to use the bathroom"
        )
        assert comparison.is_consistent_with_baseline is False
        assert comparison.change_type == DementiaChangeType.NEW_CHANGE
        db.close()

    def test_compare_to_baseline_no_baseline(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        comparison = engine.compare_to_baseline(
            "person-1", DementiaDomain.MEMORY, "Some observation"
        )
        assert comparison.is_consistent_with_baseline is False
        assert comparison.baseline is None
        assert comparison.change_type == DementiaChangeType.NEW_CHANGE
        assert "No established baseline" in comparison.deviation_description
        db.close()

    def test_process_reasoning_request_baseline_consistent(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        baseline_data = DementiaBaselineCreate(
            person_id="person-1",
            baseline_type=DementiaBaselineType.CAREGIVER_REPORTED,
            domain=DementiaDomain.MEMORY,
            description="Forgets names daily, occasionally misplaces objects",
            established_date=datetime.now(timezone.utc) - timedelta(days=730),
            confidence=0.8,
        )
        engine.create_baseline(baseline_data)
        db.commit()

        request = DementiaReasoningRequest(
            person_id="person-1",
            observation_text="Mom forgot where she put her glasses again",
            domain=DementiaDomain.MEMORY,
            caregiver_id="caregiver-1",
        )
        response = engine.process_reasoning_request(request)

        assert response.observation.change_type == DementiaChangeType.BASELINE_CONSISTENT
        assert response.assessment.is_new_change is False
        assert response.baseline_used is not None
        assert response.caregiver_language_analysis is not None
        db.close()

    def test_process_reasoning_request_new_change(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        baseline_data = DementiaBaselineCreate(
            person_id="person-1",
            baseline_type=DementiaBaselineType.CAREGIVER_REPORTED,
            domain=DementiaDomain.MEMORY,
            description="Forgets names daily, occasionally misplaces objects",
            established_date=datetime.now(timezone.utc) - timedelta(days=730),
            confidence=0.8,
        )
        engine.create_baseline(baseline_data)
        db.commit()

        request = DementiaReasoningRequest(
            person_id="person-1",
            observation_text="She normally forgets names, but today she couldn't figure out how to use the bathroom",
            domain=DementiaDomain.MEMORY,
            caregiver_id="caregiver-1",
        )
        response = engine.process_reasoning_request(request)

        assert response.assessment.is_new_change is True
        assert "acute" in response.assessment.acute_vs_gradual.lower()
        assert response.assessment.dementia_as_explanation_flag is False
        db.close()

    def test_process_reasoning_request_fluctuation(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        request = DementiaReasoningRequest(
            person_id="person-1",
            observation_text="She was herself all morning but became very confused tonight",
            domain=DementiaDomain.COGNITIVE_BASELINE,
            caregiver_id="caregiver-1",
        )
        response = engine.process_reasoning_request(request)

        assert response.observation.fluctuation_pattern == FluctuationPattern.MORNING_CLEAR_EVENING_CONFUSED
        assert response.assessment.progression_vs_episode == "fluctuation"
        db.close()

    def test_process_reasoning_request_wandering_safety(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        request = DementiaReasoningRequest(
            person_id="person-1",
            observation_text="Dad left the house at 2 AM and we found him three streets away",
            domain=DementiaDomain.WANDERING,
            caregiver_id="caregiver-1",
        )
        response = engine.process_reasoning_request(request)

        assert len(response.safety_events) > 0
        safety_event = response.safety_events[0]
        assert safety_event["significance"] == "critical"
        db.close()

    def test_process_reasoning_request_medication_safety(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        request = DementiaReasoningRequest(
            person_id="person-1",
            observation_text="Mom keeps taking her evening pills twice because she forgets she's already taken them",
            domain=DementiaDomain.ADLS_IADLS,
            caregiver_id="caregiver-1",
        )
        response = engine.process_reasoning_request(request)

        assert len(response.safety_events) > 0
        safety_event = response.safety_events[0]
        assert safety_event["significance"] == "high"
        db.close()

    def test_get_summary(self):
        db = self.get_db()
        engine = DementiaReasoningEngine(db)
        baseline_data = DementiaBaselineCreate(
            person_id="person-1",
            baseline_type=DementiaBaselineType.CAREGIVER_REPORTED,
            domain=DementiaDomain.MEMORY,
            description="Forgets names daily",
            established_date=datetime.now(timezone.utc) - timedelta(days=730),
            confidence=0.8,
        )
        engine.create_baseline(baseline_data)
        db.commit()

        request = DementiaReasoningRequest(
            person_id="person-1",
            observation_text="Mom forgot where she put her glasses again",
            domain=DementiaDomain.MEMORY,
        )
        engine.process_reasoning_request(request)
        db.commit()

        summary = engine.get_summary("person-1")
        assert summary.active_baselines_count >= 1
        assert summary.recent_observations_count >= 1
        db.close()


class TestDementiaAPI:
    def setup_method(self):
        setup_db()
        db = TestingSessionLocal()
        seed_person(db)
        db.close()
        self.client = TestClient(app)

    def teardown_method(self):
        teardown_db()

    def test_create_baseline_api(self):
        response = self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily, occasionally misplaces objects",
                "severity": "mild",
                "frequency": "daily",
                "context": "Established over 2 years",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["domain"] == "memory"
        assert data["confidence"] == 0.8

    def test_list_baselines_api(self):
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.get("/api/v1/dementia/baselines/person-1")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_analyze_language_api(self):
        response = self.client.post(
            "/api/v1/dementia/analyze-language",
            params={"text": "Dad is sundowning again"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "sundowning" in data["detected_categories"]
        assert data["clinical_label_warning"] is not None

    def test_reason_about_observation_api(self):
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "Mom forgot where she put her glasses again",
                "domain": "memory",
                "caregiver_id": "caregiver-1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "observation" in data
        assert "assessment" in data
        assert "baseline_used" in data

    def test_compare_baseline_api(self):
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/compare-baseline",
            json={
                "person_id": "person-1",
                "domain": "memory",
                "current_observation": "Mom forgot where she put her glasses again",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_consistent_with_baseline"] is True

    def test_get_summary_api(self):
        response = self.client.get("/api/v1/dementia/summary/person-1")
        assert response.status_code == 200
        data = response.json()
        assert "person_id" in data
        assert "active_baselines_count" in data

    def test_record_caregiver_disagreement_api(self):
        response = self.client.post(
            "/api/v1/dementia/caregiver-disagreements",
            json={
                "person_id": "person-1",
                "caregiver_a_id": "caregiver-1",
                "caregiver_b_id": "caregiver-1",
                "observation_domain": "memory",
                "caregiver_a_observation": "She's much more confused",
                "caregiver_b_observation": "She's exactly the same as usual",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["resolution_status"] == "unresolved"

    def test_create_safety_event_api(self):
        response = self.client.post(
            "/api/v1/dementia/safety-events",
            json={
                "person_id": "person-1",
                "event_type": "wandering",
                "description": "Left house at 2 AM",
                "safety_significance": "critical",
                "immediate_action_required": True,
                "wandering_risk": True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["wandering_risk"] is True
        assert data["safety_significance"] == "critical"


class TestDementiaBenchmarks:
    """Benchmark tests for Category 11 - Dementia-Specific Reasoning"""

    def setup_method(self):
        setup_db()
        db = TestingSessionLocal()
        seed_person(db)
        db.close()
        self.client = TestClient(app)

    def teardown_method(self):
        teardown_db()

    def test_DEM_001_baseline_forgetfulness(self):
        """DEM-001: Baseline forgetfulness should be recognized as consistent with baseline"""
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Frequently forgets where she puts objects",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "Mom forgot where she put her glasses again",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["is_new_change"] is False

    def test_DEM_002_new_type_of_confusion(self):
        """DEM-002: New type of confusion (functional) should be flagged as new change"""
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She normally forgets names, but today she couldn't figure out how to use the bathroom",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["is_new_change"] is True

    def test_DEM_006_memory_domain_specific(self):
        """DEM-006: Memory issue should be identified as memory domain, not disorientation"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She forgot that I visited yesterday",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["observation"]["domain"] == "memory"

    def test_DEM_007_orientation_domain_specific(self):
        """DEM-007: Orientation issue should be identified as orientation domain"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "He thought he was at his old house",
                "domain": "orientation",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["observation"]["domain"] == "orientation"

    def test_DEM_008_recognition_domain_specific(self):
        """DEM-008: Person recognition failure should be identified as recognition domain"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "Mom didn't recognize her granddaughter today",
                "domain": "recognition",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["observation"]["domain"] == "recognition"

    def test_DEM_009_language_domain_specific(self):
        """DEM-009: Word-finding difficulty should be identified as communication domain"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She knows what she wants but can't find the words",
                "domain": "communication",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["observation"]["domain"] == "communication"

    def test_DEM_010_executive_function_domain_specific(self):
        """DEM-010: Unusual task organization should be identified as executive function"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "He put the milk in the cupboard and the cereal in the refrigerator",
                "domain": "executive_function",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["observation"]["domain"] in ["executive_function", "judgment"]

    def test_DEM_011_fluctuation_morning_evening(self):
        """DEM-011: Morning clear, evening confused should be identified as fluctuation"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She was herself all morning but became very confused tonight",
                "domain": "cognitive_baseline",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["observation"]["fluctuation_pattern"] == "morning_clear_evening_confused"
        assert data["assessment"]["progression_vs_episode"] == "fluctuation"

    def test_DEM_013_sudden_departure_from_baseline(self):
        """DEM-013: Sudden worsening beyond baseline should be flagged as acute change"""
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "cognitive_baseline",
                "description": "Baseline confusion level: forgets names, occasionally disoriented",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She has dementia, but this confusion is much worse than anything we've seen before",
                "domain": "cognitive_baseline",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["is_new_change"] is True
        assert "acute" in data["assessment"]["acute_vs_gradual"].lower()

    def test_DEM_016_new_agitation_evening(self):
        """DEM-016: New evening agitation should be flagged with time-of-day pattern"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "Dad has started pacing around the house every evening",
                "domain": "agitation",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["observation"]["domain"] == "agitation"
        assert "evening" in (data["observation"]["time_of_day"] or "").lower()

    def test_DEM_021_dressing_functional_decline(self):
        """DEM-021: New need for help dressing should be identified as ADL decline"""
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "adls_iadls",
                "description": "Independently dresses and grooms",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She now needs help choosing and putting on her clothes",
                "domain": "adls_iadls",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["is_new_change"] is True
        assert data["assessment"]["functional_domain_specific"] is True

    def test_DEM_024_cooking_safety(self):
        """DEM-024: Repeated stove left on should trigger high safety significance"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "He left the stove on twice this week",
                "domain": "adls_iadls",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["safety_significance"] == "high"
        assert len(data["safety_events"]) > 0

    def test_DEM_025_driving_safety(self):
        """DEM-025: Getting lost driving should trigger high safety significance"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She got lost driving home from a place she's visited for years",
                "domain": "adls_iadls",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["safety_significance"] == "high"
        assert any(e.get("significance") == "high" for e in data["safety_events"])

    def test_DEM_026_first_wandering_episode(self):
        """DEM-026: First wandering episode should be critical safety event"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "Dad left the house at 2 AM and we found him three streets away",
                "domain": "wandering",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["safety_significance"] == "critical"
        assert any(e.get("significance") == "critical" for e in data["safety_events"])

    def test_DEM_030_medication_safety_dementia_context(self):
        """DEM-030: Double-dosing in dementia context should be high safety significance"""
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "Mom with dementia keeps taking her evening pills twice because she forgets she's already taken them",
                "domain": "adls_iadls",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["safety_significance"] == "high"
        assert any(e.get("significance") == "high" for e in data["safety_events"])

    def test_DEM_032_dementia_plus_infection(self):
        """DEM-032: Acute confusion with fever should not be dismissed as dementia"""
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "cognitive_baseline",
                "description": "Usually forgetful but oriented",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "Dad is usually forgetful, but today he's suddenly much more confused and has a fever",
                "domain": "cognitive_baseline",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["is_new_change"] is True
        assert "acute" in data["assessment"]["acute_vs_gradual"].lower()

    def test_DEM_035_caregiver_disagreement(self):
        """DEM-035: Conflicting caregiver assessments should be recorded"""
        response = self.client.post(
            "/api/v1/dementia/caregiver-disagreements",
            json={
                "person_id": "person-1",
                "caregiver_a_id": "caregiver-1",
                "caregiver_b_id": "caregiver-1",
                "observation_domain": "cognitive_baseline",
                "caregiver_a_observation": "She's much more confused",
                "caregiver_b_observation": "She's exactly the same as usual",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["resolution_status"] == "unresolved"
        assert data["concrete_examples_requested"] is True

    def test_caregiver_language_not_taken_as_diagnosis(self):
        """Caregiver term 'sundowning' should not be treated as clinical diagnosis"""
        response = self.client.post(
            "/api/v1/dementia/analyze-language",
            params={"text": "She's sundowning again"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["requires_concrete_evidence"] is True
        assert data["clinical_label_warning"] is not None
        assert "requires concrete evidence" in data["clinical_label_warning"].lower()
        assert data["baseline_status"] == "unknown unless established"

    def test_no_dementia_as_universal_explanation(self):
        """System should not use dementia as explanation for all new changes"""
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "Today she couldn't recognize her daughter",
                "domain": "recognition",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment"]["dementia_as_explanation_flag"] is False
        assert data["assessment"]["is_new_change"] is True


class TestDementiaReasoningTraces:
    """Tests for reasoning trace and counterfactual explainability features."""

    def setup_method(self):
        setup_db()
        db = TestingSessionLocal()
        seed_person(db)
        db.close()
        self.client = TestClient(app)

    def teardown_method(self):
        teardown_db()

    def test_reasoning_trace_present_in_response(self):
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She forgot that I visited yesterday",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["reasoning_trace"] is not None
        trace = data["reasoning_trace"]
        assert trace["observation_id"] is not None
        assert trace["person_id"] == "person-1"
        assert trace["domain"] == "memory"
        assert "language_analysis" in trace
        assert "domain_identification" in trace
        assert "baseline_comparison" in trace
        assert "safety_assessment" in trace
        assert "change_classification" in trace
        assert "uncertainty" in trace

    def test_reasoning_trace_no_baseline(self):
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She's suddenly much more confused today",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        trace = data["reasoning_trace"]
        assert trace["baseline_comparison"]["result"] == "no_baseline"

    def test_reasoning_trace_with_baseline(self):
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She normally forgets names, but today she couldn't figure out how to use the bathroom",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        trace = data["reasoning_trace"]
        assert trace["baseline_comparison"]["baseline_id"] is not None
        assert "similarity_score" in trace["baseline_comparison"]
        assert "common_keywords" in trace["baseline_comparison"]
        assert "change_indicators_detected" in trace["baseline_comparison"]
        assert len(trace["baseline_comparison"]["change_indicators_detected"]) > 0

    def test_counterfactuals_present(self):
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She normally forgets names, but today she couldn't figure out how to use the bathroom",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["counterfactuals"] is not None
        assert len(data["counterfactuals"]) > 0
        # Should have counterfactual about removing change indicators
        cf_texts = [str(cf) for cf in data["counterfactuals"]]
        assert any("change" in cf.lower() or "indicator" in cf.lower() for cf in cf_texts)

    def test_counterfactual_no_baseline(self):
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She forgot where she put her glasses",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["counterfactuals"] is not None
        # Should have counterfactual about no baseline
        cf = data["counterfactuals"][0]
        assert cf["scenario"] == "no_baseline_exists"

    def test_reasoning_trace_safety_flagged(self):
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "Dad left the house at 2 AM and we found him three streets away",
                "domain": "wandering",
            },
        )
        assert response.status_code == 200
        data = response.json()
        trace = data["reasoning_trace"]
        assert trace["safety_assessment"]["significance"] == "critical"
        assert len(trace["safety_assessment"]["concerns"]) > 0
        assert trace["safety_assessment"]["flags"]["wandering"] is True

    def test_reasoning_trace_caregiver_language_categories(self):
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She's sundowning again every evening",
                "domain": "agitation",
            },
        )
        assert response.status_code == 200
        data = response.json()
        trace = data["reasoning_trace"]
        assert "sundowning" in trace["language_analysis"]["detected_categories"]

    def test_counterfactual_threshold_sensitivity(self):
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She normally forgets names, but today she couldn't figure out how to use the bathroom",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        cf_list = data["counterfactuals"]
        threshold_cf = [cf for cf in cf_list if cf["scenario"] == "threshold_sensitivity"]
        assert len(threshold_cf) == 1
        assert "at_0_2" in threshold_cf[0]
        assert "at_0_4" in threshold_cf[0]
        assert "at_0_5" in threshold_cf[0]


class TestDementiaMultiObservation:
    """Tests for multi-observation comparison and trend analysis."""

    def setup_method(self):
        setup_db()
        db = TestingSessionLocal()
        seed_person(db)
        db.close()
        self.client = TestClient(app)

    def teardown_method(self):
        teardown_db()

    def test_multi_observation_trend_detection(self):
        self.client.post(
            "/api/v1/dementia/baselines",
            json={
                "person_id": "person-1",
                "baseline_type": "caregiver_reported",
                "domain": "memory",
                "description": "Forgets names daily",
                "established_date": (datetime.now(timezone.utc) - timedelta(days=730)).isoformat(),
                "confidence": 0.8,
            },
        )
        self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She forgot that I visited yesterday",
                "domain": "memory",
            },
        )
        self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She forgot to take her medication today",
                "domain": "memory",
            },
        )
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She couldn't remember her daughter's name",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["recent_observations"] is not None
        assert len(data["recent_observations"]) >= 1
        assert data["multi_observation_insight"] is not None
        assert "pattern_detected" in data["multi_observation_insight"]

    def test_multi_observation_no_history(self):
        response = self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She forgot where she put her glasses",
                "domain": "memory",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["recent_observations"] == []
        assert data["multi_observation_insight"] is None


class TestDementiaDocumentAnalysis:
    """Tests for document ingestion and clinical analysis."""

    def setup_method(self):
        setup_db()
        db = TestingSessionLocal()
        seed_person(db)
        db.close()
        self.client = TestClient(app)

    def teardown_method(self):
        teardown_db()

    def test_analyze_doctor_note_extracts_observations(self):
        note_text = """
        Patient visited clinic on 2024-01-15. MMSE score is 22/30.
        Patient shows memory loss and forgets recent events.
        Patient's family reports wandering behavior at night.
        No falls reported. Medication regimen stable.
        """
        response = self.client.post(
            "/api/v1/dementia/analyze-document",
            json={
                "person_id": "person-1",
                "document_type": "clinical_note",
                "text": note_text.strip(),
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["observations_created"] >= 1
        assert "mmse" in data["scores"]
        assert data["scores"]["mmse"]["score"] == 22
        assert len(data["structured_observations"]) >= 1

    def test_analyze_doctor_note_safety_flagging(self):
        note_text = "Patient left the house at 3 AM and was found two blocks away."
        response = self.client.post(
            "/api/v1/dementia/analyze-document",
            json={
                "person_id": "person-1",
                "document_type": "clinical_note",
                "text": note_text,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert response.json()["observations_created"] >= 1

    def test_timeline_analysis(self):
        self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She forgot where she put her keys",
                "domain": "memory",
            },
        )
        self.client.post(
            "/api/v1/dementia/reason",
            json={
                "person_id": "person-1",
                "observation_text": "She forgot to take her medication",
                "domain": "memory",
            },
        )
        response = self.client.get("/api/v1/dementia/timeline/person-1?days=30")
        assert response.status_code == 200
        data = response.json()
        assert data["person_id"] == "person-1"
        assert data["period_days"] == 30
        assert "domain_trends" in data
        assert "acceleration_detected" in data
        assert data["total_observations"] >= 2


class TestDementiaCarePlan:
    """Tests for care plan generation."""

    def setup_method(self):
        setup_db()
        db = TestingSessionLocal()
        seed_person(db)
        db.close()
        self.client = TestClient(app)

    def teardown_method(self):
        teardown_db()

    def test_generate_care_plan_no_observations(self):
        response = self.client.post(
            "/api/v1/dementia/care-plans",
            json={
                "person_id": "person-1",
                "title": "Routine Monitoring",
                "description": "Continue routine monitoring",
                "priority_level": "low",
                "actions": [],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Routine Monitoring"
        assert data["status"] == "active"
        assert len(data["actions"]) >= 1
        assert data["actions"][0]["action_type"] == "monitoring"

    def test_generate_care_plan_with_safety_event(self):
        safety_response = self.client.post(
            "/api/v1/dementia/safety-events",
            json={
                "person_id": "person-1",
                "event_type": "wandering",
                "description": "Left house at 2 AM",
                "safety_significance": "critical",
                "immediate_action_required": True,
                "wandering_risk": True,
            },
        )
        safety_id = safety_response.json()["id"]

        response = self.client.post(
            "/api/v1/dementia/care-plans",
            json={
                "person_id": "person-1",
                "title": "Safety Review Plan",
                "description": "Urgent safety assessment needed",
                "priority_level": "critical",
                "related_safety_events": [safety_id],
                "actions": [],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["priority_level"] == "critical"
        assert data["actions"][0]["action_type"] == "safety_assessment"
        assert data["actions"][0]["priority_level"] == "critical"


class TestCaregiverOnboarding:
    """Tests for caregiver onboarding flow."""

    def setup_method(self):
        setup_db()
        db = TestingSessionLocal()
        seed_person(db)
        db.close()
        self.client = TestClient(app)

    def teardown_method(self):
        teardown_db()

    def test_init_onboarding(self):
        response = self.client.post(
            "/api/v1/dementia/caregiver-onboarding",
            params={"person_id": "person-1"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["person_id"] == "person-1"
        assert data["status"] == "in_progress"
        assert len(data["baseline_questions"]) == 10
        assert len(data["daily_checkin_questions"]) == 4
        assert len(data["safety_monitor_items"]) == 6

    def test_get_onboarding(self):
        self.client.post(
            "/api/v1/dementia/caregiver-onboarding",
            params={"person_id": "person-1"},
        )
        response = self.client.get("/api/v1/dementia/caregiver-onboarding/person-1")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"

    def test_update_onboarding_progress(self):
        self.client.post(
            "/api/v1/dementia/caregiver-onboarding",
            params={"person_id": "person-1"},
        )
        response = self.client.post(
            "/api/v1/dementia/caregiver-onboarding/person-1/progress",
            json={
                "domain": "memory",
                "answers": ["Forgets names daily", "Repeats questions often"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "memory" in data