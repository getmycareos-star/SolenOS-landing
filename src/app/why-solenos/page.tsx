import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell, PublicCtaGroup } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { WHY_SOLENOS } from "@/lib/trust-content";

export const metadata: Metadata = {
  title: "Why SolenOS",
  description:
    "Why SolenOS exists — continuity for caregiving when information scatters and memory becomes the system of record.",
};

export default function WhySolenosPage() {
  const w = WHY_SOLENOS;

  return (
    <PublicShell activeHref="/why-solenos">
      <OpsPageView page="/why-solenos" />
      <section className="public-hero public-hero-story">
        <p className="public-eyebrow">{w.heroSubtitle}</p>
        <h1 className="public-hero-title">{w.heroTitle}</h1>
      </section>

      <article className="public-story">
        {w.lead.map((p) => (
          <p key={p}>{p}</p>
        ))}

        <h2 className="public-section-title">{w.problemTitle}</h2>
        <ul className="public-quiet-list">
          {w.problem.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="public-section-title">{w.answerTitle}</h2>
        {w.answer.map((p) => (
          <p key={p}>{p}</p>
        ))}

        <h2 className="public-section-title">{w.differenceTitle}</h2>
        <ul className="public-quiet-list">
          {w.difference.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className="public-muted">
          {w.bridgeToStory}{" "}
          <Link href="/our-story">Read our story</Link>.
        </p>
        <p className="public-muted">
          {w.bridgeToMission}{" "}
          <Link href="/mission">Read the mission</Link>.
        </p>
      </article>

      <section className="public-section public-closing">
        <PublicCtaGroup
          secondaryHref="/how-it-works"
          secondaryLabel="How It Works"
        />
      </section>
    </PublicShell>
  );
}
