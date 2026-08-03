"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SolenosWordmark } from "@/components/brand";
import { BRAND_TAGLINE } from "@/lib/brand";
import { EARLY_ACCESS_BADGE } from "@/lib/early-access-trust";

type NavItem = {
  href: string;
  label: string;
  icon?: string;
};

type AppShellProps = {
  children: React.ReactNode;
  navItems: readonly NavItem[];
  careContext?: React.ReactNode;
  brandHref?: string;
  onMenuToggle?: () => void;
};

export function AppShell({
  children,
  navItems,
  careContext,
  brandHref = "/",
  onMenuToggle,
}: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    onMenuToggle?.();
  };

  return (
    <div className="solenos-shell workspace-shell">
      <header className="shell-header workspace-header">
        <div className="shell-brand">
          <button
            type="button"
            className="sidebar-toggle"
            aria-expanded={sidebarOpen}
            aria-controls="app-shell-nav"
            onClick={toggleSidebar}
          >
            Menu
          </button>
          <Link href={brandHref} className="shell-brand-link">
            <SolenosWordmark size="md" as="span" />
          </Link>
          <span className="early-access-badge" aria-label="Early Access">
            {EARLY_ACCESS_BADGE}
          </span>
          <p className="tagline">{BRAND_TAGLINE}</p>
        </div>
      </header>

      {careContext && (
        <div className="care-context-bar">
          {careContext}
        </div>
      )}

      <div className={`shell-body${sidebarOpen ? "" : " sidebar-collapsed"}`}>
        <div
          id="app-shell-nav"
          className={`sidebar-rail app-shell-sidebar${sidebarOpen ? " is-open" : ""}`}
        >
          <nav className="app-shell-nav" aria-label="Product">
            <ul className="app-shell-nav-list">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/workspace"
                    ? pathname === "/workspace"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`app-shell-nav-link${isActive ? " is-active" : ""}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      {item.icon && <span className="app-shell-nav-icon" aria-hidden="true">{item.icon}</span>}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="shell-main workspace-main">
          {children}
        </div>
      </div>
    </div>
  );
}
