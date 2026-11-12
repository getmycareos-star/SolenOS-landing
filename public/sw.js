self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" ? payload.title : "SolenOS";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a care update. Open SolenOS to review it.",
    data: { url: typeof payload.url === "string" ? payload.url : "/workspace" },
    tag: "solenos-care-update",
    renotify: false,
    vibrate: [180, 90, 180],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data && event.notification.data.url ? event.notification.data.url : "/workspace",
    self.location.origin,
  ).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
