import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { SolenosWordmark } from "@/components/brand";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { HOME_LANDING } from "@/lib/trust-content";

export const metadata: Metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    "SolenOS helps family caregivers organize care information and understand what changed — without replacing healthcare professionals.",
};

/**
 * Public landing (/) — discover SolenOS.
 * CTA enters /workspace directly (not a waitlist wall).
 * Long-form story surface — replaces the prior thin landing.
 * Same routes/links as before: Enter SolenOS -> /workspace?enter=1,
 * How it works -> /how-it-works. Uses only existing public-* classes.
 */
export default function LandingPage() {
  const l = HOME_LANDING;

  return (
    <PublicShell activeHref="/" hideNavLinks>
      <OpsPageView page="/" />

      {/* Hero */}
      <section className="public-hero">
        <SolenosWordmark size="lg" className="public-hero-brand" />
        <p className="public-eyebrow">{l.hero.eyebrow}</p>
        <h1 className="public-hero-title">{l.hero.title}</h1>

        <ul className="public-quiet-list">
          {l.hero.fragments.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <blockquote className="public-pull">{l.hero.pull}</blockquote>
        <p className="public-hero-lede">{l.hero.lede}</p>

        <div className="public-cta-group">
          <Link href="/workspace?enter=1" className="public-cta-primary">
            Enter SolenOS
          </Link>
          <Link href="/how-it-works" className="public-cta-secondary">
            How it works
          </Link>
        </div>
      </section>

      {/* Care doesn't happen in one place */}
      <section className="public-section">
        <h2 className="public-section-title">{l.scattered.title}</h2>
        {l.scattered.lead.map((p) => (
          <p key={p} className="public-prose">
            {p}
          </p>
        ))}
        <ul className="public-quiet-list">
          {l.scattered.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <blockquote className="public-pull">{l.scattered.pull}</blockquote>
      </section>

      {/* A Living Care Record for one person */}
      <section className="public-section">
        <h2 className="public-section-title">{l.record.title}</h2>
        {l.record.body.map((p) => (
          <p key={p} className="public-prose">
            {p}
          </p>
        ))}
        <ul className="public-quiet-list">
          {l.record.answers.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>

      {/* Because memory is not a care system */}
      <section className="public-section">
        <h2 className="public-section-title">{l.memory.title}</h2>
        <p className="public-prose">{l.memory.lead}</p>
        <ul className="public-quiet-list">
          {l.memory.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <blockquote className="public-pull">{l.memory.pull}</blockquote>
      </section>

      {/* From scattered information to a clearer picture */}
      <section className="public-section" id="how-it-works">
        <h2 className="public-section-title">{l.process.title}</h2>
        <ol className="public-steps">
          {l.process.steps.map((step, i) => (
            <li key={step.title}>
              <span className="public-step-num">{i + 1}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* The care journey, remembered */}
      <section className="public-section">
        <h2 className="public-section-title">{l.remembered.title}</h2>
        <ul className="public-quiet-list">
          {l.remembered.negations.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <blockquote className="public-pull">{l.remembered.pull}</blockquote>
        <div className="public-cta-group">
          <Link href="/workspace?enter=1" className="public-cta-primary">
            Enter SolenOS
          </Link>
        </div>
      </section>

      {/* Built for caregivers */}
      <section className="public-section">
        <h2 className="public-section-title">{l.builtFor.title}</h2>
        {l.builtFor.body.map((p) => (
          <p key={p} className="public-prose">
            {p}
          </p>
        ))}
        <blockquote className="public-pull">{l.builtFor.pull}</blockquote>
      </section>

      {/* Closing */}
      <section className="public-section public-closing">
        <p className="public-closing-line">{l.closing.line}</p>
        <p className="public-muted">
          {BRAND_NAME} · {l.closing.brand}
        </p>
        <div className="public-cta-group">
          <Link href="/workspace?enter=1" className="public-cta-primary">
            Enter SolenOS
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
