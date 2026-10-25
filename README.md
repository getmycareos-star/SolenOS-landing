# SolenOS

**A Living Care Record for family caregivers.** The care journey, remembered.

SolenOS helps families preserve care context over time: what happened, what changed, what remains uncertain, and what needs to be clarified next.

## Architecture and hosting

- **Frontend:** Next.js App Router + React + TypeScript.
- **Frontend hosting:** Netlify only, using the Netlify Next.js runtime.
- **Backend:** FastAPI, hosted separately on Railway.
- **Database:** PostgreSQL, migrated with Alembic.
- **API boundary:** The Next.js frontend calls the same-origin `/api/v1` proxy configured in `netlify.toml`; it does not connect directly to PostgreSQL.
- **Vite:** Not the active frontend framework. Historical Vite material, where present in the archive, is not part of the Next.js application.

The active build scripts are `next dev`, `next build`, and `next start`. Netlify's configuration is in `netlify.toml`; do not replace it with a Vite `dist` build.

## Run locally (PowerShell)

```powershell
npm ci
npm run dev
```

The Next.js development server normally opens at `http://localhost:3000`.

## Verify a frontend change

```powershell
npm run typecheck
npm test
npm run build
```

Passing repository checks does not prove the current Netlify deployment or live backend is healthy. Check the exact Netlify deploy commit and separately verify live API/database behavior.

## Product boundaries

SolenOS is not an AI doctor. Community posts are peer experiences, not authoritative care facts, and do not automatically modify the Living Care Record. Document extraction creates source evidence and review-only candidates; it does not silently convert extracted text into verified medical instructions or authoritative care facts. Preserve uncertainty, source attribution, and caregiver review decisions.
