# 12 — Security

## Safety model (product)

1. **Safety Enforcement** (`safety-enforcement`) — terminal output gate; **SAFETY ALWAYS WINS**
2. **Fail-Safe Mode** — post-decision pause under uncertainty / unresolved conflict
3. **Containment Mode** — acute caregiver stress → max 1 action
4. **Settings governance** — post-reasoning caps only; must not rewrite chain-of-thought stores
5. **Medical boundary** — never primary diagnostic product

Safety filters **output**, not “deleting memory of risk.”

## Auth / trust assumptions

| Assumption | Reality |
|------------|---------|
| Analyze can run before signup | TRUE (by design) |
| Credentials are production-grade | **FALSE** — in-memory unsalted SHA-256 |
| RLS protects Next.js DB path | **FALSE** — service role typically bypasses |
| Client-provided user UUIDs trusted | Effectively yes today — treat as ledger keys, not proof of identity |
| Care session secrecy | Weak — UUID knowledge continues session in-process |

## RLS summary

Enabled with `auth.uid()` isolation on: `users`, `interactions`, `feedback`, `documents`, `support_signal_events`.  
Not on: `knowledge_base`, `policy_facts`, `cases`, `system_events`.

## Documents

- [failure-mode-safety-spec.md](./failure-mode-safety-spec.md)

## How to modify safely

Any change that weakens Safety/Fail-Safe ordering needs ADR + AI behavior spec update + `verify:safety-enforcement` / `verify:fail-safe-mode`.
