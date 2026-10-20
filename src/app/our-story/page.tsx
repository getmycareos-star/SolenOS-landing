import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell, PublicCtaGroup } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { OUR_STORY } from "@/lib/trust-content";

export const metadata: Metadata = {
  title: "Our Story — SolenOS",
  description:
    "How SolenOS began — a founder story about family caregiving and becoming someone else's memory system.",
};

export default function OurStoryPage() {
  const s = OUR_STORY;

  return (
    <PublicShell>
      <OpsPageView page="/our-story" />
      <section className="public-hero public-hero-story">
        <p className="public-eyebrow">{s.heroSubtitle}</p>
        <h1 className="public-hero-title">{s.heroTitle}</h1>
        <p className="public-byline">
          {s.founderName}
          <span aria-hidden="true"> · </span>
          {s.founderRole}
        </p>
      </section>

      <article className="public-story">
        {s.opening.map((p) => (
          <p key={p}>{p}</p>
        ))}

        {s.family.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <ul className="public-quiet-list">
          {s.rememberedMoments.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        {s.memoryRealization.map((p) => (
          <p key={p}>{p}</p>
        ))}

        <blockquote className="public-pull">
          Many caregivers quietly become the memory system for someone they love.
        </blockquote>

        {s.insight.slice(2).map((p) => (
          <p key={p}>{p}</p>
        ))}

        <h2 className="public-section-title">Beyond one family</h2>
        {s.widerWorld.map((p) => (
          <p key={p}>{p}</p>
        ))}

        <p className="public-closing-line">{s.closing}</p>

        <p className="public-muted">
          For the product problem this story led to, see{" "}
          <Link href="/why-solenos">Why SolenOS</Link>. For the north star, see{" "}
          <Link href="/mission">Mission</Link>.
        </p>
      </article>

      <section className="public-section public-closing">
        <PublicCtaGroup
          secondaryHref="/why-solenos"
          secondaryLabel="Why SolenOS"
        />
      </section>
    </PublicShell>
  );
}
