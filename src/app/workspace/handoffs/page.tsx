"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CareHandoffSharing } from "@/components/workflows/CareHandoffSharing";

type HandoffDraft = NonNullable<Parameters<typeof CareHandoffSharing>[0]["draft"]>;
type HandoffAudience = Parameters<typeof CareHandoffSharing>[0]["audience"];
type HandoffPurpose = Parameters<typeof CareHandoffSharing>[0]["purpose"];

function purposeForDraft(purpose: string): Exclude<HandoffPurpose, null> {
  if (purpose === "family_transition" || purpose === "return_to_care") return "today";
  if (purpose === "professional_appointment") return "appointment";
  return "overview";
}

export default function HandoffsPage() {
  const [draft, setDraft] = useState<HandoffDraft | null>(null);
  const [audience, setAudience] = useState<HandoffAudience>(null);
  const [purpose, setPurpose] = useState<HandoffPurpose>(null);

  const resumeDraft = (savedDraft: HandoffDraft) => {
    setDraft(savedDraft);
    setAudience(savedDraft.audience ?? (savedDraft.purpose === "professional_appointment" ? "professional" : "family"));
    setPurpose(purposeForDraft(savedDraft.purpose));
  };

  const returnToHandoffs = () => {
    setDraft(null);
    setAudience(null);
    setPurpose(null);
  };

  return (
    <section className="mobile-screen workspace-handoffs-page" aria-labelledby="care-handoffs-title">
      <header className="workspace-handoffs-header">
        <div>
          <p className="workspace-handoffs-eyebrow">CARE COORDINATION</p>
          <h1 id="care-handoffs-title">Care Handoffs</h1>
          <p>Review saved handoff drafts and manage incoming or outgoing care summaries for this record.</p>
        </div>
        <Link href="/workspace/companion" className="workspace-primary workspace-handoffs-create">
          Prepare in AI Companion
        </Link>
      </header>

      <aside className="workspace-handoffs-boundary" role="note">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          Handoffs require caregiver review. Preparing or reviewing a draft does not change the Living Care Record.
          Sharing remains subject to saved consent, verified recipient access, and expiry.
        </p>
      </aside>

      {draft && (
        <button type="button" className="workspace-handoffs-back" onClick={returnToHandoffs}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to all handoffs
        </button>
      )}

      <CareHandoffSharing
        draft={draft}
        audience={audience}
        purpose={purpose}
        onResumeDraft={resumeDraft}
      />
    </section>
  );
}
