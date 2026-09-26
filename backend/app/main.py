"""Main application entry point for the SolenOS Meaning Engine."""

from __future__ import annotations

from fastapi import FastAPI

from app.api.action import router as action_router
from app.api.meaning import router as meaning_router

app = FastAPI(
    title="SolenOS Meaning Engine",
    description="Action Intelligence Engine for care reasoning",
    version="1.0.0",
)

app.include_router(action_router)
app.include_router(meaning_router)
