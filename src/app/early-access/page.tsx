import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";

export const metadata: Metadata = {
  title: "Early Access — SolenOS",
  description:
    "Start using the SolenOS Living Care Record. No early-version acknowledgement is required to enter the workspace.",
};

export default function EarlyAccessPage() {
  return (
    <PublicShell activeHref="/early-access">
      <OpsPageView page="/early-access" />
      <section className="public-hero">
        <p className="public-eyebrow">SolenOS</p>
        <h1 className="public-hero-title">Start with what you already have.</h1>
        <p className="public-hero-lede">
          You do not need to organize years of caregiving first. Open your Living Care Record
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
        <p className="public-prose">
          Privacy and terms information remains available before or after entering the workspace:
          {" "}<Link href="/privacy">Privacy Policy</Link>
          {" · "}<Link href="/terms">Terms of Service</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
