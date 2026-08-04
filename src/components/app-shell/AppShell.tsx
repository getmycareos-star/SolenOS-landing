"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  FileText,
  Settings,
  Plus,
  PlusCircle,
  Upload,
  Camera,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { SolenosWordmark } from "@/components/brand";
import { Button } from "@/components/ui/Button";

type NavItem = {
  href: string;
  label: string;
  icon?: string;
};

type AppShellProps = {
  children: ReactNode;
  navItems?: readonly NavItem[];
  careContext?: ReactNode;
  brandHref?: string;
  onMenuToggle?: () => void;
};

/** Tab icons per position — Care Record, Timeline, Documents, Settings. */
const TAB_ICONS: LucideIcon[] = [BookOpen, FileText, FileText, Settings];

const FALLBACK_TABS: NavItem[] = [
  { href: "/workspace", label: "Care Record", icon: "◉" },
  { href: "/workspace/timeline", label: "Timeline", icon: "◷" },
  { href: "/workspace/documents", label: "Documents", icon: "📄" },
  { href: "/workspace/settings", label: "Settings", icon: "⚙" },
];

type FABActionId = "record" | "upload" | "capture" | "share";

const FAB_ACTIONS: { id: FABActionId; label: string; icon: LucideIcon }[] = [
  { id: "record", label: "Add Record", icon: PlusCircle },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "capture", label: "Capture", icon: Camera },
  { id: "share", label: "Share", icon: Share2 },
];

/**
 * SolenOS mobile app shell.
 * Fixed bottom tab bar (Care Record | Timeline | Documents | Settings) with
 * active accent underline, a FAB above the bar opening an Add bottom sheet,
 * and real-data care context supplied by the workspace layout.
 */
export function AppShell({
  children,
  navItems,
  careContext,
  brandHref = "/",
  onMenuToggle,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [fabOpen, setFabOpen] = useState(false);

  const tabs = navItems && navItems.length > 0 ? navItems : FALLBACK_TABS;

  const isNavActive = (href: string) =>
    href === "/workspace" ? pathname === href : pathname.startsWith(href);

  const handleFabAction = (href: string | undefined) => {
    setFabOpen(false);
    if (href) router.push(href);
  };

  useEffect(() => {
    setFabOpen(false);
  }, [pathname]);

  return (
    <div className="solenos-shell mobile-app-shell">
      {/* Compact brand header — wordmark only, no dropdown, no MENU */}
      <header className="mobile-app-header">
        <Link href={brandHref} className="mobile-app-brandlink">
          <SolenosWordmark size="sm" as="span" />
        </Link>
      </header>

      {careContext && <div className="care-context-bar">{careContext}</div>}

      <main className="mobile-app-main">{children}</main>

      {/* Floating Action Button + Add bottom sheet */}
      <div className="mobile-fab">
        {fabOpen && (
          <div className="mobile-fab-sheet" role="dialog" aria-label="Add to record">
            <p className="mobile-fab-sheet-title">Add to record</p>
            {FAB_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant="secondary"
                  className="mobile-fab-sheet-item"
                  onClick={() => handleFabAction("/workspace")}
                >
                  <Icon size={18} aria-hidden />
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}
        <Button
          variant="primary"
          className="mobile-fab-button"
          aria-label={fabOpen ? "Close add menu" : "Add to record"}
          aria-expanded={fabOpen}
          onClick={() => setFabOpen((v) => !v)}
        >
          <Plus size={24} aria-hidden />
        </Button>
      </div>

      {/* Bottom tab bar — ICON + label, active accent underline */}
      <nav className="mobile-tabbar" aria-label="Primary">
        {tabs.map((tab, i) => {
          const Icon = TAB_ICONS[i] ?? TAB_ICONS[0];
          const isActive = isNavActive(tab.href);
          return (
            <button
              key={tab.href}
              type="button"
              className={`mobile-tabbar-item${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => router.push(tab.href)}
            >
              <span className="mobile-tabbar-icon">
                <Icon size={20} aria-hidden />
              </span>
              <span className="mobile-tabbar-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
