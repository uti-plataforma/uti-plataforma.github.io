const CACHE = 'uti-student-shell-2026-11-13-20'
const base = new URL(self.registration.scope)
const local = path => new URL(path, base).href

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    new Request(local('./'), { cache: 'reload' }), local('manifest.webmanifest'), local('media/app-black-192.png'), local('media/app-black-512.png'),
  ])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => (key.startsWith('uti-public-') || key.startsWith('uti-student-shell-')) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== base.origin || url.search || !url.pathname.startsWith(base.pathname)) return
  const path = url.pathname.slice(base.pathname.length)
  const navigation = request.mode === 'navigate' && path === ''
  const asset = /^(assets\/[^/]+\.(js|css)|fonts\/[^/]+\.woff2|media\/[^/]+\.(png|jpg|svg)|manifest\.webmanifest)$/.test(path)
  if (!navigation && !asset) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    if (!navigation) {
      const cached = await cache.match(request)
      if (cached) return cached
    }
    try {
      const response = await fetch(navigation ? new Request(request, { cache: 'no-cache' }) : request)
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    } catch (error) {
      const cached = await cache.match(request)
      if (cached) return cached
      throw error
    }
  })())
})

// Notificações: mostra o aviso e, ao tocar, abre a tela certa do app.
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data ? event.data.text() : '' } }
  const title = typeof data.title === 'string' ? data.title.slice(0, 80) : 'UTI Aprova'
  const body = typeof data.body === 'string' ? data.body.slice(0, 180) : ''
  const route = typeof data.route === 'string' && /^\/app(\/[a-z]+)?(\?[a-z0-9=&-]*)?$/.test(data.route) ? data.route : '/app'
  event.waitUntil(self.registration.showNotification(title, {
    body, tag: typeof data.tag === 'string' ? data.tag.slice(0, 60) : undefined,
    icon: local('media/app-black-192.png'), badge: local('media/app-black-192.png'), data: { route },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = local(`#${event.notification.data?.route ?? '/app'}`)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(client => client.url.startsWith(base.href))
    if (open) { await open.navigate(target); return open.focus() }
    return self.clients.openWindow(target)
  })())
})
