"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const Community = dynamic(() => import("@/components/workflows/Community"), {
  ssr: false,
});

export default function CommunityPage() {
  const router = useRouter();
  const enabled = FEATURE_FLAGS.community && FEATURE_FLAGS.professionalCommunity;

  useEffect(() => {
    if (!enabled) router.replace("/workspace");
  }, [enabled, router]);

  if (!enabled) return null;

  return (
    <div className="mobile-screen feature-page">
      <Community />
    </div>
  );
}
