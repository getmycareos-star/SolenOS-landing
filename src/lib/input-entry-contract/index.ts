/**
 * SolenOS Input Entry Contract (MVP).
 * SoT: docs/02-product/solenos-input-entry-contract.md
 *
 * Entry methods collect evidence only. Reasoning never branches on origin.
 */

export const INPUT_ENTRY_CONTRACT_PURPOSE =
  "Caregiver chooses the easiest way to provide evidence; SolenOS builds understanding.";

/** How the caregiver chose to provide evidence — attribution only. */
export const INPUT_ENTRY_METHODS = [
  "scan",
  "snap",
  "upload",
  "share",
  "text",
  "voice",
] as const;

export type InputEntryMethod = (typeof INPUT_ENTRY_METHODS)[number];

/** MVP shipping entry actions in the composer (voice is FUTURE per ADR-018). */
export const MVP_COMPOSER_ENTRY_ACTIONS = ["scan", "snap", "upload", "share"] as const;

export type MvpComposerEntryAction = (typeof MVP_COMPOSER_ENTRY_ACTIONS)[number];

export const INPUT_ENTRY_ACTION_CONTRACT = {
  scan: {
    purpose: "Capture physical documents",
    opens: "document_scanner",
    never: ["normal_file_picker", "photo_mode_camera_first"] as const,
    examples: [
      "Hospital discharge papers",
      "Clinic letters",
      "Medication lists",
      "Insurance documents",
      "Referral forms",
      "Lab reports",
      "Printed care plans",
    ],
  },
  snap: {
    purpose: "Capture something happening right now",
    opens: "live_camera",
    never: ["document_scanner"] as const,
    examples: [
      "Medication bottle",
      "Prescription label",
      "Rash",
      "Wound",
      "Swollen leg",
      "Meal",
      "Whiteboard instructions",
      "Home environment",
      "Medical equipment",
    ],
  },
  upload: {
    purpose: "Select existing files already on the device",
    opens: "system_file_picker",
    never: ["camera", "document_scanner"] as const,
    allow: [
      "PDF",
      "Images",
      "Documents",
      "Text files",
      "Email exports",
      "Word documents",
      "Other supported files",
    ] as const,
  },
  share: {
    purpose: "Receive existing content from another app",
    opens: "os_share_target",
    never: ["separate_understanding_pipeline"] as const,
    examples: [
      "WhatsApp messages",
      "Email",
      "Photos",
      "PDFs",
      "Notes",
      "Voice recordings",
      "Browser pages",
    ],
  },
} as const;

/**
 * After evidence enters, every origin follows this path.
 * Origin must never change the reasoning engine.
 */
export const EVIDENCE_PIPELINE_AFTER_ENTRY = [
  "evidence_understanding",
  "care_reality_update",
  "situation_relationship_engine",
  "response_contract",
] as const;

export const INPUT_ENTRY_NON_NEGOTIABLE =
  "They provide evidence. SolenOS builds understanding.";

/** Upload accept list — file picker only; never camera/scanner attributes. */
export const UPLOAD_FILE_ACCEPT =
  "image/*,application/pdf,text/plain,text/*,.txt,.md,.csv,.doc,.docx,.rtf,.eml,.msg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isInputEntryMethod(value: string): value is InputEntryMethod {
  return (INPUT_ENTRY_METHODS as readonly string[]).includes(value);
}

/**
 * Map entry method → CareEvent input_type channel.
 * Channel is coarse; entry_method stays for attribution only.
 */
export function entryMethodToInputType(
  method: InputEntryMethod,
): "voice" | "text" | "document" {
  if (method === "text") return "text";
  if (method === "voice") return "voice";
  return "document";
}

/**
 * Guard: understanding / SRE must not branch on entry method.
 * Call from verify scripts and optional runtime asserts.
 */
export function assertEntryMethodDoesNotBranchReasoning(
  usedForReasoningBranch: boolean,
): void {
  if (usedForReasoningBranch) {
    throw new Error(
      "Input Entry Contract: entry_method must not change Evidence Understanding / SRE / Response Contract.",
    );
  }
}

export function describeEntryAction(method: MvpComposerEntryAction): string {
  return INPUT_ENTRY_ACTION_CONTRACT[method].purpose;
}
