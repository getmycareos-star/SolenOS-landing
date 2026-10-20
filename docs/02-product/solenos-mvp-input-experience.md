# SolenOS MVP Input Experience Directive

**Status:** Locked MVP product SoT  
**Authority:** Product Steward · Input Reality · First-Time Caregiver · Input Entry Contract  
**Companions:** [`solenos-input-entry-contract.md`](./solenos-input-entry-contract.md) · [`solenos-input-reality-directive.md`](./solenos-input-reality-directive.md) · [`solenos-first-time-caregiver.md`](./solenos-first-time-caregiver.md) · [`solenos-document-only-inputs.md`](./solenos-document-only-inputs.md) · Adoption wedge · Identity continuity  
**Module:** `src/lib/mvp-input-experience`  
**Verify:** `verify:mvp-input-experience`

---

## Core principle

The first interaction with SolenOS should **not** feel like using software.  
It should feel like **handing someone the care situation**.

Caregivers are already overwhelmed.

**Do not ask them to:**

- create an account  
- complete a profile  
- answer long onboarding questions  
- organize information before starting  

**Starting question (feel, not fixed template):**

> What is happening with the person you care for?

---

## Product rule

SolenOS accepts the caregiver's reality **in whatever form it arrives**.

The caregiver should not transform their life into a software format.  
The software transforms their reality into **understanding**.

---

## MVP entry actions

Primary actions:

1. **Snap**  
2. **Scan**  
3. **Upload**  
4. **Share**  

These are **not** separate features.  
They are different ways of giving SolenOS **raw care information**.

Mechanics (what each button opens): [`solenos-input-entry-contract.md`](./solenos-input-entry-contract.md).

**All origins → same pipeline:**

```
Evidence → Care Reality Object → Situation Relationship → Orientation
```

Origin is attribution only. Reasoning never branches on Snap vs Scan vs Upload vs Share vs text.

---

### 1 — Snap

**Purpose:** Capture real-world care information quickly (live camera).

Illustrations only (never product if-branches): medication bottle · discharge paper · appointment letter · handwritten notes · care instructions · insurance · prescription.

**Flow:** Tap Snap → camera → photo → process → extract → **understand meaning for this person's care** → Living Care Record.

Not OCR theater alone. Always: *What does this mean for this person's care?*

---

### 2 — Scan

**Purpose:** Document-oriented capture / process of papers and document files.

Illustrations only: discharge summary · medical report · medication list · care plan · assessment.

**Flow:** Document evidence → read → identify events / decisions / changes / medications / follow-ups / unknowns → update care reality.

**Wrong:** “Here is a summary of your document.”  
**Right:** Hospital event · what changed · what still needs confirmation — care reality first.

---

### 3 — Upload

**Purpose:** Bring existing files (PDFs, images, text, exported messages).

Do **not** force organization before upload.  
The system receives the mess. SolenOS organizes meaning.

---

### 4 — Share

**Purpose:** Meet caregivers where information already exists (OS Share Target, pasted threads, forwarded notes).

Illustrations only: WhatsApp paste · doctor instructions · caregiver notes.

Same Care Reality extraction (decision / reason / follow-up / unknown) — never a separate “share product.”

---

## No authentication initially (locked)

**Do not prioritize** for MVP entry:

- sign up  
- login  
- password management  
- user profiles as a gate  

Authentication before value is **friction**.

Early goal: *Can SolenOS create meaningful care understanding?*

### Session model

Start with an **anonymous / durable local care workspace** (care key / care case):

1. Open SolenOS  
2. Name the person when needed (ask-once identity — not a profile form wall)  
3. Add information via Snap / Scan / Upload / Share / text  
4. SolenOS builds timeline · events · decisions · unknowns · current understanding  

### When authentication becomes important

When users have:

- valuable accumulated records  
- multiple family contributors  
- long-term care history  
- sharing needs  
- privacy requirements  

**Trigger:**

> The care memory has become valuable enough that losing it matters.

Signup/login then = **continuity / restore**, never a gate before first understanding.  
See identity-continuity: login restores state — it is not an auth wall before capture.

---

## MVP success metric

**Do not measure success as:**

- number of uploads  
- number of accounts  
- number of features  

**Measure:**

After adding information, does the caregiver say:

> I understand the situation better now.

---

## Hard never

- Account / profile / long onboarding **before** first care capture  
- Separate product experiences per entry channel  
- Document summary as the product  
- Force caregivers to pre-organize files or categorize inputs  
- Soft examples in this doc as keyword → template maps  

---

## Implementation map

| Concern | Location |
|---------|----------|
| Button opens / never | `src/lib/input-entry-contract` · `AddSituationPanel` |
| Chaos-first / no setup homework | `src/lib/adoption-wedge-engine` |
| First Begin orientation | First-time caregiver SoT · welcome → `/?enter=1` |
| Soft continuity signup later | `identity-continuity` · ContinuityPrompt (non-blocking) |
| This directive | `src/lib/mvp-input-experience` |
