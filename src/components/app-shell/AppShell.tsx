"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  FileText,
  Handshake,
  MessageCircle,
  Menu,
  PanelLeftClose,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { SolenosWordmark } from "@/components/brand";
import { HistoryDrawer } from "@/components/app-shell/HistoryDrawer";

type NavItem = { href: string; label: string; icon?: string };
type AppShellProps = {
  children: ReactNode;
  navItems?: readonly NavItem[];
  careContext?: ReactNode;
  brandHref?: string;
  onMenuToggle?: () => void;
};

const NAVIGATION = [
  { href: "/workspace", label: "AI Companion", icon: MessageCircle },
  { href: "/workspace/daily-care", label: "Daily Care", icon: CalendarDays },
  { href: "/workspace/documents", label: "Documents", icon: FileText },
  { href: "/workspace/handoffs", label: "Care Handoffs", icon: Handshake },
  { href: "/workspace/appointments", label: "Appointments", icon: ShieldCheck },
] as const;

export function AppShell({ children, careContext, brandHref = "/workspace" }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
        <aside className="solenos-chat-sidebar" aria-label="SolenOS navigation">
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
        </header>
        <main className="solenos-chat-main">{children}</main>
      </div>
    </div>
  );
}
