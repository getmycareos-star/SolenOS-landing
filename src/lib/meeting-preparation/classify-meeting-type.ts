import type { MeetingType } from "./types";

const MEDICAL = /\b(doctor|physician|primary care|specialist|neurolog|cardiolog|hospital|therapy|pharmacy|clinic|medical|nurse)\b/i;
const LEGAL = /\b(attorney|lawyer|estate|power of attorney|poa|guardianship|legal|will|trust)\b/i;
const FINANCIAL = /\b(insurance|benefits|billing|medicare|medicaid|financial|claim|coverage)\b/i;
const CARE_COORD = /\b(home care|case manager|social worker|facility|agency|long-term care|care coordinator)\b/i;
const FAMILY = /\b(family meeting|family care|care planning|sibling|responsibilit)\b/i;

export function classifyMeetingType(title: string, hint?: MeetingType): MeetingType {
  if (hint) return hint;
  const text = title.trim();
  if (!text) return "other";
  if (LEGAL.test(text)) return "legal";
  if (FINANCIAL.test(text)) return "financial";
  if (CARE_COORD.test(text)) return "care_coordination";
  if (FAMILY.test(text)) return "family";
  if (MEDICAL.test(text)) return "medical";
  return "other";
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  medical: "Healthcare",
  legal: "Legal",
  financial: "Financial",
  care_coordination: "Care coordination",
  family: "Family",
  other: "Other",
};
