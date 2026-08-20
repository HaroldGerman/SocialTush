/* Lifonk Web Push service worker. No offline cache is intentionally installed here. */
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
    body: typeof payload.body === 'string' ? payload.body : 'Tienes una nueva notificación.',
    icon: '/icons/lifonk.svg',
    badge: '/icons/lifonk.svg',
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
