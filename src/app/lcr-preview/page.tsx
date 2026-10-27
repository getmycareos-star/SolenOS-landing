import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  FileText,
  MessageCircle,
  ShieldCheck,
  Share2,
  Sparkles,
  Upload,
} from "lucide-react";
import "./lcr-preview.css";

export const metadata = {
  title: "Living Care Record Preview | SolenOS",
  description: "A caregiver-first preview of the SolenOS Living Care Record workspace.",
};

export default function LcrPreviewPage() {
  return (
    <main className="lcr-preview">
      <header className="lcr-preview-header">
        <Link className="lcr-preview-brand" href="/" aria-label="SolenOS home">
          <span className="lcr-preview-brand-mark" aria-hidden="true">S</span>
          <span>
            <strong>SolenOS</strong>
            <small>The care journey, remembered.</small>
          </span>
        </Link>
        <Link className="lcr-preview-open" href="/workspace">
          Open current workspace <ArrowRight size={17} aria-hidden />
        </Link>
      </header>

      <div className="lcr-preview-content">
        <div className="lcr-preview-label">
          <span className="lcr-preview-dot" aria-hidden="true" />
          LIVING CARE RECORD
        </div>
        <h1>Your care journey,<br className="lcr-preview-desktop-break" /> in one place.</h1>
        <p className="lcr-preview-intro">
          A calmer place to keep track of what matters, pick up where you left off,
          and share the right information with the people involved in care.
        </p>

        <div className="lcr-preview-note" role="note">
          <ShieldCheck size={19} aria-hidden />
          <span><strong>Design preview</strong> — this screen uses no sample care records and does not change saved care information.</span>
        </div>

        <section className="lcr-preview-current" aria-labelledby="current-heading">
          <div className="lcr-preview-section-heading">
            <div>
              <p className="lcr-preview-eyebrow">YOUR RECORD</p>
              <h2 id="current-heading">A steady place to begin</h2>
            </div>
            <span className="lcr-preview-status"><span aria-hidden="true" /> Ready when you are</span>
          </div>
          <div className="lcr-preview-empty">
            <div className="lcr-preview-empty-icon"><Activity size={27} aria-hidden /></div>
            <div>
              <h3>Nothing you need to sort out all at once.</h3>
              <p>Start with one thing that happened today, add a document, or simply open your record. You can come back to the rest later.</p>
            </div>
          </div>
          <div className="lcr-preview-actions">
            <Link className="lcr-preview-primary" href="/workspace?compose=1">
              <span className="lcr-preview-action-icon"><FileText size={19} aria-hidden /></span>
              <span><strong>Add to the record</strong><small>A note, event, message or document</small></span>
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link className="lcr-preview-secondary" href="/workspace/daily-care">
              <span className="lcr-preview-action-icon"><CalendarDays size={19} aria-hidden /></span>
              <span><strong>Daily care</strong><small>Capture how today is going</small></span>
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </section>

        <section className="lcr-preview-tools" aria-labelledby="tools-heading">
          <div className="lcr-preview-section-heading">
            <div>
              <p className="lcr-preview-eyebrow">WHEN YOU NEED THEM</p>
              <h2 id="tools-heading">Your care tools</h2>
            </div>
          </div>
          <div className="lcr-preview-tool-grid">
            <Link href="/workspace/continuity" className="lcr-preview-tool">
              <span className="lcr-preview-tool-icon"><Activity size={20} aria-hidden /></span>
              <strong>Care history</strong>
              <p>Review saved information, changes and what is still uncertain.</p>
              <span className="lcr-preview-tool-link">Open care history <ArrowRight size={15} aria-hidden /></span>
            </Link>
            <Link href="/workspace/companion" className="lcr-preview-tool">
              <span className="lcr-preview-tool-icon"><MessageCircle size={20} aria-hidden /></span>
              <strong>AI Companion</strong>
              <p>Think through a question with your authorised care context.</p>
              <span className="lcr-preview-tool-link">Open Companion <ArrowRight size={15} aria-hidden /></span>
            </Link>
            <Link href="/workspace/handoffs" className="lcr-preview-tool">
              <span className="lcr-preview-tool-icon"><Share2 size={20} aria-hidden /></span>
              <strong>Care handoffs</strong>
              <p>Prepare and share relevant care information with permission.</p>
              <span className="lcr-preview-tool-link">Open handoffs <ArrowRight size={15} aria-hidden /></span>
            </Link>
            <Link href="/workspace?compose=1" className="lcr-preview-tool">
              <span className="lcr-preview-tool-icon"><Upload size={20} aria-hidden /></span>
              <strong>Documents and notes</strong>
              <p>Keep source documents linked to the information extracted from them.</p>
              <span className="lcr-preview-tool-link">Add information <ArrowRight size={15} aria-hidden /></span>
            </Link>
          </div>
        </section>

        <section className="lcr-preview-principle">
          <span className="lcr-preview-principle-icon"><Sparkles size={20} aria-hidden /></span>
          <div>
            <h2>One record. A clearer picture over time.</h2>
            <p>Daily Care, Documents and the AI Companion should work from the same governed care history. Sources stay visible, uncertainty stays honest, and AI suggestions do not become facts on their own.</p>
          </div>
        </section>

        <div className="lcr-preview-footer">
          <span>Designed around the reality of caring for someone.</span>
          <Link href="/workspace">Continue to SolenOS <ArrowRight size={15} aria-hidden /></Link>
        </div>
      </div>
    </main>
  );
}
