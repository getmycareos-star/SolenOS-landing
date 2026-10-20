import type { CareJourneyCategory } from "./types";

const LEGAL =
  /\b(power of attorney|poa|durable power|last will|living will|updated will|the will|trust\b|estate plan|legal consult|attorney|lawyer|guardianship|conservatorship|advance directive|healthcare proxy)\b/i;
const FINANCIAL =
  /\b(financial plan|benefits applied|insurance|medicare|medicaid|bank|financial authority|billing|premium|claim|coverage|trust fund|money|budget)\b/i;
const FAMILY =
  /\b(family meeting|family discussion|sibling|brother|sister|new caregiver|care responsibilities|reassigned|shared care|share caregiving|family coordination|who will help)\b/i;
const ADMIN =
  /\b(forms completed|records requested|agency contacted|paperwork|application submitted|referral|intake|disability benefits|ssn|social security office)\b/i;
const CAREGIVING =
  /\b(home care|aide|caregiver hired|respite|care plan|care decision|nursing home|assisted living|hospice|end.of.life|palliative)\b/i;
const MEDICAL =
  /\b(appointment|doctor|hospital|medication|symptom|diagnosis|clinic|specialist|discharge|admission|fall|pain|therapy|nurse visit|lab result)\b/i;

export function inferCareJourneyCategory(content: string): CareJourneyCategory {
  const text = content.trim();
  if (!text) return "other";
  if (LEGAL.test(text)) return "legal";
  if (FINANCIAL.test(text)) return "financial";
  if (FAMILY.test(text)) return "family";
  if (ADMIN.test(text)) return "administrative";
  if (CAREGIVING.test(text)) return "caregiving";
  if (MEDICAL.test(text)) return "medical";
  return "other";
}

export function inferCareJourneyTitle(content: string, category: CareJourneyCategory): string {
  const text = content.trim();
  const first = text.split(/[.!?]+/)[0]?.trim();
  if (first && first.length <= 80) return first;
  if (first) return `${first.slice(0, 77)}…`;

  const titles: Record<CareJourneyCategory, string> = {
    medical: "Medical care event",
    legal: "Legal planning step",
    financial: "Financial care step",
    caregiving: "Care coordination event",
    administrative: "Administrative task",
    family: "Family coordination",
    other: "Care journey note",
  };
  return titles[category];
}

export const CATEGORY_LABELS: Record<CareJourneyCategory, string> = {
  medical: "Medical",
  legal: "Legal",
  financial: "Financial",
  caregiving: "Caregiving",
  administrative: "Administrative",
  family: "Family",
  other: "Other",
};
