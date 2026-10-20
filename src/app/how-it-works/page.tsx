import type { Metadata } from "next";
import { PublicShell, PublicCtaGroup } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { FIRST_USE, HOW_IT_WORKS } from "@/lib/trust-content";

export const metadata: Metadata = {
  title: "How SolenOS Works",
  description: HOW_IT_WORKS.heroSubheadline,
};

export default function HowItWorksPage() {
  const h = HOW_IT_WORKS;
  const f = FIRST_USE;

  return (
    <PublicShell activeHref="/how-it-works">
      <OpsPageView page="/how-it-works" />
      <section className="public-hero">
        <p className="public-eyebrow">How it works</p>
        <h1 className="public-hero-title">{h.heroHeadline}</h1>
        <p className="public-hero-lede">{h.heroSubheadline}</p>
        <PublicCtaGroup />
      </section>

      {h.sections.map((section) => (
        <section key={section.id} className="public-section" id={section.id}>
          <h2 className="public-section-title">{section.title}</h2>
          {section.body.map((p) => (
            <p key={p} className="public-prose">
              {p}
            </p>
          ))}
        </section>
      ))}

      <section className="public-section" id="first-use">
        <h2 className="public-section-title">{f.title}</h2>
        <h3 className="public-subsection-title">{f.leadTitle}</h3>
        {f.leadBody.map((p) => (
          <p key={p} className="public-prose">
            {p}
          </p>
        ))}
        <ol className="public-steps">
          {f.steps.map((step, i) => (
            <li key={step.title}>
              <span className="public-step-num">{i + 1}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <blockquote className="public-pull">
          When you first use SolenOS, you should feel: &ldquo;{f.firstFeeling}&rdquo;
          <br />
          <span className="public-muted">Not: &ldquo;{f.notFeeling}&rdquo;</span>
        </blockquote>
      </section>

      <section className="public-section public-closing">
        <h2 className="public-section-title">{h.closing.title}</h2>
        {h.closing.body.map((p) => (
          <p key={p} className="public-prose">
            {p}
          </p>
        ))}
        <PublicCtaGroup />
      </section>
    </PublicShell>
  );
}
