# SolenOS Trust, Legal & User Consent Flow (MVP)

**Status:** Permanent Product Steward / Trust UX constraint  
**Authority:** Same force as Product North Star + Living Care Record UX  
**Companions:** Input Reality · First-time caregiver · Emotional language safety · Research validation · Learning-first release

**Implementation:** `src/lib/trust-content` · `src/lib/early-access-trust` · public pages `/privacy` `/terms` `/contact` `/support` (`/help` → `/support`) `/about` · `EarlyAccessConsentForm` · `WelcomeTrustStack` · `ResearchPreviewAckGate` · Sidebar About links · `verify:trust-consent`

**Support email:** `davidsolenos@gmail.com`

---

## Goal

Build trust without unnecessary friction.

Legal information must be **visible and accessible**.  
It must **not** become a blocker that prevents caregivers from understanding or testing SolenOS.

Feel: *"We respect your information."*  
Never: *"You must complete legal steps before we help you."*

Transparency should support trust, not slow down the caregiver.

---

## Public website structure

| Surface | Role |
|---------|------|
| Landing (`/`) | Discover SolenOS — **Enter SolenOS** → `/start` |
| Entry Home (`/start`) | Purpose + Research Preview + Free Early Access + short FAQ + trust stack (legacy `/welcome` redirects here) |
| Care Workspace (`/workspace`) | Living Care Record + Research Preview ack |
| Why SolenOS | Problem / belief |
| How It Works | Continuity understanding |
| About SolenOS | Story / who we are (`/about`) |
| Help (`/support`, `/help`) | Help Center + **full FAQ** |
| Capabilities (`/capabilities`) | Current capabilities (works well / still improving) |
| Early Access | Join with consent |
| Terms / Privacy / Contact | Always reachable |

**Footer (always):** How It Works · About · Terms of Service · Privacy Policy · Help · Contact · © SolenOS · emergency boundary (quiet)

Do **not** place legal links in the hero. Do **not** interrupt the first emotional connection.

Home / About are **not** compliance portals — they build trust. Avoid leading with AI tech, architecture, feature lists, or medical claims.

---

## Research Preview (existing Home + one-time product ack)

### On `/welcome` (existing Home Screen)

Below the main welcome / CTA, include:

1. Why SolenOS Exists  
2. SolenOS Research Preview (limitations + feedback invite)  
3. Free Early Access (*at no cost during early access* — never “free forever”)  
4. What SolenOS does / does not do  
5. Your Information (data handling in plain language)  
6. How To Use SolenOS  
7. Understanding Takes Context (questions are normal)  
8. Medical disclaimer (short)  
9. Early Access User collaborator framing + founder contact  
10. Continuing agreement links to Terms + Privacy  

Do **not** create another welcome page or legal wall before value.

### First product entry (`/?enter=1`)

`ResearchPreviewAckGate`: one lightweight acknowledgement (“I understand this is an early version”) + Terms/Privacy links.  
Store acceptance in local storage (`solenos_research_preview_ack_v1`).  
Returning users skip the gate.

In-app: subtle improving notice + Help improve / Report misunderstanding — never a large warning banner.  
Header: small **Early Access** badge (`SolenOS · Early Access` feel).

---

## Sign-up / early access consent

Before submission, show:

- ☐ I agree to the SolenOS Terms of Service (link)  
- ☐ I have read and understand the SolenOS Privacy Policy (link)  

Links must open the documents (new tab preferred).  
**Submit stays disabled** until both boxes are checked.

### UX rule — no legal wall

Do **not** force users to read entire documents before continuing.

---

## Inside the product

Always reachable from Menu → About SolenOS (and trust link row):

- Help  
- Privacy Policy  
- Terms of Service  
- About SolenOS  
- Contact  

Upload area: quiet privacy notice + link to Privacy Policy.  
Emergency boundary: quiet footer / About note — not alarm chrome.

Post-response feedback: “Did SolenOS understand this situation clearly?” → Helpful / Needs improvement → structured miss options + optional text → `POST /api/research-feedback`.

---

## MVP acceptance

Pass only if:

1. Privacy Policy + Terms of Service visible on public site  
2. Help Center answers what SolenOS is / how to use / trust / information / contact  
3. Early access includes consent checkboxes with clickable links  
4. User cannot submit early access without agreement  
5. `/welcome` carries Research Preview + Free Early Access (not forever)  
6. New product entrants ack once; returning users are not interrupted  
7. Legal pages do not interrupt caregiver experience  
8. In-product Help / Privacy / Terms / About / Contact remain reachable  
9. Upload privacy notice present  
10. Support email is `davidsolenos@gmail.com`

---

## Non-negotiable

Trust is part of the product.  
When uncertain, prefer admitting uncertainty over a complete but incorrect explanation.  
SolenOS should never feel like a hospital compliance portal or a legal website.
