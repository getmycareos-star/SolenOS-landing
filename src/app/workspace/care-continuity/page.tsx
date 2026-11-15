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
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

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
          "The related care topics could not be linked. Please try again.",
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
          ? "Related care topics are linked. Each keeps its own history and supporting information."
          : "The link was removed. Both care topics remain separate.",
      );
      setRelationshipTargets((previous) => ({ ...previous, [sourceSituationId]: "" }));
    } catch (error) {
      setRelationshipFeedback("The related care topics could not be linked. Please try again.");
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
    return <BrandLoading animate message="Opening your Care Record…" />;
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
            <p className="lcr-eyebrow">YOUR CARE RECORD</p>
            <h1>Your Care Record</h1>
            <p className="lcr-intro">See the care information shared with SolenOS, where it came from and what has changed over time.</p>
          </div>
          <div className="lcr-record-meta">
            <span>Updated {formatLastUpdated(latestUpdated)}</span>
          </div>
        </header>

        <section className="lcr-current-fact lcr-companion-entry" aria-labelledby="lcr-companion-entry-heading">
          <div>
            <h2 id="lcr-companion-entry-heading">Talk through a care update</h2>
            <p>Tell the Care Assistant what happened, or share a message, document or photo. You can review suggested changes before they are saved to your Care Record.</p>
          </div>
          <button type="button" className="lcr-text-action" onClick={() => router.push("/workspace/companion")}>
            Open Care Assistant <span aria-hidden="true">→</span>
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
              <p>This timeline shows saved care updates. Other saved information may still appear in your care summary.</p>
            </div>
          ) : (
            <div className="lcr-timeline">
              {situations.map((situation) => (
                <article key={situation.id} className="lcr-timeline-item">
                  <span className="lcr-timeline-marker" aria-hidden="true"><FileText size={17} /></span>
                  <div className="lcr-timeline-content">
                    <div className="lcr-entry-heading">
                      <h3>{caregiverSafeAssistantText(situation.title) || "Care update"}</h3>
                      <span>{formatLastUpdated(situation.updatedAt)}</span>
                    </div>
                    {situation.contextSummary && caregiverSafeAssistantText(situation.contextSummary) && <p>{caregiverSafeAssistantText(situation.contextSummary)}</p>}
                    {(situation.sourceStatements?.length ?? 0) > 0 && (
                      <div className="lcr-source-statements" aria-label="What was reported in the original notes and documents">
                        <p>What was reported</p>
                        {situation.sourceStatements!.map((statement) => (
                          <div key={statement.id} className="lcr-source-statement">
                            <p>
                              <strong>{statement.speaker_attribution_status === "explicit" && caregiverSafeAssistantText(statement.speaker_label)
                                ? "Reported by " + caregiverSafeAssistantText(statement.speaker_label)
                                : "Reported by a caregiver"}</strong>
                            </p>
                            <blockquote>{caregiverSafeAssistantText(statement.source_passage) || "The original wording is not available."}</blockquote>
                            {statement.supersedes_observation_id && (
                              <small>
                                Corrects an earlier saved detail{" · "}{caregiverSafeAssistantText(statement.correction_rationale) || "No reason was recorded"}
                              </small>
                            )}
                            {statement.superseded_by_observation_ids.length > 0 && (
                              <small>
                                Original wording preserved · updated in {statement.superseded_by_observation_ids.length} later saved detail(s)
                              </small>
                            )}
                            <details className="lcr-entry-details">
                              <summary>When and by whom it was reported</summary>
                              <small>
                                {statement.occurred_at
                                  ? "Happened: " + formatLastUpdated(statement.occurred_at)
                                  : statement.observed_at
                                    ? "Observed: " + formatLastUpdated(statement.observed_at)
                                    : caregiverSafeAssistantText(statement.context) || "Time not stated"}
                                {" · "}Recorded {statement.reported_at ? formatLastUpdated(statement.reported_at) : "time unavailable"}
                                {" · "}{caregiverInformationLabel(statement.epistemic_status) || "Caregiver report"}
                                {" · "}{statement.speaker_attribution_status === "explicit"
                                  ? "The name appears in the original note and has not been independently confirmed."
                                  : "The original note did not identify the speaker."}
                              </small>
                            </details>
                          </div>
                        ))}
                      </div>
                    )}
                    {(situation.conflicts?.length ?? 0) > 0 && (
                      <details className="lcr-entry-details" aria-label="Unresolved conflicting reports">
                        <summary>{situation.conflicts!.length} reports do not match yet</summary>
                        {situation.conflicts!.map((conflict) => (
                          <div key={conflict.id} className="lcr-source-statement">
                            <p>{caregiverSafeAssistantText(conflict.description) || "The saved reports differ."}</p>
                            <small>
                              {caregiverStatusLabel(conflict.resolution_status) || "Not reviewed"}
                              {" · "}Both accounts remain saved; neither has been selected as correct.
                            </small>
                          </div>
                        ))}
                      </details>
                    )}
                    {(situation.informationGaps?.length ?? 0) > 0 && (
                      <details className="lcr-entry-details" aria-label="Information that still needs checking">
                        <summary>Information that still needs checking ({situation.informationGaps!.length})</summary>
                        {situation.informationGaps!.map((gap) => (
                          <div key={gap.id} className="lcr-source-statement">
                            {gap.description && <p>{caregiverSafeAssistantText(gap.description) || "More information may be needed."}</p>}
                            {gap.gap_reason && <small>{caregiverSafeAssistantText(gap.gap_reason)}</small>}
                          </div>
                        ))}
                      </details>
                    )}

                    <span className="lcr-entry-status">{STATUS_LABELS[situation.status] ?? caregiverStatusLabel(situation.status) ?? "Status not available"}</span>
                    {situation.persistedThread && situation.status !== "resolved" && resumableSituations.length > 1 && (
                      <div className="lcr-related-situation-control">
                        <label htmlFor={`related-situation-${situation.id}`}>Link a related care topic without combining the records</label>
                        <select
                          id={`related-situation-${situation.id}`}
                          value={relationshipTargets[situation.id] ?? ""}
                          onChange={(event) => setRelationshipTargets((previous) => ({
                            ...previous,
                            [situation.id]: event.target.value,
                          }))}
                        >
                          <option value="">Choose another care topic</option>
                          {resumableSituations
                            .filter((candidate) =>
                              candidate.id !== situation.id &&
                              !situation.relatedSituations?.some((related) => related.id === candidate.id)
                            )
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>{caregiverSafeAssistantText(candidate.title) || "Care topic"}</option>
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
                            <span>{caregiverSafeAssistantText(situations.find((candidate) => candidate.id === related.id)?.title) || "Related care topic"}</span>
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
    <Suspense fallback={<BrandLoading animate message="Opening your Care Record…" />}>
      <WorkspacePageInner />
    </Suspense>
  );
}
