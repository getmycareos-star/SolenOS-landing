import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { CONTACT_PAGE } from "@/lib/trust-content";

export const metadata: Metadata = {
  title: "Contact — SolenOS",
  description: CONTACT_PAGE.lead,
};

export default function ContactPage() {
  const doc = CONTACT_PAGE;
  return (
    <PublicShell activeHref="/contact">
      <OpsPageView page="/contact" />
      <section className="public-hero">
        <h1 className="public-hero-title">{doc.title}</h1>
        <p className="public-hero-lede">{doc.lead}</p>
      </section>
      <section className="public-section">
        <p className="public-prose">
          <strong>{doc.emailLabel}:</strong>{" "}
          <a href={`mailto:${doc.email}`}>{doc.email}</a>
        </p>
        <p className="public-prose">{doc.note}</p>
        <p className="public-prose">
          Need product help? See <Link href="/support">Help</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
