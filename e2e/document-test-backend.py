"""Test-only FastAPI runner with deterministic document extraction.

This runner is used only by the isolated Playwright CI workflow. It keeps the
real PostgreSQL upload, OCR, review, LCR and Companion APIs, while replacing
the external inference boundary with verbatim candidates from the test document.
It must never be used by a production deployment.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

if os.getenv("APP_ENV") != "test":
    raise RuntimeError("The deterministic document backend is restricted to APP_ENV=test.")

backend_root = Path(os.environ["BACKEND_SERVICE_DIR"]).resolve()
sys.path.insert(0, str(backend_root))

os.environ.setdefault("SOLENOS_QWEN_WORKER_ENABLED", "true")
os.environ.setdefault("OLLAMA_BASE_URL", "http://127.0.0.1:9")
os.environ.setdefault("OLLAMA_MODEL", "deterministic-test-extractor")
os.environ.setdefault("OLLAMA_TIMEOUT_SECONDS", "5")
os.environ.setdefault("SOLENOS_REQUIRE_LIVE_QWEN", "0")

from app.api import document_intelligence  # noqa: E402


def deterministic_candidates(
    text: str,
    *,
    source_event_id: str,
    source_evidence_id: str | None = None,
) -> dict[str, object]:
    source = str(text or "")
    quotes = (
        "Patient walked 20 metres with a frame on 12 October.",
        "The patient reports eating half of lunch on 2026-11-10 during the observation period.",
    )
    observations = [
        {
            "subject": "Patient",
            "observation": quote,
            "source_quote": quote,
            "event_date": "2026-11-10" if quote.startswith("The patient reports") else None,
            "extraction_method": "test_verbatim",
        }
        for quote in quotes
        if quote in source
    ]
    return {
        "observations": observations,
        "open_questions": ["Was this usual for the person?"] if observations else [],
    }


document_intelligence.extract_review_candidates = deterministic_candidates

from app.main import app  # noqa: E402


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("API_HOST", "127.0.0.1"),
        port=int(os.getenv("API_PORT", "8000")),
        log_level="info",
    )
