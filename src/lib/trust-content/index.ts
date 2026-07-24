/**
 * Public + in-product trust content.
 * Discoverable, never interrupting the care workflow.
 */

export {
  PRIVACY_POLICY,
  TERMS_OF_USE,
  CONTACT_PAGE,
  SUPPORT_PAGE,
} from "./legal-documents";

export {
  canSubmitEarlyAccessConsent,
  TRUST_LEGAL_PUBLIC_ROUTES,
  EARLY_ACCESS_CONSENT_PURPOSE,
  type EarlyAccessConsentState,
} from "./early-access-consent";

export const TRUST_NAV = [
  { href: "/", label: "Home" },
  { href: "/start", label: "Start" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/why-solenos", label: "Why SolenOS" },
  { href: "/about", label: "About SolenOS" },
  { href: "/support", label: "Help" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/early-access", label: "Early Access" },
] as const;

/** Footer legal + support — always visible on public pages. */
export const TRUST_FOOTER_LINKS = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Help" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/contact", label: "Contact" },
] as const;

/** In-product quick links — Settings / About (never a capture blocker). */
export const IN_PRODUCT_LEGAL_LINKS = [
  { href: "/support", label: "Help" },
  { href: "/capabilities", label: "Current capabilities" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/about", label: "About SolenOS" },
  { href: "/contact", label: "Contact" },
] as const;

export const MISSION = {
  title: "Our Mission",
  heroSubtitle: "What we exist to do",
  statement:
    "To preserve the continuity of every person's care journey so families never have to reconstruct years of care from memory.",
  meaningTitle: "What this means in practice",
  meaning: [
    "Remember what happened — and what changed since then.",
    "Keep decisions connected to the reasons and outcomes behind them.",
    "Surface what needs attention now, without burying families in noise.",
    "Show what is known, what is uncertain, and what is still missing.",
    "Leave the caregiver as the heart of care — SolenOS carries the continuity.",
  ],
  notThisTitle: "What we are not optimizing for",
  notThis: [
    "Another dashboard of tasks to maintain",
    "A chatbot that answers healthcare trivia",
    "False certainty when evidence is incomplete",
  ],
  closing:
    "If continuity is preserved, families leave more certain than when they arrived — without reconstructing the journey from memory.",
} as const;

/** Product-purpose page — distinct from founder story and mission statement. */
export const WHY_SOLENOS = {
  heroTitle: "Why SolenOS",
  heroSubtitle: "The problem we exist to solve",
  lead: [
    "Caregiving breaks down when one person has to hold the entire care journey in their head.",
    "Documents, pharmacies, conversations, appointments, and family updates never live in one place — so continuity depends on recall under stress.",
  ],
  problemTitle: "What families face",
  problem: [
    "Care information scatters across hospitals, pharmacies, messages, and paper.",
    "Important context gets lost between visits and caregivers.",
    "Families repeat the same stories because nobody has the complete picture.",
    "Decisions get harder when change is invisible and uncertainty is unspoken.",
  ],
  answerTitle: "What SolenOS is for",
  answer: [
    "SolenOS is an evolving intelligence layer for a person's changing care reality.",
    "It helps families recognize change, coordinate action, and decide with confidence — without turning caregivers into data-entry clerks.",
    "The product is not storage. The product is continuity you can trust.",
  ],
  differenceTitle: "How that is different",
  difference: [
    "Not a notes app — notes alone do not explain what changed.",
    "Not a task manager — lists do not preserve why a decision was made.",
    "Not a generic chatbot — answers without a Living Care Record create false confidence.",
  ],
  bridgeToStory:
    "Behind the product is a family story about becoming someone else's memory system.",
  bridgeToMission: "Our mission is the north star for every design choice.",
} as const;

/** Founder narrative — personal origin, not a restatement of product marketing. */
export const OUR_STORY = {
  heroTitle: "Our Story",
  heroSubtitle: "Where SolenOS began",
  founderName: "David Abuchi",
  founderRole: "Founder of SolenOS",
  opening: [
    "I'm David Abuchi, founder of SolenOS.",
    "SolenOS did not begin with technology.",
    "It began with my family.",
  ],
  family: [
    "Growing up, I watched my mother care for my grandmother.",
    "I saw that caregiving was not one single responsibility.",
    "It was thousands of small moments that had to be remembered:",
  ],
  rememberedMoments: [
    "medications",
    "appointments",
    "conversations with doctors",
    "changes in health",
    "concerns that needed attention",
    "things that helped",
    "things that did not",
  ],
  memoryRealization: [
    "There was no single place where the full story existed.",
    "The story of my grandmother's care lived across conversations, papers, hospital visits, pharmacy information, and most importantly, my mother's memory.",
    "She became the connection between every hospital visit, every conversation, and every decision.",
    "She remembered what happened.",
    "She remembered what changed.",
    "She remembered what doctors had said.",
    "She remembered what the family needed to know.",
  ],
  insight: [
    "Over time, I realized something:",
    "Many caregivers quietly become the memory system for someone they love.",
    "That responsibility is meaningful.",
    "But it is also heavy.",
    "The challenge is not only the amount of work.",
    "It is the responsibility of knowing that important details cannot be forgotten.",
  ],
  widerWorld: [
    "While learning about family caregiving around the world, I realized this was not only my family's experience.",
    "Families everywhere face the same challenge.",
    "That recognition is why SolenOS exists as a company — to build the continuity layer my mother never had.",
  ],
  closing:
    "The caregiver remains the heart of care. SolenOS exists so that heart does not also have to be the entire memory system.",
} as const;

/** @deprecated Prefer WHY_SOLENOS / OUR_STORY — kept for gradual migration of FOUNDER_STORY consumers. */
export const FOUNDER_STORY = {
  heroTitle: OUR_STORY.heroTitle,
  heroSubtitle: OUR_STORY.heroSubtitle,
  founderName: OUR_STORY.founderName,
  founderRole: OUR_STORY.founderRole,
  opening: OUR_STORY.opening,
  family: OUR_STORY.family,
  rememberedMoments: OUR_STORY.rememberedMoments,
  memoryRealization: OUR_STORY.memoryRealization,
  insight: OUR_STORY.insight,
  problemWeSaw: OUR_STORY.widerWorld,
  whyExists: WHY_SOLENOS.answer,
  moreThanInformation: [
    "Caregiving is not only about managing information.",
    "It is about loving someone while trying to make the right decisions.",
    "Technology cannot replace the human connection at the heart of care.",
    "But it can help protect it.",
  ],
} as const;

export const BELIEFS = {
  title: "What SolenOS Believes",
  items: [
    "Care is human.",
    "Technology should support, not replace, caregivers.",
    "Understanding matters more than storing information.",
    "Trust matters more than engagement.",
    "A person's care story belongs to the people who care for them.",
  ],
} as const;

export const PRIVACY_TRUST = {
  title: "Privacy & Trust",
  lead: "SolenOS is protecting someone's care story.",
  principles: [
    "Transparency — show what is known, inferred, and uncertain",
    "User control — the care story belongs to the people who care",
    "Minimum necessary data — only what improves understanding",
    "Clear uncertainty — never pretend to know what we do not know",
    "Evidence over assertion — conclusions must connect back to what happened",
  ],
  hipaaNote:
    "SolenOS is designed with healthcare privacy principles in mind. We are building privacy-focused architecture and evaluating applicable regulatory requirements as the platform evolves.",
} as const;

export const HOW_IT_WORKS = {
  heroHeadline: "The care journey, remembered — understood over time.",
  heroSubheadline:
    "SolenOS helps families bring together the scattered details of caregiving and understand what is changing, what matters, and what needs attention.",
  sections: [
    {
      id: "scattered",
      title: "Care doesn't happen in one place.",
      body: [
        "A person's care journey is spread across medical documents, conversations, pharmacy information, appointments, family updates, and daily observations.",
        "The challenge is not collecting information.",
        "The challenge is understanding how everything connects.",
      ],
    },
    {
      id: "pieces",
      title: "Give SolenOS the pieces. It helps connect the story.",
      body: [
        "SolenOS accepts the information caregivers already have.",
        "Upload a discharge summary. Add a medication update. Share a doctor's note. Record an observation. Add a family update. Capture a voice note.",
        "Do not force yourself to organize everything first.",
        "Give us the chaos. We help make sense of it.",
      ],
    },
    {
      id: "understanding",
      title: "SolenOS turns moments into understanding.",
      body: [
        "Every piece of information becomes part of the care story.",
        'You add: "Mom has been sleeping more recently."',
        "SolenOS understands the observation, related context, connected medication changes, and questions worth discussing with a clinician.",
        "The value is not storing the note. The value is understanding the change.",
      ],
    },
    {
      id: "changed",
      title: "See what changed.",
      body: [
        "Care is not static. SolenOS focuses on change.",
        "It helps surface new symptoms, medication changes, repeated concerns, unanswered questions, and shifts from previous patterns.",
        "The caregiver should not have to remember everything. SolenOS helps maintain awareness.",
      ],
    },
    {
      id: "why",
      title: "Understand why things happened.",
      body: [
        "Care decisions often lose their context.",
        "SolenOS preserves what decision was made, when, who was involved, why, and what happened afterward.",
        'Instead of "Medication stopped," SolenOS can preserve: "Medication was stopped after dizziness concerns were discussed. Symptoms improved afterward."',
        "The story matters.",
      ],
    },
    {
      id: "attention",
      title: "Know what deserves attention.",
      body: [
        "Not everything is urgent.",
        "SolenOS helps distinguish what needs attention, what can wait, and when no major change is detected.",
        "The goal is not more anxiety. The goal is clarity.",
      ],
    },
    {
      id: "limits",
      title: "See what SolenOS understands — and what it doesn't.",
      body: [
        "Trust requires honesty.",
        "SolenOS shows what is known, what is uncertain, and what information is missing.",
        "A trustworthy system knows its limits.",
      ],
    },
    {
      id: "caregiver",
      title: "Built around the caregiver, not the data.",
      body: [
        "Caregivers should not become data entry workers.",
        "SolenOS is designed around natural inputs: photos, documents, messages, voice notes, and observations.",
        "The caregiver provides what they already have. SolenOS helps create understanding.",
      ],
    },
  ],
  closing: {
    title: "The goal is simple.",
    body: [
      "Not more organization. Not another app to manage. Not more information.",
      "The goal is confidence.",
      "Confidence that you understand what is happening, what has changed, what needs attention — and that you don't have to carry every detail alone.",
    ],
  },
} as const;

export const FIRST_USE = {
  title: "What happens when you first use SolenOS",
  leadTitle: "Start with what you already have.",
  leadBody: [
    "You do not need to build a perfect care record.",
    "You do not need to remember everything.",
    "You do not need to organize years of information first.",
    "Care is already happening. SolenOS helps you make sense of it.",
  ],
  steps: [
    {
      title: "Bring the pieces together",
      body: "Start with one thing you already have — a discharge paper, medication list, doctor's note, family message, voice note, or observation. You do not need everything.",
    },
    {
      title: "SolenOS helps understand what matters",
      body: "Beyond storing notes, SolenOS helps identify what happened, what changed, important decisions, unanswered questions, and areas that may need attention.",
    },
    {
      title: "Your care story begins to take shape",
      body: "Over time, SolenOS builds a clearer picture — not a folder of documents or a task list, but a living understanding of the care journey.",
    },
    {
      title: "Return when you need clarity",
      body: "Ask what changed, what to watch, what to bring to the next appointment, and what remains unknown. The goal is less mental weight outside the app — not more time inside it.",
    },
  ],
  firstFeeling:
    "I don't have to hold everything in my head anymore.",
  notFeeling: "I have another system to maintain.",
} as const;

export const WELCOME_HOME = {
  headline: "You should not have to rebuild the care journey from memory.",
  subheadline:
    "SolenOS helps organize care information, understand changes over time, and keep important parts of someone's care journey in one place.",
  bullets: [
    "What matters now — so urgency is not guessed under stress",
    "What can wait — so everything does not feel equally urgent",
    "What to ask next — so conversations with clinicians and family have a clear thread",
    "What may become serious — so change is noticed before it is reconstructed later",
  ],
  promise:
    "Bring the mess as it is. SolenOS preserves it, connects related moments, and helps you leave clearer than you arrived.",
  primaryCtaLabel: "Start Adding Care Information",
  primaryCtaHref: "/workspace?enter=1",
  secondaryCtaLabel: "Why SolenOS exists",
  secondaryCtaHref: "/why-solenos",
} as const;

export const EMPTY_STATE_TRUST = {
  title: "The Living Care Record starts here",
  body: "Help SolenOS understand the current care situation. Start by telling what has been happening — notes, messages, documents, or photos.",
  linkLabel: "Why solenos was built",
  linkHref: "/why-solenos",
} as const;

export const INSIGHT_FOOTER_TRUST = {
  label: "Learn why we built solenos",
  href: "/why-solenos",
} as const;

/** In-product: Settings → About SolenOS (discoverable, never forced). */
export const ABOUT_SOLENOS_SECTIONS = [
  {
    id: "why",
    title: "Why SolenOS",
    body: [...WHY_SOLENOS.lead],
    linkHref: "/why-solenos",
    linkLabel: "Why this product exists",
  },
  {
    id: "story",
    title: "Our Story",
    body: [
      "SolenOS began with family — watching a mother become the memory system for a grandmother's care.",
    ],
    linkHref: "/our-story",
    linkLabel: "Read our story",
  },
  {
    id: "mission",
    title: "Our Mission",
    body: [MISSION.statement],
    linkHref: "/mission",
    linkLabel: "Read the mission",
  },
  {
    id: "beliefs",
    title: "What SolenOS Believes",
    body: [...BELIEFS.items],
  },
  {
    id: "how",
    title: "How SolenOS Works",
    body: [
      "SolenOS collects the information caregivers already have and helps build an evolving understanding of what happened, what changed, what decisions were made, and what remains uncertain.",
    ],
    linkHref: "/how-it-works",
    linkLabel: "See how it works",
  },
  {
    id: "privacy",
    title: "Privacy & Trust",
    body: [PRIVACY_TRUST.lead, ...PRIVACY_TRUST.principles],
    linkHref: "/privacy",
    linkLabel: "Read the Privacy Policy",
  },
  {
    id: "terms",
    title: "Terms of Service",
    body: ["How you may use SolenOS — readable, always available."],
    linkHref: "/terms",
    linkLabel: "Read the Terms of Service",
  },
  {
    id: "contact",
    title: "Contact",
    body: ["Reach us when you need help — without interrupting care capture."],
    linkHref: "/contact",
    linkLabel: "Contact",
  },
  {
    id: "support",
    title: "Help",
    body: ["Calm product help — Privacy and Terms stay one click away."],
    linkHref: "/support",
    linkLabel: "Open Help",
  },
] as const;
