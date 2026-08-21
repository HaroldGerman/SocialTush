const IMAGE_CACHE = 'lifonk-images-v1';

async function trimImageCache(cache, maxEntries = 120) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map(key => cache.delete(key)));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.destination !== 'image') return;

  const referrer = request.referrer || '';
  if (referrer.includes('/chat')) return;

  event.respondWith((async () => {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then(async response => {
      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(request, response.clone());
        void trimImageCache(cache);
      }
      return response;
    }).catch(() => cached);
    return cached || network;
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('lifonk-images-') && name !== IMAGE_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('Invalid Lifonk push payload', error);
  }

  const title = typeof payload.title === 'string' ? payload.title : 'Lifonk';
  const safePath = typeof payload.url === 'string' && payload.url.startsWith('/') && !payload.url.startsWith('//')
    ? payload.url
    : '/feed';
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof payload.body === 'string' ? payload.body : 'Tienes una nueva señal.',
    icon: '/icons/lifonk-192.png',
    badge: '/icons/lifonk-192.png',
    tag: payload.notificationId ? `lifonk-${payload.notificationId}` : undefined,
    data: { url: safePath },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.url;
  const safePath = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/feed';
  const destination = new URL(safePath, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination);
  })());
});
