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
  const prompt = searchParams.get("prompt")?.trim().slice(0, 4000) || null;

  return (
    <div className="mobile-screen feature-page solenos-lcr-home">
      <header className="solenos-workspace-page-heading">
        <p className="solenos-home-eyebrow">YOUR LIVING CARE RECORD</p>
        <h1>Today</h1>
        <p>A current view of the care information saved in your Living Care Record. See what matters, what has changed and what may still need checking.</p>
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
