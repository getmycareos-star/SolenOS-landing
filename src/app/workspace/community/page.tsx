"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { BrandLoading } from "@/components/brand";

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
      <aside aria-labelledby="professional-invitation-title" style={{ margin: "1.25rem 0", padding: "1.25rem", border: "1px solid #d8e2d9", borderRadius: 14, background: "#f5f8f4" }}>
        <p className="public-eyebrow" style={{ marginBottom: ".5rem" }}>For care professionals</p>
        <h2 id="professional-invitation-title" style={{ fontSize: "1.2rem", margin: "0 0 .5rem" }}>Are you a dementia-care professional?</h2>
        <p style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>Share practical knowledge with family caregivers navigating dementia care. Create a professional profile to introduce your experience, areas of expertise, and the support you can offer. SolenOS reviews profiles before granting verified status or community publishing access.</p>
        <Link href="/professional/signup" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: ".7rem 1rem", borderRadius: 10, background: "#dce9dc", color: "#18251b", fontWeight: 600, textDecoration: "none" }}>Join as a professional</Link>
        <p style={{ margin: ".75rem 0 0", fontSize: ".9rem" }}>Already have a professional account? <Link href="/professional/login">Professional login</Link>.</p>
      </aside>
      <Community />
    </div>
  );
}
