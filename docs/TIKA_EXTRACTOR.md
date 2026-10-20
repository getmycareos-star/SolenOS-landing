# SolenOS — Apache Tika Extraction Layer

**Module:** `src/lib/tika-extractor/`  
**Role:** Pre-cognition ingestion adapter only.

## Boundary

```
File Upload → tika-extractor → raw text string → /api/analyze → SolenOS runtime
```

Tika does **not** import kernel, store, classification, or decision logic.

## Function

```typescript
extractText(file: File): Promise<string>
```

- Success: raw extracted text (plain string)
- Failure: `ERROR: extraction_failed`

## Backends (deterministic, no LLM)

1. **Plain text** — direct UTF-8 decode
2. **Apache Tika** — REST server (`TIKA_SERVER_URL`, default `http://127.0.0.1:9998`) or `java -jar` via `TIKA_JAR_PATH`
3. **Tesseract OCR** — images when `TESSERACT_OCR=1` (default on) via `tesseract.js`

## API

```
POST /api/v1/ingest/extract
Content-Type: multipart/form-data
field: file

Response: text/plain (raw string only)
```

Then POST extracted text to `/api/analyze` or `/api/v1/runtime/execute`.

## Run Tika Server (optional)

```bash
java -jar tika-server-standard.jar
# listens on http://127.0.0.1:9998
```

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `TIKA_SERVER_URL` | `http://127.0.0.1:9998` | Tika REST base URL |
| `TIKA_JAR_PATH` | — | Fallback: `java -jar` text extraction |
| `TESSERACT_OCR` | `1` | Enable OCR for images (`0` to disable) |
