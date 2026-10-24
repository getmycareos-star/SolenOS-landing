"use client";

import dynamic from "next/dynamic";
import { BrandLoading } from "@/components/brand";

const Companion = dynamic(() => import("@/components/workflows/AICompanion"), {
  ssr: false,
  loading: () => <BrandLoading message="Opening your care companion…" />,
});

export default function CompanionPage() {
  return (
    <div className="mobile-screen feature-page">
      <div className="mobile-page-head">
        <h1>AI Companion</h1>
        <p>Use the conversation to organise questions and context. It is not a medical professional and does not diagnose.</p>
      </div>
      <Companion />
    </div>
  );
}
