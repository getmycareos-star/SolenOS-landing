"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  FileText,
  Handshake,
  MessageCircle,
  Menu,
  PanelLeftClose,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { SolenosWordmark } from "@/components/brand";
import { HistoryDrawer } from "@/components/app-shell/HistoryDrawer";
import { ShareCareSummaryPanel } from "@/components/mvp-workspace/share/ShareCareSummaryPanel";
import { ensureAnonymousSession } from "@/api/client";
import { ensureClientInteractionSessionId } from "@/lib/care-identity";
import { WorkspaceMoreMenu, type WorkspaceAction } from "@/components/mvp-workspace/WorkspaceMoreMenu";

type NavItem = { href: string; label: string; icon?: string };
type AppShellProps = {
  children: ReactNode;
  navItems?: readonly NavItem[];
  careContext?: ReactNode;
  brandHref?: string;
  onMenuToggle?: () => void;
};

type SharePanelContext = { caregiverId: string; careSessionId: string; careRecipientName?: string };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const NAVIGATION = [
  { href: "/workspace", label: "AI Companion", icon: MessageCircle },
  { href: "/workspace/daily-care", label: "Daily Care", icon: CalendarDays },
  { href: "/workspace/documents", label: "Documents", icon: FileText },
  { href: "/workspace/handoffs", label: "Care Handoffs", icon: Handshake },
  { href: "/workspace/appointments", label: "Appointments", icon: ShieldCheck },
] as const;

const LOCAL_WORKSPACE_KEYS = [
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
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [sharePanelContext, setSharePanelContext] = useState<SharePanelContext | null>(null);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
      case "share_care_summary": {
        try {
          const session = await ensureAnonymousSession();
          const storedSessionId = window.localStorage.getItem("solenos_care_session_id");
          const careSessionId = ensureClientInteractionSessionId(storedSessionId);
          window.localStorage.setItem("solenos_care_session_id", careSessionId);
          const careRecipientName = window.localStorage.getItem("solenos_care_recipient_display_name")?.trim() || undefined;
          setSharePanelContext({
            caregiverId: session.caregiver.id,
            careSessionId,
            careRecipientName,
          });
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "The care session could not be opened for sharing.");
        }
        return;
      }
      case "pin":
      case "unpin": {
        const next = action === "pin";
        try {
          window.localStorage.setItem("solenos_workspace_pinned", next ? "1" : "0");
          setIsPinned(next);
        } catch {
          window.alert("This browser could not save the pin preference. No change was made.");
        }
        return;
      }
      case "archive": {
        if (!window.confirm("Hide this workspace on this device? This does not delete or server-archive care information. You can restore it later.")) return;
        try {
          window.localStorage.setItem("solenos_workspace_archived", "1");
          setIsArchived(true);
        } catch {
          window.alert("This browser could not save the archive preference. No change was made.");
        }
        return;
      }
      case "restore": {
        try {
          window.localStorage.removeItem("solenos_workspace_archived");
          setIsArchived(false);
        } catch {
          window.alert("This browser could not restore the workspace. No change was made.");
        }
        return;
      }
      case "delete": {
        if (!window.confirm("Clear this workspace from this device? This removes local session and workspace data from this browser. It does not delete care information already stored on SolenOS servers. Continue?")) return;
        try {
          LOCAL_WORKSPACE_KEYS.forEach((key) => window.localStorage.removeItem(key));
        } catch {
          window.alert("This browser could not clear all local workspace data. The operation may be incomplete; review browser storage before continuing.");
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
          const choice = await installPrompt.userChoice;
          if (choice.outcome === "accepted") setInstallPrompt(null);
        } catch {
          window.alert("The browser could not open its install prompt. Use the browser's Add to Home Screen option.");
        }
        return;
      }
    }
  }, [installPrompt]);

  const active = (href: string) =>
    href === "/workspace"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="solenos-chat-app">
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
              className="solenos-sidebar-icon-button"
              aria-label="Close navigation"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose size={19} />
            </button>
          </div>

          <nav className="solenos-chat-primary-nav" aria-label="Primary navigation">
            <button type="button" className="solenos-chat-nav-item" onClick={() => {
              const input = document.querySelector<HTMLInputElement>(".history-search-wrap input");
              input?.focus();
              input?.scrollIntoView({ block: "nearest" });
            }}>
              <span className="solenos-chat-nav-icon"><Search size={19} strokeWidth={1.8} /></span>
              <span>Search history</span>
            </button>
            {NAVIGATION.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`solenos-chat-nav-item${active(href) ? " is-active" : ""}`}
                aria-current={active(href) ? "page" : undefined}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="solenos-chat-nav-icon"><Icon size={19} strokeWidth={1.8} /></span>
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="solenos-chat-history-section">
            <div className="solenos-chat-history-heading">Recent history</div>
            <HistoryDrawer />
          </div>

          <div className="solenos-chat-sidebar-bottom">
            <Link
              href="/workspace/settings"
              className={`solenos-chat-nav-item${active("/workspace/settings") ? " is-active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="solenos-chat-nav-icon"><Settings size={19} /></span>
              <span>Settings</span>
            </Link>
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
            <Menu size={21} />
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
        <main className="solenos-chat-main">
          {pathname === "/workspace" && isArchived ? (
            <section className="panel" aria-label="Archived workspace">
              <h2 className="workspace-headline">Workspace archived</h2>
              <p className="panel-muted">This workspace is hidden on this device. Care information stored on SolenOS has not been deleted.</p>
            </section>
          ) : children}
        </main>
        {sharePanelContext && (
          <ShareCareSummaryPanel
            caregiverId={sharePanelContext.caregiverId}
            careSessionId={sharePanelContext.careSessionId}
            careRecipientName={sharePanelContext.careRecipientName}
            onClose={() => setSharePanelContext(null)}
          />
        )}
      </div>
    </div>
  );
}
