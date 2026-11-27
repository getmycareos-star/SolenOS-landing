# SolenOS Product Directive — First-Time Caregiver Experience

**Status:** Current product behavior  
**Authority:** Product Steward  
**Decision:** One shared caregiver entry screen with an inline first-use orientation on Today.

## Product rule

Onboarding is not a separate destination, wizard, dashboard, or modal. It is the first-use state of the existing caregiver entry experience at `/workspace` (Today).

First-time and returning caregivers use the same route, page structure, navigation, and Living Care Record. The first-use orientation is shown inline above Today content and can be dismissed without making a contribution. Returning caregivers see their existing care context and do not repeat the orientation.

## First-use orientation

Show these sections in order:

1. **Introduction** — “The care journey, remembered.” Explain that SolenOS keeps important care details together so caregivers can record what happens, save documents, understand changes, and prepare for conversations.
2. **Early access** — Clearly state that SolenOS is still being tested. Some features may change or not work as expected. Invite feedback without promising individual responses or implying that early access reduces privacy or safety responsibilities.
3. **Care recipient** — Offer recipient name and caregiver relationship as optional details. Do not require a medical questionnaire. Do not block access to Today when these details are skipped.
4. **Ways to begin** — Link to Add a care update, Upload a document, and Ask SolenOS a question. These are optional starting points, never required steps.
5. **Living Care Record explanation** — Explain that information comes from different sources, may be incomplete, uncertain, or conflicting, and that corrections preserve history. State that AI suggestions are not confirmed medical facts and SolenOS does not replace medical professionals.
6. **Continue to Today** — A single clear primary action. The caregiver can contribute whenever ready.

## Returning caregivers

Do not repeat the full orientation after completion. Continue to Today and show the existing care recipient and real saved care information. A compact Early Access notice and an optional feedback entry point may remain available.

## Persistence and identity

- Determine care history from the server-authorized record, not browser cache.
- Persist first-use orientation completion on the existing authenticated caregiver identity.
- Do not create a parallel onboarding table or recipient source of truth.
- Recipient identity remains in the existing person/caregiver profile infrastructure.
- A profile or history retrieval failure is not evidence that the caregiver is new.
- Never create a recipient because a read request failed.
- Do not claim completion until the server confirms the persisted state.
- If the caregiver has existing care history, treat them as returning even if browser storage is empty.

## Consent and trust

Do not use a blanket checkbox or consent overlay to block entry to the Living Care Record. Terms and Privacy remain accessible. Preserve server-enforced, purpose-specific consent for sensitive operations and optional improvement feedback. Optional improvement consent must never be silently enabled or required to use SolenOS.

## Feedback

Make feedback easy to find during early access. Reuse the existing consent-gated feedback pathway and support email. Explain that in-app improvement feedback requires the caregiver's explicit optional improvement permission. Do not attach full care records, documents, or Companion conversations automatically.

## Non-negotiable

- One shared entry route.
- No multi-step onboarding wizard.
- No forced contribution.
- No fake sample records.
- No repeated recipient questions.
- No medical questionnaire before access.
- No local-only completion state.
- No blanket consent wall.
- No false success when persistence fails.
- No caregiver-facing technical jargon.

The first-use experience succeeds when a caregiver understands the product, can identify where to begin, knows SolenOS is in early testing, and can enter Today without unnecessary work.
