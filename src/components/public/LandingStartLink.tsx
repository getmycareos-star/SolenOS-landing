"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type LandingStartLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export default function LandingStartLink({ href, className, children }: LandingStartLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        try {
          window.performance.mark("solenos.journey.landing-cta");
        } catch {
          // Local timing instrumentation must never affect navigation.
        }
      }}
    >
      {children}
    </Link>
  );
}
