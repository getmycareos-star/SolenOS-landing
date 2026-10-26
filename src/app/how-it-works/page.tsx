import type { Metadata } from "next";
import { PublicShell, PublicCtaGroup } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { FIRST_USE, HOW_IT_WORKS } from "@/lib/trust-content";

export const metadata: Metadata = {
  title: "How SolenOS Works",
  description: HOW_IT_WORKS.heroSubheadline,
};

const CARE_EXPERIENCE = [
  {
    title: "Living Care Record",
    subtitle: "Understand the full care story",
    body:
      "The Living Care Record (LCR) is the long-term, organized history of a person's care. It brings together recorded observations, events, documents, decisions, and follow-up questions so caregivers can review what has happened over time.",
    useWhen:
      "Use it to review care history, find earlier information, prepare a source-grounded summary, and see what is known, uncertain, or still missing.",
  },
  {
    title: "Daily Care",
    subtitle: "Capture what is happening today",
    body:
      "Daily Care is the practical place to record new observations, important events, changes, and corrections as care happens. It helps caregivers capture what they observed without having to explain the whole history every time.",
    useWhen:
      "Use it when something happens today, when you need to add or correct a care note, or when you want to capture an update for later review.",
  },
  {
    title: "AI Companion",
    subtitle: "Get help working through care situations",
    body:
      "AI Companion helps caregivers organize their thoughts, understand available information, prepare questions, and get ready for appointments or care handoffs. It can use relevant, authorized care context when available, while making uncertainty clear.",
    useWhen:
      "Use it when you want help thinking through a situation, making sense of information, or preparing what to ask a care professional.",
  },
] as const;

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

      <section className="public-section" id="three-parts">
        <h2 className="public-section-title">
          Three connected parts. One continuous care story.
        </h2>
        <p className="public-prose">
          SolenOS has three complementary parts. Each has a different job, and
          together they help caregivers capture what happens, understand the
          wider care story, and prepare for the next step.
        </p>
        <ol className="public-steps">
          {CARE_EXPERIENCE.map((part, i) => (
            <li key={part.title}>
              <span className="public-step-num">{i + 1}</span>
              <div>
                <h3>{part.title}</h3>
                <p><strong>{part.subtitle}.</strong></p>
                <p>{part.body}</p>
                <p><strong>{part.useWhen}</strong></p>
              </div>
            </li>
          ))}
        </ol>
        <h3 className="public-subsection-title">How they work together</h3>
        <p className="public-prose">
          Imagine you notice that a family member has been sleeping poorly.
          Record what you observed in Daily Care. The recorded information can
          become part of the Living Care Record according to the normal save and
          review flow, preserving what was reported and when. Then use AI
          Companion if you want help preparing questions for the next care
          professional. The Companion can help organize those questions, but
          its suggestions do not silently become facts in the care record.
        </p>
        <p className="public-prose">
          You do not have to visit all three parts every time. Something
          happened? Start in Daily Care. Need the bigger picture? Open the
          Living Care Record. Need help thinking, organizing, or preparing?
          Use AI Companion.
        </p>
        <blockquote className="public-pull">
          Capture it in Daily Care. Understand it in your Living Care Record.
          Work through it with AI Companion.
        </blockquote>
        <p className="public-prose">
          The Living Care Record is the foundation and source of truth for
          recorded care information. Daily Care helps add and correct
          information. AI Companion is a support layer, not a medical
          professional and not a separate source of truth. SolenOS should
          distinguish recorded facts from suggestions, uncertainty, and
          missing information.
        </p>
      </section>

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
