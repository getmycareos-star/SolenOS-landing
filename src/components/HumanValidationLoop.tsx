"use client";



import { useState } from "react";



interface HumanValidationLoopProps {
  interactionId: string;
  /** Care Reality store key — enables one-turn load/containment after confusion feedback. */
  careKey?: string | null;
  onComplete: () => void;
}

async function submitFeedback(payload: {
  interaction_id: string;
  helpful_yes_no: boolean;
  reduced_confusion_yes_no: boolean;
  care_key?: string;
}): Promise<void> {

  await fetch("/api/feedback", {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(payload),

  });

}



export function HumanValidationLoop({
  interactionId,
  careKey,
  onComplete,
}: HumanValidationLoopProps) {

  const [step, setStep] = useState<"helpful" | "confusion" | "done">("helpful");

  const [helpfulValue, setHelpfulValue] = useState<boolean | null>(null);



  async function onHelpfulClick(helpful_yes_no: boolean) {

    setHelpfulValue(helpful_yes_no);

    setStep("confusion");

  }



  async function onConfusionClick(reduced_confusion_yes_no: boolean) {

    if (helpfulValue === null) return;

    await submitFeedback({
      interaction_id: interactionId,
      helpful_yes_no: helpfulValue,
      reduced_confusion_yes_no,
      ...(careKey?.trim() ? { care_key: careKey.trim() } : {}),
    });

    setStep("done");

    onComplete();

  }



  if (step === "done") {

    return null;

  }



  return (

    <div className="validation-loop">

      {step === "helpful" && (

        <div className="validation-step">

          <p className="validation-prompt">Was this helpful?</p>

          <div className="validation-actions">

            <button

              type="button"

              className="btn-validation"

              onClick={() => onHelpfulClick(true)}

            >

              Yes

            </button>

            <button

              type="button"

              className="btn-validation"

              onClick={() => onHelpfulClick(false)}

            >

              No

            </button>

          </div>

        </div>

      )}



      {step === "confusion" && (

        <div className="validation-step validation-step-optional">

          <p className="validation-prompt validation-prompt-optional">

            Did this reduce confusion?

          </p>

          <div className="validation-actions">

            <button

              type="button"

              className="btn-validation btn-validation-muted"

              onClick={() => onConfusionClick(true)}

            >

              Yes

            </button>

            <button

              type="button"

              className="btn-validation btn-validation-muted"

              onClick={() => onConfusionClick(false)}

            >

              No

            </button>

          </div>

        </div>

      )}

    </div>

  );

}


