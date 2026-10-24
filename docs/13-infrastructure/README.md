# SolenOS infrastructure

## Hosting boundary

- **Frontend:** React + TypeScript + Vite, built and published by **Netlify** from this repository.
- **Backend API:** FastAPI, deployed separately on Railway.
- **Database:** PostgreSQL; schema changes are managed by the backend Alembic migration chain.
- **No Vercel deployment is part of the SolenOS hosting architecture.** Do not add Vercel build scripts, configuration, deployment workflows, or required Vercel preview checks to this repository.
- The repository does not contain a `vercel.json`; `.vercel/` is ignored. Existing Vercel GitHub-App/project connections must be disconnected in the external Vercel/GitHub settings because repository commits cannot revoke an external integration.

## Netlify frontend configuration

The root `netlify.toml` is the source of truth for the frontend build:

- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: 20
- `/api/*` is proxied to the backend.
- All other paths fall back to `/index.html` for React Router.

Do not replace this with Next.js, `.next`, or Vercel build settings. When changing the backend API origin, update the Netlify proxy target deliberately and verify the resulting deployed endpoint.

## Local development

```powershell
npm ci
npm run dev
```

The Vite development server defaults to port 5173. Run `npm run typecheck`, `npm test -- --runInBand`, and `npm run build` before considering a frontend change verified.

## Environment and secrets

Set deploy/runtime secrets in the relevant hosting environment, not in source control. Never commit live API keys, database credentials, bearer tokens, or private environment files. If a live credential has entered Git history or chat, rotate it.

## Deployment verification

A successful GitHub Actions run proves repository checks only. It does not prove that Netlify published the intended commit, that the Railway API is healthy, or that live PostgreSQL migrations and document OCR work. Verify the Netlify deploy commit separately and run the gated staging integration workflow before claiming the full stack is verified.
