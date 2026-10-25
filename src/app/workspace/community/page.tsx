"use client";

import dynamic from "next/dynamic";
import { BrandLoading } from "@/components/brand";
import QwenSupportPanel from "@/components/workflows/QwenSupportPanel";

const Community = dynamic(() => import("@/components/workflows/Community"), {
  ssr: false,
  loading: () => <BrandLoading message="Opening caregiver community…" />,
});

export default function CommunityPage() {
  return (
    <div className="mobile-screen feature-page">
      <div className="mobile-page-head">
        <h1>Caregiver community</h1>
        <p>Learn from shared dementia-care experiences. Community posts do not automatically change your Living Care Record.</p>
      </div>
      <Community />
      <QwenSupportPanel workflow="community" />
    </div>
  );
}
