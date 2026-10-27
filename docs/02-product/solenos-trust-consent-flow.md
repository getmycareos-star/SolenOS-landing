# SolenOS Trust, Legal & User Consent Flow (MVP)

**Status:** Permanent Product Steward / Trust UX constraint  
**Authority:** Same force as Product North Star + Living Care Record UX  
**Companions:** Input Reality · First-time caregiver · Emotional language safety · Research validation · Learning-first release

**Implementation:** `src/lib/trust-content` · public pages `/privacy` `/terms` `/contact` `/support` (`/help` → `/support`) `/about` · informational `WelcomeTrustStack` · Sidebar About links · `verify:direct-lcr-entry`

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
| Landing (`/`) | Discover SolenOS — **Start your care record** → `/workspace?enter=1` |
| Entry Home (`/start`) | Optional product explanation and trust information; its LCR CTA routes directly to `/workspace?enter=1` |
| Care Workspace (`/workspace`) | Living Care Record; no pre-workspace privacy or early-version checkbox |
| Why SolenOS | Problem / belief |
| How It Works | Continuity understanding |
| About SolenOS | Story / who we are (`/about`) |
| Help (`/support`, `/help`) | Help Center + **full FAQ** |
| Capabilities (`/capabilities`) | Current capabilities (works well / still improving) |
| Early Access | Optional product information with direct LCR entry; no pre-workspace checkbox |
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

### First product entry (`/workspace?enter=1`)

The user enters the Living Care Record immediately. Do not show a privacy acknowledgement checkbox, early-version checkbox, welcome gate, or consent overlay before the workspace mounts. Privacy and Terms remain accessible through public and in-product links. This UI rule does not bypass server-issued authentication, record ownership, audit requirements, or consent required for a specific sensitive action; those controls must be enforced at the relevant operation rather than as a blanket workspace-entry wall.

In-app: subtle improving notice + Help improve / Report misunderstanding — never a large warning banner.  
Header: small **Early Access** badge (`SolenOS · Early Access` feel).

---

## LCR entry and action-specific consent

Do not require a checkbox to enter the LCR. A click on any action that explicitly opens or uses the Living Care Record routes directly to `/workspace?enter=1`. Keep Privacy Policy and Terms of Service accessible as information links. Where a particular sensitive operation legally or technically requires consent (for example, a sharing workflow), request and record the relevant permission in that operation’s context; do not reuse a blanket checkbox as a substitute for authentication, authorisation, or purpose-specific consent.

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
3. LCR entry has no privacy or early-version checkbox gate  
4. Every use-the-LCR CTA routes directly to `/workspace?enter=1`  
5. `/start` may carry optional Research Preview + Free Early Access information  
6. Action-specific consent remains enforced where required; it never becomes a blanket workspace-entry wall  
7. Legal pages do not interrupt caregiver experience  
8. In-product Help / Privacy / Terms / About / Contact remain reachable  
9. Upload privacy notice present  
10. Support email is `davidsolenos@gmail.com`

---

## Non-negotiable

Trust is part of the product.  
When uncertain, prefer admitting uncertainty over a complete but incorrect explanation.  
SolenOS should never feel like a hospital compliance portal or a legal website.
