import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";

export const metadata: Metadata = {
  title: "Early Access — SolenOS",
  description:
    "Start using your SolenOS Care Record.",
};

export default function EarlyAccessPage() {
  return (
    <PublicShell activeHref="/early-access">
      <OpsPageView page="/early-access" />
      <section className="public-hero">
        <p className="public-eyebrow">SolenOS</p>
        <h1 className="public-hero-title">Start with what you already have.</h1>
        <p className="public-hero-lede">
          You do not need to organize years of caregiving first. Open your Care Record
          and add information when you are ready.
        </p>
        <div className="public-cta-group">
          <Link href="/workspace?enter=1" className="public-cta-primary">
            Open your Living Care Record
          </Link>
        </div>
      </section>

      <section className="public-section">
        <h2 className="public-section-title">About early access</h2>
        <p className="public-prose">
          SolenOS is continuing to improve its care-continuity capabilities. Some features may
          be incomplete or need correction. The record should preserve uncertainty rather than
          presenting an AI interpretation as established fact.
        </p>
        <h2 className="public-section-title">Before adding care information</h2>
        <ul className="public-quiet-list">
          <li>Your notes and uploaded documents are stored online with the care record. Keep your own copy of important information.</li>
          <li>Only enter or upload information you have permission to share.</li>
          <li>AI can miss or misread details. Check suggestions against the original information before relying on them.</li>
          <li>Privacy requests are reviewed by people. Deletion is not self-service, and shared care records may need a separate scope review.</li>
        </ul>
        <p className="public-prose">
          Read the <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Service</Link> before adding care information.
        </p>
      </section>
    </PublicShell>
  );
}
