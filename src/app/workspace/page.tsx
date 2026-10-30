"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, FileText, MessageCircle, Plus, Users } from "lucide-react";

import { BrandLoading } from "@/components/brand";
import { CognitiveWorkspace } from "@/components/mvp-workspace";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/lib/workspace-context";
import { listActiveSituations, openSituationsFromSituationApi } from "@/lib/ui-runtime";
import { ensureAnonymousSession } from "@/api/client";
import { apiUrl } from "@/lib/api-url";
import { ErrorBoundary } from "@/components/error-boundary";
import { PersistedCareOrientation } from "@/components/mvp-workspace/PersistedCareOrientation";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";
import { ChangeIntelligencePanel } from "@/components/mvp-workspace/ChangeIntelligencePanel";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const CARE_RECIPIENT_NAME_STORAGE = "solenos_care_recipient_display_name";

function formatLastUpdated(iso: string | null): string {
  if (!iso) return "Not yet updated";
  try {
    const date = new Date(iso);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Not yet updated";
  }
}

const STATUS_LABELS: Record<string, string> = {
  active: "Current",
  blocked: "Needs attention",
  waiting: "Waiting",
  paused: "Paused",
  resolved: "Resolved",
};

function WorkspacePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { runtime, hydrated, entryReady, updateRuntime } = useWorkspace();
  const [displayName, setDisplayName] = useState("");
  const [isArchived, setIsArchived] = useState(false);
  const [archiveStateLoaded, setArchiveStateLoaded] = useState(false);
  const [archiveRestoreError, setArchiveRestoreError] = useState("");
  const compose = searchParams.get("compose") === "1";
  const targetSituationId = searchParams.get("situation");
  const [relationshipTargets, setRelationshipTargets] = useState<Record<string, string>>({});
  const [linkingSituationId, setLinkingSituationId] = useState<string | null>(null);
  const [relationshipFeedback, setRelationshipFeedback] = useState("");
  const [relationshipFeedbackFor, setRelationshipFeedbackFor] = useState<string | null>(null);

  const resumableSituations = runtime.situations.filter(
    (situation) => situation.persistedThread && situation.status !== "resolved",
  );

  async function linkRelatedSituation(
    sourceSituationId: string,
    explicitTargetId?: string,
    relationshipType: "related_to" | "unrelated_to" = "related_to",
  ) {
    const relatedId = explicitTargetId ?? relationshipTargets[sourceSituationId];
    if (!relatedId || relatedId === sourceSituationId) return;
    setLinkingSituationId(sourceSituationId);
    setRelationshipFeedback("");
    setRelationshipFeedbackFor(sourceSituationId);
    try {
      const session = await ensureAnonymousSession();
      if (!session.access_token) throw new Error("A secure care session is required.");
      const response = await fetch(apiUrl("/api/v1/care-continuity/relationships"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          source_type: "situation",
          source_id: sourceSituationId,
          relationship_type: relationshipType,
          target_type: "situation",
          target_id: relatedId,
          provenance: relationshipType === "related_to"
            ? "Caregiver explicitly linked these concerns as related; this relationship does not merge their care threads or establish causation."
            : "Caregiver explicitly retracted the prior related-concern link; the historical link remains in the audit record.",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result && typeof result.detail === "string"
            ? result.detail
            : "The related-care link was not saved.",
        );
      }
      const refreshed = await fetch(apiUrl("/api/situation"), {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!refreshed.ok) {
        throw new Error("The relationship was saved, but the care timeline could not be refreshed.");
      }
      const payload = await refreshed.json();
      updateRuntime((previous) => ({
        ...previous,
        situations: openSituationsFromSituationApi(payload),
      }));
      setRelationshipFeedback(
        relationshipType === "related_to"
          ? "Related concerns linked. Their separate care threads and evidence remain intact."
          : "Relationship retracted. The prior link remains in audit history; both care threads remain separate.",
      );
      setRelationshipTargets((previous) => ({ ...previous, [sourceSituationId]: "" }));
    } catch (error) {
      setRelationshipFeedback(error instanceof Error ? error.message : "The related-care link was not saved.");
    } finally {
      setLinkingSituationId(null);
    }
  }

  useEffect(() => {
    try {
      setDisplayName(window.localStorage.getItem(CARE_RECIPIENT_NAME_STORAGE)?.trim() ?? "");
      setIsArchived(window.localStorage.getItem("solenos_workspace_archived") === "1");
    } catch {
      setDisplayName("");
      setIsArchived(false);
    } finally {
      setArchiveStateLoaded(true);
    }
  }, []);

  const openComposer = useCallback(() => {
    router.push("/workspace?compose=1");
  }, [router]);

  if (!hydrated || !entryReady || !archiveStateLoaded) {
    return <BrandLoading message="Opening your Living Care Record…" />;
  }

  if (isArchived) {
    return (
      <main className="mobile-screen lcr-screen">
        <section className="lcr-empty-state" aria-labelledby="archived-workspace-title">
          <h1 id="archived-workspace-title">Your record is archived on this device</h1>
          <p>This only hides the workspace on this device. It does not delete care information stored by SolenOS.</p>
          {archiveRestoreError && <p role="alert">{archiveRestoreError}</p>}
          <Button
            variant="primary"
            onClick={() => {
              try {
                window.localStorage.removeItem("solenos_workspace_archived");
                setArchiveRestoreError("");
                setIsArchived(false);
                router.replace("/workspace");
              } catch {
                setArchiveRestoreError("This browser could not restore the workspace. Your care information has not been deleted.");
              }
            }}
          >
            Restore my record
          </Button>
        </section>
      </main>
    );
  }

  if (compose) {
    return (
      <main className="mobile-screen lcr-screen lcr-add-screen">
        <div className="lcr-add-heading">
          <Button variant="icon" aria-label="Back to Living Care Record" onClick={() => router.push("/workspace")}>
            <span aria-hidden="true">←</span>
          </Button>
          <div>
            <p className="lcr-eyebrow">LIVING CARE RECORD</p>
            <h1>{targetSituationId ? "Update this care thread" : "Add to the record"}</h1>
            <p>{targetSituationId ? "This entry will be added to the selected care thread. Other concerns stay separate." : "Notes, messages, documents, or photos. Fragments are fine."}</p>
          </div>
        </div>
        <ErrorBoundary name="CognitiveWorkspace" fallback={
          <section className="lcr-empty-state">
            <p>The record entry could not open correctly.</p>
            <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
          </section>
        }>
          <CognitiveWorkspace targetSituationId={targetSituationId} />
        </ErrorBoundary>
      </main>
    );
  }

  const activeSituations = listActiveSituations(runtime.situations);
  const situations = [...runtime.situations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const latestUpdated = situations[0]?.updatedAt ?? null;
  const hasAnyContent = situations.length > 0;

  return (
    <main className="mobile-screen lcr-screen">
      <div className="lcr-home">
        <header className="lcr-header">
          <div>
            <p className="lcr-eyebrow">SOLENOS · LIVING CARE RECORD</p>
            <h1>{displayName || "Your care record"}</h1>
            <p className="lcr-intro">The care journey, remembered. Keep the details together, one moment at a time.</p>
          </div>
          <div className="lcr-record-meta">
            <span className="lcr-status-dot" aria-hidden="true" />
            <span>{activeSituations.length > 0 ? (STATUS_LABELS[activeSituations[0].status] ?? "Current") : "Ready when you are"}</span>
            <span className="lcr-meta-divider" aria-hidden="true">·</span>
            <span>Updated {formatLastUpdated(latestUpdated)}</span>
          </div>
        </header>

        <PersistedCareOrientation />

        <section className="lcr-primary-actions" aria-label="Record actions">
          <button type="button" className="lcr-add-primary" onClick={openComposer}>
            <span className="lcr-action-icon" aria-hidden="true"><Plus size={22} /></span>
            <span><strong>Add to record</strong><small>Write a note or add a message, document, or photo</small></span>
            <span className="lcr-action-arrow" aria-hidden="true">→</span>
          </button>
          <button type="button" className="lcr-daily-action" onClick={() => router.push("/workspace/daily-care")}>
            <CalendarDays size={21} aria-hidden="true" />
            <span><strong>Daily care</strong><small>Capture how today is going</small></span>
          </button>
        </section>

        <LCRCurrentUnderstanding />

        <ChangeIntelligencePanel />

        <section className="lcr-record-section" aria-labelledby="lcr-record-heading">
          <div className="lcr-section-heading">
            <div>
              <p className="lcr-eyebrow">YOUR CARE HISTORY</p>
              <h2 id="lcr-record-heading">Record timeline</h2>
            </div>
            {hasAnyContent && <span className="lcr-count">{situations.length} {situations.length === 1 ? "entry" : "entries"}</span>}
          </div>

          {!hasAnyContent ? (
            <div className="lcr-empty-state">
              <div className="lcr-empty-icon" aria-hidden="true"><FileText size={27} /></div>
              <h3>Your record starts with what you know.</h3>
              <p>Add a small detail from today, a message you received, or a document you want to keep connected to the care journey. You do not need to organise it first.</p>
              <button type="button" className="lcr-text-action" onClick={openComposer}>Add the first detail <span aria-hidden="true">→</span></button>
            </div>
          ) : (
            <div className="lcr-timeline">
              {situations.map((situation) => (
                <article key={situation.id} className="lcr-timeline-item">
                  <span className="lcr-timeline-marker" aria-hidden="true"><FileText size={17} /></span>
                  <div className="lcr-timeline-content">
                    <div className="lcr-entry-heading">
                      <h3>{situation.title}</h3>
                      <span>{formatLastUpdated(situation.updatedAt)}</span>
                    </div>
                    {situation.contextSummary && <p>{situation.contextSummary}</p>}
                    {(situation.sourceStatements?.length ?? 0) > 0 && (
                      <div className="lcr-source-statements" aria-label="Statements preserved from original sources">
                        <p>Statements from original sources</p>
                        {situation.sourceStatements!.map((statement) => (
                          <div key={statement.id} className="lcr-source-statement">
                            <p>
                              <strong>{statement.speaker_label || "Speaker not identified"}</strong>
                              {statement.speaker_attribution_status === "explicit"
                                ? " · label recorded in source; identity not independently verified"
                                : " · no speaker label in source"}
                            </p>
                            <p>{statement.source_passage}</p>
                            {statement.supersedes_observation_id && (
                              <small>Correction of an earlier statement · {statement.correction_rationale || "Correction reason not supplied"}</small>
                            )}
                            {statement.superseded_by_observation_ids.length > 0 && (
                              <small>Original statement preserved · superseded by {statement.superseded_by_observation_ids.length} later correction{statement.superseded_by_observation_ids.length === 1 ? "" : "s"}.</small>
                            )}
                            <small>
                              {statement.occurred_at
                                ? `Source event time: ${formatLastUpdated(statement.occurred_at)}`
                                : statement.observed_at
                                  ? `Observed: ${formatLastUpdated(statement.observed_at)}`
                                  : statement.context || "Source event time not stated"}
                              {" · "}Submitted by authenticated caregiver
                              {" · "}Recorded {statement.reported_at ? formatLastUpdated(statement.reported_at) : "time unavailable"}
                              {" · "}{statement.epistemic_status}
                            </small>
                          </div>
                        ))}
                      </div>
                    )}
                    {(situation.conflicts?.length ?? 0) > 0 && (
                      <p role="status">
                        {situation.conflicts!.length} conflicting report{situation.conflicts!.length === 1 ? "" : "s"} remain unresolved. No account has been selected as correct.
                      </p>
                    )}
                    {(situation.informationGaps?.length ?? 0) > 0 && (
                      <p>
                        {situation.informationGaps!.length} information gap{situation.informationGaps!.length === 1 ? "" : "s"} still need clarification.
                      </p>
                    )}
                    {situation.openQuestions.length > 0 && (
                      <p>Still to clarify: {situation.openQuestions.join(" · ")}</p>
                    )}
                    <span className="lcr-entry-status">{STATUS_LABELS[situation.status] ?? situation.status}</span>
                    {situation.persistedThread && situation.status !== "resolved" && resumableSituations.length > 1 && (
                      <div className="lcr-related-situation-control">
                        <label htmlFor={`related-situation-${situation.id}`}>Link a related concern without merging it</label>
                        <select
                          id={`related-situation-${situation.id}`}
                          value={relationshipTargets[situation.id] ?? ""}
                          onChange={(event) => setRelationshipTargets((previous) => ({
                            ...previous,
                            [situation.id]: event.target.value,
                          }))}
                        >
                          <option value="">Choose another care thread</option>
                          {resumableSituations
                            .filter((candidate) =>
                              candidate.id !== situation.id &&
                              !situation.relatedSituations?.some((related) => related.id === candidate.id)
                            )
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>{candidate.title}</option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="lcr-text-action"
                          disabled={!relationshipTargets[situation.id] || linkingSituationId === situation.id}
                          onClick={() => void linkRelatedSituation(situation.id)}
                        >
                          {linkingSituationId === situation.id ? "Linking…" : "Link related concern"}
                        </button>
                      </div>
                    )}
                    {situation.relatedSituations && situation.relatedSituations.length > 0 && (
                      <div className="lcr-related-situation-list">
                        <p>Related concerns kept separate:</p>
                        {situation.relatedSituations.map((related) => (
                          <div key={related.relationship_id}>
                            <span>{situations.find((candidate) => candidate.id === related.id)?.title ?? "Related care thread"}</span>
                            <button
                              type="button"
                              className="lcr-text-action"
                              disabled={linkingSituationId === situation.id}
                              onClick={() => void linkRelatedSituation(situation.id, related.id, "unrelated_to")}
                            >
                              {linkingSituationId === situation.id ? "Updating…" : "Unlink"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {situation.persistedThread && situation.status !== "resolved" && (
                      <button
                        type="button"
                        className="lcr-text-action"
                        onClick={() => router.push(`/workspace?compose=1&situation=${encodeURIComponent(situation.id)}`)}
                      >
                        Add update to this thread <span aria-hidden="true">→</span>
                      </button>
                    )}
                    {relationshipFeedback && relationshipFeedbackFor === situation.id && linkingSituationId === null && (
                      <p role="status">{relationshipFeedback}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="lcr-support-section" aria-label="Other care tools">
          <div>
            <p className="lcr-eyebrow">WHEN YOU NEED IT</p>
            <h2>More ways to work with your record</h2>
          </div>
          <button type="button" className="lcr-tool-link" onClick={() => router.push("/workspace/companion")}>
            <span className="lcr-tool-icon" aria-hidden="true"><MessageCircle size={20} /></span>
            <span><strong>AI Companion</strong><small>Think through care questions using the available context</small></span>
            <span aria-hidden="true">→</span>
          </button>
          {FEATURE_FLAGS.community && FEATURE_FLAGS.professionalCommunity && (
            <button type="button" className="lcr-tool-link" onClick={() => router.push("/workspace/community")}>
              <span className="lcr-tool-icon" aria-hidden="true"><Users size={20} /></span>
              <span><strong>Caregiver community</strong><small>Learn from other dementia-care experiences</small></span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </section>

        <p className="lcr-footer-note">Your record brings together what has been shared over time. Suggestions and uncertain information should remain distinguishable from confirmed care details.</p>
      </div>
    </main>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<BrandLoading message="Opening your Living Care Record…" />}>
      <WorkspacePageInner />
    </Suspense>
  );
}
