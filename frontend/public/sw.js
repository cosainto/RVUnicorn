// RVUnicorn Service Worker — PWA + Push
const CACHE_NAME = 'rvunicorn-v1';
const PRECACHE = ['/', '/images/Logo_RVUnicorn.png'];

// Install — cache shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    )).then(() => clients.claim())
  );
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (e) => {
  // Skip non-GET and API requests
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;

  e.respondWith(
    fetch(e.request).then(response => {
      // Cache successful responses
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => caches.match(e.request).then(cached => cached || caches.match('/')))
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
    icon: data.icon || '/images/Logo_RVUnicorn.png',
    badge: data.badge || '/images/Logo_RVUnicorn.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
