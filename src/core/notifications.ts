import type { Client } from './supabase'

/**
 * Notifications (Web Push), envoyées par la fonction serveur « notifications ».
 * Sur iPhone : seulement dans l'appli ajoutée à l'écran d'accueil (iOS 16.4 ou plus).
 */

export interface PreferencesNotifications {
  matin: boolean
  heure_matin: string
  soir: boolean
  semaine: boolean
  messages: boolean
  alertes: boolean
  resume: boolean
}
export const PREFERENCES_DEFAUT: PreferencesNotifications = { matin: true, heure_matin: '07:30', soir: true, semaine: true, messages: true, alertes: true, resume: true }

export const notificationsPossibles = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
/** Vrai si l'appli est ouverte depuis l'écran d'accueil (et non dans Safari). */
export const appliInstallee = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
export const surIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

async function appeler<T>(c: Client, route: string, corps?: unknown): Promise<T> {
  const { data } = await c.auth.getSession()
  if (!data.session) throw new Error('Connecte-toi d’abord.')
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notifications/${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_CLE ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps ?? {}),
  }).catch(() => {
    throw new Error('Pas de connexion internet (ou fonction « notifications » pas encore installée sur Supabase).')
  })
  const json = await r.json().catch(() => ({}))
  if (r.status === 404 && !json.erreur) throw new Error('La fonction « notifications » n’est pas encore installée sur Supabase.')
  if (!r.ok) throw new Error(json.erreur ?? json.message ?? `Erreur ${r.status}`)
  return json as T
}

const versOctets = (b64url: string) => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** Abonnement de cet appareil (s'il existe). */
export async function abonnementActuel() {
  if (!notificationsPossibles()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Demande l'autorisation, abonne cet appareil et l'enregistre sur le serveur (à appeler depuis un bouton). */
export async function activerNotifications(c: Client) {
  if (!notificationsPossibles())
    throw new Error(surIphone() ? 'Sur iPhone, ajoute d’abord l’appli à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis ouvre-la depuis l’icône.' : 'Notifications indisponibles sur ce navigateur.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications refusées. Réglages du téléphone → Notifications → Coaching → Autoriser.')
  const { cle } = await appeler<{ cle: string }>(c, 'cle')
  const reg = await navigator.serviceWorker.ready
  const abonnement = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(cle) }))
  await appeler(c, 'abonner', { abonnement: abonnement.toJSON(), fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone })
}

export async function desactiverNotifications(c: Client) {
  const abonnement = await abonnementActuel()
  if (!abonnement) return
  await appeler(c, 'desabonner', { endpoint: abonnement.endpoint }).catch(() => {})
  await abonnement.unsubscribe()
}

export const testerNotifications = (c: Client) => appeler<{ envoyes: number }>(c, 'tester')

export async function preferencesNotifications(c: Client, moi: string): Promise<PreferencesNotifications> {
  const { data, error } = await c.from('preferences_notifications').select('*').eq('user_id', moi).maybeSingle()
  if (error) throw error
  return { ...PREFERENCES_DEFAUT, ...(data ?? {}) }
}

export async function enregistrerPreferences(c: Client, moi: string, p: PreferencesNotifications) {
  const { error } = await c.from('preferences_notifications').upsert({ ...p, user_id: moi })
  if (error) throw error
}
