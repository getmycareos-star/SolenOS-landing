"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";

const Companion = dynamic(() => import("@/components/workflows/AICompanion"), {
  ssr: false,
  loading: () => <BrandLoading message="Opening your care companion…" />,
});

function WorkspaceHomeInner() {
  const searchParams = useSearchParams();
  const prompt = searchParams.get("prompt");
  return (
    <div className="mobile-screen feature-page companion-route solenos-companion-home">
      <Companion home initialPrompt={prompt} />
      <style jsx global>{`
        .solenos-companion-home {
          display: flex;
          width: 100%;
          height: calc(100dvh - 84px);
          min-height: 420px;
          max-width: none;
          padding: 14px clamp(10px, 2.2vw, 28px) 18px;
          overflow: hidden;
        }
        .solenos-companion-home .companion-shell {
          display: flex;
          flex: 1 1 auto;
          width: 100%;
          max-width: 920px;
          height: 100%;
          min-height: 0;
          margin: 0 auto;
          gap: 12px;
        }
        .solenos-companion-home .companion-workspace {
          display: block;
          flex: 1 1 auto;
          min-height: 0;
        }
        .solenos-companion-home .companion-conversation {
          width: 100%;
          height: 100%;
          min-height: 0;
          overflow-y: auto;
          border-radius: 16px;
        }
        .solenos-companion-home .companion-side-note {
          display: none !important;
        }
        .solenos-companion-home .companion-composer-wrap {
          flex: 0 0 auto;
          margin-top: auto;
        }
        @media (max-width: 600px) {
          .solenos-companion-home {
            height: calc(100dvh - 68px);
            min-height: 360px;
            padding: 8px 8px 12px;
          }
          .solenos-companion-home .companion-shell { gap: 8px; }
          .solenos-companion-home .companion-conversation { border-radius: 13px; }
        }
        @media (max-height: 560px) {
          .solenos-companion-home { height: auto; min-height: 500px; overflow: visible; }
          .solenos-companion-home .companion-shell { min-height: 500px; }
        }
      `}</style>
    </div>
  );
}

export default function WorkspaceHomePage() {
  return (
    <Suspense fallback={<BrandLoading message="Opening SolenOS Companion…" />}>
      <WorkspaceHomeInner />
    </Suspense>
  );
}
