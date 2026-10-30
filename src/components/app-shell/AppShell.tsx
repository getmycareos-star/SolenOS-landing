"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays, FileText, Handshake, MessageCircle,
  Menu, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck,
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const active = (href: string) => href === "/workspace"
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  const sidebar = (
    <aside className={`solenos-chat-sidebar${collapsed ? " is-collapsed" : ""}`} aria-label="SolenOS navigation">
      <div className="solenos-chat-sidebar-top">
        <Link href={brandHref} className="solenos-chat-brand" aria-label="SolenOS home">
          <span className="solenos-chat-brand-mark" aria-hidden="true">S</span>
          {!collapsed && <SolenosWordmark size="sm" as="span" />}
        </Link>
        <button type="button" className="solenos-sidebar-icon-button desktop-collapse" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
        <button type="button" className="solenos-sidebar-icon-button mobile-sidebar-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>×</button>
      </div>

      <nav className="solenos-chat-primary-nav" aria-label="Primary navigation">
        <button type="button" className="solenos-chat-nav-item" title="Search history" onClick={() => {
          const input = document.querySelector<HTMLInputElement>(".history-search-wrap input");
          if (input) { input.focus(); input.scrollIntoView({ block: "nearest" }); }
        }}>
          <span className="solenos-chat-nav-icon"><SearchIcon /></span>
          {!collapsed && <span>Search history</span>}
        </button>
        {NAVIGATION.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`solenos-chat-nav-item${active(href) ? " is-active" : ""}`} aria-current={active(href) ? "page" : undefined} title={label}>
            <span className="solenos-chat-nav-icon"><Icon size={19} strokeWidth={1.8} /></span>
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>

      {!collapsed && (
        <div className="solenos-chat-history-section">
          <div className="solenos-chat-history-heading">Recent history</div>
          <HistoryDrawer />
        </div>
      )}

      <div className="solenos-chat-sidebar-bottom">
        <Link href="/workspace/settings" className={`solenos-chat-nav-item${active("/workspace/settings") ? " is-active" : ""}`} title="Settings">
          <span className="solenos-chat-nav-icon"><Settings size={19} /></span>
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="solenos-chat-app">
      {mobileOpen && <button className="solenos-chat-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <div className={`solenos-chat-sidebar-host${mobileOpen ? " is-mobile-open" : ""}`}>
        {sidebar}
      </div>
      <div className="solenos-chat-workspace">
        <header className="solenos-chat-topbar">
          <button type="button" className="solenos-sidebar-icon-button mobile-sidebar-open" aria-label="Open navigation" onClick={() => { setCollapsed(false); setMobileOpen(true); }}><Menu size={21} /></button>
          <button type="button" className="solenos-sidebar-icon-button mobile-sidebar-brand" aria-label="SolenOS home" onClick={() => router.push(brandHref)}><span className="solenos-chat-brand-mark">S</span></button>
          <div className="solenos-chat-topbar-context">{careContext}</div>

        </header>
        <main className="solenos-chat-main">{children}</main>
      </div>
    </div>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></svg>;
}
