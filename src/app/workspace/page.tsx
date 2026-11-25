"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";
import Link from "next/link";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";
import { FirstVisitWorkspaceRouter } from "@/components/mvp-workspace/FirstVisitWorkspaceRouter";
import { UpcomingAppointmentSummary } from "@/components/app-shell/UpcomingAppointmentSummary";

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
      <header className="solenos-workspace-page-heading"><p className="solenos-home-eyebrow">YOUR CARE, AT A GLANCE</p><h1>Home</h1><p>Here’s what has changed, what may need attention and what is already recorded. You can take things one step at a time.</p></header>
      {/* Show the current care situation before inbox and detailed record content. */}
      <LCRCurrentUnderstanding />
      <UpcomingAppointmentSummary />
      <section className="solenos-care-next-step" aria-label="Next step">
        <div>
          <h2>When you’re ready, here are two ways to continue.</h2>
          <p>Add something you noticed, or ask a question about information already saved. There’s no need to do everything at once.</p>
        </div>
        <div className="solenos-care-next-step__actions">
          <Link href="/workspace/daily-care" className="solenos-care-primary-action">Add an update</Link>
          <Link href="/workspace/companion" className="solenos-care-secondary-action">Ask SolenOS</Link>
        </div>
      </section>
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
