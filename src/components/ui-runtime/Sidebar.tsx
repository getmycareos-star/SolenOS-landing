"use client";

import dynamic from "next/dynamic";
import {
  CAREGIVER_SIDEBAR_SECTION_IDS,
  CAREGIVER_SIDEBAR_SECTION_LABELS,
  SIDEBAR_SECTION_IDS,
  SIDEBAR_SECTION_LABELS,
  type ActiveSituation,
  type CareContextView,
  type CareProfileView,
  type FeedbackCorrection,
  type MemoryView,
  type ResponsibilityGraphView,
  type SafetySettingsView,
  type SidebarSectionId,
  type SituationDocument,
  type SystemHealthView,
  type SystemSettingsView,
  type TimelineEntry,
  type AboutSolenOSView,
} from "@/lib/ui-runtime";
import type { ObservationPanelData } from "@/components/ops-devtools/ObservationPanel";
import { SolenosWordmark } from "@/components/brand";
import Link from "next/link";
import { IN_PRODUCT_LEGAL_LINKS } from "@/lib/trust-content";
import { EMERGENCY_BOUNDARY } from "@/lib/early-access-trust";

/** Ops-only signals dump — code-split out of default caregiver Sidebar chunk. */
const ObservationPanel = dynamic(
  () =>
    import("@/components/ops-devtools/ObservationPanel").then((m) => m.ObservationPanel),
  { ssr: false },
);

export type SidebarData = {
  activeSituations: ActiveSituation[];
  activeSituationId: string | null;
  observations: ObservationPanelData;
  careProfile: CareProfileView;
  careContext: CareContextView;
  memory: MemoryView;
  documents: SituationDocument[];
  responsibilityGraph: ResponsibilityGraphView;
  safetySettings: SafetySettingsView;
  systemSettings: SystemSettingsView;
  feedbackCorrections: FeedbackCorrection[];
  systemHealth: SystemHealthView;
  about: AboutSolenOSView;
  timelineEntries: readonly TimelineEntry[];
};

interface SidebarProps {
  data: SidebarData;
  activeSection: SidebarSectionId;
  onSectionChange: (section: SidebarSectionId) => void;
  onSelectSituation: (id: string) => void;
  /** When false (default), only Living Care Record + continuity sections. */
  opsMode?: boolean;
}

function sectionLabel(id: SidebarSectionId, opsMode: boolean): string {
  if (!opsMode && id in CAREGIVER_SIDEBAR_SECTION_LABELS) {
    return CAREGIVER_SIDEBAR_SECTION_LABELS[
      id as (typeof CAREGIVER_SIDEBAR_SECTION_IDS)[number]
    ];
  }
  return SIDEBAR_SECTION_LABELS[id];
}

export function Sidebar({
  data,
  activeSection,
  onSectionChange,
  onSelectSituation,
  opsMode = false,
}: SidebarProps) {
  const sectionIds = opsMode
    ? SIDEBAR_SECTION_IDS
    : CAREGIVER_SIDEBAR_SECTION_IDS;

  return (
    <aside
      className={`solenos-sidebar${opsMode ? " is-ops" : " is-caregiver"}`}
      aria-label={opsMode ? "solenos ops navigation" : "Living Care Record navigation"}
    >
      <div className="solenos-sidebar-brand">
        <SolenosWordmark size="sm" />
      </div>
      <nav className="sidebar-nav" aria-label="Sidebar sections">
        <ol className="sidebar-section-list">
          {sectionIds.map((id) => (
            <li key={id}>
              <button
                type="button"
                className={`sidebar-nav-item${activeSection === id ? " is-active" : ""}`}
                onClick={() => onSectionChange(id)}
                aria-current={activeSection === id ? "true" : undefined}
              >
                {sectionLabel(id, opsMode)}
                {id === "active_situations" && data.activeSituations.length > 0 && (
                  <span className="sidebar-count">{data.activeSituations.length}</span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div
        className="sidebar-panel"
        role="region"
        aria-label={sectionLabel(activeSection, opsMode)}
      >
        {activeSection === "active_situations" && (
          <ActiveSituationsPanel
            situations={data.activeSituations}
            selectedId={data.activeSituationId}
            onSelect={onSelectSituation}
            caregiverMode={!opsMode}
          />
        )}
        {opsMode && activeSection === "observations" && (
          <ObservationPanel data={data.observations} />
        )}
        {opsMode && activeSection === "care_profile" && (
          <CareProfilePanel profile={data.careProfile} />
        )}
        {opsMode && activeSection === "care_context" && (
          <CareContextPanel context={data.careContext} />
        )}
        {activeSection === "timeline" && (
          <SidebarTimelinePanel
            entries={data.timelineEntries}
            situationId={data.activeSituationId}
            caregiverMode={!opsMode}
          />
        )}
        {opsMode && activeSection === "memory" && <MemoryPanel memory={data.memory} />}
        {opsMode && activeSection === "documents" && (
          <DocumentsPanel documents={data.documents} situationId={data.activeSituationId} />
        )}
        {opsMode && activeSection === "responsibility_graph" && (
          <ResponsibilityPanel graph={data.responsibilityGraph} />
        )}
        {opsMode && activeSection === "safety_settings" && (
          <SafetySettingsPanel settings={data.safetySettings} />
        )}
        {opsMode && activeSection === "system_settings" && (
          <SystemSettingsPanel settings={data.systemSettings} />
        )}
        {opsMode && activeSection === "feedback_corrections" && (
          <FeedbackPanel corrections={data.feedbackCorrections} />
        )}
        {opsMode && activeSection === "system_health" && (
          <SystemHealthPanel health={data.systemHealth} />
        )}
        {activeSection === "about_solenos" && <AboutPanel about={data.about} />}
      </div>
    </aside>
  );
}

function ActiveSituationsPanel({
  situations,
  selectedId,
  onSelect,
  caregiverMode,
}: {
  situations: ActiveSituation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  caregiverMode: boolean;
}) {
  if (situations.length === 0) {
    return (
      <p className="sidebar-empty">
        {caregiverMode
          ? "No open situations yet. Add a note to begin the Living Care Record."
          : "Nothing in the care record yet. Add a note or document to begin."}
      </p>
    );
  }

  return (
    <ul className="situation-list">
      {situations.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            className={`situation-item${selectedId === s.id ? " is-selected" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <span className="situation-title">{s.title}</span>
            {caregiverMode ? (
              <span className="situation-meta situation-meta-plain">Open</span>
            ) : (
              <span className="situation-meta">
                <span className={`risk-badge risk-${s.riskLevel.toLowerCase()}`}>
                  {s.riskLevel}
                </span>
                <span className="situation-status">{s.status}</span>
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function CareProfilePanel({ profile }: { profile: CareProfileView }) {
  return (
    <dl className="sidebar-dl">
      <dt>Role in care graph</dt>
      <dd>{profile.roleInCareGraph}</dd>
      <dt>Dependents</dt>
      <dd>{formatList(profile.careRelationships.dependents)}</dd>
      <dt>Shared care</dt>
      <dd>{formatList(profile.careRelationships.sharedCareWith)}</dd>
      <dt>Permissions</dt>
      <dd>{formatList(profile.caregivingPermissions)}</dd>
      <dt>Delegation</dt>
      <dd>{formatList(profile.delegationRights)}</dd>
      {profile.workloadIntensity && (
        <>
          <dt>Workload</dt>
          <dd>{profile.workloadIntensity}</dd>
        </>
      )}
      <dt className="sidebar-source">Source</dt>
      <dd className="sidebar-source">{profile.source}</dd>
    </dl>
  );
}

function CareContextPanel({ context }: { context: CareContextView }) {
  return (
    <div>
      <dl className="sidebar-dl">
        {context.situationType && (
          <>
            <dt>Situation type</dt>
            <dd>{context.situationType}</dd>
          </>
        )}
        {context.urgencyLevel && (
          <>
            <dt>Urgency</dt>
            <dd>{context.urgencyLevel}</dd>
          </>
        )}
        <dt>Dependent profiles</dt>
        <dd>{formatList(context.dependentProfiles)}</dd>
        <dt>Conditions</dt>
        <dd>{formatList(context.conditions)}</dd>
        <dt>Medications</dt>
        <dd>{formatList(context.medications)}</dd>
        <dt>Constraints</dt>
        <dd>{formatList(context.careConstraints)}</dd>
        <dt>Environment</dt>
        <dd>{formatList(context.environmentalFactors)}</dd>
        <dt className="sidebar-source">Source</dt>
        <dd className="sidebar-source">{context.source}</dd>
      </dl>
      {context.currentAssumptions && context.currentAssumptions.length > 0 && (
        <div className="assumption-list">
          <h3>Current Assumptions</h3>
          <ul>
            {context.currentAssumptions.map((a, i) => (
              <li key={`${a.summary}-${i}`}>
                <span className={`assumption-status assumption-${a.status}`}>{a.status}</span>
                {a.summary}
              </li>
            ))}
          </ul>
        </div>
      )}
      {context.conflictClarification && (
        <div className="conflict-clarification">
          <h3>{context.conflictClarification.headline}</h3>
          <p className="sidebar-note">One clarification at a time — not a conflict list.</p>
          <p>{context.conflictClarification.question}</p>
          {context.conflictClarification.options &&
            context.conflictClarification.options.length > 0 && (
              <ul>
                {context.conflictClarification.options.map((opt) => (
                  <li key={opt}>{opt}</li>
                ))}
              </ul>
            )}
        </div>
      )}
      {context.informationNeeded && context.informationNeeded.length > 0 && (
        <div className="information-needed-list">
          <h3>Information Needed</h3>
          <p className="sidebar-note">Knowledge gaps affecting reasoning — not tasks.</p>
          <ul>
            {context.informationNeeded.map((item, i) => (
              <li key={`${item.question}-${i}`}>
                <span className={`importance-badge importance-${item.importance.toLowerCase()}`}>
                  {item.importance}
                </span>
                {item.question}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SidebarTimelinePanel({
  entries,
  situationId,
  caregiverMode = false,
}: {
  entries: readonly TimelineEntry[];
  situationId: string | null;
  caregiverMode?: boolean;
}) {
  const filtered = situationId
    ? entries.filter((e) => e.situationId === situationId)
    : entries;
  if (filtered.length === 0) {
    return (
      <p className="sidebar-empty">
        {caregiverMode
          ? "Nothing on the care timeline yet — notes you add will appear here."
          : "No timeline events for this situation."}
      </p>
    );
  }
  return (
    <ol className="sidebar-timeline">
      {[...filtered]
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .slice(-12)
        .map((e) => (
          <li key={e.id}>
            {!caregiverMode && <span className="timeline-type">{e.type}</span>}
            <span className="timeline-summary">{e.summary}</span>
          </li>
        ))}
    </ol>
  );
}

function MemoryPanel({ memory }: { memory: MemoryView }) {
  return (
    <div className="memory-summaries">
      <p className="sidebar-note">Summaries only — raw memory is never dumped here.</p>
      <MemoryGroup label="Identity" items={memory.identityMemory} />
      <MemoryGroup label="Pattern" items={memory.patternMemory} />
      <MemoryGroup label="Operational" items={memory.operationalMemory} />
      <MemoryGroup label="Correction" items={memory.correctionMemory} />
      {typeof memory.compositeInfluence === "number" && (
        <p className="sidebar-meta">Composite influence: {memory.compositeInfluence.toFixed(2)}</p>
      )}
      <p className="sidebar-source">Source: {memory.source}</p>
    </div>
  );
}

function MemoryGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="memory-group">
      <h3>{label}</h3>
      {items.length === 0 ? (
        <p className="sidebar-empty">None recorded</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentsPanel({
  documents,
  situationId,
}: {
  documents: SituationDocument[];
  situationId: string | null;
}) {
  const scoped = situationId
    ? documents.filter((d) => d.situationId === situationId)
    : documents;
  if (!situationId) {
    return <p className="sidebar-empty">Select a situation to view its documents.</p>;
  }
  if (scoped.length === 0) {
    return (
      <p className="sidebar-empty">
        No documents attached to this situation. Documents always belong to a situationId.
      </p>
    );
  }
  return (
    <ul className="document-list">
      {scoped.map((doc) => (
        <li key={doc.id}>
          <strong>{doc.title}</strong>
          <span className="doc-source">{doc.sourceType}</span>
          <p>{doc.summary}</p>
        </li>
      ))}
    </ul>
  );
}

function ResponsibilityPanel({ graph }: { graph: ResponsibilityGraphView }) {
  return (
    <dl className="sidebar-dl">
      <dt>Owner</dt>
      <dd>{graph.owner}</dd>
      {graph.health ? (
        <>
          <dt>Ownership health</dt>
          <dd>{graph.health}</dd>
        </>
      ) : null}
      {typeof graph.unassignedCount === "number" ? (
        <>
          <dt>Unassigned demands</dt>
          <dd>{graph.unassignedCount}</dd>
        </>
      ) : null}
      {graph.escalate ? (
        <>
          <dt>Escalation</dt>
          <dd>Critical unassigned ownership</dd>
        </>
      ) : null}
      <dt>Shared caregivers</dt>
      <dd>{formatList(graph.sharedCaregivers)}</dd>
      <dt>Ownership conflicts</dt>
      <dd>{formatList(graph.unresolvedOwnershipConflicts)}</dd>
      <dt className="sidebar-source">Source</dt>
      <dd className="sidebar-source">{graph.source}</dd>
    </dl>
  );
}

function SafetySettingsPanel({ settings }: { settings: SafetySettingsView }) {
  return (
    <div>
      <dl className="sidebar-dl">
        <dt>Uncertainty display</dt>
        <dd>{settings.uncertaintyDisplay ? "on" : "off"}</dd>
        <dt>Medical advisory mode</dt>
        <dd>{settings.medicalAdvisoryMode}</dd>
        <dt>Risk sensitivity</dt>
        <dd>{settings.riskSensitivity}</dd>
        <dt>Escalation rules</dt>
        <dd>{formatList(settings.escalationRules)}</dd>
        <dt className="sidebar-source">Source</dt>
        <dd className="sidebar-source">{settings.source}</dd>
      </dl>
      {settings.currentAssumptions && settings.currentAssumptions.length > 0 && (
        <div className="assumption-list">
          <h3>Current Assumptions</h3>
          <p className="sidebar-note">Temporary beliefs under safety review — not facts.</p>
          <ul>
            {settings.currentAssumptions.map((a, i) => (
              <li key={`${a.summary}-${i}`}>
                <span className={`assumption-status assumption-${a.status}`}>{a.status}</span>
                {a.summary}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SystemSettingsPanel({ settings }: { settings: SystemSettingsView }) {
  return (
    <dl className="sidebar-dl">
      <dt>Memory behavior</dt>
      <dd>{settings.memoryBehavior}</dd>
      <dt>Decision authority</dt>
      <dd>{settings.decisionAuthority}</dd>
      <dt>Time engine</dt>
      <dd>{settings.timeEngineBehavior}</dd>
      <dt>System mode</dt>
      <dd>{settings.systemMode}</dd>
      <dt>Language</dt>
      <dd>{settings.languagePreference}</dd>
      <dt className="sidebar-source">Source</dt>
      <dd className="sidebar-source">{settings.source}</dd>
    </dl>
  );
}

function FeedbackPanel({ corrections }: { corrections: FeedbackCorrection[] }) {
  if (corrections.length === 0) {
    return (
      <div>
        <p className="sidebar-note">
          Correction kinds: incorrect_assumption, outdated_context, bad_recommendation,
          missing_information.
        </p>
        <p className="sidebar-empty">No corrections recorded yet.</p>
      </div>
    );
  }
  return (
    <ul className="feedback-list">
      {corrections.map((c, i) => (
        <li key={`${c.kind}-${c.recordedAt}-${i}`}>
          <span className="feedback-kind">{c.kind}</span>
          <p>{c.note}</p>
        </li>
      ))}
    </ul>
  );
}

function SystemHealthPanel({ health }: { health: SystemHealthView }) {
  return (
    <div>
      <dl className="sidebar-dl">
        <dt>Confidence drift</dt>
        <dd>{health.confidenceDrift}</dd>
        {health.caregiverConfidenceExplanation ? (
          <>
            <dt>Care understanding</dt>
            <dd>{health.caregiverConfidenceExplanation}</dd>
          </>
        ) : null}
        <dt>Context completeness</dt>
        <dd>{health.contextCompleteness}</dd>
        <dt>Memory quality</dt>
        <dd>{health.memoryQuality}</dd>
        <dt>Contradictions</dt>
        <dd>{health.contradictionCount}</dd>
        <dt>Stale documents</dt>
        <dd>{health.staleDocuments}</dd>
        <dt>Unresolved questions</dt>
        <dd>{health.unresolvedQuestions}</dd>
        {health.assumptionHealth && (
          <>
            <dt>Active assumptions</dt>
            <dd>{health.assumptionHealth.activeAssumptions}</dd>
            <dt>Stale assumptions</dt>
            <dd>{health.assumptionHealth.staleAssumptions}</dd>
            <dt>Invalidated assumptions</dt>
            <dd>{health.assumptionHealth.invalidatedAssumptions}</dd>
          </>
        )}
        {health.missingInformationHealth && (
          <>
            <dt>Open information gaps</dt>
            <dd>{health.missingInformationHealth.openItems}</dd>
            <dt>High-priority gaps</dt>
            <dd>{health.missingInformationHealth.highPriorityItems}</dd>
            <dt>Resolved gaps</dt>
            <dd>{health.missingInformationHealth.resolvedItems}</dd>
          </>
        )}
        <dt className="sidebar-source">Source</dt>
        <dd className="sidebar-source">{health.source}</dd>
      </dl>
      {health.reasoningQualityWarning && (
        <p className="sidebar-warning" role="status">
          {health.reasoningQualityWarning}
        </p>
      )}
      {health.highPriorityGaps && health.highPriorityGaps.length > 0 && (
        <div className="information-needed-list">
          <h3>Reasoning Quality Impact</h3>
          <ul>
            {health.highPriorityGaps.map((gap, i) => (
              <li key={`${gap}-${i}`}>{gap}</li>
            ))}
          </ul>
        </div>
      )}
      {health.currentAssumptions && health.currentAssumptions.length > 0 && (
        <div className="assumption-list">
          <h3>Current Assumptions</h3>
          <ul>
            {health.currentAssumptions.map((a, i) => (
              <li key={`${a.summary}-${i}`}>
                <span className={`assumption-status assumption-${a.status}`}>{a.status}</span>
                {a.summary}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AboutPanel({ about }: { about: AboutSolenOSView }) {
  return (
    <div className="about-solenos">
      <nav className="about-trust-links" aria-label="Help and trust">
        {IN_PRODUCT_LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="about-section-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <p className="about-identity">{about.identity}</p>
      <p className="about-principle">{about.principle}</p>

      {about.sections.map((section) => (
        <section key={section.id} className="about-section" id={`about-${section.id}`}>
          <h3>{section.title}</h3>
          {section.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {section.linkHref && section.linkLabel && (
            <a
              href={section.linkHref}
              className="about-section-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {section.linkLabel}
            </a>
          )}
        </section>
      ))}

      <p className="sidebar-note workspace-emergency-note" role="note">
        {EMERGENCY_BOUNDARY}
      </p>

      <p className="sidebar-note">solenos is not:</p>
      <ul>
        {about.notProductOf.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "—";
}
