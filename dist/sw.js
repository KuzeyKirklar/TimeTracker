const CACHE_NAME = 'neontrack-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) return caches.delete(cache);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

// Timer Bildirimleri (Notification)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Zaman Doldu!', body: 'Görev zamanınız geldi.' };
  
  const options = {
    body: data.body,
    icon: '/vite.svg',
    badge: '/vite.svg',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (windowClients.length > 0) {
        return windowClients[0].focus();
      } else {
        return clients.openWindow('/');
      }
    })
  );
});
