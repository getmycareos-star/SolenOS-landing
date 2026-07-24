# Security Model

**Doc status:** Canonical architecture  
**Module markers:** [module-status.md](./module-status.md) — Safety/Fail-Safe **INTERNAL · IMPLEMENTED** on analyze; acceptance gate on composer path

1. **Safety Enforcement** — terminal output constraints
2. **Fail-Safe** — clarify under uncertainty/conflict  
3. **Containment** — acute stress max 1 action  
4. **Governance settings** — post-reasoning only  
5. **Medical boundary** — no diagnosis product  
6. **RLS** — defense-in-depth for user tables under Supabase auth  
7. **Identity** — continuity-first; credential storage MVP stub  

App authorization is **not** role-based today. Treat UUIDs as soft ledger keys.

Detail: [`../12-security/`](../12-security/), [`../04-authentication/`](../04-authentication/).
