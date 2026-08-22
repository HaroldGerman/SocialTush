const SW_BUILD = '2026-08-22-chat-recovery-2';
const IMAGE_CACHE = 'lifonk-images-v1';
const SHARE_CACHE = 'lifonk-share-v1';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

async function trimImageCache(cache, maxEntries = 120) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map(key => cache.delete(key)));
}

function sharedKey(id, suffix) {
  return new URL(`/__share/${encodeURIComponent(id)}/${suffix}`, self.location.origin).href;
}

async function clearSharedItem(id) {
  const cache = await caches.open(SHARE_CACHE);
  const keys = await cache.keys();
  const prefix = `/__share/${encodeURIComponent(id)}/`;
  await Promise.all(keys.filter(key => new URL(key.url).pathname.startsWith(prefix)).map(key => cache.delete(key)));
}

async function receiveShareTarget(request) {
  try {
    const form = await request.formData();
    const id = self.crypto?.randomUUID ? self.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const title = String(form.get('title') || '').trim();
    const text = String(form.get('text') || '').trim();
    const url = String(form.get('url') || '').trim();
    const files = form.getAll('media').filter(value =>
      value instanceof File && (value.type.startsWith('image/') || value.type.startsWith('video/'))
    ).slice(0, 4);

    const cache = await caches.open(SHARE_CACHE);
    const fileMeta = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const key = sharedKey(id, `file-${index}`);
      await cache.put(key, new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Lifonk-File-Name': encodeURIComponent(file.name || `shared-${index}`),
          'Cache-Control': 'no-store',
        },
      }));
      fileMeta.push({
        index,
        name: file.name || `shared-${index}`,
        type: file.type || 'application/octet-stream',
        size: file.size || 0,
      });
    }

    await cache.put(sharedKey(id, 'meta'), new Response(JSON.stringify({
      id,
      title,
      text,
      url,
      files: fileMeta,
      createdAt: Date.now(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }));

    const destination = new URL('/share', self.location.origin);
    destination.searchParams.set('shareId', id);
    return Response.redirect(destination.href, 303);
  } catch (error) {
    console.error('Lifonk share target error', error);
    const destination = new URL('/share', self.location.origin);
    destination.searchParams.set('shareError', '1');
    return Response.redirect(destination.href, 303);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/share-target') {
    event.respondWith(receiveShareTarget(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/__share/')) {
    if (request.method === 'GET') {
      event.respondWith((async () => {
        const cache = await caches.open(SHARE_CACHE);
        return (await cache.match(request)) || new Response('Not found', { status: 404 });
      })());
      return;
    }

    if (request.method === 'DELETE') {
      event.respondWith((async () => {
        const parts = url.pathname.split('/').filter(Boolean);
        const id = parts[1] || '';
        if (id) await clearSharedItem(id);
        return new Response(null, { status: 204 });
      })());
      return;
    }
  }

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
    await Promise.all(names.filter(name => name.startsWith('lifonk-share-') && name !== SHARE_CACHE).map(name => caches.delete(name)));
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
