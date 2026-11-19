"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";
import Link from "next/link";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";
import { CaregiverHandoverInbox } from "@/components/mvp-workspace/CaregiverHandoverInbox";
import { FirstVisitWorkspaceRouter } from "@/components/mvp-workspace/FirstVisitWorkspaceRouter";

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
    <FirstVisitWorkspaceRouter fallback={(
    <div className="mobile-screen feature-page solenos-lcr-home">
      <header className="solenos-workspace-page-heading"><h1>Care Record</h1></header>
      {/* Show the current care situation before inbox and detailed record content. */}
      <LCRCurrentUnderstanding />
      <section className="solenos-care-next-step" aria-label="Next step">
        <div>
          <h2>What would you like to do next?</h2>
          <p>Add a care update to keep this record up to date, or ask SolenOS about information already saved.</p>
        </div>
        <div className="solenos-care-next-step__actions">
          <Link href="/workspace/daily-care" className="solenos-care-primary-action">Add a care update</Link>
          <Link href="/workspace/companion" className="solenos-care-secondary-action">Ask SolenOS</Link>
        </div>
      </section>
      <details className="solenos-care-explore">
        <summary>Explore your care record</summary>
        <nav aria-label="More care information" className="solenos-care-explore__links">
          <Link href="/workspace/open-loops"><strong>Follow-ups</strong><span>Review questions, decisions and agreed next steps.</span></Link>
          <Link href="/workspace/timeline"><strong>Care Timeline</strong><span>Review earlier updates and corrections.</span></Link>
          <Link href="/workspace/documents"><strong>Documents</strong><span>Open original care files and saved details.</span></Link>
          <Link href="/workspace/companion"><strong>Care Assistant</strong><span>Ask about saved care information and its sources.</span></Link>
        </nav>
      </details>
      <CaregiverHandoverInbox />
    </div>
    )} />
  );
}

export default function WorkspaceHomePage() {
  return (
    <Suspense fallback={<BrandLoading animate message="Opening your Care Record…" />}>
      <WorkspaceHomeInner />
    </Suspense>
  );
}
