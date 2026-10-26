"use client";

import dynamic from "next/dynamic";
import { BrandLoading } from "@/components/brand";

const Community = dynamic(() => import("@/components/workflows/Community"), {
  ssr: false,
  loading: () => <BrandLoading message="Loading…" />,
});

export default function CommunityClient() {
  return (
    <div className="mobile-screen feature-page">
      <Community />
    </div>
  );
}
