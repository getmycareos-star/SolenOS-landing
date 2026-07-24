import Link from "next/link";
import {
  RESEARCH_PREVIEW_SECTION,
  FREE_EARLY_ACCESS_SECTION,
  WHY_SOLENOS_EXISTS_SHORT,
  WHAT_SOLENOS_DOES,
  WHAT_SOLENOS_DOES_NOT,
  YOUR_INFORMATION_SECTION,
  HOW_TO_USE_SECTION,
  QUESTIONS_EXPECTATION_SECTION,
  MEDICAL_DISCLAIMER_SHORT,
  CONTINUING_AGREEMENT,
  FEEDBACK_INVITE,
  EARLY_USER_STATUS,
  SUPPORT_EMAIL,
} from "@/lib/early-access-trust";
import { getHomeFaqItems, MVP_FAQ_PHILOSOPHY } from "@/lib/mvp-faq";
import { FaqList } from "@/components/public/FaqList";

/**
 * Trust stack on the existing Home (/welcome) — not a separate onboarding wall.
 */
export function WelcomeTrustStack() {
  const homeFaq = getHomeFaqItems();

  return (
    <>
      <section className="public-section" aria-labelledby="why-exists">
        <h2 id="why-exists" className="public-section-title">
          {WHY_SOLENOS_EXISTS_SHORT.title}
        </h2>
        {WHY_SOLENOS_EXISTS_SHORT.body.map((p) => (
          <p key={p} className="public-prose">
            {p}
          </p>
        ))}
        <p className="public-prose">{MVP_FAQ_PHILOSOPHY}</p>
      </section>

      <section className="public-section" aria-labelledby="research-preview">
        <h2 id="research-preview" className="public-section-title">
          {RESEARCH_PREVIEW_SECTION.title}
        </h2>
        <p className="public-prose">{RESEARCH_PREVIEW_SECTION.lead}</p>
        <p className="public-prose">{RESEARCH_PREVIEW_SECTION.complexity}</p>
        <p className="public-prose">During this stage, you may notice:</p>
        <ul className="public-quiet-list">
          {RESEARCH_PREVIEW_SECTION.mayNotice.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="public-prose">{RESEARCH_PREVIEW_SECTION.feedback}</p>
        <p className="public-prose">
          <Link href="/capabilities">Current capabilities</Link>
        </p>
      </section>

      <section className="public-section" aria-labelledby="free-early">
        <h2 id="free-early" className="public-section-title">
          {FREE_EARLY_ACCESS_SECTION.title}
        </h2>
        {FREE_EARLY_ACCESS_SECTION.body.map((p) => (
          <p key={p} className="public-prose">
            {p}
          </p>
        ))}
      </section>

      <section className="public-section" aria-labelledby="does-does-not">
        <h2 id="does-does-not" className="public-section-title">
          {WHAT_SOLENOS_DOES.title}
        </h2>
        <ul className="public-quiet-list">
          {WHAT_SOLENOS_DOES.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3 className="public-section-title">{WHAT_SOLENOS_DOES_NOT.title}</h3>
        <ul className="public-quiet-list">
          {WHAT_SOLENOS_DOES_NOT.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="public-prose">{WHAT_SOLENOS_DOES_NOT.closing}</p>
      </section>

      <FaqList
        items={homeFaq}
        headingId="home-faq"
        title="Common questions"
        showMoreHref="/support#faq"
        showMoreLabel="See all questions in Help"
      />

      <section className="public-section" aria-labelledby="your-info">
        <h2 id="your-info" className="public-section-title">
          {YOUR_INFORMATION_SECTION.title}
        </h2>
        {YOUR_INFORMATION_SECTION.body.map((p) => (
          <p key={p} className="public-prose">
            {p}
          </p>
        ))}
        <p className="public-prose">
          Learn more: <Link href="/privacy">Privacy Policy</Link> ·{" "}
          <Link href="/terms">Terms of Service</Link>
        </p>
      </section>

      <section className="public-section" aria-labelledby="how-to-use">
        <h2 id="how-to-use" className="public-section-title">
          {HOW_TO_USE_SECTION.title}
        </h2>
        <p className="public-prose">{HOW_TO_USE_SECTION.lead}</p>
        <ul className="public-quiet-list">
          {HOW_TO_USE_SECTION.examples.map((ex) => (
            <li key={ex}>{ex}</li>
          ))}
        </ul>
        <p className="public-prose">{HOW_TO_USE_SECTION.closing}</p>
      </section>

      <section className="public-section" aria-labelledby="asks-context">
        <h2 id="asks-context" className="public-section-title">
          {QUESTIONS_EXPECTATION_SECTION.title}
        </h2>
        {QUESTIONS_EXPECTATION_SECTION.body.map((p) => (
          <p key={p} className="public-prose">
            {p}
          </p>
        ))}
      </section>

      <section className="public-section" aria-labelledby="safety-notice">
        <h2 id="safety-notice" className="public-section-title">
          Important
        </h2>
        <p className="public-prose">{MEDICAL_DISCLAIMER_SHORT}</p>
      </section>

      <section className="public-section" aria-labelledby="early-user">
        <h2 id="early-user" className="public-section-title">
          {EARLY_USER_STATUS.title}
        </h2>
        <p className="public-prose">{EARLY_USER_STATUS.body}</p>
        <p className="public-prose">{FEEDBACK_INVITE}</p>
        <p className="public-prose">
          Questions or feedback?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </section>

      <section className="public-section" aria-labelledby="agree-continue">
        <p className="public-prose">
          {CONTINUING_AGREEMENT}{" "}
          <Link href="/terms">Terms of Service</Link> ·{" "}
          <Link href="/privacy">Privacy Policy</Link>
        </p>
      </section>
    </>
  );
}
