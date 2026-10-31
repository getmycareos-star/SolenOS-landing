"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";

const Companion = dynamic(() => import("@/components/workflows/AICompanion"), {
  ssr: false,
  loading: () => <BrandLoading message="Opening your care companion…" />,
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
    <main className="mobile-screen feature-page solenos-lcr-home">
      <LCRCurrentUnderstanding />
    </main>
  );
}

export default function WorkspaceHomePage() {
  return (
    <Suspense fallback={<BrandLoading message="Opening your Living Care Record…" />}>
      <WorkspaceHomeInner />
    </Suspense>
  );
}
