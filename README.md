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
- **Frontend**: HTML + JavaScript (served by the backend at `/`)
- **Database**: SQLite (default), upgradeable to PostgreSQL
- **Document Processing**: pypdf (PDF), Pillow + pytesseract (image OCR), built-in text/zip parsing (TXT, DOCX)

## Getting Started

### Backend
```bash
cd backend
pip install -e .
uvicorn app.main:app --reload
```

### Usage
1. Start the server (`uvicorn app.main:app --reload`)
2. Open `http://localhost:8000/` in a browser
3. Enter your Caregiver ID and Person ID
4. Select a supported document (TXT, PDF, DOCX, PNG, JPG, GIF, BMP, TIFF)
5. Click "Upload & Process"
6. View extraction results, detected situations, and care state in the UI

### Supported File Types
- **Text files**: `.txt` — direct text extraction
- **PDFs**: `.pdf` — text layer extraction via pypdf
- **Word documents**: `.docx` — XML parsing via zipfile
- **Images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.tiff` — OCR via Tesseract (if installed)
- Files up to 50MB are accepted

## Principles

1. **Trust Over Features** - Every capability must strengthen trust, continuity, evidence, transparency, or cognitive load reduction.
2. **Evidence Over Intelligence** - Every insight links back to its source.
3. **Transparency Over Hidden Reasoning** - Show known, possible, and unknown clearly.
4. **Uncertainty Is a Feature** - Never hide what is not known.
5. **Calm Over Clever** - Reduce caregiver anxiety, don't impress.
6. **Build for the Worst Day** - Hospital discharges, late-night confusion, exhaustion.
