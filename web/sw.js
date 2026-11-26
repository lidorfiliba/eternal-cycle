// The service worker exists for one thing: showing a notification the game server sends when a character that was
// left training reaches the reset level. It caches nothing, so it never stands between the player and an update.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch (_) { /* a push without a readable body still shows something */ }
  e.waitUntil(self.registration.showNotification(String(d.title || 'Eternal Cycle'), { body: String(d.body || ''), icon: 'icon-192.png', badge: 'icon-192.png', tag: 'ec-reset', data: { url: './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => { for (const c of l) if ('focus' in c) return c.focus(); return self.clients.openWindow('./'); }));
});
