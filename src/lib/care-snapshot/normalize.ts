const FILLER_PATTERN =
  /\b(um+|uh+|like|i think maybe|maybe|sort of|kind of)\b/gi;
const MULTI_SPACE = /\s{2,}/g;

export function cleanText(text: string): string {
  return text
    .replace(FILLER_PATTERN, "")
    .replace(MULTI_SPACE, " ")
    .trim()
    .replace(/^[-•*]\s*/, "");
}

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map(cleanText)
    .filter((s) => s.length > 0);
}

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MONTH_NAMES: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  const dayName = DAY_NAMES[date.getDay()];
  const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return `${isoDate} (${capitalized})`;
}

function parseIsoInText(text: string): string | null {
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slashMatch) {
    const month = Number(slashMatch[1]) - 1;
    const day = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2000;
    return toIsoDate(new Date(year, month, day));
  }

  const monthDayMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/i,
  );
  if (monthDayMatch) {
    const monthKey = monthDayMatch[1].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    const day = Number(monthDayMatch[2]);
    const year = monthDayMatch[3]
      ? Number(monthDayMatch[3])
      : new Date().getFullYear();
    return toIsoDate(new Date(year, month, day));
  }

  return null;
}

function resolveRelativeDate(
  text: string,
  referenceDate: Date,
): string | null {
  const lower = text.toLowerCase();

  if (/\byesterday\b/.test(lower)) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 1);
    return toIsoDate(d);
  }

  if (/\b(today|this morning|this afternoon|this evening|tonight|last night)\b/.test(lower)) {
    return toIsoDate(referenceDate);
  }

  const dayMatch = lower.match(
    /\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );
  if (dayMatch) {
    const targetDay = DAY_NAMES.indexOf(
      dayMatch[2] as (typeof DAY_NAMES)[number],
    );
    const refDay = referenceDate.getDay();
    let diff = targetDay - refDay;
    if (diff > 0) diff -= 7;
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + diff);
    return toIsoDate(d);
  }

  if (/\blast week\b/.test(lower)) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 7);
    return toIsoDate(d);
  }

  return null;
}

export function extractDate(
  text: string,
  recordedAt?: string,
): { date: string | null; dateLabel: string } {
  const explicit = parseIsoInText(text);
  if (explicit) {
    return { date: explicit, dateLabel: formatDateLabel(explicit) };
  }

  const reference = recordedAt
    ? new Date(recordedAt)
    : new Date();

  const relative = resolveRelativeDate(text, reference);
  if (relative) {
    return { date: relative, dateLabel: formatDateLabel(relative) };
  }

  if (recordedAt) {
    const iso = toIsoDate(new Date(recordedAt));
    return { date: iso, dateLabel: formatDateLabel(iso) };
  }

  return { date: null, dateLabel: "unknown date" };
}

export function extractIdentity(
  inputs: { text: string; metadata?: { patientName?: string; contextLabel?: string } }[],
): { patientName?: string; contextLabel?: string } {
  let patientName: string | undefined;
  let contextLabel: string | undefined;

  for (const input of inputs) {
    if (!patientName && input.metadata?.patientName) {
      patientName = input.metadata.patientName.trim();
    }
    if (!contextLabel && input.metadata?.contextLabel) {
      contextLabel = input.metadata.contextLabel.trim();
    }
  }

  for (const input of inputs) {
    const lower = input.text.toLowerCase();
    if (!contextLabel) {
      if (/\bfamily care\b/.test(lower)) contextLabel = "Family Care";
      else if (/\bhome care\b/.test(lower)) contextLabel = "Home Care";
    }
    if (!patientName) {
      const nameMatch = input.text.match(
        /\bpatient(?:\s+name)?[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
      );
      if (nameMatch) patientName = nameMatch[1];
    }
  }

  const identity: { patientName?: string; contextLabel?: string } = {};
  if (patientName) identity.patientName = patientName;
  if (contextLabel) identity.contextLabel = contextLabel;
  return identity;
}
