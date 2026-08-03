"use client";

import { BrandLoading } from "@/components/brand";
import { ResearchPreviewAckGate } from "@/components/mvp-workspace/ResearchPreviewAckGate";
import { CognitiveWorkspace } from "@/components/mvp-workspace";
import { useWorkspace } from "@/lib/workspace-context";
import { listActiveSituations, type ActiveSituation } from "@/lib/ui-runtime";

export default function WorkspacePage() {
  const {
    runtime,
    hydrated,
    entryReady,
    updateRuntime,
    handleSituationComplete,
    handlePauseActive,
  } = useWorkspace();

  if (!hydrated || !entryReady) {
    return <BrandLoading message="Loading your care context…" />;
  }

  const activeSituations = listActiveSituations(runtime.situations);

  return (
    <div className="workspace-content">
      <div className="shell-main mvp-main workspace-page-content">
        <h1 className="page-title">Living Care Record</h1>
        {activeSituations.length > 0 ? (
          <nav className="active-situations-bar" aria-label="Open situations">
            <span className="active-situations-label">Open situations</span>
            <ul className="situation-list" role="list">
              {activeSituations.map((s: ActiveSituation) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`situation-item${
                      runtime.activeSituationId === s.id ? " is-selected" : ""
                    }`}
                    onClick={() =>
                      updateRuntime((prev) => ({ ...prev, activeSituationId: s.id }))
                    }
                  >
                    <span className="situation-title">{s.title}</span>
                    <span className="situation-meta situation-meta-plain">Open</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <div className="empty-state empty-state--inline">
            <div className="empty-state-icon">◉</div>
            <h2 className="empty-state-title">No open situations</h2>
            <p className="empty-state-body">
              Add your first care note below to begin building the Living Care Record.
            </p>
          </div>
        )}

        <ResearchPreviewAckGate>
          <CognitiveWorkspace
            onSituationComplete={handleSituationComplete}
            onPauseActive={handlePauseActive}
          />
        </ResearchPreviewAckGate>
      </div>
    </div>
  );
}
