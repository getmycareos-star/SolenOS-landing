/**
 * Permanent Product Identity — SolenOS only.
 * SoT: .cursor/rules/solenos-product-identity.mdc
 */

/** Only valid product / company / platform name. */
export const SOLENOS_PRODUCT_NAME = "SolenOS" as const;

/** Category phrase only — never a product rename. */
export const CARE_REALITY_INTELLIGENCE_CATEGORY_PHRASE =
  "Care Reality Intelligence" as const;

/** Foundation of the product. */
export const LIVING_CARE_RECORD_FOUNDATION = "The Living Care Record" as const;

/** Canonical one-line what SolenOS is. */
export const SOLENOS_PRODUCT_IDENTITY =
  "An evolving intelligence layer that understands a person's changing care reality over time and helps families recognize change, coordinate action, and make decisions with confidence.";

/** Philosophy chain. */
export const SOLENOS_PHILOSOPHY_CHAIN =
  "Input → Event → Change → Context → Meaning → Attention" as const;

/** Forbidden as product/company/platform names (purge everywhere). */
export const FORBIDDEN_PRODUCT_NAMES = [
  "CareOS",
  "Care OS",
  "Careos",
  "Care Reality OS",
  "Care Reality Operating System",
  "Care Intelligence OS",
  "Living Care OS",
  "Memory OS",
  "Health OS",
  "Care Platform",
] as const;

/** Do not describe SolenOS as these. */
export const FORBIDDEN_SOLENOS_DESCRIPTIONS = [
  "task manager",
  "reminder app",
  "document app",
  "healthcare chatbot",
  "generic care coordination tool",
] as const;
