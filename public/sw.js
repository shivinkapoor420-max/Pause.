/* Pause service worker — shows notifications. Pushes carry no content; we fetch
   the newest unread notification over the user's own session, so nothing
   personal passes through the browser vendor's push servers. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let n = null;
      try {
        const res = await fetch("/api/v1/notifications/latest", { credentials: "same-origin" });
        if (res.ok) n = (await res.json()).notification;
      } catch (_) {
        /* offline */
      }
      await self.registration.showNotification(n ? n.title : "Pause", {
        body: n ? n.body : "You have something new in Pause.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "pause",
        renotify: true,
        data: { link: (n && n.link) || "/notifications" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.link || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
