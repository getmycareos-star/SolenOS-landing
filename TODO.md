# SolenOS-landing Cleanup & Deployment Fix

## Step 1: Remove misplaced backend directories
- [x] Remove `backend/` directory (Dockerfile, railway.toml, middleware — Railway backend)
- [x] Remove `SolenOS_backend/` directory (duplicate backend repo copy)
- [x] Remove `solenos-backup/` directory (deprecated backup repo)
- [x] Remove `frontend/` directory (empty)
- [x] Remove `frontend2/` directory (empty)

## Step 2: Fix git submodule issue
- [x] Remove gitlink for `backend/` from git index
- [x] Update `.gitignore` to exclude removed directories

## Step 3: Clean up build artifacts
- [x] Add `build_output*.txt` and `tsconfig.tsbuildinfo` to `.gitignore`

## Step 4: Create `netlify.toml`
- [x] Create `netlify.toml` with Next.js build configuration

## Step 5: Update `next.config.ts`
- [x] Add proper Netlify deployment configuration (images, webpack)

## Step 6: Update `.gitignore`
- [x] Add entries for removed directories and build artifacts

## Step 7: Test build
- [x] Run `npm install`
- [x] Run `npm run build` (succeeds — 24 pages generated)

## Step 8: Commit and push
- [ ] Commit changes
- [ ] Push to origin (SolenOS-landing)
