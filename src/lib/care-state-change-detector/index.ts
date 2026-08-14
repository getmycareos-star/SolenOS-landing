/**
 * Care State Change Detector — semantic change classification over longitudinal care evidence.
 *
 * Replaces shallow structural diffing with meaning-level change detection:
 * NEW, WORSENED, IMPROVED, RECURRING, PERSISTENT, RESOLVED, UNCERTAIN, CONFLICTING.
 *
 * This is the core reasoning layer that determines what changed, not merely what was added.
 */

import type { CanonicalCareEvent, CareContextRoot } from "../situation-entry/types";
import type { BaselineFact, BaselineDeviation } from "../baseline-intelligence-engine/types";
import type { ObservationSignal } from "../progressive-understanding/types";
import type { ChangeClassification, CareDomain, DomainChange, CompoundSignal, CareStateChangeReport } from "./types";

export type { ChangeClassification, CareDomain, DomainChange, CompoundSignal, CareStateChangeReport } from "./types";

const DOMAIN_PATTERNS: { domain: CareDomain; patterns: RegExp[] }[] = [
  { domain: "sleep", patterns: [/\b(sleep|nap|night|insomnia|restless|awake|tired|exhausted)\b/i] },
  { domain: "appetite", patterns: [/\b(appetite|eat(?:ing|s)?|meal|breakfast|lunch|dinner|refus(?:ed|es)?|hungry)\b/i] },
  { domain: "mobility", patterns: [/\b(walk(?:ing|s)?|mobility|fall|unsteady|wheelchair|transfer|balance|fell)\b/i] },
  { domain: "mood", patterns: [/\b(upset|agitat(?:ed|ion)?|anxious|calm|mood|irritable|happy|sad|frustrated|angry)\b/i] },
  { domain: "medication_adherence", patterns: [/\b(medication|med|pill|dose|refus(?:ed|es)?|took|taken|missed|forgot|adherence)\b/i] },
  { domain: "communication", patterns: [/\b(ask(?:ing|s)?|repeat(?:ing|s)?|question|talk|conversation|confus(?:ed|ion)?|word|name)\b/i] },
  { domain: "cognition", patterns: [/\b(confus(?:ed|ion)?|memory|remember|forget|recognize|disorient(?:ed)?|dementia|alzheimer)\b/i] },
  { domain: "social", patterns: [/\b(visit|visitor|family|friend|lonely|withdrawn|social|alone|isolated)\b/i] },
  { domain: "routine", patterns: [/\b(routine|morning|evening|daily|habit|usually|normally|schedule)\b/i] },
  { domain: "safety", patterns: [/\b(safe|unsafe|danger|wander|chok|dehydrat|infection|urgent|emergency|hospital)\b/i] },
];

const WORSENING_SIGNALS = /\b(worse|worsening|declin(?:e|ing)|more confused|more agitated|less|decreased|reduced|not eating|not sleeping|more forgetful|increasingly|further|additional|again|another|started|began|new symptom|new behavior|fell|fell again|missed|skipped|forgot|stopped taking)\b/i;
const IMPROVEMENT_SIGNALS = /\b(better|improved|improving|recovering|appetite returned|more active|calmer|less confused|eating better|sleeping better|back to normal|stabilized|stable|taking medication|compliant|adherent)\b/i;
const RECURRING_SIGNALS = /\b(again|another|still|continues?|persist(?:s|ing)?|repeat(?:ed|ing)?|back to|recurring|resumed|restarted|missed again|skipped again)\b/i;
const PERSISTENT_SIGNALS = /\b(persist(?:s|ing)?|continues?|ongoing|still|remain(?:s|ing)?|constant|chronic|every day|daily|all the time|has been|since|regularly|schedule)\b/i;
const RESOLVED_SIGNALS = /\b(resolved|cleared|gone|better now|improved|recovered|back to normal|no longer|stopped|ended|back on track|back to routine)\b/i;

const MEDICATION_STARTED = /\b(start(?:ed|ing)?|began|begun|new medication|new prescription|added|put on|started taking)\b/i;
const MEDICATION_STOPPED = /\b(stopp?ed|discontinued|quit taking|no longer taking|came off|removed)\b/i;
const MEDICATION_CHANGED = /\b(dose changed|changed dose|increased|decreased|adjusted|switched|different medication|new dose|higher|lower)\b/i;
const MEDICATION_MISSED = /\b(missed|skipped|forgot|forgot to take|didn'?t take|did not take|late dose)\b/i;
const MEDICATION_SIDE_EFFECT = /\b(side effect|reaction|nausea|dizziness|headache|rash|upset stomach|feeling sick|new symptom)\b/i;

function domainForText(text: string): CareDomain {
  for (const { domain, patterns } of DOMAIN_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) return domain;
    }
  }
  return "unknown";
}

function signalsForText(text: string): ObservationSignal[] {
  const signals: ObservationSignal[] = [];
  const lower = text.toLowerCase();
  if (/\bfrustrat/i.test(lower)) signals.push("frustration");
  if (/\bsad\b|upset|tear|cry/i.test(lower)) signals.push("sadness");
  if (/want(?:s|ed)? to go home|go home|homesick/i.test(lower)) signals.push("go_home");
  if (/\bconfus/i.test(lower)) signals.push("confusion");
  if (/\bagitat/i.test(lower)) signals.push("agitation");
  if (/\brefus\w*/i.test(lower) || /\bnot eating|won't eat|will not eat|appetite\b/i.test(lower)) signals.push("appetite");
  if (/\bfell\b|\bfall\b/i.test(lower)) signals.push("fall");
  if (/\bmedication|dose|pill/i.test(lower)) signals.push("medication");
  if (/\bimprov(?:ed|ing|ement)\b/i.test(lower)) signals.push("improvement");
  return signals;
}

function extractTimeHint(text: string): { relative: string | null; absolute: string | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const yesterdayMatch = text.match(/\byesterday\b/i);
  const todayMatch = text.match(/\btoday\b/i);
  const lastNightMatch = text.match(/\blast night\b/i);
  const thisMorningMatch = text.match(/\bthis morning\b/i);
  const lastWeekMatch = text.match(/\blast week\b/i);
  const daysAgoMatch = text.match(/(\d+)\s+days?\s+ago/i);
  const weekAgoMatch = text.match(/\ba\s+week\s+ago\b/i);
  const recentlyMatch = text.match(/\brecently\b|\blast\s+few\s+days\b/i);

  if (todayMatch || thisMorningMatch) return { relative: "today", absolute: today };
  if (yesterdayMatch || lastNightMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { relative: "yesterday", absolute: d.toISOString() };
  }
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1]!, 10);
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return { relative: `${days} days ago`, absolute: d.toISOString() };
  }
  if (weekAgoMatch || lastWeekMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { relative: "last week", absolute: d.toISOString() };
  }
  if (recentlyMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() - 3);
    return { relative: "recently", absolute: d.toISOString() };
  }
  return { relative: null, absolute: null };
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function computeTemporalProximity(observations: { text: string; timestamp: string }[]): number {
  if (observations.length < 2) return 0;
  const sorted = [...observations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let proximityScore = 0;
  for (let i = 1; i < sorted.length; i++) {
    const days = daysBetween(sorted[i - 1]!.timestamp, sorted[i]!.timestamp);
    if (days <= 1) proximityScore += 3;
    else if (days <= 3) proximityScore += 2;
    else if (days <= 7) proximityScore += 1;
  }
  return proximityScore;
}

function computeTrendDirection(observations: { text: string; timestamp: string }[]): "worsening" | "improving" | "stable" | "unknown" {
  if (observations.length < 2) return "unknown";
  const sorted = [...observations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const recent = sorted.slice(-3);
  const worseningCount = recent.filter((o) => WORSENING_SIGNALS.test(o.text)).length;
  const improvingCount = recent.filter((o) => IMPROVEMENT_SIGNALS.test(o.text)).length;
  if (worseningCount > improvingCount && worseningCount >= 2) return "worsening";
  if (improvingCount > worseningCount && improvingCount >= 2) return "improving";
  if (worseningCount === improvingCount && worseningCount > 0) return "unknown";
  return "stable";
}

function eventToDomainObservation(event: CanonicalCareEvent): { domain: CareDomain; text: string; timestamp: string; signals: ObservationSignal[] } {
  return {
    domain: domainForText(event.raw_input),
    text: event.raw_input,
    timestamp: event.timestamp,
    signals: signalsForText(event.raw_input),
  };
}

function classifyChangeForDomain(
  domain: CareDomain,
  observations: { text: string; timestamp: string; signals: ObservationSignal[] }[],
  baselineFacts: BaselineFact[],
  priorObservations: { text: string; timestamp: string; signals: ObservationSignal[] }[],
): DomainChange {
  const baseline = baselineFacts.find((b) => b.domain === domain);
  const recent = observations[observations.length - 1];
  const recentText = recent?.text ?? "";

  const allDomainObs = [...priorObservations, ...observations];
  const priorTexts = priorObservations.map((o) => o.text);
  const currentTexts = observations.map((o) => o.text);

  const hasPriorInDomain = priorObservations.length > 0 || (baseline !== undefined);
  const hasWorseningSignal = WORSENING_SIGNALS.test(recentText);
  const hasImprovementSignal = IMPROVEMENT_SIGNALS.test(recentText);
  const hasRecurringSignal = RECURRING_SIGNALS.test(recentText);
  const hasPersistentSignal = PERSISTENT_SIGNALS.test(recentText);
  const hasResolvedSignal = RESOLVED_SIGNALS.test(recentText);

  let classification: ChangeClassification = "NEW";
  let confidence: "low" | "medium" | "high" = "medium";
  let trajectory: "worsening" | "improving" | "stable" | "unknown" = "unknown";
  const evidence: string[] = [];

  const temporalProximity = computeTemporalProximity([...priorObservations, ...observations]);
  const trendDirection = computeTrendDirection([...priorObservations, ...observations]);

  if (!hasPriorInDomain) {
    classification = "NEW";
    confidence = observations.length >= 2 ? "medium" : "low";
    evidence.push(`First observation in ${domain} domain`);
    if (temporalProximity >= 3) {
      evidence.push("Multiple observations close together");
      confidence = "medium";
    }
  } else if (hasResolvedSignal && hasPriorInDomain) {
    classification = "RESOLVED";
    confidence = "medium";
    evidence.push("Resolution signal detected in latest observation");
    trajectory = "improving";
  } else if (hasImprovementSignal && hasPriorInDomain) {
    classification = "IMPROVED";
    confidence = hasPriorInDomain ? "medium" : "low";
    evidence.push("Improvement signal in latest observation");
    trajectory = "improving";
  } else if (hasWorseningSignal && hasPriorInDomain) {
    classification = "WORSENED";
    confidence = hasPriorInDomain ? "medium" : "low";
    evidence.push("Worsening signal in latest observation");
    trajectory = "worsening";
  } else if (hasRecurringSignal && hasPriorInDomain) {
    classification = "RECURRING";
    confidence = "medium";
    evidence.push("Recurring pattern signal detected");
    trajectory = "stable";
  } else if (hasPersistentSignal && hasPriorInDomain) {
    classification = "PERSISTENT";
    confidence = "medium";
    evidence.push("Persistent pattern signal detected");
    trajectory = "stable";
  } else if (hasPriorInDomain) {
    classification = "STABLE";
    confidence = "low";
    evidence.push("No directional change signal detected");
    trajectory = "stable";
  }

  if (trendDirection === "worsening" && classification !== "WORSENED") {
    evidence.push("Pattern suggests worsening trajectory over time");
    if (classification === "STABLE") classification = "WORSENED";
    if (confidence === "low") confidence = "medium";
    trajectory = "worsening";
  } else if (trendDirection === "improving" && classification !== "IMPROVED") {
    evidence.push("Pattern suggests improving trajectory over time");
    if (classification === "STABLE") classification = "IMPROVED";
    if (confidence === "low") confidence = "medium";
    trajectory = "improving";
  }

  if (domain === "medication_adherence" && hasPriorInDomain) {
    if (MEDICATION_STARTED.test(recentText)) {
      classification = "NEW";
      evidence.push("Medication started");
      trajectory = "stable";
    } else if (MEDICATION_STOPPED.test(recentText)) {
      classification = "WORSENED";
      evidence.push("Medication stopped");
      trajectory = "worsening";
      confidence = "high";
    } else if (MEDICATION_CHANGED.test(recentText)) {
      classification = "WORSENED";
      evidence.push("Medication dose or type changed");
      trajectory = "unknown";
      confidence = "medium";
    } else if (MEDICATION_MISSED.test(recentText)) {
      classification = "WORSENED";
      evidence.push("Medication missed");
      trajectory = "worsening";
      confidence = "medium";
    } else if (MEDICATION_SIDE_EFFECT.test(recentText)) {
      classification = "NEW";
      evidence.push("Potential medication side effect reported");
      trajectory = "unknown";
      confidence = "medium";
    }
  }

  if (observations.length >= 3 && trajectory === "unknown") {
    trajectory = "stable";
  }

  if (temporalProximity >= 3 && (classification === "WORSENED" || classification === "NEW")) {
    evidence.push("Changes appearing in close temporal proximity");
    if (confidence === "medium") confidence = "high";
  }

  const currentState = currentTexts.length > 0 ? currentTexts[currentTexts.length - 1]!.slice(0, 200) : "Unknown";
  const priorState = priorTexts.length > 0 ? priorTexts[priorTexts.length - 1]!.slice(0, 200) : (baseline?.label ?? null);

  const timestamps = allDomainObs.map((o) => o.timestamp).filter(Boolean).sort();
  const firstObservedAt = timestamps[0] ?? null;
  const lastObservedAt = timestamps[timestamps.length - 1] ?? new Date().toISOString();

  return {
    domain,
    classification,
    confidence,
    evidence,
    prior_state: priorState,
    current_state: currentState,
    trajectory,
    first_observed_at: firstObservedAt,
    last_observed_at: lastObservedAt,
    observation_count: allDomainObs.length,
  };
}

function detectCompoundSignals(changes: DomainChange[]): CompoundSignal[] {
  const compounds: CompoundSignal[] = [];
  const worseningDomains = changes.filter((c) => c.trajectory === "worsening" && c.classification !== "NEW");
  const improvingDomains = changes.filter((c) => c.trajectory === "improving");
  const newDomains = changes.filter((c) => c.classification === "NEW");

  if (worseningDomains.length >= 2) {
    const domains = worseningDomains.map((c) => c.domain.replace(/_/g, " ")).join(" and ");
    compounds.push({
      domains: worseningDomains.map((c) => c.domain),
      description: `Multiple domains showing concerning signals: ${domains}`,
      attention_required: true,
    });
  }
  if (newDomains.length >= 2) {
    const domains = newDomains.map((c) => c.domain.replace(/_/g, " ")).join(" and ");
    compounds.push({
      domains: newDomains.map((c) => c.domain),
      description: `New observations across multiple areas: ${domains}`,
      attention_required: true,
    });
  }
  if (worseningDomains.length >= 3) {
    compounds.push({
      domains: worseningDomains.map((c) => c.domain),
      description: "Several care areas changing at once — this pattern deserves attention",
      attention_required: true,
    });
  }
  if (worseningDomains.some((c) => c.domain === "mobility") && worseningDomains.some((c) => c.domain === "cognition")) {
    compounds.push({
      domains: ["mobility", "cognition"],
      description: "Mobility and cognition changes appearing together",
      attention_required: true,
    });
  }
  if (worseningDomains.some((c) => c.domain === "sleep") && worseningDomains.some((c) => c.domain === "mood")) {
    compounds.push({
      domains: ["sleep", "mood"],
      description: "Sleep and mood changes appearing together",
      attention_required: true,
    });
  }
  if (worseningDomains.some((c) => c.domain === "appetite") && worseningDomains.some((c) => c.domain === "medication_adherence")) {
    compounds.push({
      domains: ["appetite", "medication_adherence"],
      description: "Appetite and medication adherence changes appearing together",
      attention_required: true,
    });
  }
  if (improvingDomains.length > 0 && worseningDomains.length > 0) {
    compounds.push({
      domains: [...improvingDomains.map((c) => c.domain), ...worseningDomains.map((c) => c.domain)],
      description: "Mixed signals — some areas improving while others need attention",
      attention_required: true,
    });
  }

  return compounds;
}

export function detectCareStateChanges(input: {
  priorContext: CareContextRoot | null;
  currentContext: CareContextRoot;
  eventsCreated: CanonicalCareEvent[];
  baselineFacts: BaselineFact[];
  baselineDeviations: BaselineDeviation[];
  contradictions?: {
    open_contradictions: Array<{
      field: string;
      event_ids: string[];
      shared_message: string;
      affects_safety: boolean;
    }>;
    change_classifications: Array<{
      event_id: string;
      change_type: string;
      label: string;
    }>;
  };
}): CareStateChangeReport {
  const nowIso = new Date().toISOString();

  try {
    const priorEvents = input.priorContext?.events ?? [];
    const currentEvents = input.currentContext?.events ?? [];

    if (!Array.isArray(priorEvents) || !Array.isArray(currentEvents)) {
      return {
        generated_at: nowIso,
        has_meaningful_change: false,
        primary_changes: [],
        all_changes: [],
        compound_signals: [],
        attention_required: false,
        can_wait: true,
        unresolved_questions: [],
        trajectory_summary: "Unable to analyze care state — invalid input",
      };
    }

    const activeCurrent = currentEvents.filter(
      (e) => e && e.status && e.status !== "invalidated" && e.status !== "superseded",
    );
    const activePrior = priorEvents.filter(
      (e) => e && e.status && e.status !== "invalidated" && e.status !== "superseded",
    );

    const currentObservations = activeCurrent.map(eventToDomainObservation);
    const priorObservations = activePrior.map(eventToDomainObservation);

    const allDomains = new Set<CareDomain>([
      ...currentObservations.map((o) => o.domain),
      ...priorObservations.map((o) => o.domain),
      ...(input.baselineFacts ?? []).map((b) => b.domain as CareDomain),
    ]);

    const changes: DomainChange[] = [];
    for (const domain of allDomains) {
      const domainCurrent = currentObservations.filter((o) => o.domain === domain);
      const domainPrior = priorObservations.filter((o) => o.domain === domain);
      const domainBaseline = (input.baselineFacts ?? []).filter((b) => b.domain === domain);

      if (domainCurrent.length === 0 && domainPrior.length === 0 && domainBaseline.length === 0) continue;

      try {
        const change = classifyChangeForDomain(domain, domainCurrent, domainBaseline, domainPrior);
        changes.push(change);
      } catch {
        changes.push({
          domain,
          classification: "UNCERTAIN",
          confidence: "low",
          evidence: ["Error classifying change for domain"],
          prior_state: null,
          current_state: "Unknown",
          trajectory: "unknown",
          first_observed_at: null,
          last_observed_at: nowIso,
          observation_count: 0,
        });
      }
    }

    if (input.contradictions?.open_contradictions) {
      for (const contradiction of input.contradictions.open_contradictions) {
        const domain = domainForText(contradiction.shared_message);
        const existingChange = changes.find((c) => c.domain === domain);
        if (existingChange) {
          existingChange.classification = "CONFLICTING";
          existingChange.confidence = "high";
          existingChange.evidence.push(`Contradiction detected: ${contradiction.shared_message}`);
          existingChange.evidence.push(`Both versions preserved — source and date determine current belief`);
        } else {
          changes.push({
            domain: domain || "unknown",
            classification: "CONFLICTING",
            confidence: "high",
            evidence: [`Contradiction detected: ${contradiction.shared_message}`],
            prior_state: null,
            current_state: contradiction.shared_message,
            trajectory: "unknown",
            first_observed_at: null,
            last_observed_at: nowIso,
            observation_count: contradiction.event_ids.length,
          });
        }
      }
    }

    const meaningfulChanges = changes.filter(
      (c) => c.classification !== "STABLE" && c.classification !== "UNCERTAIN" && c.confidence !== "low",
    );

    const compoundSignals = detectCompoundSignals(changes);
    const attentionRequired =
      meaningfulChanges.some((c) => c.classification === "WORSENED" || c.classification === "NEW" || c.classification === "CONFLICTING") ||
      compoundSignals.length > 0;
    const canWait = !attentionRequired && meaningfulChanges.length === 0;

    const trajectorySummary = buildTrajectorySummary(changes);

    return {
      generated_at: nowIso,
      has_meaningful_change: meaningfulChanges.length > 0 || compoundSignals.length > 0,
      primary_changes: meaningfulChanges.slice(0, 5),
      all_changes: changes,
      compound_signals: compoundSignals,
      attention_required: attentionRequired,
      can_wait: canWait,
      unresolved_questions: deriveUnresolvedQuestions(changes, input.baselineFacts ?? []),
      trajectory_summary: trajectorySummary,
    };
  } catch (error) {
    return {
      generated_at: nowIso,
      has_meaningful_change: false,
      primary_changes: [],
      all_changes: [],
      compound_signals: [],
      attention_required: false,
      can_wait: true,
      unresolved_questions: [],
      trajectory_summary: "Error analyzing care state",
    };
  }
}

function buildTrajectorySummary(changes: DomainChange[]): string {
  const worsening = changes.filter((c) => c.trajectory === "worsening");
  const improving = changes.filter((c) => c.trajectory === "improving");
  const stable = changes.filter((c) => c.trajectory === "stable" && c.classification !== "NEW");
  const newDomains = changes.filter((c) => c.classification === "NEW");

  const parts: string[] = [];
  if (worsening.length > 0) {
    const domains = worsening.map((c) => c.domain.replace(/_/g, " ")).join(", ");
    parts.push(`${worsening.length} area(s) showing concerning signals (${domains})`);
  }
  if (improving.length > 0) {
    const domains = improving.map((c) => c.domain.replace(/_/g, " ")).join(", ");
    parts.push(`${improving.length} area(s) showing positive signals (${domains})`);
  }
  if (stable.length > 0) {
    parts.push(`${stable.length} area(s) holding steady`);
  }
  if (newDomains.length > 0) {
    const domains = newDomains.map((c) => c.domain.replace(/_/g, " ")).join(", ");
    parts.push(`New observations in ${domains}`);
  }
  if (parts.length === 0) {
    return "No directional signals detected yet";
  }
  return parts.join("; ");
}

function deriveUnresolvedQuestions(changes: DomainChange[], baselineFacts: BaselineFact[]): string[] {
  const questions: string[] = [];
  for (const change of changes) {
    if (change.classification === "WORSENED" || change.classification === "NEW") {
      const timeHint = extractTimeHint(change.current_state);
      if (!timeHint.absolute) {
        questions.push(`When did the ${change.domain.replace(/_/g, " ")} change start?`);
      }
      if (!change.evidence.some((e) => /\b(doctor|nurse|clinic|hospital|professional)\b/i.test(e))) {
        questions.push(`Has this been discussed with the care team?`);
      }
    }
    if (change.trajectory === "worsening" && change.observation_count >= 2) {
      questions.push(`Is the ${change.domain.replace(/_/g, " ")} change continuing?`);
    }
  }
  return [...new Set(questions)].slice(0, 4);
}

export function domainForEvent(event: CanonicalCareEvent): CareDomain {
  return domainForText(event.raw_input);
}

export function signalsForEvent(event: CanonicalCareEvent): ObservationSignal[] {
  return signalsForText(event.raw_input);
}
