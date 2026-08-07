# SolenOS

A trust-first living care record.

## Philosophy

SolenOS is built on the belief that in healthcare, trust is the feature. Every product decision should strengthen:
- Trust
- Evidence
- Transparency
- Uncertainty handling
- Continuity
- Accuracy
- Explainability
- Reliability

See `docs/philosophy.md` for the full product philosophy.

## Architecture

- **Backend**: FastAPI + SQLAlchemy (Python)
- **Frontend**: React + Vite (TypeScript)
- **Database**: SQLite (default), upgradeable to PostgreSQL

## Getting Started

### Backend
```bash
cd backend
pip install -e .
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Principles

1. **Trust Over Features** - Every capability must strengthen trust, continuity, evidence, transparency, or cognitive load reduction.
2. **Evidence Over Intelligence** - Every insight links back to its source.
3. **Transparency Over Hidden Reasoning** - Show known, possible, and unknown clearly.
4. **Uncertainty Is a Feature** - Never hide what is not known.
5. **Calm Over Clever** - Reduce caregiver anxiety, don't impress.
6. **Build for the Worst Day** - Hospital discharges, late-night confusion, exhaustion.
