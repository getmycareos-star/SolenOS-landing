"use client";

import Link from "next/link";
import { EMPTY_STATE_TRUST, INSIGHT_FOOTER_TRUST } from "@/lib/trust-content";

/** Soft welcome when care record exists but little/no information yet. Never a popup. */
export function TrustEmptyStateNote({ className }: { className?: string }) {
  return (
    <aside
      className={`trust-discovery trust-discovery-empty${className ? ` ${className}` : ""}`}
      aria-label="Welcome"
    >
      <p className="trust-discovery-title">{EMPTY_STATE_TRUST.title}</p>
      <p className="trust-discovery-body">{EMPTY_STATE_TRUST.body}</p>
      <Link href={EMPTY_STATE_TRUST.linkHref} className="trust-discovery-link">
        {EMPTY_STATE_TRUST.linkLabel}
      </Link>
    </aside>
  );
}

/** Subtle footer after first meaningful understanding — optional, non-blocking. */
export function TrustInsightFooter({ className }: { className?: string }) {
  return (
    <p className={`trust-discovery trust-discovery-footer${className ? ` ${className}` : ""}`}>
      <Link href={INSIGHT_FOOTER_TRUST.href} className="trust-discovery-link">
        {INSIGHT_FOOTER_TRUST.label}
      </Link>
    </p>
  );
}
