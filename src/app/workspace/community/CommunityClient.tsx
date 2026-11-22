"use client";

import dynamic from "next/dynamic";
import { BrandLoading } from "@/components/brand";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const Community = dynamic(() => import("@/components/workflows/Community"), {
  ssr: false,
  loading: () => <BrandLoading message="Loading…" />,
});

export default function CommunityClient() {
  if (!FEATURE_FLAGS.community) {
    return (
      <div className="mobile-screen feature-page" role="status">
        <section style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
          <h1>Community is not available yet</h1>
          <p>
            Community sharing is turned off for now while we work on safety and privacy.
          </p>
          <p>Community experiences are separate from your Care Record and are never added to it automatically.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mobile-screen feature-page">
      <Community />
    </div>
  );
}
