"use client";

import { useEffect } from "react";
import { track } from "@/lib/trackEvent";

/** Fire page_view once per mount. Fail-silent via track(). */
export function OpsPageView({ page }: { page: string }) {
  useEffect(() => {
    track("page_view", { page });
  }, [page]);
  return null;
}
