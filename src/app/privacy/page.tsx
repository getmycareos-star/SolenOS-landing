import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { PRIVACY_POLICY } from "@/lib/trust-content";

export const metadata: Metadata = {
  title: "Privacy Policy — SolenOS",
  description: PRIVACY_POLICY.lead,
};

export default function PrivacyPage() {
  const doc = PRIVACY_POLICY;
  return (
    <PublicShell activeHref="/privacy">
      <OpsPageView page="/privacy" />
      <article className="public-legal">
        <p className="public-eyebrow">Updated {doc.updated}</p>
        <h1 className="public-hero-title">{doc.title}</h1>
        <p className="public-hero-lede">{doc.lead}</p>
        {doc.sections.map((section) => (
          <section key={section.title} className="public-section">
            <h2 className="public-section-title">{section.title}</h2>
            {section.body.map((p) => (
              <p key={p} className="public-prose">
                {p}
              </p>
            ))}
          </section>
        ))}
        <p className="public-prose">
          Also see <Link href="/terms">Terms of Use</Link> ·{" "}
          <Link href="/contact">Contact</Link>
        </p>
      </article>
    </PublicShell>
  );
}
