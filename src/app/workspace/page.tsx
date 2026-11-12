"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";
import { LCRCurrentUnderstanding } from "@/components/mvp-workspace/LCRCurrentUnderstanding";

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
      <section className="mx-auto mt-5 w-full max-w-4xl px-3 pb-6">
        <Link
          href="/workspace/companion"
          className="flex items-center gap-3 rounded-2xl border border-emerald-900/15 bg-white p-4 text-slate-900 shadow-sm transition hover:border-emerald-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          aria-label="Ask SolenOS in AI Companion"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Ask SolenOS</span>
            <span className="mt-1 block text-sm text-slate-600">Talk through the care history, ask a question, or understand what has changed.</span>
          </span>
          <span aria-hidden="true" className="text-xl text-slate-500">›</span>
        </Link>
      </section>
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
