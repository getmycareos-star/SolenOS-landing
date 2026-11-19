import type { Metadata } from "next";
import Link from "next/link";
import LandingStartLink from "@/components/public/LandingStartLink";
import { PublicShell } from "@/components/public/PublicShell";
import "./landing.css";

export const metadata: Metadata = {
  title: "SolenOS — The care journey, remembered.",
  description:
    "A Living Care Record for family caregivers. Keep the moments, changes, decisions and details of care together.",
};

const start = "/workspace?enter=1";

const careSteps = [
  {
    number: "01",
    title: "Record what happened",
    body: "Something happened today: a change, a concern, a difficult night or a moment worth remembering. Write it down in your own words and keep it with the care story.",
  },
  {
    number: "02",
    title: "Keep important documents together",
    body: "Add appointment notes, care instructions and other important documents so they have a place alongside the rest of the care story.",
  },
  {
    number: "03",
    title: "Correct information when something is wrong",
    body: "When a detail changes or needs correcting, the record should reflect that. An earlier mistake should not quietly become the truth.",
  },
  {
    number: "04",
    title: "Return to what happened before",
    body: "Come back to earlier information and look at what has changed, what is still unclear and what may need attention.",
  },
  {
    number: "05",
    title: "Ask about the care story",
    body: "Ask the Care Assistant about information recorded in SolenOS. It is designed to help find relevant details and be clear when an answer is missing or uncertain.",
  },
  {
    number: "06",
    title: "Keep decisions connected to what happens next",
    body: "A decision is rarely the end of a care matter. Keep the next events, changes and unanswered questions connected to the story.",
  },
];

const burdenLeft = [
  "What happened yesterday.",
  "What the doctor said last month.",
  "When something first started to change.",
  "Which information was confirmed.",
  "What the family discussed and decided.",
  "What you tried and what happened afterward.",
];
const burdenRight = [
  "What you are still waiting to understand.",
  "What you meant to ask.",
  "What happened after a decision.",
  "What another family member needs to know.",
  "What still needs an answer.",
];

const appointmentQuestions = [
  "What changed since the last appointment?",
  "What happened afterward?",
  "What are you concerned about?",
  "What did the family notice?",
  "What did you want to ask?",
  "What still needs an answer?",
];

export default function LandingPage() {
  return (
    <PublicShell activeHref="/" hideNavLinks>
      <div className="editorial-landing">
        <section className="el-hero">
          <div className="el-hero-copy">
            <p className="el-kicker">A LIVING CARE RECORD FOR FAMILY CAREGIVERS</p>
            <h1>You shouldn’t have to remember an entire care journey on your own.</h1>
            <p>
              Care happens every day. A change in someone’s health. A conversation
              with a doctor. A decision made by the family. A small detail that
              becomes important weeks later.
            </p>
            <p>
              SolenOS helps you keep the story of someone’s care together — so you
              can look back, understand what has changed and find the details that
              matter.
            </p>
            <LandingStartLink href={start} className="el-button">
              Start your Living Care Record <span aria-hidden="true">↗</span>
            </LandingStartLink>
            <p className="el-early-note">
              SolenOS is in early access. We’re working with family caregivers to
              improve the experience.
            </p>
          </div>
          <div
            className="el-hero-photo"
            role="img"
            aria-label="A daughter sharing a quiet, affectionate moment with her elderly mother"
          >
            <div className="el-photo-caption">Care is made of moments.</div>
          </div>
        </section>

        <section className="el-burden">
          <div className="el-burden-copy">
            <p className="el-kicker">THE PART NO ONE SEES</p>
            <h2>The invisible burden of caregiving.</h2>
            <p className="el-italic">
              It’s not just remembering information. It’s remembering the
              connections between things.
            </p>
            <div className="el-two-lists">
              <ul>{burdenLeft.map((item) => <li key={item}>{item}</li>)}</ul>
              <ul>{burdenRight.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <p className="el-burden-close">
              You’re not just keeping track of care.
              <br />
              <strong>You’re trying to hold an entire story together.</strong>
            </p>
          </div>
          <div
            className="el-burden-photo"
            role="img"
            aria-label="Family members sitting together and talking"
          />
        </section>

        <section className="el-reassurance">
          <div
            className="el-reassurance-photo"
            role="img"
            aria-label="An adult child supporting an older parent"
          />
          <div className="el-reassurance-copy">
            <h2>You can care deeply without having to remember everything.</h2>
            <p className="el-italic">
              You shouldn’t have to search through old messages to remember what
              happened.
            </p>
            <p>
              You shouldn’t have to explain the same story from the beginning
              every time another family member helps. And you shouldn’t have to
              depend on memory alone to recognise that something has changed.
            </p>
            <p>
              SolenOS is being built to give the care journey a place to come
              together — one moment, one observation and one decision at a time.
            </p>
          </div>
        </section>

        <section className="el-how" id="what-solenos-helps">
          <div className="el-how-heading">
            <p className="el-kicker">YOUR CARE STORY, IN ONE PLACE</p>
            <h2>Care doesn’t happen in separate pieces. Your care history shouldn’t either.</h2>
            <p>
              SolenOS brings together the everyday details that can otherwise
              become scattered across conversations, documents and memory.
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
            A clearer picture of care, built one moment at a time.
          </p>
        </section>

        <section className="el-truth">
          <p className="el-kicker">THE DETAILS MATTER</p>
          <h2>A care record should never pretend to know something it doesn’t.</h2>
          <p className="el-truth-intro">
            Not every report is confirmed. Not every question has an answer. And
            not every change has an obvious explanation. SolenOS is designed to
            make those differences clear.
          </p>
          <div className="el-truth-grid">
            <article><h3>What’s known</h3><p>Information that has been recorded and confirmed.</p></article>
            <article><h3>What’s uncertain</h3><p>Something has been reported, but it still needs clarification.</p></article>
            <article><h3>What’s missing</h3><p>A detail that hasn’t been provided or recorded.</p></article>
            <article><h3>What needs attention</h3><p>A question or matter that may need someone to follow up.</p></article>
          </div>
          <p className="el-truth-close">
            A useful care history should help you understand what is known —
            without making things up to fill the gaps.
          </p>
          <p className="el-disclaimer">
            SolenOS does not diagnose medical conditions, prescribe treatment or
            replace healthcare professionals.
          </p>
        </section>

        <section className="el-context">
          <article>
            <p className="el-kicker">WHY THE WHOLE STORY MATTERS</p>
            <h2>One moment rarely tells the whole story.</h2>
            <p>
              A person has a difficult night. A few days later, something else
              seems different. A family member notices a change. An appointment
              takes place. A decision is made.
            </p>
          </article>
          <article>
            <p>
              Then two weeks pass. Something happens again. And the question
              becomes:
            </p>
            <p className="el-question">
              “Has this happened before? Is anything different? What happened
              the last time?”
            </p>
            <p>
              When each moment is kept separately, it becomes harder to see how
              they relate. When moments are brought together, you have more of
              the history to consider.
            </p>
          </article>
          <article>
            <h2>The next care decision should not have to start with a forgotten past.</h2>
            <p>
              SolenOS is being built around that simple idea: keep the moments
              connected, so the story is easier to return to.
            </p>
          </article>
        </section>

        <section className="el-handoff">
          <div className="el-handoff-copy">
            <p className="el-kicker">CARE IS A FAMILY RESPONSIBILITY</p>
            <h2>When you can’t be there, the story shouldn’t disappear with you.</h2>
            <p>
              Perhaps your sister is looking after your mother this weekend.
              Perhaps another family member needs to take your father to an
              appointment. They may need to understand what has changed, what
              has already happened and what the family still needs to discuss.
            </p>
            <p>
              SolenOS is designed to help caregivers keep important care
              information together, so the people involved can have a clearer
              picture of the journey.
            </p>
            <p className="el-green">
              Caring for someone should not mean that one person has to
              remember everything.
            </p>
          </div>
          <div className="el-process" aria-label="How care moments connect">
            {["Moment", "Change", "Decision", "Outcome", "Next moment"].map((label, index) => (
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
            <p className="el-kicker">PREPARING FOR APPOINTMENTS</p>
            <h2>You know the story. Now you need to tell it clearly.</h2>
            <p>
              An appointment can be over before you’ve remembered everything
              you wanted to say.
            </p>
            <ul>{appointmentQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
            <p className="el-green">
              SolenOS is designed to help you return to relevant care information
              and prepare the details and questions you want to bring to a
              conversation with a healthcare professional.
            </p>
          </div>
          <div className="el-dementia-copy">
            <p className="el-kicker">WHY WE STARTED WITH DEMENTIA CARE</p>
            <h2>Dementia changes more than memory. It changes the whole family experience of care.</h2>
            <p>
              Caregiving can bring a constant stream of questions, changing
              responsibilities and difficult decisions. Families may find
              themselves trying to remember conversations, understand changes,
              coordinate support and make sense of what happened over time.
            </p>
          </div>
          <div className="el-dementia-note">
            <p>
              We started with the realities of dementia caregiving because the
              need for continuity is especially clear there.
            </p>
            <p>
              But the need is not limited to dementia. Any family caring for
              someone over time deserves a better way to keep the story together.
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
            <h2>Ask about the care journey. Find the details you may have forgotten.</h2>
            <p>
              Sometimes you remember that something happened, but not exactly
              when. The Care Assistant is designed to help you ask questions
              about information in the care record and find relevant details.
            </p>
            <p>
              It should also be clear when the record does not contain an answer.
              It is not a doctor, does not replace professional advice and
              should never invent an answer just to sound certain.
            </p>
          </div>
          <div className="el-companion-principle">
            <h2>Helpful support begins with being honest about what is known and what isn’t.</h2>
            <p>
              SolenOS is designed to organise and preserve understanding. It
              does not diagnose, prescribe or replace healthcare professionals.
            </p>
          </div>
        </section>

        <section className="el-early-access">
          <p className="el-kicker">EARLY ACCESS</p>
          <h2>Help us build something that understands the realities of caregiving.</h2>
          <p>
            We’re working with a small group of family caregivers to test and
            improve how SolenOS helps families keep track of care over time.
          </p>
          <p>
            Some features are still being developed. Some experiences may change
            as we learn what works and what caregivers actually need.
          </p>
          <p>
            Your feedback will help us make SolenOS more useful, understandable
            and dependable. We’re building with caregivers because the people
            who live with the responsibility of care should have a say in the
            tools meant to support them.
          </p>
          <LandingStartLink href={start} className="el-button">
            Start your Living Care Record <span aria-hidden="true">↗</span>
          </LandingStartLink>
        </section>

        <section className="el-final-cta">
          <div className="el-leaves el-leaves-left" aria-hidden="true">❧</div>
          <div className="el-final-copy">
            <h2>You already carry enough.</h2>
            <p className="el-italic">
              You shouldn’t have to carry the whole care story in your head, too.
            </p>
            <p>
              Start with what you know. Record a moment. Add information when
              you’re ready. Build the story over time. You don’t need to organise
              everything before you begin.
            </p>
            <LandingStartLink href={start} className="el-button">
              Start your Living Care Record <span aria-hidden="true">↗</span>
            </LandingStartLink>
            <p className="el-tagline">The care journey, remembered.</p>
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
