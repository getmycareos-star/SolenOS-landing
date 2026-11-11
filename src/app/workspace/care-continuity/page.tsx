"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";

import { BrandLoading } from "@/components/brand";
import { useWorkspace } from "@/lib/workspace-context";
import { openSituationsFromSituationApi } from "@/lib/ui-runtime";
import { ensureAnonymousSession } from "@/api/client";
import { apiUrl } from "@/lib/api-url";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";

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
  const { runtime, hydrated, entryReady, updateRuntime } = useWorkspace();
  const [isArchived, setIsArchived] = useState(false);
  const [archiveStateLoaded, setArchiveStateLoaded] = useState(false);
  const [archiveRestoreError, setArchiveRestoreError] = useState("");
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
      setIsArchived(window.localStorage.getItem("solenos_workspace_archived") === "1");
    } catch {
      setIsArchived(false);
    } finally {
      setArchiveStateLoaded(true);
    }
  }, []);

  if (!hydrated || !entryReady || !archiveStateLoaded) {
    return <BrandLoading animate message="Opening your Living Care Record…" />;
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

  const situations = [...runtime.situations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const latestUpdated = situations[0]?.updatedAt ?? null;
  const hasAnyContent = situations.length > 0;

  return (
    <main className="mobile-screen lcr-screen">
      <div className="lcr-home">
        <header className="lcr-header">
          <div>
            <p className="lcr-eyebrow">SOLENOS · LIVING CARE RECORD</p>
            <h1>Your Living Care Record</h1>
            <p className="lcr-intro">Review the care information shared with SolenOS, its sources and how it has changed over time.</p>
          </div>
          <div className="lcr-record-meta">
            <span>Updated {formatLastUpdated(latestUpdated)}</span>
          </div>
        </header>

        <section className="lcr-current-fact lcr-companion-entry" aria-labelledby="lcr-companion-entry-heading">
          <div>
            <h2 id="lcr-companion-entry-heading">Share new information through AI Companion</h2>
            <p>Tell Companion what has happened, or share a message, document or photo. You can review proposed care-record updates before they are saved.</p>
          </div>
          <button type="button" className="lcr-text-action" onClick={() => router.push("/workspace/companion")}>
            Open AI Companion <span aria-hidden="true">→</span>
          </button>
        </section>

        <LCRCurrentUnderstanding />

        <section className="lcr-record-section" aria-labelledby="lcr-record-heading">
          <div className="lcr-section-heading">
            <div>
              <p className="lcr-eyebrow">TIMELINE</p>
              <h2 id="lcr-record-heading">Care history</h2>
            </div>
            {hasAnyContent && <span className="lcr-count">{situations.length} {situations.length === 1 ? "entry" : "entries"}</span>}
          </div>

          {!hasAnyContent ? (
            <div className="lcr-empty-state">
              <div className="lcr-empty-icon" aria-hidden="true"><FileText size={27} /></div>
              <h3>No care events are available in this timeline yet</h3>
              <p>This timeline shows saved care situations. Other persisted care information may still appear in the current-care summary and source review.</p>
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
                              <small>
                                Corrects exact observation {statement.supersedes_observation_id}
                                {" · "}{statement.correction_rationale || "Correction reason not supplied"}
                              </small>
                            )}
                            {statement.superseded_by_observation_ids.length > 0 && (
                              <small>
                                Original statement preserved · superseded by exact observation IDs: {statement.superseded_by_observation_ids.join(", ")}
                              </small>
                            )}
                            <small>
                              Source record: {statement.evidence_id}
                              {" · "}
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
                      <div aria-label="Unresolved conflicting reports">
                        <p role="status">
                          {situation.conflicts!.length} conflicting report{situation.conflicts!.length === 1 ? "" : "s"} remain unresolved. Both accounts are retained; no winner is selected.
                        </p>
                        {situation.conflicts!.map((conflict) => (
                          <div key={conflict.id} className="lcr-source-statement">
                            <p><strong>{conflict.field}</strong></p>
                            <p>{conflict.description}</p>
                            <small>
                              Resolution: {conflict.resolution_status}
                              {" · "}Winner selected: no
                              {" · "}Source evidence IDs: {conflict.evidence_ids.length > 0
                                ? conflict.evidence_ids.join(", ")
                                : "not linked"}
                            </small>
                          </div>
                        ))}
                      </div>
                    )}
                    {(situation.informationGaps?.length ?? 0) > 0 && (
                      <div aria-label="Outstanding evidence gaps">
                        <p>
                          {situation.informationGaps!.length} information gap{situation.informationGaps!.length === 1 ? "" : "s"} still need clarification.
                        </p>
                        {situation.informationGaps!.map((gap) => (
                          <div key={gap.id} className="lcr-source-statement">
                            <p><strong>{gap.field}</strong></p>
                            {gap.description && <p>{gap.description}</p>}
                            <small>
                              {gap.gap_reason || "Reason not recorded"}
                              {" · "}Priority: {gap.priority || "not assessed"}
                              {" · "}Evidence IDs: {gap.evidence_ids.length > 0
                                ? gap.evidence_ids.join(", ")
                                : "none linked"}
                            </small>
                          </div>
                        ))}
                      </div>
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
                    {relationshipFeedback && relationshipFeedbackFor === situation.id && linkingSituationId === null && (
                      <p role="status">{relationshipFeedback}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>


      </div>
    </main>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<BrandLoading animate message="Opening your Living Care Record…" />}>
      <WorkspacePageInner />
    </Suspense>
  );
}
