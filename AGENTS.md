# SolenOS AGENTS

## Commands
- Backend dev: `cd backend && pip install -e . && uvicorn app.main:app --reload`
- Frontend dev: `cd frontend && npm install && npm run dev`
- Run tests: `cd backend && pytest` (if pytest is configured)
- Lint backend: `cd backend && ruff check .`
- Lint frontend: `cd frontend && npm run lint` (if configured)

## Architecture
- Backend: FastAPI, SQLAlchemy 2.0, Pydantic v2
- Frontend: React 18 + Vite + TypeScript
- Data model in `backend/app/models/care.py`
- Schemas in `backend/app/schemas/care.py`
- API routes in `backend/app/api/v1.py`
- Frontend pages in `frontend/src/pages/`

## Trust Rules (immutable)
1. Every insight must have evidence_ids and confidence.
2. Every insight must have possible_context (what is still unknown).
3. Original caregiver text is never replaced by AI language.
4. Corrections are logged and acknowledged.
5. No silent updates or deletions.
