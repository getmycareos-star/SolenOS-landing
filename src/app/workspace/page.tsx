"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";
import Link from "next/link";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";
import { UpcomingAppointmentSummary } from "@/components/app-shell/UpcomingAppointmentSummary";

const Companion = dynamic(() => import("@/components/workflows/AICompanion"), {
  ssr: false,
  loading: () => <BrandLoading animate message="Opening Ask SolenOS…" />,
});

function WorkspaceHomeInner() {
  const searchParams = useSearchParams();
  const promptValues = searchParams.getAll("prompt");
  // Repeated prompt parameters are ambiguous; do not let them alter the
  // caregiver's Home experience or choose one value silently.
  const prompt = promptValues.length === 1
    ? promptValues[0]?.trim().slice(0, 4000) || null
    : null;

  return (
    <div className="mobile-screen feature-page solenos-lcr-home">
      <header className="solenos-workspace-page-heading">
        <p className="solenos-home-eyebrow">HOME</p>
        <h1>Home</h1>
        <p>See what is happening, what has changed and what may need your attention. Your saved care information stays connected as things change.</p>
        <p><Link href="/workspace/care-continuity">View the complete Care Record</Link></p>
      </header>
      {prompt && (
        <section className="today-companion-entry" aria-label="Your question for SolenOS">
          <Companion key={prompt} home initialPrompt={prompt} />
        </section>
      )}
      <LCRCurrentUnderstanding showNextStep viewMode="today" />
      <UpcomingAppointmentSummary />
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
