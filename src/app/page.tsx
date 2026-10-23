import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import "./landing.css";

export const metadata: Metadata = {
  title: "SolenOS — The care journey, remembered.",
  description: "A Living Care Record for family caregivers. Keep the moments, changes, decisions and context of care connected in one place.",
};

const start = "/workspace?enter=1";
const capabilities = [
  ["⌕", "What happened?", "Keep important moments together."],
  ["↔", "What changed?", "See what is different across the care journey — not just what was written most recently."],
  ["♧", "What matters now?", "Bring context that matters forward."],
  ["ⓘ", "What should I ask?", "Carry questions that matter into the next conversation."],
  ["☷", "What still needs attention?", "See what remains unresolved, unclear, or waiting for follow-up."],
  ["◷", "What happened afterward?", "Keep decisions connected to what happened next."],
];

export default function LandingPage() {
  return (
    <PublicShell activeHref="/" hideNavLinks>
      <div className="editorial-landing">
        <section className="el-hero">
          <div className="el-hero-copy">
            <p className="el-kicker">A LIVING CARE RECORD FOR FAMILY CAREGIVERS</p>
            <h1>You know something happened.<br /><em>You just don’t remember it as one story.</em></h1>
            <p>Care happens in moments.<br />But you’re expected to remember the whole story.</p>
            <Link href={start} className="el-button">Start your care record <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="el-hero-photo" role="img" aria-label="A daughter sharing a quiet, affectionate moment with her elderly mother">
            <div className="el-photo-caption">Care is made of moments.</div>
          </div>
        </section>

        <section className="el-burden">
          <div className="el-burden-copy">
            <p className="el-kicker">THE PART NO ONE SEES</p>
            <h2>The invisible burden<br />of caregiving</h2>
            <p className="el-italic">It’s not just remembering information.<br />It’s remembering the connections between things.</p>
            <div className="el-two-lists">
              <ul>{["Who said what.", "When something changed.", "What the doctor recommended.", "What the family decided.", "Why that decision was made.", "What you tried.", "What helped.", "What didn’t."].map(x => <li key={x}>{x}</li>)}</ul>
              <ul>{["What you’re still waiting to understand.", "What you meant to ask.", "What happened after the decision.", "What still needs attention."].map(x => <li key={x}>{x}</li>)}</ul>
            </div>
            <p className="el-burden-close">You’re not simply carrying information.<br /><strong>You’re carrying context.</strong></p>
          </div>
          <div className="el-burden-photo" role="img" aria-label="Family members sitting together and talking" />
        </section>

        <section className="el-reassurance">
          <div className="el-reassurance-photo" role="img" aria-label="An adult child supporting an older parent" />
          <div className="el-reassurance-copy">
            <h2>You can care deeply<br />without having to<br />remember everything.</h2>
            <p className="el-italic">You love them.<br />That’s why you’re doing all of this.</p>
            <p>But loving someone doesn’t mean you should have to become the family’s memory. You shouldn’t have to search through months of messages to remember what happened. You shouldn’t have to keep replaying conversations in your head. You shouldn’t have to explain the same story from the beginning every time someone new steps in.</p>
            <p>SolenOS helps you carry the story without having to carry all of it alone.</p>
          </div>
        </section>

        <section className="el-capabilities" id="what-solenos-helps">
          <div className="el-cap-intro"><h2>What SolenOS<br />actually helps<br />you see</h2><p className="el-italic">When everything starts<br />to blur together,<br />start with the story.</p></div>
          {capabilities.map(([icon, title, body]) => <article className="el-cap" key={title}><span className="el-cap-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{body}</p></article>)}
        </section>

        <section className="el-context">
          <article><h2>One moment rarely tells<br />the whole story.</h2><p>A medication changes.<br />Something seems different.<br />Someone mentions a concern.<br />An appointment happens.<br />A decision gets made.<br />A few weeks pass.<br /><strong>Something else changes.</strong></p><p>Then someone asks:<br /><em>“Has this happened before?”</em><br />Maybe it has. Maybe you remember.<br />Maybe you don’t.</p></article>
          <article><p>Without context, every moment can look like a separate problem.</p><p>With context, the moments begin to tell a story.</p><p>SolenOS helps connect the moments that make up the care journey — so the next moment doesn’t have to start from zero.</p></article>
          <article><h2>When you can’t be there,<br />the story shouldn’t disappear<br />with you.</h2><p>Maybe your sister is taking over for the weekend. Maybe another family member needs to step in. Maybe someone else is suddenly responsible for something you normally handle.</p><p>SolenOS helps preserve the context behind the care story so someone else can understand where things are, what has changed, and what still matters.</p><p className="el-green">Care should be transferable.<br />Context shouldn’t disappear when<br />a caregiver steps away.</p></article>
        </section>

        <section className="el-process" aria-label="How care moments connect">
          {["Moment", "Change", "Decision", "Outcome", "Next moment"].map((label, i) => <div className="el-process-step" key={label}><span>{["◷", "↔", "✓", "♡", "→"][i]}</span><small>{label}</small></div>)}
        </section>

        <section className="el-appointments">
          <div className="el-appointment-photo" role="img" aria-label="A caregiver preparing notes before an appointment" />
          <div className="el-appointment-copy"><p className="el-kicker">APPOINTMENTS</p><h2>You know the story.<br />Now you need to tell it<br />clearly.</h2><ul>{["What changed since the last appointment?", "What happened afterward?", "What are you concerned about?", "What did the family notice?", "What did you want to ask?", "What did you forget to ask last time?", "What happened after the recommendation?"].map(x => <li key={x}>{x}</li>)}</ul><p className="el-green">SolenOS helps bring the relevant story and questions with you.</p><p>So you’re not walking into the room trying to remember the last three months on the way in.</p></div>
          <div className="el-dementia-copy"><h2>Dementia can change<br />the shape of a family.</h2><p>The person you love is still the person you love. But the roles can change. The questions change. The decisions become harder. The future becomes less certain.</p><p>And sometimes the person who once remembered things for everyone else becomes the person everyone is trying to remember things for.</p><p className="el-green">Care can become more continuous.<br />More complicated.<br />More dependent on context.</p></div>
          <div className="el-dementia-note"><p>That’s why SolenOS is starting with dementia care.</p><p>Not because dementia is the whole problem. Because dementia makes the need for continuity impossible to ignore.</p><p>But the need doesn’t stop there. Families caring for someone through a changing health journey deserve a way to keep the story together.</p></div>
        </section>

        <section className="el-trust">
          <div className="el-trust-photo" role="img" aria-label="A caregiver and older family member looking at a phone together" />
          <article><h2>What if you didn’t have to hold<br />it all in your head?</h2><p>Not because you care less.<br />Because you finally have somewhere for the story to live.</p></article>
          <article><h2>SolenOS won’t pretend to know<br />what you don’t know.</h2><p>Care is full of incomplete information. Something may be known. Something may be uncertain. Something may be missing. Something may need clarification.</p></article>
          <article><p>SolenOS keeps those distinctions visible.</p><p>Because the last thing a caregiver needs is a system that turns uncertainty into confidence.</p><p>If something isn’t clear, it should be clear that it isn’t clear.</p><p className="el-green">SolenOS is designed to organise and preserve understanding. It does not diagnose, prescribe, or replace healthcare professionals.</p></article>
        </section>

        <section className="el-final-cta">
          <div className="el-leaves el-leaves-left" aria-hidden="true">❧</div>
          <div><h2>You already carry enough.</h2><p className="el-italic">You shouldn’t have to carry the whole care story in your head, too.</p><p>Give the story somewhere to live. Somewhere to return to. Somewhere the next person can understand.<br />Somewhere the past can help make sense of what is happening now.</p><Link href={start} className="el-button">Start care record <span aria-hidden="true">↗</span></Link><p className="el-tagline">The care journey, remembered.</p></div>
          <aside><strong>David Abuchi</strong><br />Founder &amp; CEO<br /><Link href="/our-story">Read our story →</Link></aside>
          <div className="el-leaves el-leaves-right" aria-hidden="true">❧</div>
        </section>

        <section className="el-more-links" aria-label="Explore SolenOS">
          <Link href="/how-it-works">The SolenOS approach</Link><Link href="/why-solenos">Why SolenOS</Link><Link href="/our-story">Our story</Link><Link href="/about">About</Link><Link href="/support">Support</Link><Link href="/privacy">Privacy</Link>
        </section>
      </div>
    </PublicShell>
  );
}
