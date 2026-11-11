/**
 * Legal document copy — calm, caregiver-respectful, not a legal website feel.
 * Not legal advice; update with counsel before commercial launch.
 */

import { SUPPORT_EMAIL } from "../early-access-trust";

export const PRIVACY_POLICY = {
  title: "Privacy Policy",
  updated: "11 November 2026",
  lead:
    "SolenOS holds information about a person's care journey. This policy explains what information the service handles, why it is used, who may receive it, and what you can and cannot currently ask us to do with it.",
  sections: [
    {
      title: "1. What SolenOS is — and is not",
      body: [
        "SolenOS helps caregivers organize care notes, documents, observations, decisions, and changes over time in a Living Care Record. It is designed to support continuity and understanding, not to replace the person receiving care, their caregivers, or qualified professionals.",
        "SolenOS is not a healthcare provider, medical-record system operated by a clinic, emergency service, advertising platform, or social network. It does not diagnose, prescribe, or make healthcare decisions. AI-generated information can be incomplete or wrong and must be reviewed by a person.",
        "SolenOS is an early-access service. Features, availability, and workflows may change, and some privacy requests cannot yet be completed automatically. Please do not use SolenOS as your only copy of important care information.",
      ],
    },
    {
      title: "2. Information we handle",
      body: [
        "Care information you choose to enter, including observations, notes, events, questions, decisions, outcomes, appointment details, and information about the person receiving care.",
        "Documents and other files you upload, together with related information such as filenames, file type, upload time, source text, and extraction or review results. Uploaded documents may contain sensitive health and personal information.",
        "Information needed to operate a care workspace, such as caregiver and care-recipient identifiers, account email address, session and security records, consent choices, and contributor attribution.",
        "Information you send to AI Companion or document and capture assistance, including the request and the relevant care context selected for that task.",
        "Basic technical and operational information, such as service requests, timestamps, error categories, and security events. We aim to keep operational logs from containing care-record content, credentials, or session tokens; this does not mean every provider log or diagnostic record has been independently audited.",
        "Feedback you deliberately submit to help improve SolenOS. We do not treat ordinary care-record entries as blanket permission to use those entries for product-improvement training.",
      ],
    },
    {
      title: "3. How we use information",
      body: [
        "To create, maintain, retrieve, and protect the care workspace and its Living Care Record.",
        "To preserve source information and attribution, organize events over time, identify missing or conflicting information, and help caregivers review changes and prepare for conversations with professionals.",
        "To provide the AI-assisted functions you choose to use. The system may process relevant care context to generate a response or proposed extraction. AI-generated candidates are intended to remain reviewable; they are not a substitute for the original source or a professional assessment.",
        "To authenticate caregivers, maintain sessions, prevent unauthorized access, investigate service failures, and protect the service.",
        "If you separately opt in, to review feedback you explicitly submit for product improvement. The backend checks for a recorded improvement opt-in before accepting this feedback. This optional choice is separate from the processing needed to provide the core care-record service.",
        "We do not sell care stories or use care information to serve advertising.",
      ],
    },
    {
      title: "4. AI processing and its limits",
      body: [
        "Our current technical design routes Qwen-powered assistance through a private Ollama model runtime. SolenOS is not designed to send requests to a hosted Qwen API, OpenAI API, or Gemini API as a fallback if that runtime is unavailable. If the configured model is unavailable or fails, the backend is designed to return an error rather than silently substitute another hosted model.",
        "When you use an AI-assisted function, the request and the relevant care information selected for that function may be sent from the backend to that configured model runtime for processing. Do not assume that AI processing is the same as keeping information solely on your device.",
        "We have not yet independently confirmed the complete production runtime configuration, the exact physical processing location, or the model operator's logging and retention practices. We therefore do not promise a specific AI data-residency location or that all model-runtime diagnostics are immediately erased.",
        "AI output may omit context, misread a document, or make an incorrect interpretation. Review it against the source. SolenOS does not make an AI response an authoritative care fact merely because a model generated it.",
      ],
    },
    {
      title: "5. Who may receive or access information",
      body: [
        "Care information is scoped to its care workspace. A caregiver's authenticated session is associated with a particular care record; it is not intended to grant access to unrelated care records.",
        "People you invite or authorize as contributors may be able to access or add information within the shared care workspace and the permissions available to them. Contributions are intended to retain attribution. Do not invite someone unless you are comfortable giving them that access and have authority to share the information.",
        "SolenOS uses hosting, database, and model-runtime infrastructure to operate the service. Those providers may process information as needed to provide their services. We have not yet published a complete, independently verified list of the service providers that may process information, what each provider does, where processing occurs, or how long each provider retains information. We will update this information as those details are confirmed.",
        "We may disclose information where required by applicable law or where reasonably necessary to protect users, investigate abuse, or respond to a security incident. We do not sell personal or care information.",
      ],
    },
    {
      title: "6. Storage, security, and retention",
      body: [
        "The backend source stores structured care information in a PostgreSQL database. Uploaded evidence is represented in the backend data model, which can include original document bytes as well as extracted or source text. We have not independently confirmed the complete production storage configuration or the locations of every backup, replica, log, and provider copy.",
        "The service includes safeguards such as password hashing, hashed session-token storage, authenticated care-record scoping, and access checks. These controls reduce risk but do not make an online service risk-free. We do not claim that every stored item is encrypted at rest or that every provider's security controls have been independently audited.",
        "We do not currently publish a complete, enforced retention schedule covering care records, uploaded files, extracted text, AI conversations, security logs, backups, and provider copies. We therefore cannot promise a fixed deletion or backup-expiry period.",
        "Keep your own copy of important documents and care information. Do not upload information you are not authorized to share or are unwilling to store with an online early-access service.",
      ],
    },
    {
      title: "7. Access, correction, export, and deletion",
      body: [
        "You can email davidsolenos@gmail.com to ask about information associated with your care workspace, request a correction, ask for an export, or request deletion. We may need to verify your identity and your authority to act for the person whose care information is involved. Being signed in as a caregiver does not by itself establish legal authority over another person's information.",
        "The backend currently supports authenticated privacy-request intake and a restricted human review step. Submitting a request records that it was received; it does not itself mean that the request has been approved or fulfilled. We will not describe a request as completed until the relevant action has actually been performed and checked.",
        "Correction fulfilment currently supports a limited class of insight-description corrections. The original value is retained in a correction record. This is not a general ability to rewrite every source document, uploaded record, or item of care history.",
        "A complete self-service export and end-to-end erasure of all eligible care information, uploaded bytes, derived records, backups, and provider copies are not currently established as available capabilities. We cannot promise that every export or deletion request can be fulfilled immediately or that submitting one automatically removes data.",
        "Deleting an optional SolenOS login account is not the same as deleting the care record. The current account-deletion endpoint removes the login account and its linked email, revokes other account-linked sessions, and explicitly retains the care record and its history. Contact us separately if you want to request review of care-record deletion.",
        "If a request cannot be completed, we will explain the limitation and, where applicable, the reason. We do not publish a guaranteed response or completion deadline at this time.",
      ],
    },
    {
      title: "8. Your choices and responsibilities",
      body: [
        "Use only information you have permission to provide. If you are acting for another person, consider their wishes, capacity, legal arrangements, and applicable requirements before entering or sharing their information.",
        "Review AI-generated content and proposed records before relying on them. Correct errors and preserve the original source where it matters.",
        "Keep your sign-in details and any one-time recovery code private. Do not share a device or session with someone who should not see the care workspace.",
        "You can review the Privacy Policy and Terms of Use from the public site or inside SolenOS. Contact us if you need help understanding a data-use choice or making a privacy request.",
      ],
    },
    {
      title: "9. International processing and legal status",
      body: [
        "SolenOS may rely on infrastructure and service providers operating in a country different from yours. We have not yet confirmed and published a complete map of production data locations, international transfers, or provider-side retention. We do not make a country-specific data-residency promise in this policy.",
        "SolenOS does not claim to be HIPAA-certified or to be a HIPAA-covered entity or business associate in every use case. Whether a particular law applies depends on the facts and relationships involved. This policy is a plain-language description of current product behavior, not legal advice or a compliance certification.",
      ],
    },
    {
      title: "10. Changes to this policy",
      body: [
        "We may update this policy when the product, its providers, or its data practices change. We will revise the date at the top when we make a change. For material changes, we will take reasonable steps to make the updated policy visible. Please review it periodically.",
      ],
    },
    {
      title: "11. Contact",
      body: [
        "For privacy questions, access, correction, export, or deletion requests, email davidsolenos@gmail.com or use Contact on the SolenOS website. Include enough information for us to locate the relevant request, but do not email passwords, recovery codes, or unnecessary medical details.",
        "We will review messages carefully. A request is not complete until we confirm what action was taken.",
      ],
    },
  ],
} as const;

export const TERMS_OF_USE = {
  title: "Terms of Service",
  updated: "11 November 2026",
  lead:
    "These Terms govern your use of the SolenOS platform, website, and related services. By accessing or using SolenOS, you agree to these Terms. If you do not agree, please do not use the Service.",
  sections: [
    {
      title: "1. About SolenOS",
      body: [
        "SolenOS is a care organization and understanding platform designed to help family caregivers organize information about a person's care journey.",
        "SolenOS helps users organize care information; maintain a timeline of important events; understand changes over time; preserve care history; and identify areas that may require attention or further discussion.",
        "SolenOS is designed to support caregivers in managing information and reducing cognitive burden.",
      ],
    },
    {
      title: "2. Not Medical Advice",
      body: [
        "SolenOS does not provide medical advice, diagnosis, treatment recommendations, or emergency services.",
        "Information provided by SolenOS should not replace doctors, healthcare professionals, emergency services, or professional medical judgment.",
        "You should always seek appropriate professional advice for medical concerns or urgent situations.",
        "SolenOS may help organize information and prepare questions, but decisions about medical care should be made with qualified healthcare professionals.",
      ],
    },
    {
      title: "3. User Responsibilities",
      body: [
        "You are responsible for the information you provide to SolenOS; ensuring that information you upload is accurate to the best of your knowledge; protecting access to your account; and using SolenOS responsibly.",
        "You should not use SolenOS to replace professional healthcare decisions; create emergency response plans; store information you are not authorized to share; or upload illegal or harmful content.",
      ],
    },
    {
      title: "4. Information You Provide",
      body: [
        "SolenOS may process care notes, documents, images, messages, voice inputs (when available), and information about a person receiving care.",
        "You should only provide information that you have permission to share.",
        "You understand that care information may include sensitive personal information and should use SolenOS responsibly.",
      ],
    },
    {
      title: "5. AI-Generated Information",
      body: [
        "SolenOS may use artificial intelligence technology to help organize, analyze, and present information.",
        "AI-generated outputs may contain errors.",
        "SolenOS does not guarantee that every interpretation, summary, or insight will be complete or accurate.",
        "Users should review information carefully and use professional judgment.",
        "SolenOS is designed to help users understand information, not replace human decision-making.",
      ],
    },
    {
      title: "6. Data Storage and Security",
      body: [
        "We take reasonable measures to protect information stored within SolenOS.",
        "However, no online service can guarantee complete security.",
        "You understand that internet-based services involve risks; you are responsible for maintaining account security; and you should not share your login information.",
        "For more information about how we handle information, please review our Privacy Policy.",
      ],
    },
    {
      title: "7. Account Access",
      body: [
        "You are responsible for maintaining access to your account.",
        "If you notice unauthorized access or suspicious activity, you should contact us.",
        "We may restrict or suspend accounts that violate these Terms, misuse the Service, create security risks, or harm other users.",
      ],
    },
    {
      title: "8. Service Availability",
      body: [
        "We are continuously improving SolenOS.",
        "The Service may change over time, including adding features, removing features, fixing errors, and improving performance.",
        "We do not guarantee that SolenOS will always be available without interruption.",
      ],
    },
    {
      title: "9. Early Access / Beta Version",
      body: [
        "If you use an early access or beta version of SolenOS, you understand that features may be incomplete; errors may occur; functionality may change; and your feedback may be used to improve the Service.",
        "Early access users help shape the development of SolenOS.",
        "You are currently using SolenOS free during the early access period. Access and pricing may change in the future. This is not a permanent free-forever commitment.",
      ],
    },
    {
      title: "10. Intellectual Property",
      body: [
        "SolenOS, including its design, software, branding, and underlying technology, belongs to SolenOS unless otherwise stated.",
        "You may not copy the Service, reverse engineer the platform, or misuse our intellectual property.",
      ],
    },
    {
      title: "11. User Feedback",
      body: [
        "If you provide feedback, suggestions, or ideas about SolenOS, you allow us to use that feedback to improve the Service.",
        "You retain ownership of your personal information and content.",
      ],
    },
    {
      title: "12. Limitation of Liability",
      body: [
        "To the maximum extent permitted by law, SolenOS is not responsible for medical decisions made using information organized through the platform; outcomes resulting from caregiver decisions; interruptions of service; or loss caused by misuse of the platform.",
        "SolenOS provides an information organization service, not healthcare services.",
      ],
    },
    {
      title: "13. Privacy",
      body: [
        "Your privacy matters to us.",
        "Our collection, use, and protection of information is described in our Privacy Policy.",
        "By using SolenOS, you acknowledge that you have reviewed our Privacy Policy.",
      ],
    },
    {
      title: "14. Changes to These Terms",
      body: [
        "We may update these Terms as SolenOS evolves.",
        'When changes are made, we will update the "Last Updated" date.',
        "Your continued use of SolenOS after changes means you accept the updated Terms.",
      ],
    },
    {
      title: "15. Contact",
      body: [
        `SolenOS Support — Email: ${SUPPORT_EMAIL}`,
      ],
    },
    {
      title: "Final Notice",
      body: [
        "SolenOS exists to help caregivers better understand and organize the complexity of care.",
        "It is a support tool for clarity and continuity.",
        "It does not replace healthcare professionals, medical judgment, or emergency services.",
      ],
    },
  ],
} as const;

export const CONTACT_PAGE = {
  title: "Contact",
  lead: "We read messages from caregivers carefully. Tell us what you need.",
  emailLabel: "Email",
  email: SUPPORT_EMAIL,
  note: "For product feedback during early access, a short note is enough — you do not need a formal brief.",
} as const;

export const SUPPORT_PAGE = {
  title: "Help",
  lead: "SolenOS helps you organize care information, understand changes over time, and keep important parts of someone's care story in one place.",
  items: [
    {
      title: "Getting started",
      body: "Add information about the person you are caring for. Share what happened through text, uploads, documents, or notes. Review how SolenOS organizes the information. Continue adding updates as the care situation changes. The Care Record should become more useful over time.",
    },
    {
      title: "What SolenOS does",
      body: "Organize important care information; understand changes over time; connect events; remember decisions and their context; identify areas where more information may be needed.",
    },
    {
      title: "What SolenOS does not do",
      body: "SolenOS does not diagnose medical conditions; replace doctors or healthcare professionals; provide emergency medical advice; or make medical decisions for users. SolenOS helps organize understanding. It does not replace professional judgment.",
    },
    {
      title: "What is the Care Record?",
      body: "A growing history of important care information — events, changes, decisions, outcomes, documents, and notes — to help caregivers understand the care journey over time. Yes, you can add more information later.",
    },
    {
      title: "Documents and uploads",
      body: "You can add care notes, medical documents, important messages, relevant images, and other care information. SolenOS does not replace your doctor's official records or healthcare systems.",
    },
    {
      title: "Privacy and how information is used",
      body: "Information is private to your SolenOS care workspace unless you choose to share it. SolenOS uses what you provide to help organize and understand the care situation. See Privacy Policy and Terms of Service.",
    },
    {
      title: "Feedback — early version",
      body: `SolenOS is being developed with caregiver feedback. Share what was helpful, confusing, missed, or would make it more useful. Email: ${SUPPORT_EMAIL}`,
    },
    {
      title: "Contact support",
      body: `Need help? Email: ${SUPPORT_EMAIL}`,
    },
  ],
} as const;
