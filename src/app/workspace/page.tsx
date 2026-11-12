"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";
import QwenAssistPanel from "@/components/qwen/QwenAssistPanel";

const Companion = dynamic(() => import("@/components/workflows/AICompanion"), {
  ssr: false,
  loading: () => <BrandLoading animate message="Opening your care companion…" />,
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
      <QwenAssistPanel
        defaultWorkflow="living_care_record"
        title="Ask about your care record"
        description="Ask about saved care history, changes, conflicting reports, appointments, handoffs, follow-ups or medication observations. Suggestions use information you are authorized to see and always need your review."
      />
    </main>
  );
}

export default function WorkspaceHomePage() {
  return (
    <Suspense fallback={<BrandLoading animate message="Opening your Living Care Record…" />}>
      <WorkspaceHomeInner />
    </Suspense>
  );
}
