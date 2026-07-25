// RVUnicorn Service Worker — PWA + Push
const CACHE_NAME = 'rvunicorn-v2';

// Install — skip waiting immediately so new SW takes over
self.addEventListener('install', () => self.skipWaiting());

// Activate — clean old caches, claim clients
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

// Fetch — only cache hashed assets (/assets/*), never HTML
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;

  // Navigation requests (HTML pages) — always network, never cache
  if (e.request.mode === 'navigate') return;

  // Only cache files under /assets/ (hashed, immutable bundles)
  if (!e.request.url.includes('/assets/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'RVUnicorn', body: event.data.text() }; }

  const title = data.title || 'RVUnicorn \u{1F984}';
  const options = {
    body: data.body || '',
    icon: data.icon || '/images/logo-icon-v2.png',
    badge: data.badge || '/images/logo-icon-v2.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
