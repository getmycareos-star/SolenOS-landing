"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, FileText, ImagePlus, MessageSquareText, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandLoading } from "@/components/brand";
import QuickDailyCheckIn from "@/components/workflows/QuickDailyCheckIn";
import NaturalLanguageDailyUpdate from "@/components/workflows/NaturalLanguageDailyUpdate";
import DailyCareOfflineQueueNotice from "@/components/workflows/DailyCareOfflineQueueNotice";
import DailyCarePhotoCapture from "@/components/workflows/DailyCarePhotoCapture";

type StructuredCaptureMode = "medicine" | "measurement" | "note";
type CaptureMode = "update" | "photo" | "checkin";

const StructuredDailyCapture = dynamic(
  () => import("@/components/workflows/StructuredDailyCapture"),
  {
    ssr: false,
    loading: () => <BrandLoading animate message="Opening structured entry…" />,
  },
);

const captureOptions: Array<{
  value: CaptureMode;
  label: string;
  detail: string;
  icon: typeof MessageSquareText;
}> = [
  { value: "update", label: "Describe an update", detail: "Tell SolenOS what happened or what you noticed.", icon: MessageSquareText },
  { value: "checkin", label: "Quick check-in", detail: "A few simple choices about how today is going.", icon: ClipboardCheck },
  { value: "photo", label: "Add a photo", detail: "Take a picture or choose an image to add.", icon: ImagePlus },
];

export default function DailyCarePage() {
  const router = useRouter();
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const [structuredMode, setStructuredMode] = useState<StructuredCaptureMode | null>(null);

  const returnToChoices = () => {
    setCaptureMode(null);
    setStructuredMode(null);
  };

  return (
    <div className="mobile-screen daily-care-screen add-update-screen">
      <header className="daily-care-page-head">
        <Button
          variant="secondary"
          className="daily-care-back-button"
          aria-label="Back to Home"
          onClick={() => router.push("/workspace")}
        >
          <ArrowLeft size={18} aria-hidden />
          <span>Home</span>
        </Button>
        <div>
          <p className="daily-care-eyebrow"><CalendarDays size={15} aria-hidden /> ADD AN UPDATE</p>
          <h1>Add an update</h1>
          <p>Tell SolenOS what happened, what you noticed or what you want to remember. Use your own words; you do not need to choose a category.</p>
          <Link href="/workspace/documents" className="daily-care-upload-link">
            <FileText size={16} aria-hidden /> Upload a medical document
          </Link>
        </div>
      </header>

      <DailyCareOfflineQueueNotice />

      <section aria-labelledby="daily-care-capture-title" className="daily-care-context-panel add-update-capture-panel">
        <h2 id="daily-care-capture-title">What would you like to add?</h2>
        <p className="daily-care-muted">Choose the easiest way. You can add more information later.</p>

        {!captureMode ? (
          <div role="group" aria-label="Choose how you want to add care information" className="daily-care-capture-options">
            {captureOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="daily-care-capture-option"
                  onClick={() => setCaptureMode(option.value)}
                >
                  <span className="daily-care-capture-option-icon"><Icon size={18} aria-hidden /></span>
                  <span className="daily-care-capture-option-copy">
                    <strong>{option.label}</strong>
                    <span>{option.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="daily-care-capture-state">
            <div className="daily-care-capture-mode-heading">
              <strong>{captureOptions.find((option) => option.value === captureMode)?.label ?? "Add an update"}</strong>
              <Button variant="secondary" onClick={returnToChoices}>Back to choices</Button>
            </div>

            {captureMode === "checkin" ? (
              <QuickDailyCheckIn />
            ) : captureMode === "photo" ? (
              <div className="daily-care-capture-specialist">
                <DailyCarePhotoCapture />
                <p className="daily-care-muted">Need to add a prescription, report or other medical document? <Link href="/workspace/documents">Upload a medical document</Link>.</p>
              </div>
            ) : captureMode === "update" ? (
              <div className="daily-care-capture-specialist">
                {structuredMode ? (
                  <>
                    <div className="daily-care-capture-mode-heading">
                      <strong>{structuredMode === "medicine" ? "Medication" : structuredMode === "measurement" ? "Measurement" : "Note or observation"}</strong>
                      <Button variant="secondary" onClick={() => setStructuredMode(null)}>Back to written update</Button>
                    </div>
                    <StructuredDailyCapture mode={structuredMode} />
                  </>
                ) : (
                  <>
                    <NaturalLanguageDailyUpdate />
                    <details className="daily-care-structured-options">
                      <summary>Prefer a structured entry?</summary>
                      <p className="daily-care-muted">Use a short form if you would rather record a medication, measurement or note.</p>
                      <div role="group" aria-label="Choose a structured care entry" className="daily-care-capture-options">
                        <button type="button" className="daily-care-capture-option" onClick={() => setStructuredMode("medicine")}>
                          <span className="daily-care-capture-option-copy"><strong>Medication</strong><span>Record a medicine taken, missed or refused.</span></span>
                        </button>
                        <button type="button" className="daily-care-capture-option" onClick={() => setStructuredMode("measurement")}>
                          <span className="daily-care-capture-option-copy"><strong>Measurement</strong><span>Record a reading with its unit.</span></span>
                        </button>
                        <button type="button" className="daily-care-capture-option" onClick={() => setStructuredMode("note")}>
                          <span className="daily-care-capture-option-copy"><strong>Note or observation</strong><span>Save something you noticed or want to remember.</span></span>
                        </button>
                      </div>
                    </details>
                    <p className="daily-care-muted">You can describe a visit, hospital stay, change in routine or anything else that matters to care.</p>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <p className="daily-care-muted add-update-history-link">
        Need to review something already saved? <Link href="/workspace/timeline">Open Care history</Link>.
      </p>
    </div>
  );
}
