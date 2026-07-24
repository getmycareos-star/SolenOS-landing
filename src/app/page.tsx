import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { SolenosWordmark } from "@/components/brand";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    "SolenOS helps family caregivers organize care information and understand what changed — without replacing healthcare professionals.",
};

/**
 * Public landing (/) — discover SolenOS.
 * CTA enters /start (Entry Home), not a waitlist wall.
 * Thin surface: do not duplicate Entry Home trust stack here.
 */
export default function LandingPage() {
  return (
    <PublicShell activeHref="/">
      <OpsPageView page="/" />
      <section className="public-hero">
        <SolenosWordmark size="lg" className="public-hero-brand" />
        <h1 className="public-hero-title">
          Caring for everyone shouldn&apos;t mean carrying every detail alone.
        </h1>
        <p className="public-hero-lede">
          SolenOS helps family caregivers organize care information, understand changes over time,
          and keep important parts of someone&apos;s care journey in one place.
        </p>
        <div className="public-cta-group">
          <Link href="/start" className="public-cta-primary">
            Enter SolenOS
          </Link>
          <Link href="/how-it-works" className="public-cta-secondary">
            How it works
          </Link>
        </div>
      </section>

      <section className="public-section">
        <h2 className="public-section-title">What SolenOS is</h2>
        <p className="public-prose">
          A Living Care Record for one person you are caring for — events, decisions, outcomes, and
          what remains unclear — so continuity does not depend on memory alone.
        </p>
      </section>

      <section className="public-section">
        <h2 className="public-section-title">What SolenOS is not</h2>
        <ul className="public-quiet-list">
          <li>A medical advice engine or AI doctor</li>
          <li>A replacement for healthcare professionals or emergency services</li>
          <li>A chatbot companion or task manager</li>
        </ul>
      </section>

      <section className="public-section">
        <p className="public-prose">
          Prefer email updates first?{" "}
          <Link href="/early-access">Join Early Access</Link>
        </p>
      </section>
    </PublicShell>
  );
}
