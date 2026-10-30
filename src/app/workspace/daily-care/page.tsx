"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { ensureAnonymousSession } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { BrandLoading } from "@/components/brand";

const StructuredDailyCapture = dynamic(
  () => import("@/components/workflows/StructuredDailyCapture"),
  {
    ssr: false,
    loading: () => <BrandLoading message="Opening daily care…" />,
  },
);

export default function DailyCarePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void ensureAnonymousSession()
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn’t open daily care. Check your connection and try again.");
      });
    return () => {
      active = false;
    };
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
          <h1>How has today been?</h1>
          <p>Record observations about the day. You can leave anything you do not know blank.</p>
          <Link href="/workspace/reminders" className="care-reminders-inline-link">Open care reminders</Link>
        </div>
      </div>
      {error ? (
        <section className="daily-care-error" role="alert">
          <h2>Daily care could not be opened</h2>
          <p>{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
        </section>
      ) : ready ? (
        <StructuredDailyCapture />
      ) : (
        <BrandLoading message="Preparing your private care record…" />
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
          color: #17635f;
          font-weight: 650;
          text-underline-offset: 3px;
        }
        .structured-daily-capture {
          width: 100%;
          max-width: 48rem;
          margin: 0 auto;
          padding: 0;
          color: #172b35;
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
          color: #52656d !important;
        }
        .structured-daily-capture > section {
          width: 100%;
          margin: 0 0 1rem;
          padding: clamp(.9rem, 3vw, 1.25rem);
          border: 1px solid #dce5e8;
          border-radius: 16px;
          background: #fff;
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
          border: 1px solid #bdcbd0 !important;
          border-radius: 9px !important;
          background: #fff !important;
          color: #172b35 !important;
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
