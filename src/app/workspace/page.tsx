"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CareProfileLayerPayload } from "@/lib/care-profile/types";
import type { CareContextLayerPayload } from "@/lib/care-context/situational/types";
import type { MemoryInfluenceLayerPayload } from "@/lib/memory-influence/types";
import type { AssumptionRegistryLayerPayload } from "@/lib/assumption-registry/types";
import type { MissingInformationQueueLayerPayload } from "@/lib/missing-information-queue/types";
import type { SafetyLayerPayload } from "@/lib/safety-enforcement/types";
import type { GovernanceLayerPayload } from "@/lib/settings-governance/types";
import {
  DEFAULT_SOLENOS_LANGUAGE,
  type SolenOSLanguage,
} from "@/lib/multilingual-execution";
import {
  buildAboutSolenOSView,
  buildCareContextView,
  buildCareProfileView,
  buildMemoryView,
  buildResponsibilityGraphView,
  buildSafetySettingsView,
  buildSystemHealthView,
  buildSystemSettingsView,
  createEmptyUiRuntimeState,
  listActiveSituations,
  loadActiveSituationId,
  loadSituationsFromStorage,
  loadTimelineFromStorage,
  openSituationsFromSituationApi,
  persistActiveSituationId,
  persistSituations,
  persistTimeline,
  CAREGIVER_SIDEBAR_SECTION_IDS,
  type SidebarSectionId,
  type UiRuntimeState,
} from "@/lib/ui-runtime";
import { Sidebar, type SidebarData } from "@/components/ui-runtime";
import { CognitiveWorkspace } from "@/components/mvp-workspace";
import { BrandLoading, SolenosWordmark } from "@/components/brand";
import { BRAND_TAGLINE } from "@/lib/brand";
import {
  DURABLE_CARE_KEY_STORAGE,
  ensureClientDurableCareKey,
  ensureClientInteractionSessionId,
} from "@/lib/care-identity";
import {
  ENTER_CARE_QUERY,
  hasEnteredCareRecord,
  markEnteredCareRecord,
} from "@/lib/care-entry";
import { EARLY_ACCESS_BADGE } from "@/lib/early-access-trust";
import { ResearchPreviewAckGate } from "@/components/mvp-workspace/ResearchPreviewAckGate";
import type { Situation } from "@/lib/ui-runtime/types";
import type { SituationResponse } from "@/lib/situation-entry";
import { useRouter } from "next/navigation";

const TELEMETRY_USER_STORAGE_KEY = "solenos_telemetry_user_id";
const CARE_SESSION_STORAGE_KEY = "solenos_care_session_id";
const LANGUAGE_STORAGE_KEY = "solenos_language_preference";

/**
 * SolenOS Living Care Record workspace at /workspace.
 * First-time caregivers land on /start; returning caregivers continue here.
 * Entry: POST /api/situation only. Ops chrome behind ?ops_key=.
 */
export default function WorkspacePage() {
  const router = useRouter();
  const [runtime, setRuntime] = useState<UiRuntimeState>(() => createEmptyUiRuntimeState());
  const [careProfileLayer] = useState<CareProfileLayerPayload | null>(null);
  const [careContextLayer] = useState<CareContextLayerPayload | null>(null);
  const [memoryLayer] = useState<MemoryInfluenceLayerPayload | null>(null);
  const [assumptionLayer] = useState<AssumptionRegistryLayerPayload | null>(null);
  const [missingInfoLayer] = useState<MissingInformationQueueLayerPayload | null>(null);
  const [systemHealthLayer] = useState<
    import("@/lib/system-health/types").SystemHealthLayerPayload | null
  >(null);
  const [safetyLayer] = useState<SafetyLayerPayload | null>(null);
  const [governanceLayer] = useState<GovernanceLayerPayload | null>(null);
  const [responsibilityGraphLayer] = useState<
    import("@/lib/responsibility-graph").ResponsibilityGraphLayerPayload | null
  >(null);
  const [confidenceLayer] = useState<
    import("@/lib/confidence-layer").ConfidenceLayerPayload | null
  >(null);
  const [telemetryUserId, setTelemetryUserId] = useState<string | null>(null);
  const [language, setLanguage] = useState<SolenOSLanguage>(DEFAULT_SOLENOS_LANGUAGE);
  const [sidebarSection, setSidebarSection] = useState<SidebarSectionId>(
    CAREGIVER_SIDEBAR_SECTION_IDS[0],
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [entryReady, setEntryReady] = useState(false);
  const [opsMode, setOpsMode] = useState(false);

  const persistLanguage = useCallback((next: SolenOSLanguage) => {
    setLanguage(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const freshEnter = params.get(ENTER_CARE_QUERY) === "1";
    const previousKey = window.localStorage.getItem(DURABLE_CARE_KEY_STORAGE);

    if (freshEnter) {
      markEnteredCareRecord();
      // Begin = new interaction session only. Do not wipe local situations until
      // durable restore returns — same care key must keep Care Reality (G11).
      params.delete(ENTER_CARE_QUERY);
      const next = params.toString();
      window.history.replaceState({}, "", next ? `/workspace?${next}` : "/workspace");
    }

    // Caregiver path stays English — language chrome exhausted first paint.
    persistLanguage(DEFAULT_SOLENOS_LANGUAGE);

    // G11 / Locked A: Begin must NEVER mint a new care reality. Reuse durable key; mint only if none.
    // Begin may mint a new *interaction session* — session lifetime ≠ Care Reality lifetime.
    const careKey = ensureClientDurableCareKey(previousKey);
    const sessionId = ensureClientInteractionSessionId(
      window.localStorage.getItem(CARE_SESSION_STORAGE_KEY),
      { forceNew: freshEnter },
    );
    window.localStorage.setItem(DURABLE_CARE_KEY_STORAGE, careKey);
    window.localStorage.setItem(CARE_SESSION_STORAGE_KEY, sessionId);

    const storedUserId = window.localStorage.getItem(TELEMETRY_USER_STORAGE_KEY);
    if (storedUserId) {
      setTelemetryUserId(storedUserId);
    }

    // Always load local first — Begin must not blank the UI before durable restore.
    const localSituations = loadSituationsFromStorage();
    const timeline = loadTimelineFromStorage();
    const activeId = loadActiveSituationId();
    setRuntime({
      ...createEmptyUiRuntimeState(),
      situations: localSituations,
      timeline,
      activeSituationId: activeId,
      decisionSurface: { activeCard: null },
    });
    setHydrated(true);

    const opsKey = new URLSearchParams(window.location.search).get("ops_key");
    if (opsKey) {
      void fetch(`/api/ops/access?key=${encodeURIComponent(opsKey)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { ops?: boolean } | null) => {
          if (data?.ops) setOpsMode(true);
        })
        .catch(() => {
          // Stay in caregiver mode
        });
    }

    // Do not consume soft return invite here — CognitiveWorkspace owns offer on Done return.
    void fetch(
      `/api/situation?caregiver_id=${encodeURIComponent(careKey)}&care_session_id=${encodeURIComponent(sessionId)}&offer_return_invite=0`,
    )
      .then((r) => (r && r.ok ? r.json() : null))
      .then((data) => {
        const fromServer = openSituationsFromSituationApi(data);
        const hasDurableServerReality =
          fromServer.length > 0 ||
          data?.has_context_root === true ||
          (data?.total_events ?? 0) > 0 ||
          Boolean(data?.active_care_situation?.observations?.length);
        // Restore durable situations on return AND on Begin (same identity).
        if (fromServer.length > 0) {
          markEnteredCareRecord();
          setRuntime((prev) => {
            const next = {
              ...prev,
              situations: fromServer,
              activeSituationId:
                fromServer.find((s) => s.status === "active")?.id ??
                prev.activeSituationId ??
                fromServer[0]?.id ??
                null,
            };
            persistSituations(next.situations);
            if (next.activeSituationId) persistActiveSituationId(next.activeSituationId);
            return next;
          });
        } else if (freshEnter) {
          // Server empty for this care key: keep prior local if this identity already had reality.
          if (localSituations.length > 0 && previousKey) {
            markEnteredCareRecord();
            persistSituations(localSituations);
            if (activeId) persistActiveSituationId(activeId);
          } else if (!hasDurableServerReality && localSituations.length === 0) {
            // Confirmed empty Care Reality — safe to clear local residue.
            persistSituations([]);
            persistActiveSituationId(null);
            setRuntime((prev) => ({
              ...prev,
              situations: [],
              activeSituationId: null,
            }));
          }
        }

        const entered =
          hasEnteredCareRecord() ||
          fromServer.length > 0 ||
          hasDurableServerReality ||
          localSituations.length > 0 ||
          Boolean(opsKey) ||
          freshEnter;

        if (!entered) {
          router.replace("/start");
          return;
        }

        if (localSituations.length > 0 || fromServer.length > 0 || freshEnter) {
          markEnteredCareRecord();
        }
        setEntryReady(true);
      })
      .catch(() => {
        // Offline / API down — still respect first-visit entry home when empty.
        if (
          !hasEnteredCareRecord() &&
          localSituations.length === 0 &&
          !opsKey
        ) {
          router.replace("/start");
          return;
        }
        setEntryReady(true);
      });
  }, [persistLanguage, router]);

  const handleSituationComplete = useCallback(
    (payload: {
      careKey: string;
      caregiverId: string;
      situations: Situation[];
      activeSituationId: string | null;
      response?: SituationResponse;
    }) => {
      markEnteredCareRecord();
      window.localStorage.setItem(DURABLE_CARE_KEY_STORAGE, payload.careKey);
      // Keep interaction session; do not rebind session to care key (Locked A).
      if (!window.localStorage.getItem(CARE_SESSION_STORAGE_KEY)?.startsWith("sess_")) {
        window.localStorage.setItem(
          CARE_SESSION_STORAGE_KEY,
          ensureClientInteractionSessionId(null),
        );
      }
      const fromRecord = openSituationsFromSituationApi(
        payload.response
          ? {
              situations: payload.situations,
              ui_situations: payload.response.ui_situations,
              care_situation_groups: payload.response.care_situation_groups,
              context: payload.response.context,
              active_care_situation: payload.response.active_care_situation,
            }
          : { situations: payload.situations },
      );
      const nextSituations =
        fromRecord.length > 0
          ? fromRecord
          : payload.situations.length > 0
            ? payload.situations
            : null;
      setRuntime((prev) => {
        const situations = nextSituations ?? prev.situations;
        const next = {
          ...prev,
          situations,
          activeSituationId:
            payload.activeSituationId ??
            situations.find((s) => s.status === "active")?.id ??
            prev.activeSituationId,
        };
        persistSituations(next.situations);
        if (next.activeSituationId) persistActiveSituationId(next.activeSituationId);
        return next;
      });
      setSidebarSection("active_situations");
    },
    [],
  );

  useEffect(() => {
    if (!hydrated) return;
    persistSituations(runtime.situations);
    persistTimeline(runtime.timeline);
    persistActiveSituationId(runtime.activeSituationId);
  }, [runtime, hydrated]);

  const careProfileView = useMemo(
    () => buildCareProfileView(careProfileLayer),
    [careProfileLayer],
  );
  const careContextView = useMemo(
    () =>
      buildCareContextView({
        careContextLayer,
        careProfileLayer,
        profileRelationships: careProfileView.careRelationships,
        assumptionRegistryLayer: assumptionLayer,
        missingInformationQueueLayer: missingInfoLayer,
        conflictClarification: null,
      }),
    [careContextLayer, careProfileLayer, careProfileView.careRelationships, assumptionLayer, missingInfoLayer],
  );
  const memoryView = useMemo(() => buildMemoryView(memoryLayer), [memoryLayer]);
  const responsibilityGraph = useMemo(
    () => buildResponsibilityGraphView(careProfileView, responsibilityGraphLayer),
    [careProfileView, responsibilityGraphLayer],
  );
  const safetySettings = useMemo(
    () =>
      buildSafetySettingsView({
        safetyLayer,
        assumptionRegistryLayer: assumptionLayer,
      }),
    [safetyLayer, assumptionLayer],
  );
  const systemSettings = useMemo(
    () =>
      buildSystemSettingsView({
        governanceLayer,
        languagePreference: language,
      }),
    [governanceLayer, language],
  );
  const systemHealth = useMemo(
    () =>
      buildSystemHealthView({
        unresolvedQuestions: runtime.decisionSurface.activeCard?.unresolvedQuestions.length ?? 0,
        memory: memoryView,
        careContext: careContextView,
        pendingConflicts: careProfileView.pendingConflictCount,
        systemHealthLayer,
        assumptionRegistryLayer: assumptionLayer,
        missingInformationQueueLayer: missingInfoLayer,
        confidenceLayer,
      }),
    [
      runtime.decisionSurface.activeCard,
      memoryView,
      careContextView,
      careProfileView.pendingConflictCount,
      systemHealthLayer,
      assumptionLayer,
      missingInfoLayer,
      confidenceLayer,
    ],
  );

  const sidebarData: SidebarData = useMemo(
    () => ({
      activeSituations: listActiveSituations(runtime.situations),
      activeSituationId: runtime.activeSituationId,
      observations: {
        latestStructured: [],
        aggregation: null,
        weeklySnippet: null,
        observationsThisWeek: 0,
      },
      careProfile: careProfileView,
      careContext: careContextView,
      memory: memoryView,
      documents:
        runtime.situations.find((s) => s.id === runtime.activeSituationId)?.documents ?? [],
      responsibilityGraph,
      safetySettings,
      systemSettings,
      feedbackCorrections: runtime.feedbackCorrections,
      systemHealth,
      about: buildAboutSolenOSView(),
      timelineEntries: runtime.timeline.entries,
    }),
    [
      runtime,
      careProfileView,
      careContextView,
      memoryView,
      responsibilityGraph,
      safetySettings,
      systemSettings,
      systemHealth,
    ],
  );

  return (
    <div className="solenos-shell mvp-shell">
      {!hydrated || !entryReady ? (
        <BrandLoading message="Loading your care context…" />
      ) : (
        <>
      <header className="shell-header mvp-header">
        <div className="shell-brand">
          <button
            type="button"
            className="sidebar-toggle"
            aria-expanded={sidebarOpen}
            aria-controls="solenos-nav"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            Menu
          </button>
          <SolenosWordmark size="md" as="h1" />
          <span className="early-access-badge" aria-label="Early Access">
            {EARLY_ACCESS_BADGE}
          </span>
          <p className="tagline">{BRAND_TAGLINE}</p>
        </div>
      </header>

      <div className={`shell-body${!sidebarOpen ? " sidebar-collapsed" : ""}`}>
        <div
          id="solenos-nav"
          className={`sidebar-rail${sidebarOpen ? " is-open" : ""}`}
        >
          <Sidebar
            data={sidebarData}
            opsMode={opsMode}
            activeSection={sidebarSection}
            onSectionChange={(id) => {
              setSidebarSection(id);
              setSidebarOpen(true);
            }}
            onSelectSituation={(id) => {
              setRuntime((prev) => ({ ...prev, activeSituationId: id }));
              setSidebarSection("active_situations");
            }}
          />
        </div>

        <div className="shell-main mvp-main">
          <ResearchPreviewAckGate>
          <CognitiveWorkspace
            onSituationComplete={handleSituationComplete}
            onPauseActive={(payload) => {
              // Done for now pauses the session only — never wipe open situations.
              // Situation Relationship Engine owns lifecycle, not this button.
              if (!payload) return;
              const fromRecord = openSituationsFromSituationApi({
                situations: payload.situations,
                ui_situations: payload.situations,
                active_care_situation: payload.activeCareSituation,
              });
              setRuntime((prev) => {
                const situations =
                  fromRecord.length > 0
                    ? fromRecord
                    : payload.situations.length > 0
                      ? payload.situations
                      : prev.situations;
                const next = {
                  ...prev,
                  situations,
                  activeSituationId:
                    situations.find((s) => s.status === "active")?.id ??
                    prev.activeSituationId ??
                    situations[0]?.id ??
                    null,
                };
                persistSituations(next.situations);
                if (next.activeSituationId) {
                  persistActiveSituationId(next.activeSituationId);
                }
                return next;
              });
              setSidebarSection("active_situations");
            }}
          />
          </ResearchPreviewAckGate>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
