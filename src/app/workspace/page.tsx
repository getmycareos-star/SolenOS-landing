"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";
import Link from "next/link";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";
import { UpcomingAppointmentSummary } from "@/components/app-shell/UpcomingAppointmentSummary";

const Companion = dynamic(() => import("@/components/workflows/AICompanion"), {
  ssr: false,
  loading: () => <BrandLoading animate message="Opening Care Assistant…" />,
});

function WorkspaceHomeInner() {
  const searchParams = useSearchParams();
  const promptValues = searchParams.getAll("prompt");
  const hasSinglePrompt = promptValues.length === 1;
  const rawPrompt = hasSinglePrompt ? promptValues[0] : null;
  // Repeated prompt parameters are ambiguous; do not let them alter the
  // caregiver's Home experience or choose one value silently.
  const prompt = rawPrompt?.trim().slice(0, 4000) || null;

  useEffect(() => {
    if (hasSinglePrompt && rawPrompt?.trim()) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("prompt")) return;
    params.delete("prompt");
    const remainingQuery = params.toString();
    const nextUrl = window.location.pathname + (remainingQuery ? `?${remainingQuery}` : "") + window.location.hash;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [hasSinglePrompt, rawPrompt]);

  return (
    <div className="mobile-screen feature-page solenos-lcr-home">
      <header className="solenos-workspace-page-heading">
        <p className="solenos-home-eyebrow">HOME</p>
        <h1>Home</h1>
        <p>See what is happening, what has changed and what may need your attention. Your saved care information stays connected as things change.</p>
        <p><Link href="/workspace/care-continuity">View care information</Link></p>
      </header>
      <LCRCurrentUnderstanding showNextStep viewMode="today" />
      {prompt && (
        <section className="today-companion-entry" aria-label="Your question for SolenOS">
          <Companion key={prompt} home initialPrompt={prompt} />
        </section>
      )}
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
