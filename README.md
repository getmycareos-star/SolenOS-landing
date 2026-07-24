# SolenOS

**An evolving intelligence layer that understands a person's changing care reality over time and helps families recognize change, coordinate action, and make decisions with confidence.**

> The care journey, remembered.

**Product:** SolenOS  
**Category (not a rename):** Care Reality Intelligence  
**Foundation:** The Living Care Record

**Documentation Governance (living SoT):** [docs/README.md](docs/README.md) · **Canonical architecture:** [docs/17-canonical-architecture/](docs/17-canonical-architecture/) · Machine contract: `src/lib/solenos-layers/architecture-map.ts`

A change is complete only when code works, verifies pass, docs/canonical architecture (and PRDs if affected) are updated. **If code and docs conflict, documentation wins.**

## What SolenOS is

SolenOS maintains continuous understanding of one person's care journey — CareEvents, change, context, meaning, and attention — so caregiving never depends on reconstructing everything from memory.

Philosophy chain: **Input → Event → Change → Context → Meaning → Attention**

## What SolenOS is not

Not a chatbot, EHR, portal, document app, reminder app, task manager, or generic care coordination tool.  
Never use forbidden product renames from the permanent product-identity directive.

## Caregiver path (MVP)

```
caregiver input (text + documents) → POST /api/situation → Living Care Record update
```

Ops/engine compression (`POST /api/analyze`) is hard-gated and is **not** the caregiver product entry.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**LLM (server-side only):**

```bash
copy .env.local.example .env.local
# Edit .env.local — set GEMINI_API_KEY (never commit this file)
```

## Product integrity gate (Path A preview)

Before internal preview, Path A must stay green:

```bash
npm run verify:product-path
npm run verify:product-identity
```

This proves Care Reality / Living Care Record behavior — not chatbot, document summarizer, or task manager.

**Preview honesty:** single Node process + `.data/` JSON. Same-machine restart: yes. New device / multi-user / cloud multi-instance: **not** qualified. Details: [docs/13-infrastructure/preview-qualification.md](docs/13-infrastructure/preview-qualification.md) · Integrity: [docs/02-product/solenos-product-integrity.md](docs/02-product/solenos-product-integrity.md)

## Legacy analyze constraints

Historical analyze-only MVP notes live in [docs/MVP_ARCHITECTURE_CONSTRAINTS.md](docs/MVP_ARCHITECTURE_CONSTRAINTS.md). They describe the ops compression path — **not** SolenOS product identity.
