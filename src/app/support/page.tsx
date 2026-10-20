import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { FaqList } from "@/components/public/FaqList";
import { SUPPORT_PAGE } from "@/lib/trust-content";
import { getFullFaqItems, MVP_FAQ_PHILOSOPHY } from "@/lib/mvp-faq";

export const metadata: Metadata = {
  title: "Help — SolenOS",
  description: SUPPORT_PAGE.lead,
};

export default function SupportPage() {
  const doc = SUPPORT_PAGE;
  const faq = getFullFaqItems();
  return (
    <PublicShell activeHref="/support">
      <OpsPageView page="/support" />
      <section className="public-hero">
        <h1 className="public-hero-title">{doc.title}</h1>
        <p className="public-hero-lede">{doc.lead}</p>
        <p className="public-hero-lede">{MVP_FAQ_PHILOSOPHY}</p>
      </section>
      {doc.items.map((item) => (
        <section key={item.title} className="public-section">
          <h2 className="public-section-title">{item.title}</h2>
          <p className="public-prose">{item.body}</p>
        </section>
      ))}
      <div id="faq">
        <FaqList items={faq} headingId="help-faq" title="Frequently asked questions" />
      </div>
      <section className="public-section">
        <p className="public-prose">
          <Link href="/capabilities">Current capabilities</Link> ·{" "}
          <Link href="/contact">Contact us</Link> ·{" "}
          <Link href="/privacy">Privacy Policy</Link> ·{" "}
          <Link href="/terms">Terms of Service</Link>
        </p>
      </section>
    </PublicShell>
  );
}
