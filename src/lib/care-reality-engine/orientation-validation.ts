/**
 * Phase 13 — Caregiver Orientation Test.
 * After any input: what changed? what matters now? what remains unclear?
 * If understanding did not improve, the interaction fails.
 */

export type OrientationValidation = {
  passes: boolean;
  has_what_changed_or_happening: boolean;
  has_what_matters_now: boolean;
  has_uncertainty_or_ask_or_wait: boolean;
  failures: string[];
};

export function validateCaregiverOrientation(params: {
  what_is_happening?: string | null;
  what_changed?: string | null;
  what_matters_now?: string | null;
  what_remains_uncertain?: string | readonly string[] | null;
  what_to_ask_next?: string | readonly string[] | null;
  what_can_wait?: string | null;
}): OrientationValidation {
  const happening = (params.what_is_happening ?? "").trim();
  const changed = (params.what_changed ?? "").trim();
  const matters = (params.what_matters_now ?? "").trim();
  const uncertain = normalizeList(params.what_remains_uncertain);
  const asks = normalizeList(params.what_to_ask_next);
  const wait = (params.what_can_wait ?? "").trim();

  const has_what_changed_or_happening = happening.length > 0 || changed.length > 0;
  const has_what_matters_now = matters.length > 0;
  const has_uncertainty_or_ask_or_wait =
    uncertain.length > 0 || asks.length > 0 || wait.length > 0;

  const failures: string[] = [];
  if (!has_what_changed_or_happening) {
    failures.push("missing_what_changed_or_happening");
  }
  if (!has_what_matters_now && !has_uncertainty_or_ask_or_wait) {
    // Soft: early gather may only have happening + ask
    if (!asks.length && !happening) {
      failures.push("missing_matters_and_uncertainty");
    }
  }

  // Empty orientation = fail
  if (!happening && !changed && !matters && asks.length === 0) {
    failures.push("empty_orientation");
  }

  return {
    passes: failures.length === 0,
    has_what_changed_or_happening,
    has_what_matters_now,
    has_uncertainty_or_ask_or_wait,
    failures,
  };
}

function normalizeList(
  value: string | readonly string[] | null | undefined,
): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    const t = value.trim();
    return t ? [t] : [];
  }
  return value.map((s) => s.trim()).filter(Boolean);
}
