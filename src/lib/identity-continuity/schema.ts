import { z } from "zod";

import { CANONICAL_RISK_LEVELS } from "../canonical-architecture/contract";
import { PERSISTENCE_TRIGGER_IDS } from "./contract-constants";

export const CareStateModeSchema = z.enum(["ephemeral", "persistent"]);

export const CareGraphSummarySchema = z.object({
  what_is_happening: z.string(),
  what_matters_now: z.string(),
  risk_level: z.enum(CANONICAL_RISK_LEVELS),
  care_context_state: z.enum(["active_care", "crisis", "post_care", "uncertain"]),
  interaction_id: z.string().uuid().optional(),
});

export const ContinuityPromptSchema = z.object({
  action: z.enum(["none", "prompt_signup", "prompt_login"]),
  reason: z.enum(["continuity_needed", "resume_context"]).optional(),
  message: z.string(),
  care_graph_summary: CareGraphSummarySchema.optional(),
});

export const ContinuityLayerPayloadSchema = z.object({
  continuity_prompt: ContinuityPromptSchema,
  identity_state: z.object({
    mode: CareStateModeSchema,
    care_session_id: z.string().uuid(),
    has_stored_care_graph: z.boolean(),
    auth_enabled: z.boolean(),
  }),
  persistence_triggers: z.array(z.enum(PERSISTENCE_TRIGGER_IDS)),
});

export const IdentitySignupRequestSchema = z.object({
  care_session_id: z.string().uuid(),
  telemetry_user_id: z.string().uuid().optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

export const IdentityLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  care_session_id: z.string().uuid().optional(),
});

export type IdentitySignupRequest = z.infer<typeof IdentitySignupRequestSchema>;
export type IdentityLoginRequest = z.infer<typeof IdentityLoginRequestSchema>;
