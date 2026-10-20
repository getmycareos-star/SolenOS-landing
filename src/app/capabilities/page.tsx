import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { CURRENT_CAPABILITIES } from "@/lib/mvp-faq";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";

export const metadata: Metadata = {
  title: "Current Capabilities — SolenOS",
  description: CURRENT_CAPABILITIES.lead,
};

export default function CapabilitiesPage() {
  const doc = CURRENT_CAPABILITIES;
  return (
    <PublicShell activeHref="/capabilities">
      <OpsPageView page="/capabilities" />
      <section className="public-hero">
        <h1 className="public-hero-title">{doc.title}</h1>
        <p className="public-hero-lede">{doc.lead}</p>
      </section>
      <section className="public-section">
        <p className="public-prose">{doc.philosophy}</p>
      </section>
      <section className="public-section">
        <h2 className="public-section-title">{doc.worksWell.title}</h2>
        <ul className="public-quiet-list">
          {doc.worksWell.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="public-section">
        <h2 className="public-section-title">{doc.stillImproving.title}</h2>
        <ul className="public-quiet-list">
          {doc.stillImproving.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="public-section">
        <p className="public-prose">{doc.closing}</p>
        <p className="public-prose">
          <Link href="/support">Help Center</Link> ·{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </section>
    </PublicShell>
  );
}
