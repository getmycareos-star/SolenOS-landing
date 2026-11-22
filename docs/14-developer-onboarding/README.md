# 14 — Developer Onboarding

## Goal

Run the caregiver application locally, understand the Living Care Record as the source of truth, and verify the authenticated backend workflows.

## Run locally

```powershell
npm install
copy .env.local.example .env.local
npm run dev
```

The frontend does not require a Gemini or OpenAI API key. Configure the existing private Qwen/Ollama service on the backend using its deployment environment settings (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and bounded runtime settings). Never expose the private model URL or credentials to browser code.

## Architecture overview

1. The caregiver enters information through the authenticated workspace.
2. The frontend sends requests through the shared API client with the server-issued bearer session.
3. The backend scopes access to the caregiver's record and retrieves authorized source information.
4. Qwen supports extraction and explanation through the existing backend gateway.
5. Validation, reconciliation and explicit caregiver review control what becomes part of the Living Care Record.

## Core verification

```powershell
npm run verify:product-path
npm run verify:product-identity
npm run verify:langchain
npm run verify:analyze
```

The legacy `/api/analyze` endpoint is retired. Its verification script checks that it remains closed; it is not a caregiver product gate.

## Done means

Code changes, relevant tests, deployment evidence and documentation must agree. A queued deployment or a successful source commit is not proof that deployed Qwen inference or the complete caregiver workflow works.
