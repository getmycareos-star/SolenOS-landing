"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const clearDraftForSessionChange = () => {
      setDraft(null);
      setAudience(null);
      setPurpose(null);
    };
    window.addEventListener("personIdChanged", clearDraftForSessionChange);
    return () => window.removeEventListener("personIdChanged", clearDraftForSessionChange);
  }, []);

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
          <p className="workspace-handoffs-eyebrow">CARE HANDOFFS</p>
          <h1 id="care-handoffs-title">Care handoffs</h1>
          <p>Prepare a care summary, review what will be shared, and manage summaries shared with you or by you.</p>
        </div>

      </header>

      <aside className="workspace-handoffs-boundary" role="note">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          Check every summary before sharing. Preparing a summary does not change your Care Record. Only people approved to access this Care Record can receive it. Shared links expire.
        </p>
      </aside>

      {draft && (
        <button type="button" className="workspace-handoffs-back" onClick={returnToHandoffs}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to summaries
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
