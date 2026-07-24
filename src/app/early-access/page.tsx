import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { EarlyAccessConsentForm } from "@/components/public/EarlyAccessConsentForm";
import { OpsPageView } from "@/components/ops/OpsPageView";

export const metadata: Metadata = {
  title: "Early Access — SolenOS",
  description:
    "Join SolenOS early access. Start with what you already have — no perfect care record required.",
};

export default function EarlyAccessPage() {
  return (
    <PublicShell activeHref="/early-access">
      <OpsPageView page="/early-access" />
      <section className="public-hero">
        <p className="public-eyebrow">Early access</p>
        <h1 className="public-hero-title">Start without having everything figured out.</h1>
        <p className="public-hero-lede">
          You do not need to organize years of caregiving first. Bring what you already have.
          SolenOS helps create clarity.
        </p>
        <EarlyAccessConsentForm />
      </section>

      <section className="public-section">
        <h2 className="public-section-title">What early access is</h2>
        <p className="public-prose">
          A calm place to try SolenOS while we deepen Continuity — CareEvents, change awareness,
          unknowns, and trust. Feedback from real caregiving helps us stay focused on reducing
          memory burden, not adding another app to maintain.
        </p>
        <p className="public-prose">
          Prefer to understand who we are first?{" "}
          <Link href="/why-solenos">Read why we built SolenOS</Link>
          {" · "}
          <Link href="/privacy">Privacy Policy</Link>
          {" · "}
          <Link href="/terms">Terms of Use</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
