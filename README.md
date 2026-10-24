# SolenOS

**A Living Care Record for family caregivers.**

SolenOS helps families preserve care context over time: what happened, what changed, what remains uncertain, and what needs to be clarified next.

## Hosting

- Frontend: React + TypeScript + Vite on **Netlify only**.
- Backend: FastAPI on Railway.
- Database: PostgreSQL, migrated with Alembic.
- Vercel is not a supported or intended deployment target for SolenOS.

The Netlify build configuration is in [`netlify.toml`](./netlify.toml). The frontend build command is `npm run build`, and the publish directory is `dist`.

## Run locally (PowerShell)

```powershell
npm ci
npm run dev
```

Vite normally serves the frontend at [http://localhost:5173](http://localhost:5173).

## Verify a frontend change

```powershell
npm run typecheck
npm test -- --runInBand
npm run build
```

Passing these checks does not prove the current Netlify deployment or the live backend is healthy. Check the Netlify deploy's commit and separately verify live API/database behavior.

## Product boundaries

SolenOS is not an AI doctor. Document extraction creates source evidence and review-only candidates; it does not silently convert extracted text into verified medical instructions or authoritative care facts. Preserve uncertainty, source attribution, and caregiver review decisions.
