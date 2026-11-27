"use client";


import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell/AppShell";
import { WorkspaceNavigationAccessibility } from "@/components/app-shell/WorkspaceNavigationAccessibility";
import { WorkspaceRouteBreadcrumbs } from "@/components/app-shell/WorkspaceRouteBreadcrumbs";
import { GlobalDisplayPreferences } from "@/components/accessibility/GlobalDisplayPreferences";
import { BrandLoading } from "@/components/brand";
import { caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";
import { useWorkspace } from "@/lib/workspace-context";
import { ensureAnonymousSession, getJSON } from "@/api/client";
import { EarlyAccessConsentForm } from "@/components/public/EarlyAccessConsentForm";

function formatUpdatedDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function CareContextBar() {
  const { runtime, recordLoadError } = useWorkspace();
  const active = runtime.situations.find((s) => s.status === "active");
  const hasSituations = runtime.situations.length > 0;
  const [mounted, setMounted] = useState(false);
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const recipientRequestVersionRef = useRef(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let activeRequest = true;
    const loadRecipientName = async () => {
      const requestVersion = ++recipientRequestVersionRef.current;
      try {
        const profile = await getJSON("/care-profile") as { name?: unknown };
        if (!activeRequest || requestVersion !== recipientRequestVersionRef.current) return;
        setRecipientName(typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : null);
      } catch {
        if (activeRequest && requestVersion === recipientRequestVersionRef.current) setRecipientName(null);
      }
    };
    const refreshForPersonChange = () => {
      recipientRequestVersionRef.current += 1;
      setRecipientName(null);
      void loadRecipientName();
    };
    void loadRecipientName();
    window.addEventListener("personIdChanged", refreshForPersonChange);
    return () => {
      activeRequest = false;
      recipientRequestVersionRef.current += 1;
      window.removeEventListener("personIdChanged", refreshForPersonChange);
    };
  }, []);

  const updatedLabel = mounted && active ? formatUpdatedDate(active.updatedAt) : "";

  return (
    <section className="care-context-bar" aria-label="Care recipient and record status">
      <div className="care-context-inner">
        <div className="care-context-info" aria-live="polite" aria-atomic="true">
          {recipientName && <span className="care-context-recipient care-context-name">Care for {recipientName}</span>}
          {recordLoadError ? (
            <>
              <span className="care-context-name">Care information unavailable</span>
              <span className="care-context-status care-context-status--paused">Connection needed</span>
            </>
          ) : active ? (
            <>
              <span className="care-context-name">{caregiverSafeAssistantText(active.title) || "Care information"}</span>
              <span className={`care-context-status care-context-status--${active.status}`}>
                {caregiverStatusLabel(active.status) || "Status not available"}
              </span>
              {updatedLabel && <span className="care-context-meta">Updated {updatedLabel}</span>}
            </>
          ) : hasSituations ? (
            <>
              <span className="care-context-name">{runtime.situations.length} care areas</span>
              <span className="care-context-status care-context-status--paused">No active care area</span>
            </>
          ) : (
            <>
              <span className="care-context-name">No care details yet</span>
              <Link className="care-context-action" href="/workspace/daily-care">
                Add an update
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

type ConsentState = "loading" | "required" | "verified" | "error";

function WorkspaceEntryGate({ children }: { children: ReactNode }) {
  const { entryReady, recordLoadError } = useWorkspace();
  const [consentState, setConsentState] = useState<ConsentState>("loading");
  const [consentError, setConsentError] = useState("");

  const loadConsent = useCallback(async () => {
    setConsentState("loading");
    setConsentError("");
    try {
      const session = await ensureAnonymousSession();
      const status = await getJSON(
        `/consent?person_id=${encodeURIComponent(session.person.id)}`,
      ) as { verified?: boolean; required?: boolean };
      if (status.verified === true && status.required === false) {
        setConsentState("verified");
      } else if (status.required === true && status.verified !== true) {
        setConsentState("required");
      } else {
        throw new Error("The server returned an incomplete consent status.");
      }
    } catch {
      setConsentError("We couldn't verify your privacy and safety acknowledgement. Your care workspace remains protected. Try again.");
      setConsentState("error");
    }
  }, []);

  useEffect(() => {
    if (!entryReady) return;
    void loadConsent();
  }, [entryReady, loadConsent]);

  if (!entryReady || consentState === "loading") {
    return (
      <main className="workspace-route-loading" role="status" aria-live="polite">
        <BrandLoading animate message="Preparing your care workspace…" />
      </main>
    );
  }

  if (consentState === "error") {
    return (
      <AppShell brandHref="/workspace">
        <main className="workspace-consent-gate">
          <section className="workspace-consent-card" role="alert" aria-live="assertive">
            <h1>We need to verify your acknowledgement.</h1>
            <p>{consentError}</p>
            <button type="button" className="workspace-primary" onClick={() => void loadConsent()}>
              Try again
            </button>
          </section>
        </main>
      </AppShell>
    );
  }

  if (consentState === "required") {
    return (
      <AppShell brandHref="/workspace">
        <main className="workspace-consent-gate">
          <section className="workspace-consent-card" aria-labelledby="workspace-consent-title">
            <p className="solenos-home-eyebrow">Before you continue</p>
            <h1 id="workspace-consent-title">Review how SolenOS handles care information.</h1>
            <p>
              Please review the Terms of Service and Privacy Policy and confirm
              the required privacy and safety acknowledgements. This is a
              one-time step for this caregiver identity. Optional improvement
              feedback remains separate and is not enabled by this acknowledgement.
            </p>
            <EarlyAccessConsentForm
              continueHref=""
              continueLabel="Agree and continue"
              onConsentDone={() => setConsentState("verified")}
            />
          </section>
        </main>
      </AppShell>
    );
  }

  return (
    <>
      {recordLoadError ? (
        <div className="workspace-connection-alert" role="alert" aria-live="assertive">
          <p>
            Your Care Record could not be loaded. Your saved information has not been confirmed as current.
            Reconnect before relying on the information shown here.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry connection
          </button>
        </div>
      ) : null}
      {children}
    </>
  );
}

/**
 * Visual workspace composition only. Session bootstrap and care-record loading
 * remain owned by WorkspaceProvider; display preferences and navigation
 * accessibility are mounted alongside, rather than inside, the page content.
 */
export function WorkspaceShellContent({ children }: { children: ReactNode }) {
  return (
    <WorkspaceEntryGate>
      <AppShell brandHref="/workspace" careContext={<CareContextBar />}>
        <WorkspaceRouteBreadcrumbs />
        {children}
      </AppShell>
      <WorkspaceNavigationAccessibility />
      <GlobalDisplayPreferences />
    </WorkspaceEntryGate>
  );
}
