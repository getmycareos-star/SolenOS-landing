"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Situation, UiRuntimeState } from "@/lib/ui-runtime";
import {
  createEmptyUiRuntimeState,
  loadActiveSituationId,
  loadSituationsFromStorage,
  loadTimelineFromStorage,
  openSituationsFromSituationApi,
  persistActiveSituationId,
  persistSituations,
  persistTimeline,
  type SituationApiContinuityPayload,
} from "@/lib/ui-runtime";
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
import { hasCompletedOnboarding } from "@/lib/onboarding";

const TELEMETRY_USER_STORAGE_KEY = "solenos_telemetry_user_id";
const CARE_SESSION_STORAGE_KEY = "solenos_care_session_id";
const LANGUAGE_STORAGE_KEY = "solenos_language_preference";

export type WorkspaceContextValue = {
  runtime: UiRuntimeState;
  careKey: string;
  sessionId: string;
  telemetryUserId: string | null;
  language: string;
  hydrated: boolean;
  entryReady: boolean;
  opsMode: boolean;
  setOpsMode: (mode: boolean) => void;
  updateRuntime: (updater: (prev: UiRuntimeState) => UiRuntimeState) => void;
  handleSituationComplete: (payload: {
    careKey: string;
    caregiverId: string;
    situations: Situation[];
    activeSituationId: string | null;
    response?: SituationApiContinuityPayload;
  }) => void;
  handlePauseActive: (payload: {
    situations: Situation[];
    activeCareSituation?: SituationApiContinuityPayload["active_care_situation"];
  }) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

type WorkspaceProviderProps = {
  children: ReactNode;
};

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const router = useRouter();
  const [runtime, setRuntime] = useState<UiRuntimeState>(() => createEmptyUiRuntimeState());
  const [careKey, setCareKey] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [telemetryUserId, setTelemetryUserId] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [hydrated, setHydrated] = useState(false);
  const [entryReady, setEntryReady] = useState(false);
  const [opsMode, setOpsMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const freshEnter = params.get(ENTER_CARE_QUERY) === "1";
    const previousKey = window.localStorage.getItem(DURABLE_CARE_KEY_STORAGE);

    if (freshEnter) {
      markEnteredCareRecord();
      params.delete(ENTER_CARE_QUERY);
      const next = params.toString();
      window.history.replaceState({}, "", next ? `/workspace?${next}` : "/workspace");
    }

    setLanguage("en");
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");

    const key = ensureClientDurableCareKey(previousKey);
    const sid = ensureClientInteractionSessionId(
      window.localStorage.getItem(CARE_SESSION_STORAGE_KEY),
      { forceNew: freshEnter },
    );
    window.localStorage.setItem(DURABLE_CARE_KEY_STORAGE, key);
    window.localStorage.setItem(CARE_SESSION_STORAGE_KEY, sid);
    setCareKey(key);
    setSessionId(sid);

    const storedUserId = window.localStorage.getItem(TELEMETRY_USER_STORAGE_KEY);
    if (storedUserId) {
      setTelemetryUserId(storedUserId);
    }

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
        .catch(() => {});
    }

    void fetch(
      `/api/situation?caregiver_id=${encodeURIComponent(key)}&care_session_id=${encodeURIComponent(sid)}&offer_return_invite=0`,
    )
      .then((r) => (r && r.ok ? r.json() : null))
      .then((data) => {
        const fromServer = openSituationsFromSituationApi(data);
        const hasDurableServerReality =
          fromServer.length > 0 ||
          data?.has_context_root === true ||
          (data?.total_events ?? 0) > 0 ||
          Boolean(data?.active_care_situation?.observations?.length);

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
          if (localSituations.length > 0 && previousKey) {
            markEnteredCareRecord();
            persistSituations(localSituations);
            if (activeId) persistActiveSituationId(activeId);
          } else if (!hasDurableServerReality && localSituations.length === 0) {
            persistSituations([]);
            persistActiveSituationId(null);
            setRuntime((prev) => ({
              ...prev,
              situations: [],
              activeSituationId: null,
            }));
          }
        }

        // First-time users who have not completed onboarding are handled by the
        // OnboardingGate (welcome → consent → app shell). Do not bounce them to
        // /start — the gate owns the first-run flow.
        const onboardingPending = !hasCompletedOnboarding();
        const entered =
          onboardingPending ||
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
        if (!hasEnteredCareRecord() && localSituations.length === 0 && !opsKey) {
          router.replace("/start");
          return;
        }
        setEntryReady(true);
      });
  }, [router]);

  useEffect(() => {
    if (!hydrated) return;
    persistSituations(runtime.situations);
    persistTimeline(runtime.timeline);
    persistActiveSituationId(runtime.activeSituationId);
  }, [runtime, hydrated]);

  const updateRuntime = useCallback((updater: (prev: UiRuntimeState) => UiRuntimeState) => {
    setRuntime(updater);
  }, []);

  const handleSituationComplete = useCallback(
    (payload: {
      careKey: string;
      caregiverId: string;
      situations: Situation[];
      activeSituationId: string | null;
      response?: SituationApiContinuityPayload;
    }) => {
      markEnteredCareRecord();
      window.localStorage.setItem(DURABLE_CARE_KEY_STORAGE, payload.careKey);
      if (!window.localStorage.getItem(CARE_SESSION_STORAGE_KEY)?.startsWith("sess_")) {
        window.localStorage.setItem(
          CARE_SESSION_STORAGE_KEY,
          ensureClientInteractionSessionId(null),
        );
      }
      const fromRecord = payload.response
        ? openSituationsFromSituationApi({
            situations: payload.situations,
            ui_situations: payload.response.ui_situations,
            care_situation_groups: payload.response.care_situation_groups,
            context: payload.response.context,
            active_care_situation: payload.response.active_care_situation,
          })
        : openSituationsFromSituationApi({ situations: payload.situations });
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
    },
    [],
  );

  const handlePauseActive = useCallback(
    (payload: {
      situations: Situation[];
      activeCareSituation?: SituationApiContinuityPayload["active_care_situation"];
    }) => {
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
    },
    [],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      runtime,
      careKey,
      sessionId,
      telemetryUserId,
      language,
      hydrated,
      entryReady,
      opsMode,
      setOpsMode,
      updateRuntime,
      handleSituationComplete,
      handlePauseActive,
    }),
    [runtime, careKey, sessionId, telemetryUserId, language, hydrated, entryReady, opsMode, updateRuntime, handleSituationComplete, handlePauseActive],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
