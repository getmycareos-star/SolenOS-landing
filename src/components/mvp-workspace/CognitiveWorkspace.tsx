"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type AccessibilityPrefs,
  type AttachedDocument,
  type WorkspaceState,
  DEFAULT_ACCESSIBILITY,
} from "@/lib/mvp-workspace";
import type { InputProvenance } from "@/lib/care-events";
import {
  ACTIVATION_LAST_SNIPPET_KEY,
  trackClientActivationEvent,
} from "@/lib/activation-system/client";
import type { SituationResponse } from "@/lib/situation-entry";
import {
  normalizeBackendSituationResponse,
  type WorkspaceSituationResponse,
} from "@/lib/situation-entry/backend-response";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";
import {
  CARE_RECIPIENT_ID_STORAGE,
  DURABLE_CARE_KEY_STORAGE,
  ensureClientDurableCareKey,
  ensureClientInteractionSessionId,
} from "@/lib/care-identity";
import type { Situation } from "@/lib/ui-runtime/types";
import { openSituationsFromSituationApi } from "@/lib/ui-runtime";
import { AddSituationPanel } from "./AddSituationPanel";
import type { WorkspaceAction } from "./WorkspaceMoreMenu";
import { ActivationOutputPanel } from "./ActivationOutputPanel";
import { SituationResponsePanel } from "./SituationResponsePanel";
import { CareRecipientNameGate } from "./CareRecipientNameGate";
import { track } from "@/lib/trackEvent";
import { observationCareFact } from "@/lib/care-epistemics";
import { caregiverNoteMetaLabel } from "@/lib/care-memory-maturity";
import { apiUrl, safeJson } from "@/lib/api-url";
import { ensureAnonymousSession, getAnonymousAccessToken } from "@/api/client";
import {
  IN_APP_IMPROVING_NOTICE,
  EMERGENCY_BOUNDARY,
} from "@/lib/early-access-trust";
import { HelpImproveSolenos } from "./HelpImproveSolenos";
import { ConsentGatePanel } from "./ConsentGatePanel";

function caregiverNoteMetaLabelFromResponse(response: SituationResponse): string {
  const observations = response.active_care_situation?.observations ?? [];
  const careCount = observations.filter((o) =>
    Boolean(observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text })),
  ).length;
  const latest = observations[observations.length - 1];
  const latestCare = latest
    ? Boolean(
        observationCareFact({ human_fact: latest.human_fact, raw_text: latest.raw_text }),
      )
    : false;
  return caregiverNoteMetaLabel({
    careWorthyCount: careCount,
    latestIsCareWorthy: latestCare,
  });
}

const TELEMETRY_USER_STORAGE_KEY = "solenos_telemetry_user_id";
const CARE_SESSION_STORAGE_KEY = "solenos_care_session_id";
const LAST_INPUT_STORAGE_KEY = "solenos_last_input_raw";

/** Read or mint interaction session — never the durable care key (Locked A). */
function interactionSessionId(forceNew = false): string {
  if (typeof window === "undefined") return ensureClientInteractionSessionId(null, { forceNew });
  const next = ensureClientInteractionSessionId(
    window.localStorage.getItem(CARE_SESSION_STORAGE_KEY),
    { forceNew },
  );
  window.localStorage.setItem(CARE_SESSION_STORAGE_KEY, next);
  return next;
}

type SubmitPhase = "idle" | "acknowledged" | "processing" | "done";

/** Social-only input belongs in Companion, never in the Living Care Record. */
function isCasualConversationOnly(text: string): boolean {
  const normalized = text
    .trim()
    .toLocaleLowerCase()
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(hi|hello|hey|hiya|how are you|how are you doing|how's it going|hows it going|good morning|good afternoon|good evening|thanks|thank you|thank you so much|good night|bye|goodbye)$/.test(normalized);
}

/** Build caregiver-facing + LCR display text from typed note and/or ready documents. */
function buildSharedDisplayText(text: string, docs: AttachedDocument[]): string {
  const parts: string[] = [];
  const trimmed = text.trim();
  if (trimmed) parts.push(trimmed);
  for (const d of docs) {
    if (d.status !== "ready" || !d.extractedText.trim()) continue;
    parts.push(`[Document: ${d.name}]\n${d.extractedText.trim()}`);
  }
  return parts.join("\n\n");
}

type Props = {
  /** Fired after MVP /api/situation so sidebar can hydrate from TrackedSituation. */
  onSituationComplete?: (payload: {
    careKey: string;
    caregiverId: string;
    situations: Situation[];
    activeSituationId: string | null;
    response: SituationResponse;
  }) => void;
  /**
   * Done for now — pause interaction only.
   * Parent keeps open situations (never wipe sidebar / local continuity).
   */
  onPauseActive?: (payload: {
    situations: Situation[];
    activeSituationId: string | null;
    activeCareSituation: SituationResponse["active_care_situation"];
    suppressFirstTimeUx: boolean;
  }) => void;
};

/**
 * Caregiver workspace — single entry pipeline: POST /api/situation.
 * Analyze / Clarity / Clear-my-head paths removed (ops-gated elsewhere).
 */
export function CognitiveWorkspace({ onSituationComplete, onPauseActive }: Props) {
  const [state, setState] = useState<WorkspaceState>("REAL_MOMENT");
  const [rawInput, setRawInput] = useState("");
  const [documents, setDocuments] = useState<AttachedDocument[]>([]);
  /** Last successful share — used for CARRYING / LCR when composer is cleared. */
  const [lastSharedDisplay, setLastSharedDisplay] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const setCaregiverError = useCallback((message: string | null) => {
    setError(message == null ? null : sanitizeCaregiverErrorMessage(message));
  }, []);
  const [prefs] = useState<AccessibilityPrefs>(DEFAULT_ACCESSIBILITY);
  const [transitionKey, setTransitionKey] = useState(0);
  const [situationResponse, setSituationResponse] = useState<WorkspaceSituationResponse | null>(null);
  const [hasContextRoot, setHasContextRoot] = useState(false);
  const [entryMode, setEntryMode] = useState<"initial" | "update">("initial");
  /** This browser session shared at least one note — gates Continuity / dual pane. */
  const [sessionHasNote, setSessionHasNote] = useState(false);
  /** Soft privacy line after first capture — never a consent wall. */
  const [showSoftPrivacyNote, setShowSoftPrivacyNote] = useState(false);
  const [caregiverId, setCaregiverId] = useState("");
  const [consentState, setConsentState] = useState<"loading" | "required" | "accepted" | "unavailable">("loading");
  /** Care Reality id — shared Living Care Record (Locked B). Distinct from contributor session. */
  const [careRecipientId, setCareRecipientId] = useState<string | null>(null);
  /** Null = still loading; "" = needs ask-once; string = set. */
  const [displayName, setDisplayName] = useState<string | null>(null);
  /** Skip name ask without blocking — first-time Locked B. */
  const [nameAskDismissed, setNameAskDismissed] = useState(false);

  /** Soft one-time return invite (G10) — never a quiz loop. */
  const [returnInvite, setReturnInvite] = useState<string | null>(null);
  /** Long-absence orientation (G18) — recent + unresolved only. */
  const [returnOrientation, setReturnOrientation] = useState<{
    recent: string[];
    unresolved: string[];
  } | null>(null);
  /** Share Target intake id — same pipeline after claim. */
  const [pendingShareId, setPendingShareId] = useState<string | null>(null);

  /** PWA install prompt — deferred until user action. */
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [canAddToHome, setCanAddToHome] = useState(false);

  /** Workspace management state. */
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [hasCareInfo, setHasCareInfo] = useState(false);

  const go = useCallback((next: WorkspaceState) => {
    setTransitionKey((k) => k + 1);
    setState(next);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share_id");
    if (shareId) {
      setPendingShareId(shareId);
      params.delete("share_id");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next || "/");
    }

    // PWA install prompt — capture for Add to Home action.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanAddToHome(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
    };
    // Intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const storedCareKey = ensureClientDurableCareKey(
      window.localStorage.getItem(DURABLE_CARE_KEY_STORAGE),
    );
    setCaregiverId(storedCareKey);
    window.localStorage.setItem(DURABLE_CARE_KEY_STORAGE, storedCareKey);
    const sessionId = interactionSessionId(false);

    const priorInput = window.localStorage.getItem(LAST_INPUT_STORAGE_KEY);
    if (priorInput) {
      void trackClientActivationEvent({ event_type: "RETURN_SESSION" });
    }

    // Hydrate only an existing server-issued session. A fresh visitor does not
    // create an empty care record merely by opening the workspace.
    const existingToken = getAnonymousAccessToken();
    if (!existingToken) {
      setDisplayName("");
      return;
    }

    // Mount hydrate must not consume soft invite — Done path offers once (Locked B).
    void ensureAnonymousSession()
      .then((session) =>
        fetch(
          apiUrl(`/api/situation?care_session_id=${encodeURIComponent(sessionId)}&offer_return_invite=0`),
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        ),
      )
      .then(async (r) => {
        if (!r.ok) throw new Error(`Situation hydration failed (${r.status})`);
        return r.json();
      })
      .then(
        (data: {
          has_context_root?: boolean;
          care_key?: string;
          care_recipient_id?: string | null;
          care_recipient_display_name?: string | null;
          context?: SituationResponse["context"];
          active_care_situation?: SituationResponse["active_care_situation"];
          active_care_situation_turn?: SituationResponse["active_care_situation_turn"];
          ui_situations?: Situation[];
          situations?: Situation[];
          return_continuity?: {
            soft_invite?: { offered_now?: boolean; text?: string | null };
            is_long_absence?: boolean;
            recent_relevant_changes?: string[];
            important_unresolved?: string[];
            suppress_first_time_ux?: boolean;
          };
        }) => {
          if (data.care_key) setCaregiverId(data.care_key);
          else if (data.context?.caregiver_id) setCaregiverId(data.context.caregiver_id);
          if (typeof data.care_recipient_id === "string" && data.care_recipient_id.trim()) {
            setCareRecipientId(data.care_recipient_id.trim());
          }
          if (data.has_context_root) setHasContextRoot(true);
          setDisplayName(
            typeof data.care_recipient_display_name === "string" &&
              data.care_recipient_display_name.trim()
              ? data.care_recipient_display_name.trim()
              : "",
          );
          const rc = data.return_continuity;
          if (rc?.soft_invite?.offered_now && rc.soft_invite.text) {
            setReturnInvite(rc.soft_invite.text);
          }
          if (
            rc?.is_long_absence &&
            ((rc.recent_relevant_changes?.length ?? 0) > 0 ||
              (rc.important_unresolved?.length ?? 0) > 0)
          ) {
            setReturnOrientation({
              recent: rc.recent_relevant_changes ?? [],
              unresolved: rc.important_unresolved ?? [],
            });
          }
          if (rc?.suppress_first_time_ux) setSessionHasNote(true);

          // Same durable care key → restore Living Care Record (Begin ≠ wipe memory).
          const acs = data.active_care_situation;
          const obs = acs?.observations ?? [];
          if (acs && obs.length > 0 && data.active_care_situation_turn) {
            const careKey = data.care_key ?? storedCareKey;
            const lastRaw = obs[obs.length - 1]?.raw_text?.trim() || priorInput || "";
            const restored = {
              active_care_situation: acs,
              active_care_situation_turn: data.active_care_situation_turn,
              events_created: [],
              context: data.context ?? {
                caregiver_id: careKey,
                care_recipient_id: data.care_recipient_id ?? careKey,
              },
              care_key: careKey,
              care_recipient_id: data.care_recipient_id ?? null,
            } as unknown as SituationResponse;
            setSituationResponse(restored);
            setHasContextRoot(true);
            setSessionHasNote(true);
            setEntryMode(obs.length > 1 ? "update" : "initial");
            setLastSharedDisplay(lastRaw);
            setShowSoftPrivacyNote(true);
            go("CARRYING");
            const uiSituations: Situation[] = openSituationsFromSituationApi({
              situations: data.situations,
              ui_situations: data.ui_situations,
              context: data.context,
              active_care_situation: acs,
            });
            onSituationComplete?.({
              careKey,
              caregiverId: careKey,
              situations: uiSituations,
              activeSituationId:
                uiSituations.find((s) => s.status === "active")?.id ?? null,
              response: restored,
            });
          }
        },
      )
      .catch(() => {
        setDisplayName("");
      });
    // Restore once on mount — same durable care key must not remint care reality.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only hydrate
  }, []);

  async function handleAddSituation(provenance: InputProvenance) {
    const readyDocs = documents.filter((d) => d.status === "ready" && (d.extractedText.trim() || d.evidenceId));
    const text = rawInput.trim();
    const sharedDisplay = buildSharedDisplayText(text, readyDocs);

    if (!sharedDisplay) {
      setCaregiverError("Type a note or attach a document / photo first — fragments are fine.");
      return;
    }

    // Social-only messages are conversational, not care evidence. Send them to
    // Companion so Qwen generates the response; never save "hi" as a care event.
    if (readyDocs.length === 0 && text && isCasualConversationOnly(text)) {
      try {
        // Ensure the anonymous bearer session exists before Companion auto-sends the draft.
        await ensureAnonymousSession();
        window.location.assign(`/workspace/companion?draft=${encodeURIComponent(text)}`);
      } catch {
        setCaregiverError("SolenOS could not start a secure Companion session. Your greeting was not saved to the care record; please try again.");
      }
      return;
    }

    setLoading(true);
    setCaregiverError(null);
    setSubmitPhase("acknowledged");

    try {
      setSubmitPhase("processing");

      void trackClientActivationEvent({
        event_type: "ENTRY_CREATED",
        payload: { entry: "add_situation", has_documents: readyDocs.length > 0 },
      });

      const anonymousSession = await ensureAnonymousSession();
      const situationRes = await fetch(apiUrl("/api/situation"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonymousSession.access_token}`,
        },
        body: JSON.stringify({
          person_id: anonymousSession.person.id,
          caregiver_id: anonymousSession.caregiver.id,
          client_care_key: caregiverId,
          raw_input: text,
          care_session_id: interactionSessionId(),
          timestamp: provenance.captured_at,
          captured_at: provenance.captured_at,
          provenance: {
            input_type:
              readyDocs.length > 0 && !text ? "document" : provenance.input_type,
            entry_method: provenance.entry_method,
            captured_at: provenance.captured_at,
            recognition_confidence: provenance.recognition_confidence,
            transcript_uncertain: provenance.transcript_uncertain,
          },
          documents: readyDocs.map((d) => ({
            id: d.id,
            evidence_id: d.evidenceId,
            name: d.name,
            mime_type: d.mimeType || null,
            extracted_text: d.extractedText,
            extracted_text_preview: d.extractedTextPreview ?? undefined,
            extracted_char_count: d.extractedCharCount ?? undefined,
            ocr_confidence: d.ocrConfidence ?? null,
            extraction_source: d.extractionSource ?? undefined,
            entry_method: d.entryMethod,
          })),
        }),
      });

      if (!situationRes.ok) {
        const err = (await safeJson(situationRes)) as {
          error?: string;
          detail?: string | { code?: string; message?: string };
        };
        const detail =
          typeof err.detail === "string"
            ? err.detail
            : err.detail?.message;
        if (
          err.detail &&
          typeof err.detail === "object" &&
          err.detail.code === "conversation_only" &&
          readyDocs.length === 0 &&
          text
        ) {
          // Older clients may still submit a greeting to the capture endpoint.
          // The backend rejects it without writing care evidence; hand it to
          // Companion for a real Qwen response instead.
          const session = await ensureAnonymousSession();
          if (!session.access_token) throw new Error("Secure Companion session unavailable.");
          window.location.assign("/workspace/companion?draft=" + encodeURIComponent(text));
          return;
        }
        throw new Error(detail ?? err.error ?? "Could not structure situation");
      }

      let situationData = normalizeBackendSituationResponse(
        await safeJson(situationRes),
      ) as WorkspaceSituationResponse & {
        policy_engine_layer?: {
          consent_required?: boolean;
          ingestion?: { allowed?: boolean; blocked_reason?: string | null };
        };
        care_key?: string;
        care_session_id?: string;
        care_event_id?: string;
        evidence_id?: string;
        ui_situations?: Situation[];
        situations?: Situation[];
      };

      // The backend POST returns its read-after-write projection from saved
      // evidence/events. Use it first; only make a separate GET for older
      // backend deployments that acknowledge a write without returning the view.
      let hydrated = situationData;
      if (!hydrated.active_care_situation && !hydrated.active_care_situation_turn) {
        const hydrationUrl = new URL(apiUrl("/api/situation"), window.location.origin);
        hydrationUrl.searchParams.set("caregiver_id", caregiverId);
        hydrationUrl.searchParams.set("care_session_id", interactionSessionId());
        const hydrationRes = await fetch(hydrationUrl.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${anonymousSession.access_token}` },
          cache: "no-store",
        });
        if (!hydrationRes.ok) {
          throw new Error(
            "The note was accepted, but the saved care record could not be reloaded. Refresh the record before retrying; do not submit the same note again.",
          );
        }
        hydrated = normalizeBackendSituationResponse(
          await safeJson(hydrationRes),
        ) as typeof situationData;
      }
      if (!hydrated.active_care_situation && !hydrated.active_care_situation_turn) {
        throw new Error(
          "The note was accepted, but the backend did not return a persisted care-record view. Refresh the record before retrying; do not submit the same note again.",
        );
      }
      situationData = ({
        ...situationData,
        ...hydrated,
        // Preserve write receipts while using the durable projection for display.
        care_event_id: situationData.care_event_id,
        evidence_id: situationData.evidence_id,
        message: situationData.message,
      }) as typeof situationData;

      if (situationData.policy_engine_layer?.consent_required) {
        setShowSoftPrivacyNote(true);
      }

      const careKey =
        situationData.care_key ??
        situationData.context?.caregiver_id ??
        caregiverId;
      setSituationResponse(situationData);
      const savedEventId =
        typeof situationData.care_event_id === "string" && situationData.care_event_id
          ? situationData.care_event_id
          : typeof situationData.situation_id === "string" && situationData.situation_id
            ? situationData.situation_id
            : "";
      setQwenAnalysis({ status: savedEventId ? "processing" : "unavailable", candidates: null });
      if (savedEventId) {
        // Run Qwen after durable save/read-back so model latency cannot trigger a duplicate capture.
        void requestQwenCandidateAnalysis(savedEventId)
          .then((analysis) => setQwenAnalysis({
            status: analysis.qwen_extraction_status,
            candidates: analysis.qwen_candidates,
          }))
          .catch(() => setQwenAnalysis({ status: "unavailable", candidates: null }));
      }
      setHasContextRoot(true);
      setSessionHasNote(true);
      setShowSoftPrivacyNote(true);
      setCaregiverId(careKey);
      window.localStorage.setItem(DURABLE_CARE_KEY_STORAGE, careKey);
      window.localStorage.setItem(CARE_SESSION_STORAGE_KEY, interactionSessionId());

      // Update workspace info flags.
      const obsCount = situationData.active_care_situation?.observations?.length ?? 0;
      const hasInfo = obsCount > 0 || (situationData.events_created?.length ?? 0) > 0;
      setHasCareInfo(hasInfo);

      // Stay in update mode only while this ACS has more than one note.
      setEntryMode(obsCount > 1 ? "update" : "initial");
      setSubmitPhase("done");
      setLastSharedDisplay(sharedDisplay);
      setRawInput("");
      setDocuments([]);
      window.localStorage.setItem(LAST_INPUT_STORAGE_KEY, sharedDisplay);
      window.localStorage.setItem(ACTIVATION_LAST_SNIPPET_KEY, sharedDisplay.slice(0, 200));
      track("input_submitted", {
        input_type: readyDocs.length > 0 && !text ? "document" : provenance.input_type,
        case_id: situationData.context?.care_recipient_id ?? null,
        has_documents: readyDocs.length > 0,
      });
      if (readyDocs.length > 0) {
        track("document_uploaded", {
          doc_type: "care_document",
          case_id: situationData.context?.care_recipient_id ?? null,
        });
      }

      const uiSituations: Situation[] = openSituationsFromSituationApi({
        situations: situationData.situations,
        ui_situations: situationData.ui_situations,
        care_situation_groups: situationData.care_situation_groups,
        context: situationData.context,
        active_care_situation: situationData.active_care_situation,
      });
      onSituationComplete?.({
        careKey,
        caregiverId: careKey,
        situations: uiSituations,
        activeSituationId: uiSituations.find((s) => s.status === "active")?.id ?? null,
        response: situationData,
      });

      go("CARRYING");
    } catch (e) {
      setCaregiverError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitPhase("idle");
      track("error_triggered", {
        error_code: "SITUATION_SUBMIT",
        error_message: e instanceof Error ? e.message : "Unknown",
        endpoint: "/api/situation",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleWorkspaceAction(action: WorkspaceAction) {
    switch (action) {
      case "pin": {
        setIsPinned(true);
        try {
          window.localStorage.setItem("solenos_workspace_pinned", "1");
        } catch {
          /* ignore */
        }
        break;
      }
      case "archive": {
        const confirmed = window.confirm(
          "Archive this care record?\n\nArchived records are hidden from the active view but not deleted. You can recover them later.",
        );
        if (!confirmed) return;
        setIsArchived(true);
        try {
          window.localStorage.setItem("solenos_workspace_archived", "1");
        } catch {
          /* ignore */
        }
        // In a full implementation, this would navigate to an archive view.
        // For MVP, we redirect to /workspace which will show the empty state.
        window.location.href = "/workspace";
        break;
      }
      case "delete": {
        const confirmed = window.confirm(
          "Delete this care record?\n\nThis will permanently remove all care information from this device. This action cannot be undone.",
        );
        if (!confirmed) return;
        try {
          const keysToRemove = [
            "solenos_durable_care_key",
            "solenos_care_session_id",
            "solenos_telemetry_user_id",
            "solenos_situations",
            "solenos_timeline",
            "solenos_active_situation_id",
            "solenos_care_recipient_display_name",
            "solenos_care_profile",
            "solenos_care_recipient_id",
            "solenos_last_input_raw",
            "solenos_notif_prefs",
            "solenos_data_training",
            "solenos_language_preference",
            "solenos_early_access_consent_v1",
            "onboarding_complete",
            "onboarding_complete_at",
            "solenos_workspace_pinned",
            "solenos_workspace_archived",
          ];
          keysToRemove.forEach((k) => {
            try {
              window.localStorage.removeItem(k);
            } catch {
              /* ignore */
            }
          });
        } catch {
          /* ignore */
        }
        window.location.href = "/start";
        break;
      }
      case "add_to_home": {
        if (deferredPrompt) {
          try {
            void (deferredPrompt as any).prompt();
            const { outcome } = await (deferredPrompt as any).userChoice;
            if (outcome === "accepted") {
              setCanAddToHome(false);
            }
          } catch {
            /* prompt may fail if already shown */
          }
          setDeferredPrompt(null);
        } else {
          // Fallback: open browser menu instructions
          window.alert(
            "To add SolenOS to your home screen:\n\n" +
              "iOS: Tap Share → Add to Home Screen\n" +
              "Android: Tap menu → Add to Home screen\n" +
              "Desktop: Click the install icon in the address bar.",
          );
        }
        break;
      }
    }
  }

  // Restore pinned/archived state from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pinned = window.localStorage.getItem("solenos_workspace_pinned");
      if (pinned === "1") setIsPinned(true);
      const archived = window.localStorage.getItem("solenos_workspace_archived");
      if (archived === "1") setIsArchived(true);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only
  }, []);

  async function handleDoneForNow() {
    // Pause interaction only — never resolve care reality or restart-from-zero.
    const hadDurable =
      hasContextRoot ||
      sessionHasNote ||
      (situationResponse?.active_care_situation?.observations?.length ?? 0) > 0;

    let pausePayload: {
      situations: Situation[];
      activeSituationId: string | null;
      activeCareSituation: SituationResponse["active_care_situation"];
      suppressFirstTimeUx: boolean;
      returnInviteText: string | null;
      recent: string[];
      unresolved: string[];
    } = {
      situations: [],
      activeSituationId: null,
      activeCareSituation: situationResponse?.active_care_situation ?? null,
      suppressFirstTimeUx: hadDurable,
      returnInviteText: null,
      recent: [],
      unresolved: [],
    };

    let accessToken = "";
    try {
      const existingToken = getAnonymousAccessToken();
      if (!existingToken) throw new Error("No server-issued care session exists yet.");
      const session = await ensureAnonymousSession();
      accessToken = session.access_token;

      // "Done for now" is a persisted interaction pause, not a local-only UI reset.
      // The backend binds this command to the bearer session's person/caregiver scope.
      const pauseResponse = await fetch(apiUrl("/api/situation"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "pause_active_care_situation",
          person_id: session.person.id,
          caregiver_id: session.caregiver.id,
          client_care_key: caregiverId,
          care_session_id: interactionSessionId(),
        }),
      });
      if (!pauseResponse.ok) {
        throw new Error("The server did not confirm the interaction pause.");
      }
    } catch {
      setCaregiverError(
        "SolenOS could not confirm that this interaction was paused. Your current note and selected documents remain here; retry before leaving.",
      );
      return;
    }

    let hydrationWarning = false;
    try {
      const res = await fetch(
        apiUrl(`/api/situation?care_session_id=${encodeURIComponent(interactionSessionId())}&offer_return_invite=0`),
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) throw new Error("The saved care record could not be refreshed.");
      if (res.ok) {
        const data = (await safeJson(res)) as {
          situations?: Situation[];
          ui_situations?: Situation[];
          active_situations?: Situation[];
          active_care_situation?: SituationResponse["active_care_situation"];
          return_continuity?: {
            soft_invite?: { offered_now?: boolean; text?: string | null };
            recent_relevant_changes?: string[];
            important_unresolved?: string[];
            suppress_first_time_ux?: boolean;
            has_durable_care_reality?: boolean;
          };
        };
        const situations = openSituationsFromSituationApi({
          situations: data.situations ?? data.ui_situations,
          ui_situations: data.ui_situations,
          active_care_situation: data.active_care_situation,
        });
        const durable =
          data.return_continuity?.has_durable_care_reality === true ||
          data.return_continuity?.suppress_first_time_ux === true ||
          (data.active_care_situation?.observations?.length ?? 0) > 0 ||
          situations.length > 0 ||
          hadDurable;

        // Pause never consumes the invite — one soft offer on return (Locked B).
        let softInviteText: string | null = null;
        if (durable) {
          try {
            const inviteRes = await fetch(
              apiUrl(`/api/situation?care_session_id=${encodeURIComponent(interactionSessionId())}&offer_return_invite=1`),
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            if (inviteRes.ok) {
              const inviteData = (await safeJson(inviteRes)) as {
                return_continuity?: {
                  soft_invite?: { offered_now?: boolean; text?: string | null };
                };
              };
              if (
                inviteData.return_continuity?.soft_invite?.offered_now &&
                inviteData.return_continuity.soft_invite.text
              ) {
                softInviteText = inviteData.return_continuity.soft_invite.text;
              }
            }
          } catch {
            // Continuity message below still orients without pressure.
          }
        }

        pausePayload = {
          situations,
          activeSituationId:
            situations.find((s) => s.status === "active")?.id ?? situations[0]?.id ?? null,
          activeCareSituation: data.active_care_situation ?? null,
          suppressFirstTimeUx: durable,
          returnInviteText:
            softInviteText ??
            (durable
              ? "Your Living Care Record is still here — continue whenever you're ready."
              : null),
          recent: data.return_continuity?.recent_relevant_changes ?? [],
          unresolved: [],
        };
      }
    } catch {
      // The pause is already confirmed. Keep the local continuity payload and
      // surface the failed refresh instead of pretending hydration succeeded.
      hydrationWarning = true;
    }

    const hasPendingDraft = Boolean(rawInput.trim()) || documents.length > 0;
    if (!hasPendingDraft) {
      setRawInput("");
      setDocuments([]);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LAST_INPUT_STORAGE_KEY);
        window.localStorage.removeItem(ACTIVATION_LAST_SNIPPET_KEY);
      }
    } else if (rawInput.trim() && typeof window !== "undefined") {
      // Reuse the existing recoverable text-draft key; do not discard unsaved text.
      window.localStorage.setItem(LAST_INPUT_STORAGE_KEY, rawInput);
    }
    setLastSharedDisplay("");
    setSituationResponse(null);
    setQwenAnalysis(null);
    setCaregiverError(
      hydrationWarning
        ? "Interaction paused, but the latest care record could not be refreshed. Check your connection before relying on the refreshed view."
        : hasPendingDraft
          ? "Interaction paused. Your unsaved note or selected document has not been saved to the care record yet."
          : null,
    );
    setSubmitPhase("idle");
    setShowSoftPrivacyNote(false);
    // Keep continuity flags — Done for now is not first-time UX.
    if (pausePayload.suppressFirstTimeUx || hadDurable) {
      setHasContextRoot(true);
      setSessionHasNote(true);
      setEntryMode("update");
    }
    if (pausePayload.returnInviteText) {
      setReturnInvite(pausePayload.returnInviteText);
    }
    // One soft return invite only — do not dump multiple open gaps (open-uncertainties Locked B).
    if (pausePayload.recent.length > 0) {
      setReturnOrientation({
        recent: pausePayload.recent.slice(0, 2),
        unresolved: [],
      });
    }
    onPauseActive?.({
      situations: pausePayload.situations,
      activeSituationId: pausePayload.activeSituationId,
      activeCareSituation: pausePayload.activeCareSituation,
      suppressFirstTimeUx: pausePayload.suppressFirstTimeUx || hadDurable,
    });
    go("REAL_MOMENT");
  }

  const showOutputPane = submitPhase !== "idle" || state === "CARRYING";
  const shellClass = [
    "cognitive-workspace",
    `theme-${prefs.themeLayout}`,
    `type-${prefs.typography}`,
    `scale-${prefs.textScale}`,
    `state-${state.toLowerCase()}`,
    !showOutputPane && state === "REAL_MOMENT" ? "single-pane" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <p className="panel-muted research-preview-notice" role="note">
        {IN_APP_IMPROVING_NOTICE}
      </p>
      <ConsentGatePanel caregiverId={caregiverId} onStatusChange={setConsentState} />
      {consentState === "accepted" && (
        <>
      <HelpImproveSolenos careKey={caregiverId} compact />
      {showSoftPrivacyNote && (
        <p className="soft-privacy-note" role="note">
          What you share stays in the Living Care Record for this care journey. It is not sold or used
          for advertising.
        </p>
      )}

      <div key={transitionKey} className="workspace-split workspace-transition" data-state={state}>
        {state === "REAL_MOMENT" && (
          <>
            <section className="panel panel-input" aria-label="Caregiver input">
              {displayName === null ? (
                <p className="workspace-lede">Loading…</p>
              ) : (
                <>
                  {/* Ask-once identity after first value — never pre-capture onboarding form. */}
                  {displayName === "" &&
                    !nameAskDismissed &&
                    (sessionHasNote || hasContextRoot) && (
                      <CareRecipientNameGate
                        caregiverId={caregiverId}
                        careSessionId={interactionSessionId()}
                        onSaved={(name) => setDisplayName(name)}
                        onSkip={() => setNameAskDismissed(true)}
                      />
                    )}
                  {returnOrientation && (
                    <aside className="return-continuity-note" aria-label="Where care left off">
                      <p className="workspace-lede">Picking up where you left off.</p>
                      {returnOrientation.recent.length > 0 && (
                        <ul className="return-continuity-list">
                          {returnOrientation.recent.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      )}
                      {/* Open uncertainties: soft invite only — never "Still open" multi-gap dump */}
                    </aside>
                  )}
                  {returnInvite && (
                    <p className="return-continuity-invite" role="note">
                      {returnInvite}
                    </p>
                  )}
                  <AddSituationPanel
                    value={rawInput}
                    onChange={setRawInput}
                    documents={documents}
                    onDocumentsChange={setDocuments}
                    onSubmit={(provenance) => {
                      setReturnInvite(null);
                      setReturnOrientation(null);
                      void handleAddSituation(provenance);
                    }}
                    loading={loading}
                    error={error}
                    pendingShareId={pendingShareId}
                    onShareClaimed={() => setPendingShareId(null)}
                    hasContextRoot={
                      hasContextRoot ||
                      sessionHasNote ||
                      (situationResponse?.active_care_situation?.observations?.length ?? 0) > 0
                    }
                    mode={
                      hasContextRoot ||
                      sessionHasNote ||
                      entryMode === "update" ||
                      (situationResponse?.active_care_situation?.observations?.length ?? 0) > 1
                        ? "update"
                        : "initial"
                    }
                    caregiverId={caregiverId}
                    careSessionId={interactionSessionId()}
                    careRecipientName={displayName ?? undefined}
                    onWorkspaceAction={handleWorkspaceAction}
                    isPinned={isPinned}
                    isArchived={isArchived}
                    canAddToHome={canAddToHome}
                    hasCareInfo={hasCareInfo}
                  />
                </>
              )}
            </section>
            {showOutputPane && (
              <section className="panel panel-output" aria-label="Care continuity">
                <ActivationOutputPanel phase={submitPhase} />
              </section>
            )}
          </>
        )}

        {state === "CARRYING" && situationResponse && (
          <>
            <section className="panel panel-input" aria-label="Caregiver contribution">
              <div className="workspace-panel-inner">
                <article className="care-card-note">
                  <p className="care-card-note-label">Caregiver note</p>
                  <p className="care-card-note-body">
                    {lastSharedDisplay || rawInput || "Document added to the Living Care Record."}
                  </p>
                  <p className="care-card-note-meta">
                    {caregiverNoteMetaLabelFromResponse(situationResponse)}
                  </p>
                </article>
              </div>
            </section>
            {situationResponse.analysis_status === "partial" && (
              <p className="workspace-status-warning" role="status">
                {situationResponse.analysis_warning ||
                  "Care input was saved, but change and situation analysis could not be completed. The recorded evidence remains available."}
              </p>
            )}
            {situationResponse.ok === true && !situationResponse.active_care_situation ? (
              <section className="panel panel-response" role="status" aria-live="polite">
                <h3>Care record view unavailable</h3>
                <p>
                  The server accepted this capture but did not return a persisted care-record view.
                  Refresh the record to verify what was saved before submitting the same information again.
                </p>
              </section>
            ) : (
              <SituationResponsePanel
                response={situationResponse}
                rawInput={lastSharedDisplay || rawInput}
                careKey={caregiverId}
                entryIntent={
                  (situationResponse.active_care_situation?.observations?.length ?? 0) > 1
                    ? "update"
                    : "initial"
                }
                onAddUpdate={() => {
                  setRawInput("");
                  setDocuments([]);
                  const obs =
                    situationResponse.active_care_situation?.observations?.length ?? 0;
                  setEntryMode(obs > 1 ? "update" : "initial");
                  go("REAL_MOMENT");
                }}
                onContinue={handleDoneForNow}
              />
            )}
            {qwenAnalysis && (
              <section className="panel panel-response" aria-label="Qwen support suggestions">
                <h3>Qwen suggestions for caregiver review</h3>
                <p role="status">
                  {qwenAnalysis.status === "processing"
                    ? "Reviewing the saved source with the local SolenOS model…"
                    : qwenAnalysis.status === "pending_review"
                      ? "These are suggestions only. They are not confirmed care facts and have not been written to the Living Care Record."
                      : "The care update remains saved. Qwen suggestions are currently unavailable; nothing was substituted or invented."}
                </p>
                {qwenAnalysis.candidates?.observations?.length ? (
                  <ul>
                    {qwenAnalysis.candidates.observations.map((candidate: any, index: number) => (
                      <li key={index}>
                        <strong>{candidate.subject}:</strong> {candidate.observation}
                        <p>Source: “{candidate.source_quote}” · {candidate.review_status}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {qwenAnalysis.candidates?.open_questions?.length ? (
                  <div>
                    <strong>Questions to clarify</strong>
                    <ul>{qwenAnalysis.candidates.open_questions.map((question: string, index: number) => <li key={index}>{question}</li>)}</ul>
                  </div>
                ) : null}
              </section>
            )}
            <button
              type="button"
              className="care-reality-fab"
              onClick={() => {
                setRawInput("");
                setDocuments([]);
                const obs =
                  situationResponse.active_care_situation?.observations?.length ?? 0;
                setEntryMode(obs > 1 ? "update" : "initial");
                go("REAL_MOMENT");
              }}
            >
              <span className="care-reality-fab-plus" aria-hidden>
                +
              </span>
              Tell us what happened
            </button>
          </>
        )}
      </div>
      <p className="panel-muted workspace-emergency-note" role="note">
        {EMERGENCY_BOUNDARY}
      </p>
        </>
      )}
    </div>
  );
}
