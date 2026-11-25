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
  loading: () => <BrandLoading animate message="Opening Ask SolenOS…" />,
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
      <header className="solenos-workspace-page-heading"><p className="solenos-home-eyebrow">HOME</p><h1>Home</h1><p>See what is happening, what has changed and what may need your attention. Your saved care information stays connected as things change.</p><p><Link href="/workspace/care-continuity">View care information</Link></p></header>
      {/* Show the current care situation before inbox and detailed record content. */}
      <LCRCurrentUnderstanding showNextStep />
      <UpcomingAppointmentSummary />
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
