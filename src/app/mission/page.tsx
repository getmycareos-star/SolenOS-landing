import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell, PublicCtaGroup } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { BELIEFS, MISSION } from "@/lib/trust-content";

export const metadata: Metadata = {
  title: "Mission — SolenOS",
  description: MISSION.statement,
};

export default function MissionPage() {
  const m = MISSION;

  return (
    <PublicShell>
      <OpsPageView page="/mission" />
      <section className="public-hero public-hero-story">
        <p className="public-eyebrow">{m.heroSubtitle}</p>
        <h1 className="public-hero-title">{m.title}</h1>
      </section>

      <article className="public-story">
        <p className="public-mission">{m.statement}</p>

        <h2 className="public-section-title">{m.meaningTitle}</h2>
        <ul className="public-quiet-list">
          {m.meaning.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="public-section-title">{m.notThisTitle}</h2>
        <ul className="public-quiet-list">
          {m.notThis.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="public-section-title">{BELIEFS.title}</h2>
        <ul className="public-quiet-list">
          {BELIEFS.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className="public-closing-line">{m.closing}</p>

        <p className="public-muted">
          Read the human origin in <Link href="/our-story">Our Story</Link>, or the
          product problem in <Link href="/why-solenos">Why SolenOS</Link>.
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
