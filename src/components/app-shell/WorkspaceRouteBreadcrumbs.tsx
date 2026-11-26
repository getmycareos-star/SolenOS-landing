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

  const isHome = !current || current.href === "/workspace";
  const isCareInformationChild = CARE_INFORMATION_NAVIGATION.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  const isMoreChild = WORKSPACE_SECONDARY_NAVIGATION.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );

  const trail = isHome
    ? []
    : [
        { href: "/workspace", label: "Today" },
        ...(isCareInformationChild ? [{ href: "/workspace/care-continuity", label: "Care information" }] : []),
        ...(isMoreChild ? [{ href: "/workspace/more", label: "More" }] : []),
        ...(current ? [{ href: current.href, label: current.label }] : []),
      ].filter((item, index, all) => index === 0 || item.href !== all[index - 1]?.href);

  return (
    <nav className={`solenos-workspace-breadcrumbs${isHome ? " is-home" : ""}`} aria-label="Breadcrumb">
      <ol>
        {trail.map((item, index) => {
          const isCurrent = index === trail.length - 1;
          return (
            <li key={item.href}>
              {index > 0 && <span aria-hidden="true" className="solenos-workspace-breadcrumb-separator">/</span>}
              {isCurrent ? (
                <span aria-current="page" className="solenos-workspace-breadcrumb-current">{item.label}</span>
              ) : (
                <Link href={item.href}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
      <span className="solenos-visually-hidden" aria-live="polite" aria-atomic="true">{trail[trail.length - 1]?.label ?? "Today"} page</span>
    </nav>
  );
}
