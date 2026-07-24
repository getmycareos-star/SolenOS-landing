# Future Capabilities (Phase 2 / Phase 3)

**Status: FUTURE — not MVP.**  
MVP must first prove SolenOS creates a **trusted understanding** of a person's care reality. These capabilities extend the Care Reality Engine — they are not separate products.

Module: `src/lib/future-capabilities`  
Architecture map: `FUTURE_CAPABILITIES` (`notANewPillar: true`)

## Readiness gate

> Care Reality Engine must produce evidence-backed, person-specific understanding before communication or clarity UX ships.

## Phase 2 — In-the-moment understanding

| Capability | Extends | Not |
|------------|---------|-----|
| **Care Moment** | `moment-of-need-engine` | Emergency tool · diagnosis · chatbot |
| **I Need Clarity** | moment-of-need + baseline | Ask anything · generic assistant |
| **Care Understanding Confidence** | continuity + evidence + care-state | Caregiving score · health score · % rating |
| **Confidence Collapse Support** | moment-of-need + diff | Diagnosis · decision replacement |

### Care Moment response framework

1. What changed?  
2. What do we know?  
3. Why might this matter? (context, not diagnosis)  
4. What should be remembered?  
5. What questions should be considered?

Success metric: *Did SolenOS help the caregiver understand an uncertain moment better than they could alone?*

### Care Understanding Confidence

Communicate **what we understand** and **what is missing** — never gamified scores.

Forbidden: "Your caregiving confidence: 72%", care health scores, performance ratings.

Build: area-level clarity with evidence, reliability level, and missing context.

## Phase 3 — Communication from shared reality

| Capability | Extends | Not |
|------------|---------|-----|
| **Care Communication Support** | care-reality-intelligence + evidence | Generic communication assistant |
| **Help Me Communicate This** | communication support + profile | Persuasion · taking sides |

### Principle

Do not help users communicate **opinions**. Help them communicate **shared context** grounded in care history, changes, decisions, outcomes, and unanswered questions.

### Output structure (engine contract)

1. Current situation summary (neutral)  
2. Evidence from care reality  
3. Conversation preparation  
4. Communication drafts (only after understanding)

### Boundaries

Must not: take sides · decide who is right · create conflict · persuade medical decisions  
Must: create shared understanding · reduce confusion

Strategic goal: *"Why didn't anyone tell me?"* → *"Now everyone understands what has been happening."*

## Voice input (FUTURE channel — ADR-018)

Not a Phase 2/3 “clarity UX” capability — a **future input channel** into the same pipeline:

```
User Input (text | document | voice later)
        ↓
Understanding Layer
        ↓
Care Record / Actions
```

Do not ship mic, Voice Conversation Mode, Hear SolenOS, Whisper, or TTS as MVP. Keep `src/lib/voice*` interfaces so voice can plug in later. See ADR-017 (I/O contract) and ADR-018 (MVP scope).

## Person-specific human context

`human-context.ts` — layers for Care Reality Profile:

- Communication patterns · what calms · what causes distress  
- Preferred routines · important relationships  
- Previous successful / failed approaches  

Wrong: "Resistance to care can occur in dementia."  
Right: "This person responded better when choices were offered instead of instructions."

## Chaos-first ingestion (IMPLEMENTED)

**Not future** — lives in `adoption-wedge-engine`.

> Bring the chaos. SolenOS helps make sense of it.

Forbids: complete profile · enter all medications · long questionnaires before value.

## Verify

```bash
npm run verify:future-capabilities
```

Verify also asserts caregiver MVP surfaces (`mvp-workspace`, `/`) do not ship Phase 2/3 product strings, caregiving confidence %, or voice/mic UI (`ObservationInput` is FUTURE / ADR-018 and is not re-exported from caregiver `ui-runtime`).

## Cursor rule

`.cursor/rules/solenos-future-capabilities.mdc`
