"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  RESEARCH_PREVIEW_SECTION,
  MEDICAL_DISCLAIMER_SHORT,
  hasResearchPreviewAck,
  markResearchPreviewAck,
  SUPPORT_EMAIL,
} from "@/lib/early-access-trust";

/**
 * One-time early-version acknowledgement for new product entrants.
 * Not a separate welcome page — overlays lightly until accepted.
 */
export function ResearchPreviewAckGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [needsAck, setNeedsAck] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setNeedsAck(!hasResearchPreviewAck());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!needsAck) return <>{children}</>;

  return (
    <div className="research-preview-ack" role="dialog" aria-labelledby="rp-ack-title">
      <div className="research-preview-ack-inner">
        <h2 id="rp-ack-title" className="workspace-headline">
          {RESEARCH_PREVIEW_SECTION.title}
        </h2>
        <p className="workspace-lede">{RESEARCH_PREVIEW_SECTION.lead}</p>
        <p className="panel-muted">{MEDICAL_DISCLAIMER_SHORT}</p>
        <p className="panel-muted">
          By continuing, you agree to our{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
          .
        </p>
        <label className="research-preview-ack-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>{RESEARCH_PREVIEW_SECTION.ackLabel}</span>
        </label>
        <button
          type="button"
          className="workspace-primary"
          disabled={!checked}
          onClick={() => {
            markResearchPreviewAck();
            setNeedsAck(false);
          }}
        >
          Continue
        </button>
        <p className="panel-muted">
          Feedback: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
