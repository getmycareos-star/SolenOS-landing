"use client";

import { apiUrl } from "@/lib/api-url";
import { useCallback, useState } from "react";

type Props = {
  careKey: string;
  situationId?: string | null;
  rawInputExcerpt?: string | null;
  /** The AI-generated content being reported */
  aiContent: string;
};

type Step = "ask" | "details" | "thanks" | "hidden";

const PROBLEM_REPORTING_QUESTION = "Help us identify what went wrong with this AI-generated information. Choose the issue that best describes your concern.";

const PROBLEM_CATEGORIES = [
  {
    id: "incorrect-fact",
    label: "Incorrect fact",
    description: "The response states something that does not match the recorded information or source.",
  },
  {
    id: "missing-context",
    label: "Missing context",
    description: "Important information was omitted, or the response did not account for relevant details.",
  },
  {
    id: "misleading-interpretation",
    label: "Misleading interpretation",
    description: "The recorded facts may be accurate, but the conclusion or interpretation is misleading.",
  },
  {
    id: "unsupported-claim",
    label: "Unsupported claim",
    description: "The response makes a claim that is not adequately supported by the available information.",
  },
  {
    id: "privacy-access-concern",
    label: "Privacy or access concern",
    description: "The response may have exposed information that should not have been available to this user.",
  },
  {
    id: "potentially-unsafe-output",
    label: "Potentially unsafe output",
    description: "The response could lead to harmful action, inappropriate reassurance, or unsafe handling of a care situation.",
  },
  {
    id: "other",
    label: "Other",
    description: "Something else is wrong with this AI-generated content.",
  },
] as const;

export function ProblemReportingPrompt({ 
  careKey, 
  situationId, 
  rawInputExcerpt,
  aiContent 
}: Props) {
  const [step, setStep] = useState<Step>("ask");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!careKey.trim() || !selectedCategory || saving) return;
    
    setSaving(true);
    setSubmitError(null);
    
    try {
      const res = await fetch(apiUrl("/api/report-problem"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          care_key: careKey.trim(),
          category: selectedCategory,
          details: details.trim() || null,
          situation_id: situationId ?? undefined,
          ai_content: aiContent,
          raw_input_excerpt: rawInputExcerpt ?? undefined,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || Server returned );
      }
      
      setStep("thanks");
    } catch (err) {
      setSubmitError(
        err instanceof Error 
          ? err.message 
          : "We couldn't submit your report. Check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  }, [careKey, situationId, rawInputExcerpt, aiContent, selectedCategory, details, saving]);

  if (step === "hidden") return null;

  if (step === "thanks") {
    return (
      <p className="panel-muted research-feedback-thanks" role="status">
        Thank you for flagging this. Your report has been recorded. Submission does not necessarily mean it has been reviewed or resolved.
        <button type="button" className="link-button" onClick={() => setStep("hidden")}>
          Dismiss
        </button>
      </p>
    );
  }

  if (step === "details") {
    return (
      <div className="problem-reporting" aria-label="Problem reporting details">
        <p className="workspace-lede">Please describe what seems incorrect or what context is missing.</p>
        <label className="problem-reporting-field">
          <span>What went wrong? (optional)</span>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            disabled={saving}
            maxLength={4000}
          />
          <p className="panel-muted" style={{ fontSize: "0.875rem" }}>
            {details.length}/4000 characters
          </p>
        </label>
        <div className="situation-actions">
          <button
            type="button"
            className="workspace-primary"
            disabled={saving}
            onClick={submit}
          >
            Submit report
          </button>
          <button
            type="button"
            className="workspace-secondary"
            disabled={saving}
            onClick={() => setStep("ask")}>
            Back to categories
          </button>
        </div>
        <p className="panel-muted">
          Or skip details and submit anyway
        </p>
      </div>
    );
  }

  return (
    <div className="problem-reporting" aria-label="Problem reporting">
      <p className="workspace-lede">{PROBLEM_REPORTING_QUESTION}</p>
      
      {/* Show the AI content being reported (limited for readability) */}
      <div className="problem-reporting-content" style={{ 
        backgroundColor: "#f8f9fa", 
        borderRadius: "4px", 
        padding: "12px", 
        marginBottom: "16px",
        fontSize: "0.875rem"
      }}>
        <p className="workspace-lede" style={{ marginBottom: "8px", fontWeight: "500" }}>
          AI-generated content being reported:
        </p>
        <p className="panel-muted" style={{ 
          whiteSpace: "pre-wrap", 
          wordBreak: "break-word",
          maxHeight: "100px",
          overflowY: "auto"
        }}>
          {aiContent.substring(0, 200)}{aiContent.length > 200 ? "..." : ""}
        </p>
      </div>
      
      <div className="situation-actions" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {PROBLEM_CATEGORIES.map(category => (
          <button
            key={category.id}
            type="button"
            className={workspace-secondary }
            disabled={saving}
            onClick={() => {
              setSelectedCategory(category.id);
              setDetails(""); // Reset details when category changes
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{category.label}</span>
              <span className="panel-muted" style={{ fontSize: "0.875rem" }}>
                {selectedCategory === category.id ? "selected" : ""}
              </span>
            </div>
            <p className="panel-muted" style={{ 
              marginTop: "4px", 
              fontSize: "0.875rem",
              lineHeight: "1.4"
            }}>
              {category.description}
            </p>
          </button>
        ))}
      </div>
      
      {selectedCategory && (
        <div className="situation-actions" style={{ marginTop: "16px" }}>
          <button
            type="button"
            className="workspace-primary"
            disabled={saving}
            onClick={() => setStep("details")}>
            Continue to details
          </button>
          <button
            type="button"
            className="workspace-secondary"
            disabled={saving}
            onClick={submit}>
            Skip details and submit
          </button>
        </div>
      )}
      
      {submitError && (
        <p className="workspace-error" role="alert">
          {submitError}
        </p>
      )}
    </div>
  );
}
