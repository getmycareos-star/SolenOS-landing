"use client";

import dynamic from "next/dynamic";
import { BrandLoading } from "@/components/brand";

const Companion = dynamic(() => import("@/components/workflows/AICompanion"), {
  ssr: false,
  loading: () => <BrandLoading message="Opening your care companion…" />,
});

export default function CompanionPage() {
  return (
    <div className="mobile-screen feature-page companion-route">
      <Companion />
    </div>
  );
}
