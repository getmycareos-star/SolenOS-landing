"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type LandingStartLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
};

/** Mark the user-initiated transition without turning the public landing page into a client component. */
export function LandingStartLink({ href, className, children }: LandingStartLinkProps) {
  const markStart = () => {
    if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
    try {
      performance.clearMarks("solenos.journey.landing-cta");
      performance.mark("solenos.journey.landing-cta");
    } catch {
      // Browser timing must never block navigation.
    }
  };

  return (
    <Link href={href} className={className} onClick={markStart}>
      {children}
    </Link>
  );
}
