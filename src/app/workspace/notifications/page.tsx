"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Notification preferences and the care-update inbox belong under Settings. */
export default function NotificationsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/workspace/settings#settings-notifications");
  }, [router]);

  return (
    <main role="status" aria-live="polite">
      Opening notification settings…
    </main>
  );
}
