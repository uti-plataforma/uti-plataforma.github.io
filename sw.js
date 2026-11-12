const CACHE = 'uti-public-2026-11-11-1'
const base = new URL(self.registration.scope)
const local = path => new URL(path, base).href

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    local('./'), local('manifest.webmanifest'), local('media/app-192.png'), local('media/app-512.png'),
  ])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('uti-public-') && key !== CACHE)
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
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    } catch (error) {
      const cached = await cache.match(request)
      if (cached) return cached
      throw error
    }
  })())
})
