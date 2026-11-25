"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CARE_INFORMATION_NAVIGATION, WORKSPACE_NAVIGATION, WORKSPACE_SECONDARY_NAVIGATION } from "@/lib/workspace-navigation";

const items = [
  ...WORKSPACE_NAVIGATION.care,
  ...WORKSPACE_NAVIGATION.settings,
  ...CARE_INFORMATION_NAVIGATION,
  ...WORKSPACE_SECONDARY_NAVIGATION,
];

export function WorkspaceRouteBreadcrumbs() {
  const pathname = usePathname();
  const current = [...items]
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((left, right) => right.href.length - left.href.length)[0];

  const label = current?.label || "Home";
  const isHome = !current || current.href === "/workspace";

  return (
    <nav className={`solenos-workspace-breadcrumbs${isHome ? " is-home" : ""}`} aria-label="Breadcrumb">
      <ol>
        {isHome ? (
          <li aria-current="page"><span className="solenos-workspace-breadcrumb-current">{label}</span></li>
        ) : (
          <>
            <li><Link href="/workspace">Care Record</Link></li>
            <li aria-hidden="true" className="solenos-workspace-breadcrumb-separator">/</li>
            <li aria-current="page"><span className="solenos-workspace-breadcrumb-current">{label}</span></li>
          </>
        )}
      </ol>
      <span className="solenos-visually-hidden" aria-live="polite" aria-atomic="true">{label} page</span>
    </nav>
  );
}
