# ADR-023: Emotional phrasing — record voice over therapy empathy

**Status:** Accepted  
**Date:** 2026-07-20  
**Deciders:** Product Steward  
**Conflicts resolved:** [`solenos-emotional-language-safety.md`](../02-product/solenos-emotional-language-safety.md) “prefer” list vs [`solenos-emotional-response-language.md`](../02-product/solenos-emotional-response-language.md) ban list vs [`solenos-response-intelligence-directive.md`](../02-product/solenos-response-intelligence-directive.md)

---

## Context

Docs disagreed on phrases like “That sounds difficult”:

- **Safety doc** listed it under “Prefer (human, experience-based).”
- **Response language doc** banned “That sounds incredibly difficult” and ChatGPT empathy patterns.
- **Response intelligence directive** banned “That sounds difficult” in product output.
- **Composer + acceptance gate** ban “I understand how you feel”, “I'm here for you”, etc. — enforced in code.

Without a decision, engineers could add therapy empathy to “be kind” or block all emotional acknowledgment.

---

## Decision

**Caregiver-facing copy (composer path) uses record-based recognition — not therapy empathy or generic difficulty scripts.**

| Allowed | Banned in composer |
|---------|-------------------|
| “You mentioned feeling exhausted.” | “I understand how you feel.” |
| Situation-grounded recognition from held facts | “I'm here for you.” |
| Invite to share care context (≤1 soft ask) | “That sounds difficult.” / “That must be really hard.” |
| Held / Living Care Record framing | “I'm sorry you're going through this.” |

**Illustrative “prefer” phrases in emotional-language-safety** are for **human writers and support docs** — not automated product branches. They must not become keyword triggers in `caregiver-response-composer`.

Emotional acknowledgment = **context → clarity**, never chatbot companionship.

---

## Consequences

- Update emotional-language-safety to cross-link this ADR and mark generic difficulty phrases as **not composer copy**.
- Acceptance gate and `CAREGIVER_RESPONSE_BANNED_PHRASES` remain authoritative for runtime.
- Future emotional copy changes go through composer + `verify:caregiver-response-composer` / G5 scenarios.

---

## References

- ADR-022 Caregiver Response Contract  
- `src/lib/caregiver-response-composer` · `src/lib/response-acceptance-gate`  
- Golden G5 · G61
