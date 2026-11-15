"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

import { BrandLoading } from "@/components/brand";
import { useWorkspace } from "@/lib/workspace-context";
import { openSituationsFromSituationApi } from "@/lib/ui-runtime";
import { ensureAnonymousSession } from "@/api/client";
import { apiUrl } from "@/lib/api-url";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";
import { caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

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

  const latestUpdated = [...runtime.situations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.updatedAt ?? null;

  return (
    <main className="mobile-screen lcr-screen">
      <div className="lcr-home">
        <header className="lcr-header">
          <div>
            <p className="lcr-eyebrow">YOUR CARE RECORD</p>
            <h1>Your Care Record</h1>
            <p className="lcr-intro">See what is currently understood about care, what still needs checking and where the information came from.</p>
          </div>
          <div className="lcr-record-meta">
            <span>Updated {formatLastUpdated(latestUpdated)}</span>
          </div>
        </header>

        <section className="lcr-current-fact lcr-companion-entry" aria-labelledby="lcr-companion-entry-heading">
          <div>
            <h2 id="lcr-companion-entry-heading">Need to add something?</h2>
            <p>Record a new observation or change in Daily Care. Review suggested changes before they become part of your Care Record.</p>
          </div>
          <button type="button" className="lcr-text-action" onClick={() => router.push("/workspace/daily-care")}>
            Open Daily Care <span aria-hidden="true">→</span>
          </button>
        </section>

        <LCRCurrentUnderstanding />

        <section
          aria-label="Care Record actions"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, padding: 18, border: "1px solid var(--solenos-hairline)", borderRadius: 14, background: "var(--solenos-surface)" }}
        >
          <div>
            <h2 style={{ margin: "0 0 5px", fontSize: 16 }}>Keep your care information up to date</h2>
            <p style={{ margin: 0, color: "var(--solenos-muted)", fontSize: 13, lineHeight: 1.5 }}>
              Record something new in Daily Care, or open the Timeline when you need to review earlier updates.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <button
              type="button"
              onClick={() => router.push("/workspace/daily-care")}
              style={{ minHeight: 42, padding: "9px 15px", border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", font: "inherit", fontWeight: 600, cursor: "pointer" }}
            >
              Add a care update
            </button>
            <button type="button" className="lcr-text-action" onClick={() => router.push("/workspace/timeline")}>
              View care timeline <span aria-hidden="true">→</span>
            </button>
          </div>
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
