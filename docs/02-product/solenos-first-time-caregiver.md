# SolenOS Product Directive — First-Time Caregiver Experience

**Status:** Current product behavior  
**Priority:** P0 — Launch-critical  
**Decision:** One shared caregiver entry screen with an inline first-use orientation on Today.

## Product rule

Onboarding is not a separate destination, wizard, dashboard, or modal. It is the first-use state of the existing caregiver entry experience at `/workspace` (Today).

First-time and returning caregivers use the same route, page structure, navigation, and Living Care Record. First-use guidance appears inline above Today content. The caregiver can continue without contributing information. Returning caregivers do not repeat the full orientation.

## First-use orientation

Show these sections in order:

1. **Introduction** — “The care journey, remembered.” Explain that SolenOS keeps important care details together so caregivers can record what happens, save documents, understand changes, and prepare for conversations.
2. **Early access** — Clearly state that SolenOS is still being tested. Some features may change or not work as expected. Invite feedback without promising individual responses or implying that early access reduces privacy or safety responsibilities.
3. **Care recipient** — Offer recipient name and caregiver relationship as optional details. Do not require a medical questionnaire. Do not block access to Today when these details are skipped.
4. **Ways to begin** — Offer Add a care update, Upload a document, and Ask SolenOS a question. These are optional starting points, never required steps.
5. **Living Care Record explanation** — Explain that information comes from different sources, may be incomplete, uncertain, or conflicting, and that corrections preserve history. State that AI suggestions are not confirmed medical facts and SolenOS does not replace medical professionals.
6. **Continue to Today** — A single clear primary action. The caregiver can contribute whenever ready.

## Returning caregivers

Use the same Today route. Show a brief “Welcome back” orientation with the saved recipient name where available, then the real current care information, recent developments and relevant next actions already owned by Today and the Living Care Record. Do not create a second returning-user dashboard. Keep a compact Early Access notice and optional feedback entry point available.

## Persistence and identity

- Care recipient identity remains in the existing person and caregiver-profile infrastructure.
- First-use completion is stored on the existing caregiver identity in PostgreSQL.
- A saved recipient profile with an empty LCR still receives first-use guidance.
- Existing care history or a server-confirmed orientation completion timestamp identifies a returning caregiver.
- A profile or history retrieval failure is not evidence that the caregiver is new.
- Never create a recipient because a read request failed.
- Never claim completion until the server confirms the persisted state.
- Do not create a parallel onboarding table or recipient source of truth.

## Consent and trust

Preserve the existing consent model; do not introduce a blanket privacy checkbox or consent overlay before the caregiver can enter Today. The public Terms and Privacy pages remain accessible from the product. Consent is checked at the specific actions and data-processing paths that require it. In-app improvement feedback is one such path: the backend resolves the active bearer session, verifies that the consent belongs to that person and caregiver, requires the required privacy/safety acknowledgements, and separately requires explicit improvement-feedback opt-in. A direct API request cannot bypass those checks.

The optional improvement preference remains separate, explicit, revocable, and off unless the caregiver chooses it in Privacy settings. Consent must not be silently inherited from another caregiver or care recipient. A failed consent check must not produce a successful-looking feedback receipt or block access to unrelated Care Record content.

## Feedback

Provide a Share feedback entry point in first-use guidance and Settings. Reuse the existing feedback endpoint and consent checks. In-app improvement feedback requires the caregiver's explicit optional improvement permission. Do not automatically attach full care records, documents, or Companion conversations. Submission errors must be visible; do not claim success before the backend confirms persistence.

## Known identity-recovery limitation

The current anonymous-session bearer credential is stored in browser storage. If a caregiver clears all browser storage, the server cannot identify that anonymous session from the browser alone. A caregiver who has linked an account can sign in again, but a truly anonymous session cannot be safely restored after its credential is deleted. Do not silently create a replacement record and describe it as restored. Durable cross-device or cleared-storage recovery requires a server-managed secure session or an explicit account sign-in recovery flow.

## Non-negotiable

- One shared caregiver entry route and shell.
- No multi-step onboarding wizard.
- No forced contribution.
- No fake sample records.
- No repeated recipient questions.
- No medical questionnaire before access.
- No local-only onboarding completion state.
- No blanket consent gate before workspace entry; enforce consent on the protected actions that require it.
- No false success when persistence fails.
- No caregiver-facing technical jargon.

The first-use experience succeeds when a caregiver understands what SolenOS does, knows it is in early testing, understands the limits of the Living Care Record and AI suggestions, and can reach Today without unnecessary work.
