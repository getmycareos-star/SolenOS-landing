import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { SolenosWordmark } from "@/components/brand";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { HOME_LANDING } from "@/lib/trust-content";
import "./landing.css";

export const metadata: Metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    "SolenOS helps family caregivers organize care information and understand what changed — without replacing healthcare professionals.",
};

/**
 * Public landing (/) — discover SolenOS.
 * CTA enters /workspace directly (not a waitlist wall).
 * Dark / cream / sage / gold visual system, scoped to this route only
 * via landing.css. Same routes as before: Enter SolenOS -> /workspace?enter=1,
 * How it works -> /how-it-works. Footer/nav unchanged (PublicShell).
 */
export default function LandingPage() {
  const l = HOME_LANDING;

  return (
    <PublicShell activeHref="/" hideNavLinks>
      <OpsPageView page="/" />

      <div className="landing-root">
        {/* Hero */}
        <section className="landing-block landing-dark landing-hero">
          <div className="landing-inner">
            <SolenosWordmark size="lg" className="public-hero-brand" />

            <div className="landing-orb" aria-hidden="true">
              <span className="orb-a" />
              <span className="orb-b" />
              <span className="orb-c" />
              <span className="landing-orb-title landing-serif">
                Living Care
                <br />
                Record
              </span>
            </div>

            <p className="landing-eyebrow">{l.hero.eyebrow}</p>
            <h1 className="landing-title landing-serif">{l.hero.title}</h1>

            <ul className="landing-fragments">
              {l.hero.fragments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className="landing-pull">{l.hero.pull}</p>
            <p className="landing-lede">{l.hero.lede}</p>

            <div className="landing-cta-group">
              <Link href="/workspace?enter=1" className="landing-btn landing-btn-fill">
                Enter SolenOS
              </Link>
              <Link href="/how-it-works" className="landing-btn landing-btn-outline">
                How it works
              </Link>
            </div>
          </div>
        </section>

        {/* Care doesn't happen in one place */}
        <section className="landing-block landing-cream">
          <div className="landing-inner">
            <h2 className="landing-section-title landing-serif">{l.scattered.title}</h2>
            {l.scattered.lead.map((p) => (
              <p key={p} className="landing-prose">
                {p}
              </p>
            ))}
            <ul className="landing-quiet-list">
              {l.scattered.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="landing-pull">{l.scattered.pull}</p>
          </div>
        </section>

        {/* A Living Care Record for one person */}
        <section className="landing-block landing-dark">
          <div className="landing-inner">
            <h2 className="landing-section-title landing-serif">{l.record.title}</h2>
            {l.record.body.map((p) => (
              <p key={p} className="landing-prose" style={{ color: "var(--landing-text-light-muted)" }}>
                {p}
              </p>
            ))}
            <div className="landing-answer-grid">
              {l.record.answers.map((a) => (
                <div key={a}>{a}</div>
              ))}
            </div>
          </div>
        </section>

        {/* Because memory is not a care system */}
        <section className="landing-block landing-cream">
          <div className="landing-inner">
            <h2 className="landing-section-title landing-serif">{l.memory.title}</h2>
            <p className="landing-prose">{l.memory.lead}</p>
            <ul className="landing-quiet-list">
              {l.memory.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="landing-pull">{l.memory.pull}</p>
          </div>
        </section>

        {/* Process flow */}
        <section className="landing-block landing-dark" id="how-it-works">
          <div className="landing-inner">
            <h2 className="landing-section-title landing-serif">{l.process.title}</h2>
            <div className="landing-flow">
              {l.process.steps.map((step, i) => (
                <div className="landing-flow-step" key={step.title}>
                  <div className="landing-flow-rail">
                    <span className="landing-flow-dot" />
                    {i < l.process.steps.length - 1 && <span className="landing-flow-line" />}
                  </div>
                  <div className="landing-flow-content">
                    <h4>{step.title}</h4>
                    <p>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The care journey, remembered */}
        <section className="landing-block landing-dark2">
          <div className="landing-inner" style={{ textAlign: "center" }}>
            <h2 className="landing-section-title landing-serif">{l.remembered.title}</h2>
            <ul
              className="landing-quiet-list"
              style={{ textAlign: "left", maxWidth: 420, margin: "0 auto" }}
            >
              {l.remembered.negations.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="landing-pull" style={{ margin: "18px auto", maxWidth: 460 }}>
              {l.remembered.pull}
            </p>
            <div className="landing-cta-group">
              <Link href="/workspace?enter=1" className="landing-btn landing-btn-fill">
                Enter SolenOS
              </Link>
            </div>
          </div>
        </section>

        {/* Built for caregivers */}
        <section className="landing-block landing-cream">
          <div className="landing-inner">
            <h2 className="landing-section-title landing-serif">{l.builtFor.title}</h2>
            {l.builtFor.body.map((p) => (
              <p key={p} className="landing-prose">
                {p}
              </p>
            ))}
            <p className="landing-pull">{l.builtFor.pull}</p>
          </div>
        </section>

        {/* Closing */}
        <section className="landing-block landing-dark landing-closing">
          <p className="landing-closing-line landing-serif">{l.closing.line}</p>
          <p className="landing-closing-brand">
            {BRAND_NAME} &middot; {l.closing.brand}
          </p>
          <div className="landing-cta-group">
            <Link href="/workspace?enter=1" className="landing-btn landing-btn-fill">
              Enter SolenOS
            </Link>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
