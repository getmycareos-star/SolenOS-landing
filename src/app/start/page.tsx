import type { Metadata } from "next";
import { PublicShell, PublicCtaGroup } from "@/components/public/PublicShell";
import { WelcomeTrustStack } from "@/components/public/WelcomeTrustStack";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { WELCOME_HOME } from "@/lib/trust-content";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { SolenosWordmark } from "@/components/brand";

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Entry`,
  description: WELCOME_HOME.subheadline,
};

/**
 * Entry Home (/start) — trust + Research Preview before Care Workspace.
 * Not a separate legal wall. Landing CTA "Enter SolenOS" lands here.
 */
export default function StartPage() {
  return (
    <PublicShell activeHref="/start">
      <OpsPageView page="/start" />
      <section className="public-hero">
        <p className="public-eyebrow">SolenOS · Early Access</p>
        <SolenosWordmark size="lg" className="public-hero-brand" />
        <h1 className="public-hero-title">{WELCOME_HOME.headline}</h1>
        <p className="public-hero-lede">{WELCOME_HOME.subheadline}</p>
        <PublicCtaGroup
          primaryHref={WELCOME_HOME.primaryCtaHref}
          primaryLabel={WELCOME_HOME.primaryCtaLabel}
          secondaryHref={WELCOME_HOME.secondaryCtaHref}
          secondaryLabel={WELCOME_HOME.secondaryCtaLabel}
        />
      </section>

      <section className="public-section">
        <h2 className="public-section-title">When SolenOS works, caregiving feels lighter</h2>
        <p className="public-prose">{WELCOME_HOME.promise}</p>
        <ul className="public-quiet-list">
          {WELCOME_HOME.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <WelcomeTrustStack />
    </PublicShell>
  );
}
