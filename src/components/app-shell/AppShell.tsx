"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, FileText, Home, Menu, MessageCircle, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { CARE_INFORMATION_NAVIGATION, WORKSPACE_NAVIGATION, WORKSPACE_SECONDARY_NAVIGATION } from "@/lib/workspace-navigation";
import { SolenosWordmark } from "@/components/brand";
const ShareCareSummaryPanel = dynamic(() => import("@/components/mvp-workspace/share/ShareCareSummaryPanel").then((module) => module.ShareCareSummaryPanel), { ssr: false });
import { ensureAnonymousSession, getAnonymousAccessToken, getJSON, markAnonymousSessionRevokedLocally, revokeAnonymousSession } from "@/api/client";
import { caregiverSafeErrorMessage } from "@/lib/caregiver-language";
import { ensureClientInteractionSessionId } from "@/lib/care-identity/durable-care-key";
import { clearDurableWriteQueue } from "@/lib/offline-sync/durable-write-queue";
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
  const [careInformationExpanded, setCareInformationExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [sharePanelContext, setSharePanelContext] = useState<SharePanelContext | null>(null);
  const [sharePanelIntent, setSharePanelIntent] = useState<"share" | "export">("share");
  const [recordDetailsOpen, setRecordDetailsOpen] = useState(false);
  const recordDetailsReturnFocusRef = useRef<HTMLElement | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let requestVersion = 0;
    const refreshUnreadCount = async () => {
      const requestId = ++requestVersion;
      try {
        await ensureAnonymousSession();
        const result = await getJSON("/notifications/unread-count") as { unread_count?: unknown };
        if (!active || requestId !== requestVersion) return;
        const count = Number(result?.unread_count);
        setUnreadNotificationCount(Number.isFinite(count) ? Math.max(0, Math.floor(count)) : null);
      } catch {
        if (active && requestId === requestVersion) setUnreadNotificationCount(null);
      }
    };
    const refreshForPersonChange = () => {
      requestVersion += 1;
      setUnreadNotificationCount(null);
      void refreshUnreadCount();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshUnreadCount();
    };
    void refreshUnreadCount();
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("personIdChanged", refreshForPersonChange);
    window.addEventListener("solenos:notifications-updated", refreshUnreadCount);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("personIdChanged", refreshForPersonChange);
      window.removeEventListener("solenos:notifications-updated", refreshUnreadCount);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathname]);

  useEffect(() => {
    const isCareInformationRoute = pathname === "/workspace/care-continuity" || CARE_INFORMATION_NAVIGATION.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
    if (isCareInformationRoute) setCareInformationExpanded(true);
  }, [pathname]);

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
        if (!window.confirm("Clear this device? This removes local session and workspace data, including unsent updates stored only in this browser. Those unsent updates have not reached SolenOS and will be deleted from this device. An update already being sent may still reach SolenOS. It does not delete care information already saved in SolenOS. Continue?")) return;
        let accessRevoked = false;
        let offlineQueueCleared = false;
        try {
          await clearDurableWriteQueue(() => {
            window.alert("SolenOS is waiting for another tab to close before clearing device-only updates. Close other SolenOS tabs and keep this page open; clearing will continue automatically.");
          });
          offlineQueueCleared = true;
          if (getAnonymousAccessToken()) await revokeAnonymousSession();
          else markAnonymousSessionRevokedLocally();
          accessRevoked = true;
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
        } catch (cause) {
          // Keep implementation diagnostics out of the caregiver alert.
          console.error("SolenOS device cleanup failed", cause);
          window.alert(!offlineQueueCleared
            ? "We couldn't remove unsent updates from this device, so no other local information was cleared. Close other SolenOS tabs and try again."
            : accessRevoked
              ? "Your SolenOS access was revoked, but some other device information could not be cleared. Try again after closing other SolenOS tabs."
              : "Unsent updates were removed, but we couldn't confirm your access to SolenOS. Your other local information was not cleared. Check your connection and try again.");
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
    if (href === "/workspace/care-continuity") {
      return pathname === href || CARE_INFORMATION_NAVIGATION.some((item) =>
        pathname === item.href || pathname.startsWith(item.href + "/"),
      );
    }
    if (href === "/workspace/more") {
      return pathname === href || WORKSPACE_SECONDARY_NAVIGATION.some((item) =>
        pathname === item.href || pathname.startsWith(item.href + "/"),
      );
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className={`solenos-chat-app${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
      <a className="solenos-skip-link" href="#solenos-main-content">Skip to main content</a>
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
              {WORKSPACE_NAVIGATION.care.map(({ id, href, label, description, icon: Icon }) => {
                const link = (
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
                );
                if (id !== "care-information") return link;
                return (
                  <div className="solenos-chat-nav-nested-group" key={id}>
                    <div className="solenos-chat-nav-parent-row">
                      {link}
                      <button
                        type="button"
                        className="solenos-chat-nav-expand"
                        aria-label={careInformationExpanded ? "Collapse Care information sections" : "Expand Care information sections"}
                        aria-expanded={careInformationExpanded}
                        aria-controls="solenos-care-information-subnav"
                        onClick={() => { if (sidebarCollapsed) { setSidebarCollapsed(false); try { window.localStorage.setItem("solenos_sidebar_collapsed", "0"); } catch { /* Optional preference only. */ } } setCareInformationExpanded((expanded) => !expanded); }}
                      >
                        <span aria-hidden="true">{careInformationExpanded ? "−" : "+"}</span>
                      </button>
                    </div>
                    <div id="solenos-care-information-subnav" className="solenos-chat-nav-subnav" role="group" aria-label="Care information sections" hidden={!careInformationExpanded}>
                      {CARE_INFORMATION_NAVIGATION.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = active(child.href);
                        return (
                          <Link
                            key={child.id}
                            href={child.href}
                            prefetch={false}
                            className={`solenos-chat-nav-subitem${childActive ? " is-active" : ""}`}
                            aria-current={childActive ? "page" : undefined}
                            onMouseEnter={() => router.prefetch(child.href)}
                            onFocus={() => router.prefetch(child.href)}
                            onClick={() => { try { performance.mark("solenos.workspace.navigation-click"); } catch { /* Optional instrumentation. */ } setSidebarOpen(false); }}
                          >
                            <span className="solenos-chat-nav-subicon"><ChildIcon size={16} strokeWidth={1.8} /></span>
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
          <Link href="/workspace/notifications" className={`solenos-notification-shortcut${active("/workspace/notifications") ? " is-active" : ""}`} aria-current={active("/workspace/notifications") ? "page" : undefined} aria-label={unreadNotificationCount && unreadNotificationCount > 0 ? `Notifications, ${unreadNotificationCount} unread` : "Notifications"} title={unreadNotificationCount && unreadNotificationCount > 0 ? `${unreadNotificationCount} unread notifications` : "Notifications"}>
            <Bell size={19} aria-hidden="true" />
            {unreadNotificationCount !== null && unreadNotificationCount > 0 && (
              <span className="solenos-notification-count" aria-hidden="true">{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</span>
            )}
          </Link>
          {pathname === "/workspace" && (
            <WorkspaceMoreMenu
              onAction={(action) => void handleWorkspaceAction(action)}
              isPinned={isPinned}
              isArchived={isArchived}
            />
          )}
        </header>
        {actionNotice && <p role="status" className="solenos-workspace-action-notice">{actionNotice}</p>}
        <main id="solenos-main-content" tabIndex={-1} className="solenos-chat-main">
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
        <nav className="solenos-mobile-bottom-nav" aria-label="Main destinations">
          <Link href="/workspace" aria-current={active("/workspace") ? "page" : undefined} className={active("/workspace") ? "is-active" : ""}>
            <Home size={19} aria-hidden="true" /><span>Today</span>
          </Link>
          <Link href="/workspace/care-continuity" aria-current={active("/workspace/care-continuity") ? "page" : undefined} className={active("/workspace/care-continuity") ? "is-active" : ""}>
            <FileText size={19} aria-hidden="true" /><span>Care</span>
          </Link>
          <Link href="/workspace/companion" aria-current={active("/workspace/companion") ? "page" : undefined} className={active("/workspace/companion") ? "is-active" : ""}>
            <MessageCircle size={19} aria-hidden="true" /><span>Ask</span>
          </Link>
          <Link href="/workspace/more" aria-current={active("/workspace/more") ? "page" : undefined} className={active("/workspace/more") ? "is-active" : ""}>
            <MoreHorizontal size={19} aria-hidden="true" /><span>More</span>
          </Link>
        </nav>
        <Link href="/workspace/daily-care" className="solenos-mobile-add-update">
          <Plus size={18} aria-hidden="true" /><span>Add an update</span>
        </Link>
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
