const SELF_CONTENT =
  /\b(my (?:own )?(?:dental|doctor|appointment|health|stress|sleep|needs|medication|back pain|headache)|I need (?:rest|a break|to see)|I'm (?:tired|exhausted)|my appointment)\b/i;

const RECIPIENT_CONTENT =
  /\b(grandma|grandmother|grandpa|grandfather|mom|dad|mother|father|she|he|her|him|they)\b/i;

export function splitInputBySubject(content: string): {
  caregiverText: string | null;
  recipientText: string | null;
} {
  const text = content.trim();
  if (!text) return { caregiverText: null, recipientText: null };

  const hasSelf = SELF_CONTENT.test(text);
  const hasRecipient = RECIPIENT_CONTENT.test(text);

  if (hasSelf && !hasRecipient) {
    return { caregiverText: text, recipientText: null };
  }
  if (hasRecipient && !hasSelf) {
    return { caregiverText: null, recipientText: text };
  }
  if (hasSelf && hasRecipient) {
    return { caregiverText: text, recipientText: text };
  }
  return { caregiverText: null, recipientText: text };
}

export function synthesizeCaregiverBasics(content: string, existing: string): string {
  if (existing.trim()) return existing;
  if (SELF_CONTENT.test(content)) return "Caregiver — own needs tracked in the same system.";
  return existing;
}
