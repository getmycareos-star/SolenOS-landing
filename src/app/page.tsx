import type { Metadata } from "next";
import Link from "next/link";
import LandingStartLink from "@/components/public/LandingStartLink";
import { PublicShell } from "@/components/public/PublicShell";
import "./landing.css";

export const metadata: Metadata = {
  title: "SolenOS — The care journey, remembered.",
  description:
    "A Care Record for family caregivers. Keep care moments, changes and decisions together over time.",
};

const start = "/workspace?enter=1";

const careSteps = [
  {
    number: "01",
    title: "Record a moment",
    body: "Write down a change, concern, difficult night or detail you want to remember. Use your own words.",
  },
  {
    number: "02",
    title: "Keep documents close",
    body: "Keep appointment notes, care instructions and important documents alongside the care history.",
  },
  {
    number: "03",
    title: "Keep the record accurate",
    body: "Correct details when something changes. Earlier mistakes should not quietly become the accepted story.",
  },
  {
    number: "04",
    title: "See what has changed",
    body: "Return to earlier information and review what is different, what is still unclear and what needs follow-up.",
  },
  {
    number: "05",
    title: "Ask about the record",
    body: "Ask the Care Assistant about information saved in your Care Record. It should be clear when the record has no answer.",
  },
  {
    number: "06",
    title: "Keep decisions connected",
    body: "Keep track of what happened after a decision, including outcomes and questions that remain open.",
  },
];

const burdenLeft = [
  "What happened yesterday.",
  "What the doctor said last month.",
  "When something first changed.",
  "What the family decided.",
];
const burdenRight = [
  "What is still uncertain.",
  "What you meant to ask.",
  "What happened afterward.",
  "What another caregiver needs to know.",
];

const appointmentQuestions = [
  "What has changed since the last visit?",
  "What happened afterward?",
  "What concerns the family?",
  "What do you still need to ask?",
];

export default function LandingPage() {
  return (
    <PublicShell activeHref="/" hideNavLinks>
      <div className="editorial-landing">
        <section className="el-hero">
          <div className="el-hero-copy">
            <p className="el-kicker">A CARE RECORD FOR FAMILY CAREGIVERS</p>
            <h1>The whole care story, in one place.</h1>
            <p>
              Care is made up of everyday moments: a change, a conversation,
              an appointment or a decision that matters later.
            </p>
            <p>
              SolenOS helps families keep those moments together, so it is
              easier to return to the details and understand what has changed.
            </p>
            <LandingStartLink href={start} className="el-button">
              Start your Care Record <span aria-hidden="true">↗</span>
            </LandingStartLink>
            <p className="el-early-note">
              SolenOS is in early access. We are learning with family caregivers.
            </p>
          </div>
          <div
            className="el-hero-photo"
            role="img"
            aria-label="A daughter sharing a quiet moment with her elderly mother"
          >
            <div className="el-photo-caption">Care is made of moments.</div>
          </div>
        </section>

        <section className="el-burden">
          <div className="el-burden-copy">
            <p className="el-kicker">THE PART NO ONE SEES</p>
            <h2>Caregiving means carrying a lot of details.</h2>
            <p className="el-italic">
              The hard part is remembering how those details fit together.
            </p>
            <div className="el-two-lists">
              <ul>{burdenLeft.map((item) => <li key={item}>{item}</li>)}</ul>
              <ul>{burdenRight.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <p className="el-burden-close">
              You are not just keeping track of events.
              <br />
              <strong>You are trying to hold a care story together.</strong>
            </p>
          </div>
          <div
            className="el-burden-photo"
            role="img"
            aria-label="Family members sitting together and talking"
          />
        </section>

        <section className="el-how" id="what-solenos-helps">
          <div className="el-how-heading">
            <p className="el-kicker">HOW SOLENOS HELPS</p>
            <h2>A clearer history of care, built over time.</h2>
            <p>
              Keep daily notes, documents, changes and decisions connected
              instead of scattered across messages and memory.
            </p>
          </div>
          <div className="el-how-grid">
            {careSteps.map((step) => (
              <article className="el-how-card" key={step.number}>
                <span className="el-how-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
          <div
            className="el-how-photo"
            role="img"
            aria-label="An older couple reviewing important papers together at home"
          />
          <p className="el-how-caption">
            The details stay connected as the care journey continues.
          </p>
        </section>

        <section className="el-truth">
          <p className="el-kicker">HONEST ABOUT THE DETAILS</p>
          <h2>A care record should be clear about what is known.</h2>
          <p className="el-truth-intro">
            Not every report is confirmed. Not every question has an answer.
            SolenOS is designed to keep those differences visible.
          </p>
          <div className="el-truth-grid">
            <article><h3>Known</h3><p>Information that has been recorded and confirmed.</p></article>
            <article><h3>Uncertain</h3><p>Something has been reported but needs clarification.</p></article>
            <article><h3>Missing</h3><p>A detail that has not been provided or recorded.</p></article>
            <article><h3>Needs follow-up</h3><p>A question or matter that still needs attention.</p></article>
          </div>
          <p className="el-truth-close">
            SolenOS should help families understand the record without filling
            gaps with guesses.
          </p>
          <p className="el-disclaimer">
            SolenOS does not diagnose, prescribe treatment or replace healthcare professionals.
          </p>
        </section>

        <section className="el-handoff">
          <div className="el-handoff-copy">
            <p className="el-kicker">CARE IS SHARED</p>
            <h2>When someone else steps in, the story can come with them.</h2>
            <p>
              A sister takes your mother to an appointment. Another family
              member covers the weekend. They need to know what has changed,
              what has already happened and what still needs an answer.
            </p>
            <p className="el-green">
              SolenOS helps keep important care information together for the
              people involved.
            </p>
          </div>
          <div className="el-process" aria-label="How care moments connect">
            {["Moment", "Change", "Decision", "Outcome", "Next step"].map((label, index) => (
              <div className="el-process-step" key={label}>
                <span>{["◷", "↔", "✓", "♡", "→"][index]}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="el-appointments">
          <div
            className="el-appointment-photo"
            role="img"
            aria-label="A caregiver preparing notes before an appointment"
          />
          <div className="el-appointment-copy">
            <p className="el-kicker">BEFORE AN APPOINTMENT</p>
            <h2>Bring the details and questions that matter.</h2>
            <p>
              It is easy to forget a question or an important detail during
              an appointment. Return to the care history and prepare what
              you want to discuss.
            </p>
            <ul>{appointmentQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="el-dementia-copy">
            <p className="el-kicker">WHERE WE STARTED</p>
            <h2>Built with the realities of dementia care in mind.</h2>
            <p>
              Dementia can bring changing needs, difficult decisions and
              responsibilities shared across a family. We started here because
              the need to keep care information connected over time is especially clear.
            </p>
          </div>
          <div className="el-dementia-note">
            <p>
              The need does not stop with dementia. Every family caring for
              someone over time deserves a reliable way to keep the history.
            </p>
          </div>
        </section>

        <section className="el-companion">
          <div
            className="el-trust-photo"
            role="img"
            aria-label="A caregiver and older family member looking at a phone together"
          />
          <div className="el-companion-copy">
            <p className="el-kicker">THE CARE ASSISTANT</p>
            <h2>Ask about what has been recorded.</h2>
            <p>
              The Care Assistant helps you find relevant details
              in the care record, including information you may not remember
              exactly.
            </p>
            <p>
              If the record does not contain an answer, it should say so.
              It is not a doctor and does not replace professional advice.
            </p>
          </div>
          <div className="el-companion-principle">
            <h2>Useful support starts with an honest record.</h2>
            <p>
              SolenOS does not diagnose or prescribe. It helps organise the
              information families have recorded.
            </p>
          </div>
        </section>

        <section className="el-early-access">
          <p className="el-kicker">EARLY ACCESS</p>
          <h2>Help shape a better way to keep the care story.</h2>
          <p>
            We are working with family caregivers to test and improve SolenOS.
            Some features are still being developed, and the experience will
            improve as we learn what families actually need.
          </p>
        </section>

        <section className="el-final-cta">
          <div className="el-leaves el-leaves-left" aria-hidden="true">❧</div>
          <div className="el-final-copy">
            <h2>The care journey, remembered.</h2>
            <p className="el-italic">
              Start with what you know. Add to the story when you are ready.
            </p>
            <LandingStartLink href={start} className="el-button">
              Start your Care Record <span aria-hidden="true">↗</span>
            </LandingStartLink>
            <p className="el-tagline">One Care Record for family caregivers.</p>
          </div>
          <aside>
            <strong>David Abuchi</strong>
            <br />
            Founder &amp; CEO
            <br />
            <Link href="/our-story">Read our story →</Link>
            <Link
              href="https://www.linkedin.com/in/david-abuchi-43a624407"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="David Abuchi on LinkedIn"
              className="el-linkedin-link"
            >
              <span className="el-linkedin-mark" aria-hidden="true">in</span>
              <span>Connect on LinkedIn</span>
            </Link>
          </aside>
          <div className="el-leaves el-leaves-right" aria-hidden="true">❧</div>
        </section>

        <section className="el-more-links" aria-label="Explore SolenOS">
          <Link href="/how-it-works">The SolenOS approach</Link>
          <Link href="/privacy">Privacy</Link>
        </section>
      </div>
    </PublicShell>
  );
}
