# SolenOS MVP FAQ (Trust & Expectations)

**Status:** Permanent Product Steward constraint for early MVP  
**Implementation:** `src/lib/mvp-faq` · `FaqList` · `/welcome` excerpt · `/support#faq` full · `/capabilities`  
**Verify:** `verify:mvp-faq`

## Purpose

Answer the questions early caregivers actually have — without a mandatory onboarding wall or ChatGPT-level expectations.

Feel: *"I understand what I am using."*  
Never: *"I am being warned about a risky product."*

Philosophy line: **SolenOS is not trying to know everything. It is trying to preserve what matters.**

## Placement

| Surface | Content |
|---------|---------|
| Home `/welcome` | 5–7 highest-trust FAQs (`HOME_FAQ_IDS`) near Research Preview |
| Help `/support` | Full FAQ |
| `/capabilities` | Current capabilities (works well / still improving) |

Do **not** create a required FAQ screen before care value.

## Home FAQ set (locked)

1. What is SolenOS?  
2. Is SolenOS a healthcare or medical service?  
3. Why is SolenOS an early version?  
4. Can SolenOS misunderstand information?  
5. Is SolenOS free? (early access — not forever)  
6. Does SolenOS store my information?  
7. What should I do if SolenOS gets something wrong?

## Tone

Transparency + collaboration. Not legal tone. Not hospital compliance.

## Related

- Greeting → Care Record orientation (`entry-behavior-protocol` / `GREETING_ORIENTATION`) — never companion chat  
- Retention behavior (internal): `docs/02-product/solenos-mvp-retention-behavior.md`  
- Trust consent: `solenos-trust-consent-flow.md`
