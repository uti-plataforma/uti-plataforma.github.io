const CACHE = 'uti-student-shell-5601f022e8231780'
const base = new URL(self.registration.scope)
const local = path => new URL(path, base).href

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache=await caches.open(CACHE)
    const response=await fetch(local('offline-shell.json'),{cache:'reload'})
    if(!response.ok) throw Error('Pacote do aplicativo indisponível.')
    const assets=await response.json()
    if(!Array.isArray(assets)||assets.some(path=>typeof path!=='string'||!/^(assets|media|fonts)\/[a-zA-Z0-9_.-]+$/.test(path))) throw Error('Pacote inválido.')
    await cache.addAll([new Request(local('./'),{cache:'reload'}),local('manifest.webmanifest'),...assets.map(path=>local(path))])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => (key.startsWith('uti-public-') || key.startsWith('uti-student-shell-')) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  const mascotVersion = /^\?v=[a-z0-9-]+$/.test(url.search) && /\/mascote-rive-[a-z-]+\.(webp|png)$/.test(url.pathname)
  if (request.method !== 'GET' || url.origin !== base.origin || (url.search && !mascotVersion) || !url.pathname.startsWith(base.pathname)) return
  const path = url.pathname.slice(base.pathname.length)
  const navigation = request.mode === 'navigate' && path === ''
  const asset = /^(assets\/[^/]+\.(js|css)|fonts\/[^/]+\.woff2|media\/(?:aulas\/)?[^/]+\.(png|jpg|svg|webp|gif|wav)|manifest\.webmanifest)$/.test(path)
  if (!navigation && !asset) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    if (!navigation) {
      const cached = await cache.match(request, { ignoreVary: true, ignoreSearch: mascotVersion })
      if (cached) return cached
    }
    try {
      const response = await fetch(navigation ? new Request(request, { cache: 'no-cache' }) : request)
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    } catch (error) {
      const cached = await cache.match(request, { ignoreVary: true, ignoreSearch: mascotVersion })
      if (cached) return cached
      throw error
    }
  })())
})

// Notificações: mostra o aviso e, ao tocar, abre a tela certa do app.
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data ? event.data.text() : '' } }
  const title = typeof data.title === 'string' ? data.title.slice(0, 80) : 'UTI da Ciência'
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
