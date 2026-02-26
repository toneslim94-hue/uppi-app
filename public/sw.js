// Uppi Service Worker - Offline support + Caching
const CACHE_NAME = 'uppi-v1'
const STATIC_CACHE = 'uppi-static-v1'
const API_CACHE = 'uppi-api-v1'

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/uppi/home',
  '/uppi/ride/route-input',
  '/offline',
]

// Install: pre-cache essential pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Individual fallback if bulk add fails
        return Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
        )
      })
    })
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== STATIC_CACHE && name !== API_CACHE)
          .map(name => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch strategy: Network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip Supabase/auth requests - never cache
  if (url.hostname.includes('supabase') || url.pathname.includes('/auth/')) return

  // Skip websocket and realtime
  if (url.pathname.includes('/realtime/') || url.protocol === 'ws:' || url.protocol === 'wss:') return

  // API responses: Network-first, cache for 5 min
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/rest/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Static assets: Cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ico)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
      })
    )
    return
  }

  // Pages: Network-first with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline')
          })
        })
    )
    return
  }
})

// ============================================================
// WEB PUSH (VAPID) — notificacoes mesmo com app fechado
// ============================================================

// Recebe o push do servidor e exibe a notificacao nativa
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Uppi', body: event.data.text() }
  }

  const title = payload.title || 'Uppi'
  const options = {
    body:     payload.body    || '',
    icon:     payload.icon    || '/icons/icon-192x192.png',
    badge:    payload.badge   || '/icons/badge-72x72.png',
    data:     payload.data    || {},
    tag:      payload.tag     || 'uppi-push',
    renotify: true,
    vibrate:  [200, 100, 200],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Ao clicar na notificacao, abre ou foca o app na rota correta
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data    = event.notification.data || {}
  const rideId  = data.ride_id
  const url     = rideId
    ? `/uppi/ride/${rideId}`
    : (data.url || '/uppi/home')

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.postMessage({ type: 'NAVIGATE', url })
          return
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

// ============================================================

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PREFETCH') {
    const urls = event.data.urls || []
    caches.open(CACHE_NAME).then((cache) => {
      urls.forEach((url) => {
        cache.match(url).then((existing) => {
          if (!existing) {
            fetch(url, { priority: 'low' }).then((response) => {
              if (response.ok) cache.put(url, response)
            }).catch(() => {})
          }
        })
      })
    })
  }
})
