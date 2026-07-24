# 04 — Authentication & Identity Continuity

**Status:** Continuity model IMPLEMENTED; credential auth **IN-MEMORY STUB** (not production).

## Architecture

SolenOS prioritizes **identity continuity**, not a login wall:

1. Works immediately (ephemeral `care_session_id`)
2. Preserves care graph / memory / decisions across the session
3. Optional signup binds ephemeral → persistent **without resetting** care state
4. Login restores care state — **not** an auth gate for `/api/analyze`

Canonical code: `src/lib/identity-continuity/`, APIs under `src/app/api/identity/`.

## Login / signup flows

### Ephemeral (default)
- `/api/analyze` accepts/creates `care_session_id`
- Client may store `solenos_care_session_id` in `localStorage`
- Header `x-solenos-care-session-id` continues graph in process memory

### Signup `POST /api/identity/signup`
Body: `{ care_session_id, email, password (≥8), telemetry_user_id? }`  
→ `upgradeEphemeralToPersistent` → in-memory SHA-256 password map + `ensureUser` telemetry UUID  
→ returns `user_id`, `care_session_id`, identity flags  
**Does not** write `users.email` / `password_hash` to Postgres today.

### Login `POST /api/identity/login`
Body: `{ email, password, care_session_id? }`  
→ authenticate against process Maps → optional bind → `rehydrateCareState`  
→ **404** if care graph missing in memory (e.g. after restart)

## Session handling

| Mechanism | Reality |
|-----------|---------|
| Care session UUID | Process Map + localStorage |
| Telemetry user UUID | `ensureUser` / headers |
| JWT / cookies / middleware | **Absent** |
| Durable auth session | **Absent** |

## Roles & permissions

**Not app RBAC.** Closest concepts:

- Care graph roles: `primary_caregiver | secondary_caregiver | shared_caregiver | observer`
- Governance autonomy levels / system modes (settings-governance)
- UI `caregivingPermissions` hardcoded stub `["operational_guidance"]`

APIs do **not** authorize by role before serving analyze.

## Security assumptions (honest)

- Password hash = unsalted SHA-256 in memory — **replace before production**
- Knowing `care_session_id` on same process continues the graph
- Postgres RLS does not protect the service-role Next path
- Credentials lost on process restart

## Future extension paths

1. Persist credentials with Argon2/bcrypt into `users.password_hash`
2. Issue httpOnly session cookies or Supabase Auth; align `auth.uid()` with RLS
3. Durable care-graph store keyed by user_id
4. Real RBAC only if multi-tenant B2B requires it — separate ADR

## Related

- Settings governance: `src/lib/settings-governance` (post-reasoning control plane, not auth)
- Security: `12-security`
