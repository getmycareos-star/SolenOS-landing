import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell, PublicCtaGroup } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { OUR_STORY, BELIEFS } from "@/lib/trust-content";

export const metadata: Metadata = {
  title: "About SolenOS",
  description:
    "Why SolenOS exists — understanding caregiver reality and continuity of care.",
};

/**
 * About is trust-building, not a legal document.
 * Focus: caregiver reality, belief, continuity — not AI/tech feature lists.
 */
export default function AboutPage() {
  const s = OUR_STORY;
  return (
    <PublicShell activeHref="/about">
      <OpsPageView page="/about" />
      <section className="public-hero public-hero-story">
        <p className="public-eyebrow">About SolenOS</p>
        <h1 className="public-hero-title">Built around caregiver reality</h1>
        <p className="public-hero-lede">
          SolenOS exists so families do not have to reconstruct a care journey from memory.
          The focus is continuity and understanding — not another app to maintain.
        </p>
      </section>

      <section className="public-section">
        <h2 className="public-section-title">Why we exist</h2>
        {s.insight.map((line) => (
          <p key={line} className="public-prose">
            {line}
          </p>
        ))}
      </section>

      <section className="public-section">
        <h2 className="public-section-title">{BELIEFS.title}</h2>
        <ul className="public-quiet-list">
          {BELIEFS.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="public-section">
        <p className="public-prose">
          Read the <Link href="/our-story">full story</Link>, our{" "}
          <Link href="/mission">mission</Link>, or{" "}
          <Link href="/why-solenos">why SolenOS</Link>.
        </p>
        <PublicCtaGroup
          primaryHref="/early-access"
          primaryLabel="Join early access"
          secondaryHref="/privacy"
          secondaryLabel="Privacy Policy"
        />
      </section>
    </PublicShell>
  );
}
