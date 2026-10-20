import type {
  Classification,
  DecisionState,
  DomainTag,
  InternalRiskLevel,
  SessionMemory,
  SignalVector,
} from "./types";

function urgencyComponent(signals: SignalVector): number {
  if (signals.urgency_signals.length === 0) return 0.2;
  return Math.max(...signals.urgency_signals);
}

function medicalRisk(signals: SignalVector, raw: string): number {
  let risk = 0.1;
  if (signals.medical_entities.includes("oxygen")) risk = 0.75;
  if (signals.urgency_signals.some((u) => u >= 0.9)) risk = Math.max(risk, 0.95);
  if (signals.medical_entities.length >= 2) risk = Math.max(risk, 0.55);
  if (signals.inferred.some((i) => i.signal === "possible clinical decline")) {
    risk = Math.max(risk, 0.5);
  }
  if (/\b(discharge|medication|symptom)\b/i.test(raw)) risk = Math.max(risk, 0.35);
  return Math.min(1, risk);
}

function memoryRelevance(signals: SignalVector, memory: SessionMemory): number {
  let score = 0.1;
  if (memory.medications.length > 0 && signals.medical_entities.some((e) => /med/.test(e))) {
    score += 0.3;
  }
  if (memory.baseline_facts.length > 0) score += 0.2;
  if (memory.turn_count > 0) score += 0.15;
  if (memory.unresolved_issues.length > 0) score += 0.15;
  if (signals.context_entities.some((c) => memory.provider_names.some((p) => p.includes(c)))) {
    score += 0.1;
  }
  return Math.min(1, score);
}

function toInternalRisk(score: number, medicalRisk: number, uncertain: boolean): InternalRiskLevel {
  if (medicalRisk >= 0.75 && uncertain) return "ORANGE";
  if (score >= 0.75 || medicalRisk >= 0.9) return "RED";
  if (score >= 0.5 || medicalRisk >= 0.6) return "ORANGE";
  if (score >= 0.3) return "YELLOW";
  return "GREEN";
}

function resolveAction(
  domain: DomainTag,
  classification: Classification,
  signals: SignalVector,
  raw: string,
  blocking: string,
): { action: string; question: string } {
  const maxUrgency = signals.urgency_signals.length ? Math.max(...signals.urgency_signals) : 0;

  if (maxUrgency >= 0.9 && !signals.medical_entities.includes("oxygen")) {
    return {
      action: "Address immediate safety — contact emergency services or care provider if symptoms are active.",
      question: "Are any symptoms active right now that need immediate medical attention?",
    };
  }

  if (signals.medical_entities.includes("oxygen") || /\boxygen\s*\d/i.test(raw)) {
    return {
      action: "Check oxygen tubing and confirm reading is accurate.",
      question: "What is his normal oxygen level?",
    };
  }

  if (domain === "post-care" || /\b(discharge|hospital)\b/i.test(raw)) {
    return {
      action: "Confirm discharge instructions and identify one warning sign that requires calling the doctor.",
      question: "What specific symptom change did discharge papers say requires immediate contact?",
    };
  }

  if (signals.inferred.some((i) => i.signal === "missed care task")) {
    return {
      action: "Confirm whether the missed dose is safe to take now or should be skipped.",
      question: "What medication was missed and when was it due?",
    };
  }

  if (blocking === "medication_clarity" || signals.medical_entities.some((e) => /med/.test(e))) {
    return {
      action: "Verify current medication list before any other care decision.",
      question: "What medications were added or changed most recently?",
    };
  }

  if (domain === "administrative-care") {
    return {
      action: "Identify the single billing or coverage question blocking your next step.",
      question: "What document or bill are you trying to understand right now?",
    };
  }

  if (classification === "question") {
    return {
      action: "Answer the most urgent part of your question with one verified fact first.",
      question: "What is the single fact you need confirmed before acting?",
    };
  }

  if (signals.emotional_intensity >= 0.6) {
    return {
      action: "Pause and identify the single most urgent task — defer everything else.",
      question: "What is the one task that cannot wait until tomorrow?",
    };
  }

  return {
    action: "Document today's observable change in one sentence, then act on the highest-urgency item only.",
    question: "What is the main symptom or change you are worried about today?",
  };
}

/**
 * Step 4: Decision Engine
 * priority_score = (urgency * 0.4) + (medical_risk * 0.3) + (emotional * 0.2) + (memory * 0.1)
 */
export function runDecisionEngine(
  raw: string,
  classification: Classification,
  signals: SignalVector,
  domain: DomainTag,
  memory: SessionMemory,
): DecisionState {
  const urgency = urgencyComponent(signals);
  const medRisk = medicalRisk(signals, raw);
  const emotional = signals.emotional_intensity;
  const memRel = memoryRelevance(signals, memory);

  const priority_score = Math.max(
    Math.round(
      (urgency * 0.4 + medRisk * 0.3 + emotional * 0.2 + memRel * 0.1) * 100,
    ) / 100,
    domain === "post-care" ? 0.48 : 0,
    medRisk >= 0.75 ? 0.55 : 0,
  );

  const uncertain =
    signals.uncertainty_markers.length > 0 ||
    classification === "ambiguous" ||
    (signals.medical_entities.includes("oxygen") && !memory.baseline_facts.some((f) => /oxygen/i.test(f)));

  let blocking_factor = "";
  if (uncertain) blocking_factor = "missing_context";
  if (signals.inferred.some((i) => i.signal === "missed care task")) {
    blocking_factor = "missed_medication";
  }
  if (signals.medical_entities.includes("oxygen") && uncertain) {
    blocking_factor = "missing_baseline";
  }
  if (/\b(discharge)\b/i.test(raw) && signals.uncertainty_markers.length > 0) {
    blocking_factor = "discharge_unclear";
  }

  const { action, question } = resolveAction(domain, classification, signals, raw, blocking_factor);

  let confidence = 0.5 + priority_score * 0.3 - (uncertain ? 0.15 : 0);
  confidence = Math.max(0.2, Math.min(0.95, Math.round(confidence * 100) / 100));

  const risk_level = toInternalRisk(priority_score, medRisk, uncertain);

  return {
    primary_action: action,
    next_question: question,
    priority_score,
    risk_level,
    confidence,
    blocking_factor,
  };
}

export function mapInternalRiskToOutput(
  internal: InternalRiskLevel,
  uncertain: boolean,
  medicalRisk: number,
): import("../output-contract/types").SolenOSRiskLevel {
  if (internal === "RED") return "high";
  if (internal === "ORANGE") return "medium";
  if (internal === "YELLOW") return "medium";
  if (medicalRisk >= 0.75 && uncertain) return "medium";
  if (uncertain && internal !== "GREEN") return "medium";
  return "low";
}
