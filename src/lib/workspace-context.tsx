"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Situation, UiRuntimeState } from "@/lib/ui-runtime";
import {
  createEmptyUiRuntimeState,
  openSituationsFromSituationApi,
  type SituationApiContinuityPayload,
} from "@/lib/ui-runtime";
import {
  DURABLE_CARE_KEY_STORAGE,
  ensureClientDurableCareKey,
  ensureClientInteractionSessionId,
} from "@/lib/care-identity/durable-care-key";
import {
  ENTER_CARE_QUERY,
  hasEnteredCareRecord,
  markEnteredCareRecord,
} from "@/lib/care-entry";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { ensureAnonymousSession, getAnonymousAccessToken, getJSON } from "@/api/client";

const TELEMETRY_USER_STORAGE_KEY = "solenos_telemetry_user_id";
const CARE_SESSION_STORAGE_KEY = "solenos_care_session_id";

export type WorkspaceContextValue = {
  runtime: UiRuntimeState;
  careKey: string;
  sessionId: string;
  telemetryUserId: string | null;
  language: string;
  hydrated: boolean;
  entryReady: boolean;
  hasCareHistory: boolean;
  recordLoadError: string | null;
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
  const [hasCareHistory, setHasCareHistory] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState<string | null>(null);
  const [opsMode, setOpsMode] = useState(false);
  const scopeRefreshVersionRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const freshEnter = params.get(ENTER_CARE_QUERY) === "1";
    const previousKey = window.localStorage.getItem(DURABLE_CARE_KEY_STORAGE);

    // Keep explicit new-record intent in the URL until the session client
    // has captured it and the server has successfully issued a replacement.

    // Interface language selection is intentionally disabled for the MVP.
    setLanguage("en");

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

    // The authenticated server response below is the sole source of
    // caregiver-visible situations and history. Legacy browser caches do not
    // authorize workspace entry or supply care-record content.
    setRuntime({
      ...createEmptyUiRuntimeState(),
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

    const existingToken = getAnonymousAccessToken();
    if (!existingToken) {
      const onboardingPending = !hasCompletedOnboarding();
      const shouldEnterWorkspace =
        onboardingPending ||
        hasEnteredCareRecord() ||
        Boolean(opsKey) ||
        freshEnter;

      // A first-time visitor who has not entered onboarding should go to /start.
      // Once the workspace is entered, bootstrap the server-issued anonymous
      // capability before making any protected care-data request. Existing IDs
      // without a token are rejected by ensureAnonymousSession rather than
      // silently creating a replacement record.
      if (!shouldEnterWorkspace) {
        router.replace("/start");
        return;
      }
    }

    void ensureAnonymousSession()
      .then(() => {
        // The session client has now persisted the server-issued identity and
        // cleared any deletion marker. It is safe to consume the explicit-entry URL.
        if (freshEnter) {
          markEnteredCareRecord();
          params.delete(ENTER_CARE_QUERY);
          const next = params.toString();
          window.history.replaceState(window.history.state, "", next ? `/workspace?${next}` : "/workspace");
        }
        // Use the shared authorized GET path so bootstrap reads inherit the
        // standard timeout, safe GET retry, and expired-session refresh policy.
        return getJSON(
          `/situation?care_session_id=${encodeURIComponent(sid)}&offer_return_invite=0`,
        );
      })
      .then((data) => {
        setRecordLoadError(null);
        const fromServer = openSituationsFromSituationApi(data);
        const hasDurableServerReality =
          fromServer.length > 0 ||
          data?.has_context_root === true ||
          (data?.total_events ?? 0) > 0 ||
          Boolean(data?.active_care_situation?.observations?.length);
        setHasCareHistory(hasDurableServerReality);

        if (fromServer.length > 0 || hasDurableServerReality) {
          markEnteredCareRecord();
        }
        // Always replace the visible projection with the server result,
        // including an empty result. Never resurrect another session's
        // browser-cached care situations when the authorized record is empty.
        setRuntime((prev) => ({
          ...prev,
          situations: fromServer,
          activeSituationId:
            fromServer.find((s) => s.status === "active")?.id ??
            fromServer[0]?.id ??
            null,
        }));

        // First-time users who have not completed onboarding are handled by the
        // OnboardingGate (welcome → consent → app shell). Do not bounce them to
        // /start — the gate owns the first-run flow.
        const onboardingPending = !hasCompletedOnboarding();
        const entered =
          onboardingPending ||
          hasEnteredCareRecord() ||
          fromServer.length > 0 ||
          hasDurableServerReality ||
          Boolean(opsKey) ||
          freshEnter;

        if (!entered) {
          router.replace("/start");
          return;
        }

        if (fromServer.length > 0 || hasDurableServerReality || freshEnter) {
          markEnteredCareRecord();
        }
        setEntryReady(true);
      })
      .catch(() => {
        // A failed session or record read is never evidence that this is a
        // first visit. Keep the caregiver in the workspace with an explicit
        // recoverable connection state instead of redirecting to /start.
        setRecordLoadError("Your care information isn't available right now. Check your connection and try again.");
        setEntryReady(true);
      });
  }, [router]);

  const refreshWorkspaceScope = useCallback(async () => {
    const requestVersion = ++scopeRefreshVersionRef.current;
    setEntryReady(false);
    setRecordLoadError(null);
    setRuntime({ ...createEmptyUiRuntimeState(), decisionSurface: { activeCard: null } });

    try {
      const nextCareKey = ensureClientDurableCareKey(window.localStorage.getItem(DURABLE_CARE_KEY_STORAGE));
      const nextSessionId = ensureClientInteractionSessionId(window.localStorage.getItem(CARE_SESSION_STORAGE_KEY));
      window.localStorage.setItem(DURABLE_CARE_KEY_STORAGE, nextCareKey);
      window.localStorage.setItem(CARE_SESSION_STORAGE_KEY, nextSessionId);
      setCareKey(nextCareKey);
      setSessionId(nextSessionId);
      setTelemetryUserId(window.localStorage.getItem(TELEMETRY_USER_STORAGE_KEY));

      await ensureAnonymousSession();
      const data = await getJSON(
        `/situation?care_session_id=${encodeURIComponent(nextSessionId)}&offer_return_invite=0`,
      );
      if (requestVersion !== scopeRefreshVersionRef.current) return;

      const fromServer = openSituationsFromSituationApi(data);
      const hasDurableServerReality =
        fromServer.length > 0 ||
        data?.has_context_root === true ||
        (data?.total_events ?? 0) > 0 ||
        Boolean(data?.active_care_situation?.observations?.length);
      setHasCareHistory(hasDurableServerReality);
      setRuntime((prev) => ({
        ...prev,
        situations: fromServer,
        activeSituationId:
          fromServer.find((s) => s.status === "active")?.id ??
          fromServer[0]?.id ??
          null,
      }));
      if (fromServer.length > 0 || hasDurableServerReality) markEnteredCareRecord();
      setEntryReady(true);
    } catch {
      if (requestVersion !== scopeRefreshVersionRef.current) return;
      setRecordLoadError("Your care information isn't available right now. Check your connection and try again.");
      setEntryReady(true);
    }
  }, []);

  useEffect(() => {
    if (!entryReady) return;
    const refreshForPersonChange = () => void refreshWorkspaceScope();
    window.addEventListener("personIdChanged", refreshForPersonChange);
    return () => window.removeEventListener("personIdChanged", refreshForPersonChange);
  }, [entryReady, refreshWorkspaceScope]);

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
      setHasCareHistory(true);
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
      hasCareHistory,
      recordLoadError,
      opsMode,
      setOpsMode,
      updateRuntime,
      handleSituationComplete,
      handlePauseActive,
    }),
    [runtime, careKey, sessionId, telemetryUserId, language, hydrated, entryReady, hasCareHistory, recordLoadError, opsMode, updateRuntime, handleSituationComplete, handlePauseActive],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
