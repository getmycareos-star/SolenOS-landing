/**
 * Care setting model — physical, social, organizational, financial/legal.
 *
 * The system knows about the person and the caregiver. This layer adds the
 * missing context: the environment that shapes care reality.
 */

export const CARE_SETTING_VERSION = "1.0.0";

export type PhysicalSetting = {
  settingType: "own_home" | "family_home" | "assisted_living" | "nursing_home" | "hospital" | "other";
  description: string;
  adaptations: string[];
  risks: string[];
  confidence: number;
  source: "stated" | "inferred" | "family_reported";
  recordedAt: string;
};

export type SocialSetting = {
  whoVisits: string[];
  whoHelps: string[];
  whoConflicts: string[];
  supportNetworkStrength: "strong" | "moderate" | "weak" | "isolated";
  description: string;
  confidence: number;
  source: "stated" | "inferred" | "family_reported";
  recordedAt: string;
};

export type OrganizationalSetting = {
  careAgency?: string | null;
  gp?: string | null;
  specialist?: string | null;
  hospital?: string | null;
  pharmacy?: string | null;
  careCoordinator?: string | null;
  description: string;
  confidence: number;
  source: "stated" | "inferred" | "family_reported";
  recordedAt: string;
};

export type FinancialLegalSetting = {
  budget?: string | null;
  fundingSource?: "private" | "insurance" | "government" | "mixed" | "unknown";
  advanceDirective: boolean;
  powerOfAttorney: boolean;
  doNotResuscitate: boolean;
  otherLegalDocuments: string[];
  description: string;
  confidence: number;
  source: "stated" | "inferred" | "family_reported";
  recordedAt: string;
};

export type CareSetting = {
  version: string;
  careRecipientId: string;
  physical: PhysicalSetting | null;
  social: SocialSetting | null;
  organizational: OrganizationalSetting | null;
  financialLegal: FinancialLegalSetting | null;
  createdAt: string;
  updatedAt: string;
};

export function createEmptyCareSetting(careRecipientId: string, createdAt?: string): CareSetting {
  const now = createdAt ?? new Date().toISOString();
  return {
    version: CARE_SETTING_VERSION,
    careRecipientId,
    physical: null,
    social: null,
    organizational: null,
    financialLegal: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizeCareSetting(setting: CareSetting): {
  hasPhysical: boolean;
  hasSocial: boolean;
  hasOrganizational: boolean;
  hasFinancialLegal: boolean;
  supportNetwork: string | null;
  settingType: string | null;
  hasAdvanceDirective: boolean;
  hasPowerOfAttorney: boolean;
} {
  return {
    hasPhysical: setting.physical !== null,
    hasSocial: setting.social !== null,
    hasOrganizational: setting.organizational !== null,
    hasFinancialLegal: setting.financialLegal !== null,
    supportNetwork: setting.social?.supportNetworkStrength ?? null,
    settingType: setting.physical?.settingType ?? null,
    hasAdvanceDirective: setting.financialLegal?.advanceDirective ?? false,
    hasPowerOfAttorney: setting.financialLegal?.powerOfAttorney ?? false,
  };
}