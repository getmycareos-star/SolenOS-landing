"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { ensureAnonymousSession, getCaregiverId, getJSON, getPersonId } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { BrandLoading } from "@/components/brand";
import QuickDailyCheckIn from "@/components/workflows/QuickDailyCheckIn";
import DailyCarePhotoCapture from "@/components/workflows/DailyCarePhotoCapture";

const StructuredDailyCapture = dynamic(
  () => import("@/components/workflows/StructuredDailyCapture"),
  {
    ssr: false,
    loading: () => <BrandLoading animate message="Opening daily care…" />,
  },
);

type CaptureMode = "something" | "medicine" | "measurement" | "photo" | "checkin" | "note";

type CareItem = {
  id?: string;
  source_id?: string;
  title?: string;
  description?: string | null;
  text?: string | null;
  occurred_at?: string | null;
  recorded_at?: string | null;
  status?: string | null;
  kind?: string | null;
  epistemic_status?: string | null;
  source_label?: string | null;
  original_text?: string | null;
  corrected_text?: string | null;
  reason?: string | null;
  scheduled_at?: string | null;
  uploaded_at?: string | null;
  source_type?: string | null;
  event_type?: string | null;
  created_by_caregiver_id?: string | null;
  created_at?: string | null;
};

function historyRecordId(item: CareItem): string {
  return item.id || item.source_id || "";
}

function displayCareTime(value?: string | null): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time not recorded"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function isOpenMatter(item: CareItem): boolean {
  return new Set([
    "Conflict",
    "Reconciliation review",
    "Needs clarification",
    "Information missing",
    "Open question",
    "Follow-up",
    "Care event needing attention",
  ]).has(item.kind || "");
}

function displayHistorySource(item: CareItem): string {
  if (item.source_label && item.source_label !== "Source label not recorded") return item.source_label;
  if (item.source_type === "caregiver_report" || item.source_type === "care_event" || item.created_by_caregiver_id) {
    return "Recorded by caregiver";
  }
  if (item.source_type === "system" || item.source_type === "system_generated") {
    return "System-generated update";
  }
  if (item.source_type === "professional" || item.source_type === "verified_professional") {
    return "Professional contribution";
  }
  return "Source not recorded";
}

function displayHistoryTime(item: CareItem): string {
  const eventTime = item.occurred_at;
  const recordedTime = item.recorded_at || item.uploaded_at;
  if (eventTime && recordedTime) {
    const eventDate = new Date(eventTime);
    const recordedDate = new Date(recordedTime);
    if (!Number.isNaN(eventDate.getTime()) && !Number.isNaN(recordedDate.getTime()) &&
        Math.abs(eventDate.getTime() - recordedDate.getTime()) > 60_000) {
      return `Happened: ${displayCareTime(eventTime)} · Recorded: ${displayCareTime(recordedTime)}`;
    }
  }
  if (eventTime) return `Happened: ${displayCareTime(eventTime)}`;
  if (item.scheduled_at) return `Scheduled for: ${displayCareTime(item.scheduled_at)}`;
  if (recordedTime) return `Recorded: ${displayCareTime(recordedTime)}`;
  return "Time not recorded";
}

function classifyHistoryRecord(item: CareItem): "observations" | "medicines" | "measurements" | "checkIns" | "handoffs" | "updates" {
  const eventType = (item.event_type || "").toLowerCase();
  if (eventType.includes("handoff")) return "handoffs";
  if (eventType.includes("checkin") || eventType.includes("check_in")) return "checkIns";
  const raw = item.text || item.description || "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const detail = (parsed.original_capture && typeof parsed.original_capture === "object"
      ? parsed.original_capture
      : parsed) as Record<string, unknown>;
    if (detail.quick_check_in) return "checkIns";
    if (Array.isArray(detail.medications) && detail.medications.length) return "medicines";
    if (Array.isArray(detail.vitals) && detail.vitals.length) return "measurements";
    if (typeof detail.capture_kind === "string" && ["something", "note"].includes(detail.capture_kind)) return "observations";
  } catch {
    // Older entries may not have a structured capture payload.
  }
  if (eventType.includes("observation") || item.source_type === "caregiver_report") return "observations";
  return "updates";
}

function displayHistoryText(item: CareItem): string {
  if (item.source_type === "correction" && (item.original_text || item.corrected_text)) {
    return [
      item.original_text ? `Earlier entry: ${item.original_text}` : "",
      item.corrected_text ? `Correction: ${item.corrected_text}` : "",
      item.reason ? `Reason: ${item.reason}` : "",
    ].filter(Boolean).join(" · ");
  }

  const raw = item.text || item.description || "";
  if (!raw) return item.reason || "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return raw;
    const capture = (parsed.original_capture && typeof parsed.original_capture === "object"
      ? parsed.original_capture
      : parsed) as Record<string, unknown>;
    const quick = (capture.quick_check_in && typeof capture.quick_check_in === "object"
      ? capture.quick_check_in
      : null) as Record<string, unknown> | null;
    const parts: string[] = [];

    if (quick && typeof quick.kind === "string") {
      const labels: Record<string, string> = {
        same_as_usual: "About the same as usual",
        change: "Some things were different",
        uncertain: "It was hard to tell",
        concern: "Caregiver reported a concern",
        care_completed: "Care support was reported",
      };
      parts.push(labels[quick.kind] || "Quick check-in recorded");
    }

    const note = typeof quick?.note === "string" && quick.note.trim()
      ? quick.note.trim()
      : typeof capture.notes === "string" && capture.notes.trim()
        ? capture.notes.trim()
        : typeof capture.original_notes === "string" && capture.original_notes.trim()
          ? capture.original_notes.trim()
          : "";
    if (note) parts.push(note);

    if (Array.isArray(capture.medications)) {
      for (const value of capture.medications) {
        if (!value || typeof value !== "object") continue;
        const medicine = value as Record<string, unknown>;
        const name = typeof medicine.medication_name === "string" ? medicine.medication_name : "Medicine";
        const status = typeof medicine.status === "string" ? medicine.status : "status not recorded";
        const statusLabels: Record<string, string> = {
          given: "reported given",
          not_given: "reported not given",
          uncertain: "not sure whether it was given",
          scheduled: "scheduled; not confirmed as given",
          other: "other medicine event",
          refused: "reported refused",
          missed: "reported missed",
        };
        const scheduledFor = typeof medicine.scheduled_for === "string"
          ? ` (scheduled for ${displayCareTime(medicine.scheduled_for)})`
          : "";
        parts.push(`${name}: ${statusLabels[status] || status}${scheduledFor}`);
      }
    }

    if (Array.isArray(capture.vitals)) {
      for (const value of capture.vitals) {
        if (!value || typeof value !== "object") continue;
        const vital = value as Record<string, unknown>;
        const type = typeof vital.measurement_name === "string" && vital.measurement_name.trim()
          ? vital.measurement_name.trim()
          : typeof vital.vital_type === "string" ? vital.vital_type.replace(/_/g, " ") : "Measurement";
        const reading = vital.value;
        const unit = typeof vital.unit === "string" ? vital.unit : "";
        if (typeof reading === "number" || typeof reading === "string") {
          parts.push(`${type}: ${reading}${unit ? ` ${unit}` : ""}`);
        }
      }
    }

    return parts.length ? parts.join(" · ") : raw;
  } catch {
    return raw;
  }
}

export default function DailyCarePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [careItems, setCareItems] = useState<CareItem[]>([]);
  const [historyItems, setHistoryItems] = useState<CareItem[]>([]);
  const [sinceLastOpenItems, setSinceLastOpenItems] = useState<CareItem[] | null>(null);
  const [lastOpenedAt, setLastOpenedAt] = useState<string | null>(null);
  const [historyMayBeTruncated, setHistoryMayBeTruncated] = useState(false);
  const visitBaselineRef = useRef<{ initialized: boolean; previousVisit: string | null }>({
    initialized: false,
    previousVisit: null,
  });
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState("");

  useEffect(() => {
    let active = true;
    setContextLoading(true);
    setContextError("");
    void ensureAnonymousSession()
      .then(async () => {
        // Do not make caregivers wait for current-care and history reads before
        // they can record an update. The capture interface is useful as soon
        // as the anonymous session is ready; context can finish loading below.
        if (active) setReady(true);
        const [careResult, historyResult] = await Promise.allSettled([
          getJSON("/care-continuity/current-care?limit_per_source=20"),
          getJSON("/daily-care/intelligence/history?limit=200&offset=0"),
        ]);
        if (!active) return;

        if (careResult.status === "fulfilled") {
          const payload = careResult.value as { items?: unknown };
          setCareItems(Array.isArray(payload?.items) ? payload.items as CareItem[] : []);
        } else {
          setContextError("Current care information could not be loaded. Try refreshing the record.");
        }

        if (historyResult.status === "fulfilled") {
          const payload = historyResult.value as {
            records?: unknown;
            page?: { has_more?: boolean };
          };
          const records = Array.isArray(payload?.records) ? payload.records as CareItem[] : [];
          setHistoryItems(records);
          setHistoryMayBeTruncated(Boolean(payload.page?.has_more));

          const personId = getPersonId();
          const caregiverId = getCaregiverId();
          if (personId && caregiverId && careResult.status === "fulfilled") {
            const visitKey = `solenos:daily-care:last-opened:${personId}:${caregiverId}`;
            if (!visitBaselineRef.current.initialized) {
              let previousVisit: string | null = null;
              try {
                previousVisit = window.localStorage.getItem(visitKey);
              } catch {
                previousVisit = null;
              }
              visitBaselineRef.current = { initialized: true, previousVisit };
              setLastOpenedAt(previousVisit);
              try {
                window.localStorage.setItem(visitKey, new Date().toISOString());
              } catch {
                // History remains available if this browser blocks local storage.
              }
            }
            const previousVisit = visitBaselineRef.current.previousVisit;
            if (previousVisit) {
              const previousTime = new Date(previousVisit).getTime();
              const newlyRecorded = records.filter((item) => {
                const recorded = item.recorded_at || item.uploaded_at || item.created_at;
                if (!recorded) return false;
                const recordedTime = new Date(recorded).getTime();
                return Number.isFinite(recordedTime) && recordedTime > previousTime;
              });
              setSinceLastOpenItems(newlyRecorded);
            } else {
              setSinceLastOpenItems(null);
            }
          } else {
            setSinceLastOpenItems(null);
            setLastOpenedAt(null);
          }
        } else {
          setContextError((current) => current || "Recent care history could not be loaded. Try refreshing the record.");
        }
        setReady(true);
        setContextLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn’t open daily care. Check your connection and try again.");
        setContextLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshVersion]);

  useEffect(() => {
    const refresh = () => setRefreshVersion((value) => value + 1);
    window.addEventListener("careRecordUpdated", refresh);
    return () => window.removeEventListener("careRecordUpdated", refresh);
  }, []);

  return (
    <div className="mobile-screen daily-care-screen">
      <div className="daily-care-page-head">
        <Button
          variant="icon"
          aria-label="Back to care record"
          onClick={() => router.push("/workspace")}
        >
          <ArrowLeft size={20} aria-hidden />
        </Button>
        <div>
          <p className="daily-care-eyebrow"><CalendarDays size={15} aria-hidden /> DAILY CARE</p>
          <h1>Your care journey, remembered.</h1>
          <p>See what has been recorded. Add something only when it would help.</p>
        </div>
      </div>

      {error ? (
        <section className="daily-care-error" role="alert">
          <h2>Daily Care could not be opened</h2>
          <p>{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
        </section>
      ) : ready ? (
        <>
          <section aria-labelledby="daily-care-current-title" className="daily-care-context-panel">
            <h2 id="daily-care-current-title">Where things stand</h2>
            <p className="daily-care-muted">The latest information currently available in the care record.</p>
            {contextLoading ? (
              <p>Loading care information…</p>
            ) : careItems.filter((item) => !isOpenMatter(item)).length > 0 ? (
              <ul className="daily-care-record-list">
                {careItems.filter((item) => !isOpenMatter(item)).slice(0, 5).map((item, index) => (
                  <li key={item.id || `care-item-${index}`}>
                    <strong>{item.title || item.event_type || "Care update"}</strong>
                    {displayHistoryText(item) && <p>{displayHistoryText(item)}</p>}
                    <span>{displayHistoryTime(item)}</span>
                    <span> · {displayHistorySource(item)}</span>
                    {item.epistemic_status && <span> · {item.epistemic_status.replace(/_/g, " ")}</span>}
                    {item.status && <span> · {item.status.replace(/_/g, " ")}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No current care updates are available to show. This does not mean nothing happened.</p>
            )}
            {contextError && <p role="status" className="daily-care-muted">{contextError}</p>}
          </section>

          <section aria-labelledby="daily-care-open-matters-title" className="daily-care-context-panel">
            <h2 id="daily-care-open-matters-title">Open matters</h2>
            <p className="daily-care-muted">Questions, missing information and disagreements that have not been marked as resolved.</p>
            {careItems.filter(isOpenMatter).length > 0 ? (
              <ul className="daily-care-record-list">
                {careItems.filter(isOpenMatter).slice(0, 8).map((item, index) => (
                  <li key={item.id || `open-matter-${index}`}>
                    <strong>{item.title || item.kind || "Open matter"}</strong>
                    {displayHistoryText(item) && <p>{displayHistoryText(item)}</p>}
                    <span>{displayHistoryTime(item)}</span>
                    {item.source_label && <span> · {item.source_label}</span>}
                    {item.epistemic_status && <span> · {item.epistemic_status.replace(/_/g, " ")}</span>}
                    {item.status && <span> · {item.status.replace(/_/g, " ")}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No open matters are currently recorded in this view. This does not confirm that none exist.</p>
            )}
          </section>

          <section aria-labelledby="daily-care-since-last-title" className="daily-care-context-panel">
            <h2 id="daily-care-since-last-title">Since you last opened Daily Care</h2>
            <p className="daily-care-muted">
              This summary uses records added since your previous visit on this device. It does not describe unrecorded care.
            </p>
            {sinceLastOpenItems === null ? (
              <p>This is the first visit on this device. New recorded updates will appear here the next time you open Daily Care.</p>
            ) : sinceLastOpenItems.length > 0 ? (
              <>
                <p><strong>{sinceLastOpenItems.length}</strong> new care record{sinceLastOpenItems.length === 1 ? "" : "s"} added since {lastOpenedAt ? displayCareTime(lastOpenedAt) : "your previous visit"}.</p>
                <ul className="daily-care-record-list">
                  {([
                    ["observations", "Observation records"],
                    ["medicines", "Medication event records"],
                    ["measurements", "Measurement records"],
                    ["checkIns", "Quick check-ins"],
                    ["handoffs", "Care handoffs"],
                    ["updates", "Other care updates"],
                  ] as const).filter(([key]) => sinceLastOpenItems.some((item) => classifyHistoryRecord(item) === key))
                    .map(([key, label]) => {
                      const matching = sinceLastOpenItems.filter((item) => classifyHistoryRecord(item) === key);
                      const targetId = historyRecordId(matching[0]);
                      return (
                        <li key={key}>
                          {targetId ? (
                            <a href={`#daily-care-event-${targetId}`}>
                              {matching.length} {label.toLowerCase()}
                            </a>
                          ) : (
                            <>{matching.length} {label.toLowerCase()}</>
                          )}
                        </li>
                      );
                    })}
                </ul>
                <p className="daily-care-muted">Select a count to jump to its saved entries in Recent care history below.</p>
              </>
            ) : (
              <p>No new care records have been added since your last visit on this device. This does not mean nothing happened.</p>
            )}
            {historyMayBeTruncated && <p className="daily-care-muted">The summary is based on the latest 200 history records. Open full history to check older entries.</p>}
          </section>

          <section aria-labelledby="daily-care-capture-title" className="daily-care-context-panel">
            <h2 id="daily-care-capture-title">Anything different today?</h2>
            <p className="daily-care-muted">Share something, check in, or leave things as they are. Nothing is required.</p>
            <Button
              variant="primary"
              aria-expanded={captureOpen}
              onClick={() => {
                if (captureOpen) {
                  setCaptureOpen(false);
                  setCaptureMode(null);
                } else {
                  setCaptureOpen(true);
                }
              }}
            >
              {captureOpen ? "Close capture" : "Share something"}
            </Button>
            {captureOpen && (
              <div className="daily-care-capture-state">
                {!captureMode ? (
                  <div role="group" aria-label="Choose what you want to share" className="daily-care-capture-options">
                    {([
                      { value: "something", label: "Something happened", detail: "Share an observation in your own words." },
                      { value: "medicine", label: "Medicine", detail: "Record what happened with a medicine." },
                      { value: "measurement", label: "Measurement", detail: "Record a reading that was actually taken." },
                      { value: "photo", label: "Photograph", detail: "Add a photo as care-record evidence." },
                      { value: "checkin", label: "Quick check-in", detail: "Share one overall impression of today." },
                      { value: "note", label: "Note", detail: "Save a short note without categorizing it." },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="daily-care-capture-option"
                        onClick={() => setCaptureMode(option.value)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.detail}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="daily-care-capture-mode-heading">
                      <strong>{({
                        something: "Something happened",
                        medicine: "Medicine",
                        measurement: "Measurement",
                        photo: "Photograph",
                        checkin: "Quick check-in",
                        note: "Note",
                      } as const)[captureMode]}</strong>
                      <Button variant="secondary" onClick={() => setCaptureMode(null)}>Back to choices</Button>
                    </div>
                    {captureMode === "checkin" ? (
                      <QuickDailyCheckIn />
                    ) : captureMode === "photo" ? (
                      <DailyCarePhotoCapture />
                    ) : (
                      <StructuredDailyCapture mode={captureMode} />
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="daily-care-history-title" className="daily-care-context-panel">
            <div className="daily-care-history-heading">
              <div>
                <h2 id="daily-care-history-title">Recent care history</h2>
                <p className="daily-care-muted">Recorded events, in time order. Missing days do not mean nothing happened.</p>
              </div>
              <Link href="/workspace/timeline" className="care-reminders-inline-link">View all history</Link>
            </div>
            {historyItems.length > 0 ? (
              <ul className="daily-care-record-list">
                {[...new Map(
                  [...historyItems.slice(0, 8), ...(sinceLastOpenItems || [])]
                    .map((item, index) => [historyRecordId(item) || `history-item-${index}`, item] as const)
                ).values()].map((item, index) => (
                  <li
                    id={historyRecordId(item) ? `daily-care-event-${historyRecordId(item)}` : undefined}
                    key={historyRecordId(item) || `history-item-${index}`}
                  >
                    <strong>{item.title || item.event_type || item.source_type || "Care record entry"}</strong>
                    {displayHistoryText(item) && <p>{displayHistoryText(item)}</p>}
                    <span>{displayHistoryTime(item)}</span>
                    {item.source_label && <span> · {item.source_label}</span>}
                    {item.epistemic_status && <span> · {item.epistemic_status.replace(/_/g, " ")}</span>}
                    {item.status && <span> · {item.status.replace(/_/g, " ")}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent care entries are available. No record is not proof that no care took place.</p>
            )}
          </section>
        </>
      ) : (
        <BrandLoading animate message="Opening your care record…" />
      )}

      <style jsx global>{`
        /* Daily Care: deliberately single-column, readable, and resilient on phones. */
        .daily-care-screen,
        .daily-care-screen *,
        .daily-care-screen *::before,
        .daily-care-screen *::after {
          box-sizing: border-box;
          min-width: 0;
        }
        .daily-care-screen {
          width: 100%;
          max-width: 100%;
          padding: clamp(.75rem, 3.5vw, 1.5rem);
          overflow-wrap: anywhere;
          word-break: normal;
        }
        .daily-care-page-head {
          width: 100%;
          max-width: 48rem;
          margin: 0 auto 1.25rem;
          gap: .65rem;
        }
        .daily-care-context-panel {
          width: 100%;
          max-width: 48rem;
          margin: 0 auto 1rem;
          padding: clamp(.9rem, 3vw, 1.25rem);
          border: 1px solid var(--theme-panel-border);
          border-radius: 16px;
          background: var(--theme-panel-bg);
          color: var(--theme-panel-fg);
        }
        .daily-care-context-panel h2 {
          margin: 0 0 .35rem;
          font-size: 1.2rem;
          line-height: 1.35;
        }
        .daily-care-muted {
          color: var(--theme-panel-muted);
          line-height: 1.55;
          margin: 0 0 .8rem;
        }
        .daily-care-record-list {
          list-style: none;
          margin: .5rem 0 0;
          padding: 0;
        }
        .daily-care-record-list li {
          padding: .85rem 0;
          border-top: 1px solid var(--theme-panel-border);
          overflow-wrap: anywhere;
        }
        .daily-care-record-list li:first-child { border-top: 0; }
        .daily-care-record-list strong { display: block; margin-bottom: .2rem; }
        .daily-care-record-list p { margin: .25rem 0; white-space: pre-wrap; }
        .daily-care-record-list span {
          color: var(--theme-panel-muted);
          font-size: .85rem;
        }
        .daily-care-history-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: .75rem;
          flex-wrap: wrap;
        }
        .daily-care-capture-state { margin-top: 1rem; }
        .daily-care-capture-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
          gap: .65rem;
          margin-top: .9rem;
        }
        .daily-care-capture-option {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: .3rem;
          min-height: 76px;
          padding: .85rem 1rem;
          border: 1px solid var(--theme-panel-border);
          border-radius: 12px;
          background: var(--theme-field-bg);
          color: var(--theme-panel-fg);
          text-align: left;
          cursor: pointer;
        }
        .daily-care-capture-option span {
          color: var(--theme-panel-muted);
          font-size: .88rem;
          line-height: 1.4;
        }
        .daily-care-capture-mode-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: .75rem;
          margin-bottom: .9rem;
        }
        .daily-care-page-head > div { min-width: 0; flex: 1 1 auto; }
        .daily-care-page-head h1 {
          font-size: clamp(1.65rem, 6vw, 2.25rem);
          line-height: 1.15;
          letter-spacing: -.035em;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }
        .daily-care-page-head p:not(.daily-care-eyebrow) {
          max-width: 42rem;
          font-size: 1rem;
          line-height: 1.6;
        }
        .daily-care-page-head .care-reminders-inline-link {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          margin-top: .5rem;
          color: var(--theme-link);
          font-weight: 650;
          text-underline-offset: 3px;
        }
        .structured-daily-capture {
          width: 100%;
          max-width: 48rem;
          margin: 0 auto;
          padding: 0;
          color: var(--theme-panel-fg);
          font-size: 1rem;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }
        .structured-daily-capture h1,
        .structured-daily-capture h2,
        .structured-daily-capture h3,
        .structured-daily-capture h4,
        .structured-daily-capture p,
        .structured-daily-capture label,
        .structured-daily-capture li,
        .structured-daily-capture strong,
        .structured-daily-capture span {
          max-width: 100%;
          overflow-wrap: anywhere;
          white-space: normal;
          line-height: 1.5;
        }
        .structured-daily-capture > div:first-child {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          gap: .35rem !important;
          width: 100%;
          margin-bottom: 1.25rem !important;
        }
        .structured-daily-capture > div:first-child h1 {
          margin: 0 !important;
          font-size: clamp(1.45rem, 5vw, 1.9rem) !important;
          line-height: 1.2 !important;
          letter-spacing: -.025em;
        }
        .structured-daily-capture > div:first-child p {
          max-width: 100% !important;
          margin: 0 !important;
          font-size: 1rem !important;
          line-height: 1.6 !important;
          color: var(--theme-panel-muted) !important;
        }
        .structured-daily-capture > section {
          width: 100%;
          margin: 0 0 1rem;
          padding: clamp(.9rem, 3vw, 1.25rem);
          border: 1px solid var(--theme-panel-border);
          border-radius: 16px;
          background: var(--theme-panel-bg);
          box-shadow: 0 2px 10px rgba(23, 43, 53, .035);
        }
        .structured-daily-capture > section > h2 {
          margin: 0 0 .85rem !important;
          font-size: 1.2rem !important;
          line-height: 1.3 !important;
          letter-spacing: -.015em;
        }
        .structured-daily-capture section > div[style*="background"] {
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .structured-daily-capture form {
          width: 100%;
          min-width: 0;
        }
        .structured-daily-capture form > div,
        .structured-daily-capture form label {
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .structured-daily-capture input:not([type="checkbox"]):not([type="radio"]),
        .structured-daily-capture select,
        .structured-daily-capture textarea {
          display: block;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          min-height: 46px;
          padding: .7rem .8rem !important;
          border: 1px solid var(--theme-panel-border) !important;
          border-radius: 9px !important;
          background: var(--theme-field-bg) !important;
          color: var(--theme-field-fg) !important;
          font-family: inherit;
          font-size: 16px !important;
          line-height: 1.45;
          white-space: normal;
        }
        .structured-daily-capture textarea {
          min-height: 7rem;
          resize: vertical;
          overflow-wrap: anywhere;
        }
        .structured-daily-capture input:focus,
        .structured-daily-capture select:focus,
        .structured-daily-capture textarea:focus {
          border-color: #267c78 !important;
          outline: 3px solid rgba(38, 124, 120, .18);
          outline-offset: 1px;
        }
        .structured-daily-capture button {
          min-height: 44px;
          max-width: 100%;
          white-space: normal !important;
          overflow-wrap: anywhere;
          line-height: 1.35;
        }
        .structured-daily-capture form button,
        .structured-daily-capture section button {
          flex-shrink: 1;
        }
        .structured-daily-capture ul {
          min-width: 0;
          max-width: 100%;
          padding-inline-start: 1.1rem;
        }
        .structured-daily-capture li {
          min-width: 0;
          max-width: 100%;
        }
        .structured-daily-capture [style*="grid-template-columns"] {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)) !important;
          min-width: 0 !important;
        }
        .structured-daily-capture [style*="display: flex"] {
          flex-wrap: wrap;
          min-width: 0;
        }
        .structured-daily-capture [style*="justify-content: space-between"] {
          gap: .5rem;
        }
        .structured-daily-capture [style*="borderRadius"] {
          overflow-wrap: anywhere;
        }
        .structured-daily-capture img,
        .structured-daily-capture video,
        .structured-daily-capture canvas {
          max-width: 100%;
          height: auto;
        }
        .daily-care-error {
          width: 100%;
          max-width: 38rem;
          margin-inline: auto;
          overflow-wrap: anywhere;
        }
        @media (max-width: 600px) {
          .daily-care-screen { padding: .75rem; }
          .daily-care-page-head { gap: .35rem; }
          .daily-care-page-head > :first-child { flex: 0 0 auto; }
          .structured-daily-capture > section {
            margin-bottom: .8rem;
            border-radius: 13px;
          }
          .structured-daily-capture [style*="grid-template-columns"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .structured-daily-capture [style*="display: flex"] {
            gap: .6rem;
          }
          .structured-daily-capture button {
            max-width: 100%;
          }
        }
        @media (max-width: 360px) {
          .daily-care-screen { padding: .55rem; }
          .structured-daily-capture > section { padding: .75rem; }
          .structured-daily-capture > section > h2 { font-size: 1.1rem !important; }
        }
      `}</style>
    </div>
  );
}
