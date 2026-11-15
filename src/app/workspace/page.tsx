"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";
import Link from "next/link";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";
import { CaregiverHandoverInbox } from "@/components/mvp-workspace/CaregiverHandoverInbox";

const Companion = dynamic(() => import("@/components/workflows/AICompanion"), {
  ssr: false,
  loading: () => <BrandLoading animate message="Opening Care Assistant…" />,
});

function WorkspaceHomeInner() {
  const searchParams = useSearchParams();
  const prompt = searchParams.get("prompt");

  if (prompt) {
    return (
      <div className="mobile-screen feature-page companion-route solenos-companion-home">
        <Companion home initialPrompt={prompt} />
      </div>
    );
  }

  return (
    <div className="mobile-screen feature-page solenos-lcr-home">
      <header className="solenos-workspace-page-heading"><h1>Care Record</h1></header>
      {/* Show the current care situation before inbox and detailed record content. */}
      <LCRCurrentUnderstanding />
      <section aria-label="Ask SolenOS" style={{ display: "grid", gap: 10, padding: "18px 0" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>What would you like to do?</h2>
          <p style={{ margin: "6px 0 0", color: "var(--text-secondary)" }}>Record a new care update or ask SolenOS about information already saved.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href="/workspace/companion" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 46, width: "fit-content", border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 700, padding: "10px 16px", textDecoration: "none" }}>Ask SolenOS</Link>
          <Link href="/workspace/daily-care" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 46, width: "fit-content", border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", fontWeight: 650, padding: "10px 16px", textDecoration: "none" }}>Add a care update</Link>
        </div>
      </section>
      <nav aria-label="Care information" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 10, padding: "8px 0 20px" }}>
        <Link href="/workspace/open-loops" style={{ display: "grid", gap: 5, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", color: "var(--text)", textDecoration: "none" }}>
          <strong>Follow-ups</strong>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Resolve open questions, review decisions and manage what still needs attention.</span>
        </Link>
        <Link href="/workspace/timeline" style={{ display: "grid", gap: 5, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", color: "var(--text)", textDecoration: "none" }}>
          <strong>Care Timeline</strong>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Review earlier updates and see how recorded corrections affect the current Care Record.</span>
        </Link>
        <Link href="/workspace/documents" style={{ display: "grid", gap: 5, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", color: "var(--text)", textDecoration: "none" }}>
          <strong>Documents</strong>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Keep original care files and review information taken from them.</span>
        </Link>
        <Link href="/workspace/companion" style={{ display: "grid", gap: 5, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", color: "var(--text)", textDecoration: "none" }}>
          <strong>AI Companion</strong>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Ask questions about saved care information and where it came from.</span>
        </Link>
      </nav>
      <CaregiverHandoverInbox />
    </div>
  );
}

export default function WorkspaceHomePage() {
  return (
    <Suspense fallback={<BrandLoading animate message="Opening your Care Record…" />}>
      <WorkspaceHomeInner />
    </Suspense>
  );
}
