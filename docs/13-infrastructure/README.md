# SolenOS infrastructure

## Hosting boundary

- **Frontend:** Next.js (React + TypeScript), built and published by **Netlify** from this repository.
- **Backend API:** FastAPI, deployed separately on Railway.
- **Database:** PostgreSQL; schema changes are managed by the backend Alembic migration chain.

## Netlify frontend configuration

The root `netlify.toml` is the source of truth for the frontend build:

- Build command: `npm test && npm run build`
- Publish directory: `.next`
- Node.js: 20
- Netlify's Next.js plugin adapts the Next.js build output for Netlify hosting.
- `/api/v1/*` and `/api/situation` are proxied to the Railway backend.

Keep the application framework, build scripts, Netlify plugin, and deployment configuration aligned. When changing the backend API origin, update the Netlify proxy target deliberately and verify the resulting deployed endpoint.

## Local development

```powershell
npm ci
npm run dev
```

The Next.js development server defaults to port 3000. Run `npm run typecheck`, the repository's test command, and `npm run build` before considering a frontend change verified.

## Environment and secrets

Set deploy/runtime secrets in the relevant hosting environment, not in source control. Never commit live API keys, database credentials, bearer tokens, or private environment files. If a live credential has entered Git history or chat, rotate it.

## Deployment verification

A successful GitHub Actions run proves repository checks only. It does not prove that Netlify published the intended commit, that the Railway API is healthy, or that live PostgreSQL migrations and document OCR work. Verify the Netlify deploy commit separately and run the gated staging integration workflow before claiming the full stack is verified.
