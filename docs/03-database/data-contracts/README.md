# Data Governance & Data Contracts

## Allowed data types

| Allowed | Examples |
|---------|----------|
| Caregiver operational language | Input text for clarity transform |
| Situation / demand / ownership STATE | In-process + future durable stores |
| Beliefs (assumptions, missing info) | Confidence 0–1, importance |
| Telemetry evidence | Latency, risk_level labels, relief flags |
| Observation structured categories | memory, orientation, communication, mood, behavior, daily_function |
| Governance settings | Post-reasoning caps (not prompt injection) |
| Language preferences | Enum languages |

## Forbidden data types (product)

| Forbidden | Why |
|-----------|-----|
| Clinical diagnosis labels as product outputs | Medical boundary |
| Disease progression timelines from observation counts | Anti-pattern |
| Covert psych profiling for employers without consent product | Not MVP; B2B2C is future doc-only |
| Raw password plaintext | Credentials must be hashed (current stub uses unsalted SHA-256 — **not production**) |
| Secrets in repo | `.env.local` only |

## Canonical conceptual entities

### Care event
A caregiver interaction or observation that may create/update Situations, Demands, Observations, or telemetry rows. Analyze creates a transformative event; observation API creates structured observation events.

### Decision
An EXPLANATION-layer record of **WHY** an action/recommendation was chosen (decision history), distinct from Timeline **WHAT**. Assembled after Priority + LLM + gates.

### Risk signal
DERIVED crisis or situation risk (probability, ETA, factors). Not persisted as medical truth. Must include explanation when emitted by crisis layer.

### Delegation action
MVP: a **suggestion** only (`task`, `recommendedPerson`, `reason`, optional `loadReductionEstimate`). No auto-assignment mutation of ownership without future product + ADR.

## Mutation rules

| Layer | Who may write |
|-------|----------------|
| STATE | Resolution / demand / responsibility modules in pipeline |
| BELIEF | Assumption / missing-info sync |
| EXPLANATION | Decision history, trust explanations, timeline |
| DERIVED | **No durable writes** — pure functions |
| Telemetry DB | Backend store only, when enabled |
| Human override API | STUB — records intent array; **no STATE/BELIEF mutation** |

## Validation

- Analyze output: Zod hard gate on MVP fields
- Layer guarantees: per-module `guarantee.ts` / system behavior guarantees
- Verify scripts: enforceable contracts

## Lifecycle

1. **Create** ephemeral care session → optional signup bind  
2. **Update** STATE/BELIEF per analyze  
3. **Derive** load/crisis/confidence/delegation each request  
4. **Explain** decision  
5. **Telemetry** optional persist evidence  
6. **Durable Living Care Record** — CareContext + ACS write-through to `.data/` (Map = cache); consent similarly durable. Process bounce must reload CareContext/ACS. Telemetry/analyze STATE graphs may still be IN-MEMORY.

## Related

- Schema: [../README.md](../README.md)
- Security failure modes: `12-security/failure-mode-safety-spec.md`
