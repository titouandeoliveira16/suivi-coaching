/* Notifications de l'appli (chargé par le service worker). */
self.addEventListener('push', (e) => {
  let d = {}
  try {
    d = e.data ? e.data.json() : {}
  } catch {
    d = { texte: e.data ? e.data.text() : '' }
  }
  e.waitUntil(
    self.registration.showNotification(d.titre || 'Suivi Coaching', {
      body: d.texte || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: d.tag,
      data: { url: d.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ('focus' in f) {
          if ('navigate' in f) f.navigate(url)
          return f.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
