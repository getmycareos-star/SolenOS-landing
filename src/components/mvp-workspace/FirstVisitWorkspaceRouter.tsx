"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ensureAnonymousSession } from "@/api/client";
import { apiUrl } from "@/lib/api-url";
import { ensureClientInteractionSessionId } from "@/lib/care-identity/durable-care-key";

type SituationSnapshot = {
  has_context_root?: boolean;
  total_events?: number;
  situations?: unknown[];
  ui_situations?: unknown[];
  active_care_situation?: { observations?: unknown[] } | null;
  return_continuity?: { suppress_first_time_ux?: boolean };
};

type LoadState = "loading" | "first_visit" | "returning" | "unavailable";

/**
 * Show first capture only after the authenticated backend confirms this
 * durable care identity is empty. A failed read is never treated as empty.
 */
export function FirstVisitWorkspaceRouter({ fallback }: { fallback: ReactNode }) {
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const session = await ensureAnonymousSession();
      if (!session?.access_token || !session?.person?.id) {
        throw new Error("The care session could not be verified.");
      }
      const storedSessionId = window.localStorage.getItem("solenos_care_session_id");
      const careSessionId = ensureClientInteractionSessionId(storedSessionId);
      window.localStorage.setItem("solenos_care_session_id", careSessionId);
      const response = await fetch(
        apiUrl(`/api/situation?care_session_id=${encodeURIComponent(careSessionId)}&offer_return_invite=0`),
        { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Care information could not be checked (${response.status}).`);
      const data = (await response.json()) as SituationSnapshot;
      if (typeof data.has_context_root !== "boolean") {
        throw new Error("The care record returned an incomplete response.");
      }
      const hasSavedCare =
        data.has_context_root ||
        data.return_continuity?.suppress_first_time_ux === true ||
        (data.total_events ?? 0) > 0 ||
        (data.situations?.length ?? 0) > 0 ||
        (Array.isArray(data.ui_situations) && data.ui_situations.length > 0) ||
        (data.active_care_situation?.observations?.length ?? 0) > 0;
      setState(hasSavedCare ? "returning" : "first_visit");
    } catch {
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  useEffect(() => {
    const className = "solenos-first-visit-mode";
    document.documentElement.classList.toggle(className, state === "first_visit");
    return () => document.documentElement.classList.remove(className);
  }, [state]);

  if (state === "loading") {
    return <div className="workspace-route-loading" role="status" aria-live="polite">Preparing your care record…</div>;
  }

  if (state === "unavailable") {
    return (
      <div className="mobile-screen feature-page" aria-labelledby="care-record-unavailable">
        <section className="workspace-panel-inner">
          <h1 id="care-record-unavailable">We couldn’t check your Care Record</h1>
          <p>Your existing care information has not been changed. Check your connection and try again. We won’t treat an unavailable record as a new one.</p>
          <button type="button" className="workspace-primary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
          <p><Link href="/workspace/timeline">Open care history</Link></p>
        </section>
      </div>
    );
  }

  // First-time and returning caregivers use the same Today page. The page's
  // record-driven empty state offers a starting action without a separate onboarding route.
  return <>{fallback}</>;
}
