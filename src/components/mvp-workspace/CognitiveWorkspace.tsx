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
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";
import {
  CARE_RECIPIENT_ID_STORAGE,
  DEFAULT_DURABLE_CARE_KEY,
  DURABLE_CARE_KEY_STORAGE,
  ensureClientDurableCareKey,
  ensureClientInteractionSessionId,
} from "@/lib/care-identity";
import type { Situation } from "@/lib/ui-runtime/types";
import { openSituationsFromSituationApi } from "@/lib/ui-runtime";
import { AddSituationPanel } from "./AddSituationPanel";
import { ActivationOutputPanel } from "./ActivationOutputPanel";
import { SituationResponsePanel } from "./SituationResponsePanel";
import { CareRecipientNameGate } from "./CareRecipientNameGate";
import { track } from "@/lib/trackEvent";
import { observationCareFact } from "@/lib/care-epistemics";
import { caregiverNoteMetaLabel } from "@/lib/care-memory-maturity";
import {
  IN_APP_IMPROVING_NOTICE,
  EMERGENCY_BOUNDARY,
} from "@/lib/early-access-trust";
import { HelpImproveSolenos } from "./HelpImproveSolenos";

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
  const [situationResponse, setSituationResponse] = useState<SituationResponse | null>(null);
  const [hasContextRoot, setHasContextRoot] = useState(false);
  const [entryMode, setEntryMode] = useState<"initial" | "update">("initial");
  /** This browser session shared at least one note — gates Continuity / dual pane. */
  const [sessionHasNote, setSessionHasNote] = useState(false);
  /** Soft privacy line after first capture — never a consent wall. */
  const [showSoftPrivacyNote, setShowSoftPrivacyNote] = useState(false);
  const [caregiverId, setCaregiverId] = useState(DEFAULT_DURABLE_CARE_KEY);
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

    // Mount hydrate must not consume soft invite — Done path offers once (Locked B).
    void fetch(
      `/api/situation?caregiver_id=${encodeURIComponent(storedCareKey)}&care_session_id=${encodeURIComponent(sessionId)}&offer_return_invite=0`,
    )
      .then((r) => r.json())
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
            } as SituationResponse;
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
    const readyDocs = documents.filter((d) => d.status === "ready" && d.extractedText.trim());
    const text = rawInput.trim();
    const sharedDisplay = buildSharedDisplayText(text, readyDocs);

    if (!sharedDisplay) {
      setCaregiverError("Type a note or attach a document / photo first — fragments are fine.");
      return;
    }

    // Empty or greeting-only input → SESSION_REENTRY_EVENT (handled by API)

    setLoading(true);
    setCaregiverError(null);
    setSubmitPhase("acknowledged");

    try {
      setSubmitPhase("processing");

      void trackClientActivationEvent({
        event_type: "ENTRY_CREATED",
        payload: { entry: "add_situation", has_documents: readyDocs.length > 0 },
      });

      const situationRes = await fetch("/api/situation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_input: text,
          caregiver_id: caregiverId,
          care_session_id: interactionSessionId(),
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
            name: d.name,
            mime_type: d.mimeType || null,
            extracted_text: d.extractedText,
            entry_method: d.entryMethod,
          })),
        }),
      });

      if (!situationRes.ok) {
        const err = (await situationRes.json()) as { error?: string };
        throw new Error(err.error ?? "Could not structure situation");
      }

      const situationData = (await situationRes.json()) as SituationResponse & {
        policy_engine_layer?: {
          consent_required?: boolean;
          ingestion?: { allowed?: boolean; blocked_reason?: string | null };
        };
        care_key?: string;
        care_session_id?: string;
        ui_situations?: Situation[];
        situations?: Situation[];
      };

      if (situationData.policy_engine_layer?.consent_required) {
        setShowSoftPrivacyNote(true);
      }

      const careKey =
        situationData.care_key ??
        situationData.context?.caregiver_id ??
        caregiverId;
      setSituationResponse(situationData);
      setHasContextRoot(true);
      setSessionHasNote(true);
      setShowSoftPrivacyNote(true);
      setCaregiverId(careKey);
      window.localStorage.setItem(DURABLE_CARE_KEY_STORAGE, careKey);
      window.localStorage.setItem(CARE_SESSION_STORAGE_KEY, interactionSessionId());

      // Stay in update mode only while this ACS has more than one note.
      const obsCount = situationData.active_care_situation?.observations?.length ?? 0;
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

    try {
      const res = await fetch("/api/situation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pause_active_care_situation",
          caregiver_id: caregiverId,
          care_session_id: interactionSessionId(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
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
              `/api/situation?caregiver_id=${encodeURIComponent(caregiverId)}&care_session_id=${encodeURIComponent(interactionSessionId())}&offer_return_invite=1`,
            );
            if (inviteRes.ok) {
              const inviteData = (await inviteRes.json()) as {
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
      // Local continuity still preserved below even if pause request fails.
    }

    setRawInput("");
    setDocuments([]);
    setLastSharedDisplay("");
    setSituationResponse(null);
    setCaregiverError(null);
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
    if (typeof window !== "undefined") {
      // Draft composer only — not the durable care key / session.
      window.localStorage.removeItem(LAST_INPUT_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVATION_LAST_SNIPPET_KEY);
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
    </div>
  );
}
