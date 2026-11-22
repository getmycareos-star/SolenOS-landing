/* Retire the legacy browser-push worker.
 * SolenOS notifications are delivered inside the authenticated app only.
 * Existing registrations update to this worker and then unregister themselves.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  })());
});
