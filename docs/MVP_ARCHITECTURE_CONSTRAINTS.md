# MVP Architecture Constraints — Current Caregiver Path

> **Product identity:** SolenOS is a Living Care Record for family caregivers. The caregiver product enters through authenticated backend APIs; the backend PostgreSQL record is authoritative.

## Active inference boundary

| Layer | Current implementation |
|---|---|
| Caregiver API | Authenticated FastAPI routes behind the frontend API client |
| Model | Qwen through the existing private Railway Ollama service |
| Gateway | Backend `app.services.qwen_gateway`; native Ollama API |
| Frontend | No direct browser-to-Ollama connection |
| Validation | Backend source checks plus workflow-specific frontend/backend schemas |
| Record changes | Model output is a proposal; existing review and caregiver-approval paths govern accepted changes |

The legacy `POST /api/analyze` route is retired and returns HTTP 410. Its former Gemini pipeline is not a caregiver entry point.

## Configuration

| Setting | Owner | Purpose |
|---|---|---|
| `OLLAMA_BASE_URL` | Backend deployment | Private Ollama service URL |
| `OLLAMA_MODEL` | Backend deployment | Configured Qwen model |
| `OLLAMA_TIMEOUT_SECONDS` | Backend deployment | Bounded inference timeout |
| `OLLAMA_NUM_CTX`, `OLLAMA_NUM_THREADS`, `OLLAMA_NUM_PREDICT` | Backend deployment | Resource limits |

No Gemini or OpenAI-hosted inference key is required by the active caregiver inference path. Do not add provider selectors or browser-side model credentials.
