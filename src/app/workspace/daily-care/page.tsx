"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { ensureAnonymousSession } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { BrandLoading } from "@/components/brand";

const StructuredDailyCapture = dynamic(
  () => import("@/pages/StructuredDailyCapture"),
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
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Daily care could not be opened. Please try again.",
        );
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
    </div>
  );
}
