from typing import Optional


US_TIMEZONES = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
]

CARE_SETTINGS = [
    "home",
    "emergency_department",
    "hospital",
    "icu",
    "rehabilitation",
    "skilled_nursing_facility",
    "memory_care",
    "assisted_living",
    "pharmacy",
    "laboratory",
    "urgent_care",
    "primary_care_clinic",
    "specialist_office",
    "home_health_visit",
]

CARE_TRANSITION_SEQUENCES = {
    "hospital_discharge": [
        "hospital",
        "home",
        "rehabilitation",
        "skilled_nursing_facility",
    ],
    "emergency_visit": ["emergency_department", "hospital", "icu", "home"],
    "routine_follow_up": ["home", "primary_care_clinic", "home"],
    "specialist_visit": ["home", "specialist_office", "home"],
    "full_course": [
        "home",
        "emergency_department",
        "hospital_admission",
        "icu",
        "medical_ward",
        "rehabilitation",
        "home",
        "primary_care_follow_up",
    ],
}

STATE_TIMEZONE_MAP = {
    "NY": "America/New_York",
    "PA": "America/New_York",
    "FL": "America/New_York",
    "MA": "America/New_York",
    "CT": "America/New_York",
    "NJ": "America/New_York",
    "IL": "America/Chicago",
    "TX": "America/Chicago",
    "MO": "America/Chicago",
    "CO": "America/Denver",
    "AZ": "America/Phoenix",
    "UT": "America/Denver",
    "CA": "America/Los_Angeles",
    "WA": "America/Los_Angeles",
    "OR": "America/Los_Angeles",
    "AK": "America/Anchorage",
    "HI": "Pacific/Honolulu",
}

PROVIDER_LOCATION_TYPES = [
    "primary_care_clinic",
    "specialist_office",
    "hospital",
    "urgent_care",
    "emergency_department",
    "pharmacy",
    "laboratory",
    "rehabilitation",
    "skilled_nursing_facility",
    "memory_care",
    "assisted_living",
]


def validate_timezone(tz: Optional[str]) -> Optional[str]:
    if not tz:
        return None
    if tz in US_TIMEZONES:
        return tz
    return None


def get_timezone_for_state(state: Optional[str]) -> Optional[str]:
    if not state:
        return None
    state = state.upper()
    return STATE_TIMEZONE_MAP.get(state)


def parse_location_text(text: str) -> dict:
    text_lower = text.lower()
    matched_setting = None
    for setting in CARE_SETTINGS:
        if setting.replace("_", " ") in text_lower or setting in text_lower:
            matched_setting = setting
            break
    return {
        "original_text": text,
        "parsed_location_type": matched_setting,
        "confidence": 0.8 if matched_setting else 0.3,
    }


def detect_care_transition(
    from_location: Optional[str], to_location: str, transition_type: Optional[str] = None
) -> dict:
    transition = {
        "from_location": from_location,
        "to_location": to_location,
        "transition_type": transition_type or "unknown",
        "is_significant": from_location is not None and from_location != to_location,
    }
    return transition


def get_location_context(location_type: str) -> dict:
    context = {
        "location_type": location_type,
        "urgency_multiplier": 1.0,
        "coordination_notes": [],
    }
    if location_type in ["emergency_department", "icu"]:
        context["urgency_multiplier"] = 3.0
        context["coordination_notes"].append("High urgency - notify all caregivers immediately")
    elif location_type in ["hospital", "urgent_care"]:
        context["urgency_multiplier"] = 2.0
        context["coordination_notes"].append("Notify primary caregiver")
    elif location_type in [
        "rehabilitation",
        "skilled_nursing_facility",
        "memory_care",
        "assisted_living",
    ]:
        context["urgency_multiplier"] = 1.5
        context["coordination_notes"].append("Coordinate with facility staff")
    elif location_type == "home":
        context["coordination_notes"].append("Standard home care coordination")
    return context


def infer_transition_type(from_location: Optional[str], to_location: str) -> str:
    if from_location == to_location:
        return "no_change"

    from_lower = (from_location or "").lower().replace(" ", "_")
    to_lower = to_location.lower().replace(" ", "_")

    if to_lower in ["emergency_department", "emergency"]:
        return "emergency_visit"
    if "hospital" in to_lower and from_lower not in ["hospital", "icu"]:
        return "hospital_admission"
    if from_lower in ["hospital", "icu"] and to_lower == "home":
        return "hospital_discharge"
    if from_lower in ["hospital", "icu"] and to_lower == "rehabilitation":
        return "transition_to_rehab"
    if to_lower in ["rehabilitation", "skilled_nursing_facility"]:
        return "transition_to_facility"
    if to_lower == "home" and from_lower in [
        "rehabilitation",
        "skilled_nursing_facility",
    ]:
        return "return_home"
    if from_lower == "home" and to_lower in ["primary_care_clinic", "specialist_office"]:
        return "routine_follow_up"
    if from_lower == "home" and to_lower in ["pharmacy", "laboratory"]:
        return "errand"
    if to_lower == "home":
        return "return_home"

    return "care_transition"


def is_care_transition_significant(from_location: Optional[str], to_location: str) -> bool:
    if from_location is None:
        return False
    if from_location == to_location:
        return False
    return True


def get_nearby_providers(
    location_type: str, radius_miles: int = 25
) -> list[dict]:
    provider_map = {
        "primary_care_clinic": ["Primary Care Clinic", "Family Medicine"],
        "specialist_office": ["Specialist Office", "Specialty Care"],
        "hospital": ["Hospital", "Medical Center"],
        "urgent_care": ["Urgent Care Center"],
        "emergency_department": ["Hospital ER", "Emergency Department"],
        "pharmacy": ["Pharmacy", "Drug Store"],
        "laboratory": ["Laboratory", "Lab Corp"],
        "rehabilitation": ["Rehabilitation Center", "Physical Therapy"],
        "skilled_nursing_facility": ["Skilled Nursing Facility", "SNF"],
        "memory_care": ["Memory Care Facility"],
        "assisted_living": ["Assisted Living Facility"],
        "home_health_visit": ["Home Health Agency"],
    }

    providers = provider_map.get(location_type, [location_type])
    return [
        {
            "type": location_type,
            "provider_name": p,
            "distance_miles": radius_miles,
            "location_type": location_type,
        }
        for p in providers
    ]


def calculate_travel_time(
    from_location: dict, to_location: dict, method: str = "driving"
) -> Optional[dict]:
    if not from_location or not to_location:
        return None

    if method == "driving":
        base_minutes = 15
        return {
            "method": "driving",
            "estimated_minutes": base_minutes,
            "note": "Estimate only - actual time may vary",
        }
    return None


def enrich_location_with_geographic_intelligence(location: dict) -> dict:
    location_type = location.get("location_type", "")
    context = get_location_context(location_type)
    nearby = get_nearby_providers(location_type)

    return {
        "location": location,
        "context": context,
        "nearby_providers": nearby,
    }


def format_location_for_display(location: dict, timezone: Optional[str] = None) -> str:
    parts = [location.get("name", "Unknown location")]
    if location.get("city"):
        parts.append(location.get("city"))
    if location.get("state"):
        parts.append(location.get("state"))
    if location.get("timezone"):
        parts.append(f"({location.get('timezone')})")
    return ", ".join(parts)
