# SolenOS Input Entry Contract (MVP)

**Status:** Permanent Product Steward rule  
**Authority:** Do not infer or change these behaviors without Product Steward.  
**Companions:** ADR-018 · Input Reality · Document-only inputs · Response Contract · [`solenos-mvp-input-experience.md`](./solenos-mvp-input-experience.md)  
**Implementation:** `src/lib/input-entry-contract` · `AddSituationPanel` · Share Target `/share` · `verify:input-entry-contract` · `verify:mvp-input-experience`

---

## Goal

The caregiver chooses the easiest way to provide information.  
SolenOS chooses how to understand it.

Never require the caregiver to think about formats, file types, or workflows.

---

## Input actions (single responsibility)

| Action | Purpose | On tap | Never |
|--------|---------|--------|-------|
| **Scan** | Physical documents | Open the device **document scanner** | Normal file picker; camera in photo mode first |
| **Snap** | Something happening right now | Open the device **live camera** | Document scanning |
| **Upload** | Existing files on device | Open the **system file picker** | Camera; document scanner |
| **Share** | Content from another app | SolenOS as **Share Target** (where supported) | — |

### Scan examples

Hospital discharge, clinic letters, medication lists, insurance, referrals, labs, printed care plans.

### Snap examples

Medication bottle, prescription label, rash, wound, swollen leg, meal, whiteboard, home environment, medical equipment.

### Upload allows

PDF, images, documents, text, email exports, Word, other supported files — from Files, Downloads, Photos, cloud storage (OS-dependent).

### Share examples

WhatsApp, email, photos, PDFs, notes, voice recordings, browser pages.

---

## Critical rule — same pipeline

Entry methods only collect evidence. After entry, **every** input follows:

```
Scan | Snap | Upload | Share | Voice | Text
              ▼
     Evidence Understanding
              ▼
       Care Reality Update
              ▼
  Situation Relationship Engine
              ▼
         Response Contract
```

The origin must **never** change the reasoning engine.  
A scanned discharge summary, a typed note, a WhatsApp share, or a Snap photo produce the **same style** of Care Reality understanding.

`entry_method` may be stored for evidence attribution only — never for branching understanding logic.

---

## Platform note (web MVP)

Where the OS does not expose a native document-scanner API to the browser, Scan uses a **document-oriented live capture** surface (not the file picker, not Snap’s “moment” framing). Native scanner SDKs may replace that surface later without changing the pipeline.

---

## Acceptance

1. Scan does not open the normal file picker  
2. Snap opens a live camera experience (not document scan framing)  
3. Upload opens the file picker only (no camera / scanner)  
4. Share Target is registered where the platform supports it  
5. All origins feed the same Evidence → Care Reality → SRE → Response path  
6. Caregiver is never asked to pick a format workflow  

---

## Non-negotiable

They provide evidence. SolenOS builds understanding.
