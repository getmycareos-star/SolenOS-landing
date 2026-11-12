/* SolenOS root-scoped Web Push service worker.
 * Lock-screen content stays generic; care details remain in the authenticated feed.
 */
self.addEventListener("push", (event) => {
  let notificationId = "care-update";
  if (event.data) {
    try {
      const payload = event.data.json();
      if (typeof payload?.notification_id === "string" && payload.notification_id.length <= 180) {
        notificationId = payload.notification_id;
      }
    } catch {
      // Non-JSON payloads still produce a generic notification.
    }
  }

  event.waitUntil(
    self.registration.showNotification("SolenOS", {
      body: "You have a care update. Open SolenOS to review it.",
      tag: `solenos-${notificationId}`,
      renotify: false,
      data: { path: "/workspace" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const requestedPath = event.notification?.data?.path;
    let target = new URL("/workspace", self.location.origin);
    if (typeof requestedPath === "string") {
      try {
        const candidate = new URL(requestedPath, self.location.origin);
        if (
          candidate.origin === self.location.origin &&
          (candidate.pathname === "/workspace" || candidate.pathname.startsWith("/workspace/"))
        ) {
          target = candidate;
        }
      } catch {
        // Keep the safe workspace default.
      }
    }

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && "focus" in client) {
        if ("navigate" in client) await client.navigate(target.href);
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});
