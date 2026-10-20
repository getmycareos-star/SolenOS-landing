import type {
  ActionState,
  InterpretedState,
  PriorityState,
} from "./domain/types";

/**
 * PRIORITY_STATE → ACTION_STATE
 * What the user should actually do — not diagnoses.
 */
export function generateActions(
  interpreted: InterpretedState,
  priority: PriorityState,
): ActionState {
  const text = interpreted.signal_text;
  const actions = {
    do_now: [] as string[],
    do_today: [] as string[],
    ask_professional: [] as string[],
    do_not_do: [] as string[],
  };

  const hasEmergency = /\b(emergency|911|unresponsive|severe pain|chest pain)\b/i.test(
    text,
  );
  const hasDischarge = /\b(discharge|hospital|sent home)\b/i.test(text);
  const hasMed = /\b(medication|med|pill|prescription)\b/i.test(text);
  const hasDoctor = /\b(doctor|physician|appointment)\b/i.test(text);

  switch (priority.classification) {
    case "IMMEDIATE_ACTION":
      actions.do_now.push(
        "Address immediate safety — contact emergency services or care provider if symptoms are active.",
      );
      actions.do_not_do.push(
        "Do not delay seeking help if symptoms are worsening.",
      );
      break;
    case "SOON_ACTION":
      if (hasDischarge) {
        actions.do_today.push(
          "Review discharge instructions and confirm follow-up appointment details.",
        );
      }
      if (hasMed) {
        actions.do_today.push(
          "Confirm current medication list and any recent changes.",
        );
      }
      actions.ask_professional.push(
        "Ask what symptoms should prompt an immediate call to the doctor.",
      );
      break;
    case "MONITOR_ONLY":
      actions.do_today.push(
        "Document observable changes in one sentence for future reference.",
      );
      if (interpreted.uncertain_elements) {
        actions.do_today.push(
          "Write down what remains unclear — do not guess.",
        );
      }
      break;
    case "IGNORE_FOR_NOW":
      actions.do_not_do.push(
        "Do not make major care decisions until today's priority is clear.",
      );
      break;
  }

  if (hasDoctor && !hasEmergency) {
    actions.ask_professional.push(
      "Prepare one specific question for your next provider contact.",
    );
  }

  actions.do_not_do.push(
    "Do not attempt to diagnose or change treatment without professional guidance.",
  );

  return { actions };
}
