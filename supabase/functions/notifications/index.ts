// Fonction serveur Supabase « notifications » (Deno) : notifications de l'appli Suivi Coaching (Web Push).
//
// Routes (POST) :
//   /notifications/cle        → clé publique VAPID (créée au premier appel) ; retient aussi l'adresse d'envoi
//   /notifications/abonner    { abonnement, fuseau } → enregistre cet appareil (utilisateur connecté)
//   /notifications/desabonner { endpoint } → retire cet appareil (utilisateur connecté)
//   /notifications/tester     → notification d'essai sur tes appareils (utilisateur connecté)
//   /notifications/envoyer    → appelé par la base (message, alerte, semaine validée) et toutes les 15 min :
//                               envoie la file d'attente et les rappels programmés dus.
//                               Sans danger si quelqu'un l'appelle : chaque notification ne part qu'une fois.
// Aucun secret à ajouter : les clés VAPID sont créées et gardées par la fonction elle-même.

import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const CONTACT = 'https://titouandeoliveira16.github.io/suivi-coaching/'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------- Rappels programmés (règles pures, testées dans l'appli) ----------
// --- debut regles ---
export interface Preferences {
  matin: boolean
  heure_matin: string
  soir: boolean
  semaine: boolean
  messages: boolean
  alertes: boolean
  resume: boolean
}
export const PREFERENCES_DEFAUT: Preferences = { matin: true, heure_matin: '07:30', soir: true, semaine: true, messages: true, alertes: true, resume: true }

export interface Moment {
  date: string // AAAA-MM-JJ
  heure: string // HH:MM
  jour: number // 0 = dimanche
}

export interface Etat {
  role: 'coach' | 'eleve'
  /** Statuts des séances du jour (élève). */
  seancesDuJour: string[]
  matinFait: boolean
  /** Élèves ayant un profil sportif (coach). */
  nbEleves: number
  /** Rappels déjà envoyés aujourd'hui. */
  dejaEnvoyes: string[]
}

export interface Rappel {
  type: 'matin' | 'soir' | 'resume'
  titre: string
  texte: string
  url: string
}

export const HEURE_SOIR = '20:00'
export const HEURE_RESUME = '18:00'

/** Rappels dus maintenant. Chaque rappel a une fenêtre de quelques heures et ne part qu'une fois par jour. */
export function rappelsDus(m: Moment, p: Preferences, e: Etat): Rappel[] {
  const r: Rappel[] = []
  const dans = (debut: string, fin: string) => m.heure >= debut && m.heure < fin
  const libre = (type: Rappel['type']) => !e.dejaEnvoyes.includes(type)
  if (e.role === 'eleve') {
    const prevue = e.seancesDuJour.includes('validee')
    if (p.matin && prevue && !e.matinFait && dans(p.heure_matin, '11:00') && libre('matin'))
      r.push({ type: 'matin', titre: '☀️ Comment tu te sens ?', texte: 'Ton questionnaire du matin (30 secondes) pour voir ta séance du jour.', url: './' })
    if (p.soir && prevue && dans(HEURE_SOIR, '22:00') && libre('soir'))
      r.push({ type: 'soir', titre: '🏁 Tu as fait ta séance ?', texte: 'Dis-moi comment ça s’est passé : durée, effort, sensations.', url: './' })
  } else if (p.resume && m.jour === 0 && e.nbEleves > 0 && dans(HEURE_RESUME, '21:00') && libre('resume')) {
    r.push({
      type: 'resume',
      titre: '🗓️ Semaines à valider',
      texte: e.nbEleves > 1 ? `Les propositions de la semaine de tes ${e.nbEleves} élèves t’attendent.` : 'La proposition de la semaine de ton élève t’attend.',
      url: './#/a-valider',
    })
  }
  return r
}

/** Date (AAAA-MM-JJ), heure (HH:MM) et jour de la semaine (0 = dimanche) dans un fuseau. */
export function maintenantDans(fuseau: string, quand = new Date()): Moment {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(quand).map((x) => [x.type, x.value]),
  )
  const date = `${p.year}-${p.month}-${p.day}`
  return { date, heure: `${p.hour}:${p.minute}`, jour: new Date(`${date}T12:00:00Z`).getUTCDay() }
}
// --- fin regles ---

// ---------- Web Push (RFC 8291 : chiffrement aes128gcm ; RFC 8292 : VAPID) ----------
// --- debut webpush ---
const enc = new TextEncoder()
const b64url = (o: Uint8Array) => btoa(String.fromCharCode(...o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
const concat = (...l: Uint8Array[]) => {
  const r = new Uint8Array(l.reduce((a, x) => a + x.length, 0))
  let i = 0
  for (const x of l) {
    r.set(x, i)
    i += x.length
  }
  return r
}
async function hmac(cle: Uint8Array, donnees: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', cle, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, donnees))
}

export interface ClesVapid {
  publique: string // point P-256 non compressé, base64url (applicationServerKey)
  privee: JsonWebKey
}

export async function creerClesVapid(): Promise<ClesVapid> {
  const p = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return {
    publique: b64url(new Uint8Array(await crypto.subtle.exportKey('raw', p.publicKey))),
    privee: await crypto.subtle.exportKey('jwk', p.privateKey),
  }
}

/** En-tête Authorization VAPID pour un point d'envoi. */
async function enteteVapid(endpoint: string, cles: ClesVapid) {
  const corps = { aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACT }
  const nonSigne = `${b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))}.${b64url(enc.encode(JSON.stringify(corps)))}`
  const k = await crypto.subtle.importKey('jwk', cles.privee, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(nonSigne)))
  return `vapid t=${nonSigne}.${b64url(sig)}, k=${cles.publique}`
}

/** Chiffre un message pour un abonnement (p256dh, auth). */
export async function chiffrerMessage(p256dh: string, auth: string, texte: string) {
  const uaPublic = deB64url(p256dh)
  const secretAuth = deB64url(auth)
  const ephemere = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemere.publicKey))
  const cleUa = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secretEcdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: cleUa }, ephemere.privateKey, 256))
  const prkCle = await hmac(secretAuth, secretEcdh)
  const ikm = (await hmac(prkCle, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32)
  const sel = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(sel, ikm)
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, concat(enc.encode(texte), new Uint8Array([2]))))
  const rs = new Uint8Array([0, 0, 16, 0]) // 4096
  return concat(sel, rs, new Uint8Array([asPublic.length]), asPublic, chiffre)
}

/** Envoie une notification. Renvoie le statut HTTP du service de push (404 / 410 : abonnement expiré). */
export async function envoyerPush(abonnement: { endpoint: string; keys: { p256dh: string; auth: string } }, message: unknown, cles: ClesVapid) {
  const corps = await chiffrerMessage(abonnement.keys.p256dh, abonnement.keys.auth, JSON.stringify(message))
  const r = await fetch(abonnement.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await enteteVapid(abonnement.endpoint, cles),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(4 * 3600),
      Urgency: 'high',
    },
    body: corps,
  })
  return r.status
}
// --- fin webpush ---

// ---------- Clés, abonnements, envoi ----------

async function cles(): Promise<ClesVapid> {
  const { data } = await admin.from('push_config').select('*').eq('id', 1).maybeSingle()
  if (data) return { publique: data.cle_publique, privee: JSON.parse(data.cle_privee) }
  const c = await creerClesVapid()
  await admin.from('push_config').upsert({ id: 1, cle_publique: c.publique, cle_privee: JSON.stringify(c.privee) }, { onConflict: 'id', ignoreDuplicates: true })
  // Deux appels simultanés : on relit la clé réellement gardée
  const { data: gardee } = await admin.from('push_config').select('*').eq('id', 1).single()
  return { publique: gardee.cle_publique, privee: JSON.parse(gardee.cle_privee) }
}

type Abonnement = { endpoint: string; user_id: string; abonnement: { endpoint: string; keys: { p256dh: string; auth: string } }; fuseau: string }

/** Envoie à tous les appareils d'une personne ; retire les abonnements expirés. */
async function envoyerA(appareils: Abonnement[], message: { titre: string; texte: string; tag: string; url: string }, c: ClesVapid) {
  let n = 0
  for (const a of appareils) {
    const statut = await envoyerPush(a.abonnement, message, c).catch(() => 0)
    if (statut === 404 || statut === 410) await admin.from('push_abonnements').delete().eq('endpoint', a.endpoint)
    else if (statut >= 200 && statut < 300) n++
  }
  return n
}

async function preferences(ids: string[]) {
  const { data } = ids.length ? await admin.from('preferences_notifications').select('*').in('user_id', ids) : { data: [] }
  const parId = new Map<string, Preferences>((data ?? []).map((p: Preferences & { user_id: string }) => [p.user_id, p]))
  return (id: string) => parId.get(id) ?? PREFERENCES_DEFAUT
}

async function envoyerTout() {
  const c = await cles()
  const { data } = await admin.from('push_abonnements').select('*')
  const appareils = new Map<string, Abonnement[]>()
  for (const a of (data ?? []) as Abonnement[]) appareils.set(a.user_id, [...(appareils.get(a.user_id) ?? []), a])
  const prefs = await preferences([...appareils.keys()])
  let envoyes = 0

  // 1. File d'attente : chaque ligne est réservée avant l'envoi, donc ne part qu'une fois
  const { data: file } = await admin
    .from('notifications_a_envoyer')
    .update({ envoyee_le: new Date().toISOString() })
    .is('envoyee_le', null)
    .gte('cree_le', new Date(Date.now() - 24 * 3600e3).toISOString())
    .select('*')
  for (const n of file ?? []) {
    const p = prefs(n.user_id) as unknown as Record<string, boolean>
    if (!p[n.type] || !appareils.has(n.user_id)) continue
    envoyes += await envoyerA(appareils.get(n.user_id)!, { titre: n.titre, texte: n.texte, tag: `${n.type}-${n.id}`, url: n.url }, c)
  }
  // Ménage : on garde une semaine d'historique
  await admin.from('notifications_a_envoyer').delete().lt('cree_le', new Date(Date.now() - 7 * 24 * 3600e3).toISOString())

  // 2. Rappels programmés
  const ids = [...appareils.keys()]
  const { data: profils } = ids.length ? await admin.from('profils').select('id, role').in('id', ids) : { data: [] }
  for (const { id, role } of (profils ?? []) as { id: string; role: 'coach' | 'eleve' }[]) {
    const m = maintenantDans(appareils.get(id)![0].fuseau)
    const p = prefs(id)
    const { data: deja } = await admin.from('rappels_envoyes').select('type').eq('user_id', id).eq('date', m.date)
    const etat: Etat = { role, seancesDuJour: [], matinFait: false, nbEleves: 0, dejaEnvoyes: (deja ?? []).map((d: { type: string }) => d.type) }
    if (role === 'eleve') {
      const [{ data: seances }, { data: matin }] = await Promise.all([
        admin.from('seances').select('statut').eq('eleve_id', id).eq('date', m.date),
        admin.from('matins').select('date').eq('eleve_id', id).eq('date', m.date).maybeSingle(),
      ])
      etat.seancesDuJour = (seances ?? []).map((s: { statut: string }) => s.statut)
      etat.matinFait = !!matin
    } else {
      const { data: eleves } = await admin.from('profils').select('id').eq('coach_id', id)
      const liste = (eleves ?? []).map((e: { id: string }) => e.id)
      const { count } = liste.length ? await admin.from('profils_sportifs').select('eleve_id', { count: 'exact', head: true }).in('eleve_id', liste) : { count: 0 }
      etat.nbEleves = count ?? 0
    }
    for (const r of rappelsDus(m, p, etat)) {
      // La ligne « déjà envoyé » est posée d'abord : deux passages simultanés n'envoient pas deux fois
      const { error } = await admin.from('rappels_envoyes').insert({ user_id: id, type: r.type, date: m.date })
      if (!error) envoyes += await envoyerA(appareils.get(id)!, { titre: r.titre, texte: r.texte, tag: r.type, url: r.url }, c)
    }
  }
  await admin.from('rappels_envoyes').delete().lt('date', new Date(Date.now() - 7 * 24 * 3600e3).toISOString().slice(0, 10))
  return envoyes
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const route = new URL(req.url).pathname.split('/').pop()
  try {
    if (route === 'envoyer') return json({ envoyes: await envoyerTout() })
    if (route === 'cle') {
      const c = await cles()
      // Adresse d'envoi utilisée par la base (déclencheurs et passage toutes les 15 min)
      await admin.from('push_config').update({ url_envoi: `${Deno.env.get('SUPABASE_URL')}/functions/v1/notifications/envoyer` }).eq('id', 1).is('url_envoi', null)
      return json({ cle: c.publique })
    }

    const jeton = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } }
    const user = data.user
    if (!user) return json({ erreur: 'Connecte-toi à ton compte.' }, 401)
    const corps = await req.json().catch(() => ({}))

    if (route === 'abonner') {
      const ab = corps.abonnement
      if (!ab?.endpoint || !ab?.keys?.p256dh || !ab?.keys?.auth) return json({ erreur: 'Abonnement invalide.' }, 400)
      const { error } = await admin.from('push_abonnements').upsert(
        { endpoint: ab.endpoint, user_id: user.id, abonnement: { endpoint: ab.endpoint, keys: { p256dh: ab.keys.p256dh, auth: ab.keys.auth } }, fuseau: typeof corps.fuseau === 'string' ? corps.fuseau : 'Europe/Paris' },
        { onConflict: 'endpoint' },
      )
      if (error) throw error
      return json({ ok: true })
    }
    if (route === 'desabonner') {
      await admin.from('push_abonnements').delete().eq('endpoint', corps.endpoint).eq('user_id', user.id)
      return json({ ok: true })
    }
    if (route === 'tester') {
      const { data: appareils } = await admin.from('push_abonnements').select('*').eq('user_id', user.id)
      const n = await envoyerA((appareils ?? []) as Abonnement[], { titre: '✅ Suivi Coaching', texte: 'Les notifications fonctionnent sur cet appareil.', tag: 'test', url: './' }, await cles())
      return json({ envoyes: n })
    }
    return json({ erreur: 'Route inconnue.' }, 404)
  } catch (e) {
    return json({ erreur: (e as Error).message }, 500)
  }
})
