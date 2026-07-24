/**
 * SolenOS MVP FAQ — trust & expectations for early caregivers.
 * SoT: docs/02-product/solenos-mvp-faq.md
 *
 * Home shows a short excerpt; Help Center shows the full set.
 * Not a legal wall. Not mandatory onboarding.
 */

export const MVP_FAQ_PURPOSE =
  "Answer early-caregiver trust questions without onboarding friction or ChatGPT expectations.";

export const MVP_FAQ_PHILOSOPHY =
  "SolenOS is not trying to know everything. It is trying to preserve what matters.";

export type MvpFaqItem = {
  id: string;
  question: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
  links?: readonly { href: string; label: string }[];
};

/** 5–7 most important — Home Screen only */
export const HOME_FAQ_IDS = [
  "what-is-solenos",
  "not-medical-service",
  "early-version",
  "can-misunderstand",
  "is-free",
  "stores-information",
  "gets-something-wrong",
] as const;

export const MVP_FAQ_ITEMS: readonly MvpFaqItem[] = [
  {
    id: "what-is-solenos",
    question: "What is SolenOS?",
    paragraphs: [
      "SolenOS helps caregivers organize important information about someone's care journey and understand changes over time.",
      "It helps bring together observations, notes, documents, and updates into a clearer picture of what is happening.",
      "SolenOS is designed to help caregivers understand:",
    ],
    bullets: [
      "what happened",
      "what changed",
      "what is known",
      "what is unclear",
      "what information may need attention",
    ],
  },
  {
    id: "not-medical-service",
    question: "Is SolenOS a healthcare or medical service?",
    paragraphs: [
      "No.",
      "SolenOS is not a replacement for doctors, nurses, healthcare professionals, or emergency services.",
      "SolenOS helps organize information and support caregiver understanding.",
      "Medical decisions should always involve appropriate healthcare professionals.",
    ],
  },
  {
    id: "not-ai-doctor",
    question: "Is SolenOS an AI doctor?",
    paragraphs: [
      "No.",
      "SolenOS does not diagnose conditions, prescribe treatments, or determine medical decisions.",
      "It helps organize the care story and highlight information that may be useful to discuss with healthcare professionals.",
    ],
  },
  {
    id: "early-version",
    question: "Why is SolenOS an early version?",
    paragraphs: [
      "Caregiving situations are complex.",
      "Understanding someone's care journey requires context, history, and real-world experience.",
      "This early version helps us learn how technology can better support caregivers.",
      "As an early user, your feedback helps improve how SolenOS understands real caregiving situations.",
    ],
  },
  {
    id: "can-misunderstand",
    question: "Can SolenOS misunderstand information?",
    paragraphs: [
      "Yes. SolenOS is still learning.",
      "Sometimes it may miss important context, misunderstand part of a situation, need more information, or use wording that can be improved.",
      "If something does not look correct, tell us. Your corrections help improve SolenOS.",
    ],
  },
  {
    id: "why-use-early",
    question: "Why should I use SolenOS if it is still improving?",
    paragraphs: [
      "Even in this early stage, SolenOS can help organize scattered care information and make it easier to see important events, changes over time, unanswered questions, and information that may need clarification.",
      "The goal is not to replace human judgment.",
      "The goal is to reduce the burden of trying to remember everything alone.",
    ],
  },
  {
    id: "is-free",
    question: "Is SolenOS free?",
    paragraphs: [
      "Yes. During the early access period, SolenOS is free for caregivers who want to help us improve the experience.",
      "Future pricing decisions will depend on what we learn from caregivers and how the product develops.",
    ],
  },
  {
    id: "what-can-add",
    question: "What information can I add to SolenOS?",
    paragraphs: [
      "You can add care notes, observations, documents, important updates, changes in daily routines, and questions you want to remember.",
      "You do not need to write in a specific format. Share information naturally.",
    ],
  },
  {
    id: "upload-document",
    question: "What happens when I upload a document?",
    paragraphs: [
      "SolenOS uses uploaded information as part of the Care Record.",
      "The goal is not simply to summarize documents.",
      "The goal is to understand whether the information represents a new event, a change, a decision, an outcome, or something that needs clarification.",
    ],
  },
  {
    id: "stores-information",
    question: "Does SolenOS store my information?",
    paragraphs: [
      "SolenOS stores information you provide to help build your Care Record.",
      "Please only upload information you are comfortable storing.",
      "For more details, see the Privacy Policy and Terms of Service.",
    ],
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
  {
    id: "who-can-see",
    question: "Who can see my information?",
    paragraphs: [
      "Your information is private to your SolenOS account unless you choose to share it.",
    ],
  },
  {
    id: "gets-something-wrong",
    question: "What should I do if SolenOS gets something wrong?",
    paragraphs: [
      "Tell us. Feedback is one of the most important parts of improving SolenOS.",
      "You can report incorrect understanding, missing context, confusing explanations, or things you expected SolenOS to notice.",
    ],
  },
  {
    id: "designed-for",
    question: "Who is SolenOS designed for?",
    paragraphs: [
      "SolenOS is designed for family caregivers supporting someone through changing care needs.",
      "Dementia caregiving is one important starting point because it represents many of the challenges SolenOS is designed to understand: changing situations, uncertainty, coordination, and long-term care journeys.",
    ],
  },
  {
    id: "not-replace-records",
    question: "Can SolenOS replace my notes or medical records?",
    paragraphs: [
      "No.",
      "SolenOS is not a replacement for official medical records.",
      "It is designed to help caregivers organize their own understanding of the care journey.",
    ],
  },
  {
    id: "help-improve",
    question: "How can I help improve SolenOS?",
    paragraphs: [
      "Use it with real caregiving situations.",
      "Tell us what was helpful, what was confusing, what SolenOS misunderstood, and what you expected it to understand.",
      "Your feedback helps shape the Care Reality Engine.",
    ],
  },
  {
    id: "vs-notes-app",
    question: "How is SolenOS different from a notes app?",
    paragraphs: [
      "A notes app stores information. SolenOS is designed to help organize the meaning behind the information.",
      "Instead of only storing a note, SolenOS aims to help organize what happened, what changed, what decisions followed, what is still unclear, and what connects to previous events.",
      "The goal is to maintain an evolving understanding of the care journey.",
    ],
  },
  {
    id: "vs-chatbot",
    question: "How is SolenOS different from a chatbot?",
    paragraphs: [
      "SolenOS is not designed to simply answer questions.",
      "A chatbot responds to conversations. SolenOS focuses on building a Care Record over time.",
      "Each interaction should help improve understanding of events, changes, decisions, outcomes, and unknowns.",
      "The goal is continuity, not just conversation.",
    ],
  },
  {
    id: "understand-completely",
    question: "Does SolenOS understand my family member completely?",
    paragraphs: [
      "No. Every person's care journey is unique.",
      "SolenOS can only understand the information provided and the context available.",
      "It may need more information to understand a situation better.",
      "A clearer understanding develops over time as more relevant information is added.",
    ],
  },
  {
    id: "why-ask-questions",
    question: "Why does SolenOS sometimes ask questions?",
    paragraphs: [
      "Questions help reduce uncertainty.",
      "SolenOS does not ask questions because it needs more conversation.",
      "It asks questions when missing information could change understanding.",
      "The goal is better understanding, not collecting unnecessary information.",
    ],
  },
  {
    id: "make-decisions",
    question: "Does SolenOS make decisions for me?",
    paragraphs: [
      "No.",
      "SolenOS does not make decisions on behalf of caregivers.",
      "Care decisions involve personal values, family circumstances, and healthcare professionals.",
      "SolenOS helps organize information so caregivers can make more informed decisions.",
    ],
  },
  {
    id: "tell-what-to-do",
    question: "Will SolenOS tell me what I should do?",
    paragraphs: [
      "No.",
      "SolenOS is designed to help caregivers understand situations, not replace human judgment.",
      "It may highlight things that changed, information that is missing, and questions worth discussing.",
      "It does not provide medical instructions or replace professional advice.",
    ],
  },
  {
    id: "misses-important",
    question: "What if SolenOS misses something important?",
    paragraphs: [
      "Tell us. Early versions improve through real caregiver feedback.",
      "If SolenOS misses context, your correction helps us understand what information mattered, what relationships were important, and what the system should learn to recognize.",
    ],
  },
  {
    id: "trust-every-response",
    question: "Should I trust every SolenOS response?",
    paragraphs: [
      "No AI system should be trusted without judgment.",
      "Always review information and consider the context of your own situation.",
      "SolenOS is designed to support understanding, not replace your own knowledge or professional guidance.",
    ],
  },
  {
    id: "why-show-uncertainty",
    question: "Why does SolenOS show uncertainty?",
    paragraphs: [
      "Because uncertainty is part of real caregiving.",
      "Sometimes families know a medication changed, but not whether it caused a later change.",
      "SolenOS should show what is known, what is possible, and what remains unclear rather than pretending to know more.",
    ],
  },
  {
    id: "what-happens-to-info",
    question: "What happens to information I enter?",
    paragraphs: [
      "Information you provide helps create your Care Record.",
      "SolenOS uses this information to organize your care journey and understand changes over time.",
      "You should only provide information you are comfortable storing.",
    ],
  },
  {
    id: "delete-information",
    question: "Can I delete my information?",
    paragraphs: [
      "During this early version, contact us at davidsolenos@gmail.com for help managing your information.",
    ],
  },
  {
    id: "shared-with-others",
    question: "Is my information shared with other people?",
    paragraphs: [
      "No. Your information is not shared with other users.",
      "Sharing should only happen when you choose to share information.",
    ],
  },
  {
    id: "upload-medical-docs",
    question: "Can I upload medical documents?",
    paragraphs: [
      "Yes. You may upload documents that help organize a person's care journey — such as discharge summaries, care instructions, medication information, or appointment notes.",
      "Always review important medical information with healthcare professionals.",
    ],
  },
  {
    id: "upload-everything",
    question: "Should I upload everything?",
    paragraphs: [
      "No. More information does not always mean better understanding.",
      "SolenOS is designed to focus on information that changes understanding of the care situation — for example new symptoms, changes in ability, decisions, hospital visits, medication changes, and changes in support needs.",
    ],
  },
  {
    id: "small-amount",
    question: "What happens if I only enter a small amount of information?",
    paragraphs: [
      "That is okay. Caregivers often do not have time to organize everything.",
      "SolenOS should work with small updates. Even a simple observation can become useful when connected with future information.",
    ],
  },
  {
    id: "why-need-feedback",
    question: "Why does SolenOS need my feedback?",
    paragraphs: [
      "Because caregiving situations are difficult for technology to understand.",
      "Your feedback helps improve what information matters, how changes are recognized, how uncertainty is represented, and how caregivers want information presented.",
    ],
  },
  {
    id: "who-created",
    question: "Who created SolenOS?",
    paragraphs: [
      "SolenOS was created to help address a common challenge in caregiving:",
      "Families often carry important knowledge about someone's care journey, but that knowledge can become scattered across documents, conversations, and memories.",
      "SolenOS is being developed to help preserve and organize that understanding over time.",
    ],
  },
  {
    id: "only-dementia",
    question: "Is SolenOS only for dementia caregivers?",
    paragraphs: [
      "Dementia caregiving is an important starting point because it demonstrates many complex care challenges: changing needs, uncertainty, long-term decisions, and coordination between family and professionals.",
      "However, SolenOS is designed around changing care journeys more broadly.",
    ],
  },
  {
    id: "emergency",
    question: "What should I do in an emergency?",
    paragraphs: [
      "Do not use SolenOS for emergencies.",
      "If there is an urgent health or safety concern, contact appropriate emergency services or healthcare professionals.",
    ],
  },
  {
    id: "why-family-caregivers",
    question: "Why is SolenOS starting with family caregivers?",
    paragraphs: [
      "Family caregivers often become the people who hold together history, observations, decisions, daily changes, and important context.",
      "SolenOS is designed to support that invisible coordination work.",
    ],
  },
  {
    id: "long-term-goal",
    question: "What is the long-term goal of SolenOS?",
    paragraphs: [
      "The goal is to build a system that helps families maintain an accurate understanding of a person's evolving care reality.",
      "Not just what information exists — but what changed, why it changed, what happened afterward, and what remains uncertain.",
    ],
  },
  {
    id: "how-thinks",
    question: "How does SolenOS understand information?",
    paragraphs: [
      "SolenOS does not simply summarize what you provide.",
      "It tries to organize information into parts of a care journey: what happened, what changed, what decisions were made, what is known, what is unclear, and what may need attention.",
      "SolenOS is designed to help organize understanding, not create certainty where information is missing.",
    ],
  },
  {
    id: "why-unclear",
    question: "Why doesn't SolenOS always give an answer?",
    paragraphs: [
      "Real caregiving situations are often uncertain.",
      "Sometimes the most helpful thing is not an answer, but understanding what is known and what still needs clarification.",
      "Showing uncertainty helps prevent incorrect assumptions.",
    ],
  },
  {
    id: "first-use-expect",
    question: "What should I expect when I first use SolenOS?",
    paragraphs: [
      "Because SolenOS is an early version, your first experience may vary.",
      "You may notice some situations are understood clearly, some responses may need additional context, some information may need to be corrected, and some features are still being developed.",
      "The value of SolenOS improves as it learns from real caregiving experiences.",
    ],
  },
  {
    id: "help-understand-better",
    question: "How can I help SolenOS understand my situation?",
    paragraphs: [
      "The most useful information usually includes what happened, when it happened, what changed, what was different before, what decisions were made, what happened afterward, and what questions you still have.",
      "You do not need to organize information perfectly. Describe the situation naturally.",
    ],
  },
  {
    id: "can-correct",
    question: "Can I correct SolenOS?",
    paragraphs: [
      "Yes. Correction is an important part of improving SolenOS.",
      "If something is incorrect, you can tell us what was misunderstood, what context was missing, and what SolenOS should have noticed.",
      "Caregiver knowledge is essential because families often know details that are not visible in documents.",
    ],
  },
  {
    id: "why-need-context",
    question: "Why can't SolenOS just summarize documents?",
    paragraphs: [
      "Documents contain information, but they do not always explain the full situation.",
      "A discharge summary may show a medication change, while a caregiver may know walking was improving before that change.",
      "Context helps create a clearer care story.",
    ],
  },
  {
    id: "improve-from-feedback",
    question: "Does SolenOS improve from caregiver feedback?",
    paragraphs: [
      "Feedback helps us understand where SolenOS needs improvement.",
      "Feedback may help improve future versions of SolenOS.",
      "Your personal care information is handled according to our Privacy Policy.",
    ],
    links: [{ href: "/privacy", label: "Privacy Policy" }],
  },
  {
    id: "who-not-for",
    question: "Who is SolenOS not designed for?",
    paragraphs: [
      "SolenOS is not designed to provide emergency assistance, diagnose health conditions, replace medical professionals, or make urgent medical decisions.",
      "It is designed to help organize and understand ongoing care situations.",
    ],
  },
  {
    id: "caregiver-in-control",
    question: "Who makes decisions using SolenOS?",
    paragraphs: [
      "You do.",
      "SolenOS helps organize information and highlight questions.",
      "Caregivers, families, and healthcare professionals remain responsible for decisions.",
    ],
  },
] as const;

export function getHomeFaqItems(): MvpFaqItem[] {
  const byId = new Map(MVP_FAQ_ITEMS.map((item) => [item.id, item]));
  return HOME_FAQ_IDS.map((id) => byId.get(id)).filter(
    (item): item is MvpFaqItem => Boolean(item),
  );
}

export function getFullFaqItems(): readonly MvpFaqItem[] {
  return MVP_FAQ_ITEMS;
}

/** Current Capabilities — honest early-access transparency */
export const CURRENT_CAPABILITIES = {
  title: "SolenOS Current Capabilities",
  lead: "SolenOS is an early version. This page explains what currently works well and what is still improving.",
  philosophy: MVP_FAQ_PHILOSOPHY,
  worksWell: {
    title: "Currently works well",
    items: [
      "organizing submitted information",
      "creating timelines of care events",
      "identifying mentioned events",
      "highlighting missing information",
      "preserving what you add over time",
    ],
  },
  stillImproving: {
    title: "Still improving",
    items: [
      "understanding complex situations",
      "connecting long-term patterns",
      "interpreting ambiguous caregiver language",
      "understanding family dynamics",
      "wording and clarity of every response",
    ],
  },
  closing:
    "Your feedback helps improve how SolenOS organizes care information and understands real caregiver experiences.",
} as const;

export const GLOBAL_FEEDBACK_OPTIONS = [
  "SolenOS misunderstood something",
  "SolenOS missed important information",
  "Response was confusing",
  "Response was helpful",
  "Something else",
] as const;

export const GLOBAL_FEEDBACK_PROMPT = "What did you notice?";
export const GLOBAL_FEEDBACK_LABEL = "Help us improve SolenOS";
