"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { WORKSPACE_NAVIGATION, WORKSPACE_SECONDARY_NAVIGATION } from "@/lib/workspace-navigation";
import { SolenosWordmark } from "@/components/brand";
const ShareCareSummaryPanel = dynamic(() => import("@/components/mvp-workspace/share/ShareCareSummaryPanel").then((module) => module.ShareCareSummaryPanel), { ssr: false });
import { ensureAnonymousSession, getAnonymousAccessToken, getJSON, markAnonymousSessionRevokedLocally, revokeAnonymousSession } from "@/api/client";
import { caregiverSafeErrorMessage } from "@/lib/caregiver-language";
import { ensureClientInteractionSessionId } from "@/lib/care-identity/durable-care-key";
import { WorkspaceMoreMenu, type WorkspaceAction } from "@/components/mvp-workspace/WorkspaceMoreMenu";

const CareRecordOverview = dynamic(
  () => import("@/components/app-shell/CareRecordOverview").then((module) => module.CareRecordOverview),
  { ssr: false, loading: () => <p className="solenos-record-details-loading">Loading saved care details…</p> },
);

type AppShellProps = {
  children: ReactNode;
  careContext?: ReactNode;
  brandHref?: string;
};

type SharePanelContext = { caregiverId: string; careSessionId: string; careRecipientName?: string };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const LOCAL_WORKSPACE_KEYS = [
  // Current and legacy browser identity credentials. Deleting this workspace
  // must revoke the token and remove every local identifier and expiry value.
  "solenos_anonymous_access_token",
  "solenos_backend_person_id",
  "solenos_backend_caregiver_id",
  "solenos_anonymous_session_expires_at",
  "solenos_person_id",
  "solenos_durable_care_key",
  "solenos_care_session_id",
  "solenos_telemetry_user_id",
  "solenos_situations",
  "solenos_timeline",
  "solenos_active_situation_id",
  "solenos_care_recipient_display_name",
  "solenos_care_profile",
  "solenos_care_recipient_id",
  "solenos_last_input_raw",
  "solenos_notif_prefs",
  "solenos_data_training",
  "solenos_language_preference",
  "solenos_early_access_consent_v1",
  "onboarding_complete",
  "onboarding_complete_at",
  "solenos_workspace_pinned",
  "solenos_workspace_archived",
] as const;

export function AppShell({ children, careContext, brandHref = "/workspace" }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [sharePanelContext, setSharePanelContext] = useState<SharePanelContext | null>(null);
  const [sharePanelIntent, setSharePanelIntent] = useState<"share" | "export">("share");
  const [recordDetailsOpen, setRecordDetailsOpen] = useState(false);
  const recordDetailsReturnFocusRef = useRef<HTMLElement | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem("solenos_sidebar_collapsed") === "1");
    } catch {
      setSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
    try {
      performance.mark("solenos.workspace.route-mounted");
      if (performance.getEntriesByName("solenos.workspace.navigation-click", "mark").length > 0) {
        performance.measure("solenos.workspace.navigation-to-route-mounted", {
          start: "solenos.workspace.navigation-click",
          end: "solenos.workspace.route-mounted",
        });
        performance.clearMarks("solenos.workspace.navigation-click");
      }
      performance.clearMarks("solenos.workspace.route-mounted");
    } catch {
      // Local timing instrumentation must never affect navigation.
    }
  }, [pathname]);

  useEffect(() => {
    if (!recordDetailsOpen) return;

    const dialog = document.querySelector<HTMLElement>(".solenos-record-details-dialog");
    if (!dialog) return;

    const background = [
      ".solenos-chat-sidebar-host",
      ".solenos-chat-topbar",
      ".solenos-chat-main",
      ".solenos-workspace-action-notice",
    ]
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((element): element is HTMLElement => Boolean(element));
    const previousInertStates = background.map((element) => ({
      element,
      inert: element.inert,
    }));
    previousInertStates.forEach(({ element }) => {
      element.inert = true;
    });

    const getFocusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");

    getFocusableElements()[0]?.focus({ preventScroll: true });
    const handleDialogKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setRecordDetailsOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeydown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeydown);
      previousInertStates.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      const returnFocus = recordDetailsReturnFocusRef.current;
      recordDetailsReturnFocusRef.current = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [recordDetailsOpen]);

  useEffect(() => {
    try {
      setIsPinned(window.localStorage.getItem("solenos_workspace_pinned") === "1");
      setIsArchived(window.localStorage.getItem("solenos_workspace_archived") === "1");
    } catch {
      setIsPinned(false);
      setIsArchived(false);
    }
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  const handleWorkspaceAction = useCallback(async (action: WorkspaceAction) => {
    switch (action) {
      case "share_care_summary":
      case "download_export": {
        try {
          const session = await ensureAnonymousSession();
          const storedSessionId = window.localStorage.getItem("solenos_care_session_id");
          const careSessionId = ensureClientInteractionSessionId(storedSessionId);
          window.localStorage.setItem("solenos_care_session_id", careSessionId);
          const careProfile = await getJSON("/care-profile") as { name?: string };
          const careRecipientName = careProfile.name?.trim() || undefined;
          setSharePanelIntent(action === "download_export" ? "export" : "share");
          setSharePanelContext({
            caregiverId: session.caregiver.id,
            careSessionId,
            careRecipientName,
          });
        } catch {
          window.alert(caregiverSafeErrorMessage());
        }
        return;
      }
      case "edit_record": {
        router.push("/workspace/daily-care");
        return;
      }
      case "view_record_details": {
        recordDetailsReturnFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setRecordDetailsOpen(true);
        return;
      }
      case "pin":
      case "unpin": {
        const next = action === "pin";
        try {
          window.localStorage.setItem("solenos_workspace_pinned", next ? "1" : "0");
          setIsPinned(next);
          setActionNotice(next ? "This workspace is pinned on this device." : "This workspace is no longer pinned.");
        } catch {
          window.alert("This browser could not save the pin preference. No change was made.");
        }
        return;
      }
      case "archive": {
        if (!window.confirm("Archive this workspace on this device? This hides the workspace here only. It does not archive or change care information stored on SolenOS. You can restore this view later.")) return;
        try {
          window.localStorage.setItem("solenos_workspace_archived", "1");
          setIsArchived(true);
          setActionNotice("This workspace is archived on this device. Choose Restore from the menu to bring it back.");
        } catch {
          window.alert("This browser could not save the archive preference. No change was made.");
        }
        return;
      }
      case "restore": {
        try {
          window.localStorage.removeItem("solenos_workspace_archived");
          setIsArchived(false);
          setActionNotice("This workspace has been restored.");
        } catch {
          window.alert("This browser could not restore the workspace. No change was made.");
        }
        return;
      }
      case "delete": {
        if (!window.confirm("Clear this device? This removes local session and workspace data from this browser. It does not delete care information already saved in SolenOS. Continue?")) return;
        try {
          if (getAnonymousAccessToken()) await revokeAnonymousSession();
          else markAnonymousSessionRevokedLocally();
          const ownedKeys = new Set<string>(LOCAL_WORKSPACE_KEYS);
          for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index);
            if (
              key &&
              (key.startsWith("solenos_") ||
                key.startsWith("solenos:") ||
                key === "onboarding_complete" ||
                key === "onboarding_complete_at")
            ) {
              ownedKeys.add(key);
            }
          }
          // Keep the tombstone: only an explicit Care Record entry may create
          // a replacement identity after this workspace is deleted.
          ownedKeys.delete("solenos_anonymous_session_revoked");
          ownedKeys.forEach((key) => window.localStorage.removeItem(key));
          try {
            window.sessionStorage.clear();
          } catch {
            // The local deletion boundary remains in place if sessionStorage is unavailable.
          }
        } catch {
          window.alert("We couldn't confirm your access to SolenOS, so nothing was cleared. Check your connection and try again.");
          return;
        }
        window.location.assign("/start");
        return;
      }
      case "add_to_home": {
        if (!installPrompt) {
          window.alert(
            "To add SolenOS to your home screen:\n\n" +
              "iPhone or iPad: Open the Share menu in Safari, then choose Add to Home Screen.\n" +
              "Android: Open the browser menu, then choose Add to Home screen.\n" +
              "Desktop: Use the install icon in the browser address bar when available.",
          );
          return;
        }
        try {
          await installPrompt.prompt();
          await installPrompt.userChoice;
        } catch {
          window.alert("The browser could not open its install prompt. Use the browser's Add to Home Screen option.");
        } finally {
          setInstallPrompt(null);
        }
        return;
      }
    }
  }, [installPrompt, router]);

  const active = (href: string) => {
    if (href === "/workspace") return pathname === href;
    if (href === "/workspace/more") {
      return pathname === href || WORKSPACE_SECONDARY_NAVIGATION.some((item) =>
        pathname === item.href || pathname.startsWith(item.href + "/"),
      );
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className={`solenos-chat-app${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
      {sidebarOpen && (
        <button
          type="button"
          className="solenos-chat-mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`solenos-chat-sidebar-host${sidebarOpen ? " is-sidebar-open" : ""}`}>
        <aside id="solenos-navigation" className="solenos-chat-sidebar" aria-label="SolenOS navigation">
          <div className="solenos-chat-sidebar-top">
            <Link href={brandHref} className="solenos-chat-brand" aria-label="SolenOS home">
              <span className="solenos-chat-brand-mark" aria-hidden="true">S</span>
              <SolenosWordmark size="sm" as="span" />
            </Link>
            <button
              type="button"
              className="solenos-sidebar-icon-button solenos-sidebar-collapse-button"
              aria-label={sidebarOpen ? "Close navigation" : sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={sidebarOpen || !sidebarCollapsed}
              aria-controls="solenos-navigation"
              title={sidebarOpen ? "Close navigation" : sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => {
                if (window.matchMedia("(max-width: 900px)").matches) {
                  setSidebarOpen(false);
                  return;
                }
                setSidebarCollapsed((value) => {
                  const next = !value;
                  try { window.localStorage.setItem("solenos_sidebar_collapsed", next ? "1" : "0"); } catch { /* Optional preference only. */ }
                  return next;
                });
              }}
            >
              {sidebarOpen || !sidebarCollapsed ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
            </button>
          </div>

          <nav className="solenos-chat-primary-nav" aria-label="Primary navigation">
            <div className="solenos-chat-nav-group" role="group" aria-labelledby="solenos-nav-care-heading">
              <p id="solenos-nav-care-heading" className="solenos-chat-nav-heading">CARE</p>
              {WORKSPACE_NAVIGATION.care.map(({ id, href, label, description, icon: Icon }) => (
                <Link
                  key={id}
                  href={href}
                  prefetch={false}
                  title={label}
                  aria-label={label}
                  className={`solenos-chat-nav-item${active(href) ? " is-active" : ""}`}
                  aria-current={active(href) ? "page" : undefined}
                  onMouseEnter={() => router.prefetch(href)}
                  onFocus={() => router.prefetch(href)}
                  onTouchStart={() => router.prefetch(href)}
                  onClick={() => { try { performance.mark("solenos.workspace.navigation-click"); } catch { /* Optional instrumentation. */ } setSidebarOpen(false); }}
                >
                  <span className="solenos-chat-nav-icon"><Icon size={19} strokeWidth={1.8} /></span>
                  <span className="solenos-chat-nav-copy">
                    <span className="solenos-chat-nav-label">{label}</span>
                    <span className="solenos-chat-nav-description">{description}</span>
                  </span>
                </Link>
              ))}
            </div>

          </nav>

          <div className="solenos-chat-sidebar-bottom">
            {WORKSPACE_NAVIGATION.settings.map(({ id, href, label, description, icon: Icon }) => (
              <Link
                key={id}
                href={href}
                prefetch={false}
                title={label}
                  aria-label={label}
                  className={`solenos-chat-nav-item${active(href) ? " is-active" : ""}`}
                aria-current={active(href) ? "page" : undefined}
                onMouseEnter={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
                onTouchStart={() => router.prefetch(href)}
                onClick={() => { try { performance.mark("solenos.workspace.navigation-click"); } catch { /* Optional instrumentation. */ } setSidebarOpen(false); }}
              >
                <span className="solenos-chat-nav-icon"><Icon size={19} strokeWidth={1.8} /></span>
                <span className="solenos-chat-nav-copy">
                  <span className="solenos-chat-nav-label">{label}</span>
                  <span className="solenos-chat-nav-description">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </div>

      <div className="solenos-chat-workspace">
        <header className="solenos-chat-topbar">
          <button
            type="button"
            className="solenos-sidebar-icon-button solenos-sidebar-toggle"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            aria-controls="solenos-navigation"
            onClick={() => setSidebarOpen((value) => !value)}
          >
            {sidebarOpen ? <X size={19} /> : <Menu size={19} />}
            <span className="solenos-sidebar-toggle-label">{sidebarOpen ? "Close" : "Menu"}</span>
          </button>
          <button
            type="button"
            className="solenos-sidebar-icon-button mobile-sidebar-brand"
            aria-label="SolenOS home"
            onClick={() => router.push(brandHref)}
          >
            <span className="solenos-chat-brand-mark">S</span>
          </button>
          <div className="solenos-chat-topbar-context">{careContext}</div>
          {pathname === "/workspace" && (
            <WorkspaceMoreMenu
              onAction={(action) => void handleWorkspaceAction(action)}
              isPinned={isPinned}
              isArchived={isArchived}
            />
          )}
        </header>
        {actionNotice && <p role="status" className="solenos-workspace-action-notice">{actionNotice}</p>}
        <main className="solenos-chat-main">
          {pathname === "/workspace" && isArchived ? (
            <section className="panel" aria-label="Archived workspace">
              <h2 className="workspace-headline">Workspace archived</h2>
              <p className="panel-muted">This workspace is hidden on this device. Care information stored on SolenOS has not been deleted.</p>
            </section>
          ) : children}
        </main>
        {recordDetailsOpen && (
          <div className="solenos-record-details-backdrop">
            <button type="button" className="solenos-record-details-dismiss" aria-hidden="true" tabIndex={-1} onClick={() => setRecordDetailsOpen(false)} />
            <section className="solenos-record-details-dialog" role="dialog" aria-modal="true" aria-labelledby="solenos-record-details-title" tabIndex={-1}>
              <header className="solenos-record-details-header">
                <div>
                  <p>YOUR CARE RECORD</p>
                  <h2 id="solenos-record-details-title">Care record details</h2>
                  <span>Saved information, recorded changes, and what remains uncertain.</span>
                </div>
                <button type="button" aria-label="Close care record details" onClick={() => setRecordDetailsOpen(false)}>
                  <X size={20} aria-hidden />
                </button>
              </header>
              <div className="solenos-record-details-content"><CareRecordOverview /></div>
            </section>
          </div>
        )}
        {sharePanelContext && (
          <ShareCareSummaryPanel
            caregiverId={sharePanelContext.caregiverId}
            careSessionId={sharePanelContext.careSessionId}
            careRecipientName={sharePanelContext.careRecipientName}
            intent={sharePanelIntent}
            onClose={() => {
              setSharePanelContext(null);
              setSharePanelIntent("share");
            }}
          />
        )}
      </div>
    </div>
  );
}
