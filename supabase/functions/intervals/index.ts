// Fonction serveur Supabase « intervals » (Deno) : relie le compte Intervals.icu de chaque élève et importe ses sorties.
//
// Routes (POST) :
//   /intervals/cle            { cle } → vérifie la clé auprès d'Intervals, l'enregistre chiffrée, puis importe (élève connecté)
//   /intervals/etat           { eleve? } → { connecte, dernier_import } (l'élève, ou son coach avec `eleve`)
//   /intervals/deconnexion    → efface la clé (élève connecté)
//   /intervals/importer       { eleve? } → importe les sorties récentes (l'élève, ou son coach avec `eleve`)
//   /intervals/importer-tout  → appelé toutes les heures par la base : importe pour tous les élèves reliés.
//                               Sans danger si quelqu'un l'appelle : on ne fait que relire Intervals.
//
// Ce qui est importé : durée, distance, dénivelé, puissance, FC (jamais de trace GPS), et la VFC / FC de repos de la nuit.
// Chaque sortie est rattachée à la séance prévue du même jour et du même sport ; une séance dont la sortie est arrivée
// est marquée « faite » le lendemain si l'élève ne l'a pas saisie (son ressenti reste à ajouter).
// Aucun secret à ajouter : la clé de chiffrement est dérivée de la clé « service role » du projet.

import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const API = 'https://intervals.icu/api/v1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------- Règles de rattachement (pures, testées dans l'appli) ----------
// --- debut regles ---
export type SportSeance = 'velo' | 'course' | 'renfo'

const TYPES: Record<string, SportSeance> = {
  Ride: 'velo', VirtualRide: 'velo', GravelRide: 'velo', MountainBikeRide: 'velo', EBikeRide: 'velo', EMountainBikeRide: 'velo', Velomobile: 'velo',
  Run: 'course', TrailRun: 'course', VirtualRun: 'course', Treadmill: 'course',
  WeightTraining: 'renfo', Workout: 'renfo', Crossfit: 'renfo', Pilates: 'renfo', Yoga: 'renfo',
}

/** Sport de l'appli pour un type d'activité Intervals (null : on ne l'importe pas). */
export const sportDe = (type: string): SportSeance | null => TYPES[type] ?? null

export interface SeanceARattacher {
  id: string
  date: string
  sport: SportSeance
  duree_min: number
  statut: string
}
export interface SortieARattacher {
  id: string
  date: string
  sport: SportSeance
  duree_s: number
}

/**
 * Rattache chaque sortie à une séance prévue du même jour et du même sport (validée ou faite, pas encore rattachée),
 * la plus proche en durée ; une séance ne reçoit qu'une sortie. Renvoie sortie → séance.
 */
export function rattacher(sorties: SortieARattacher[], seances: SeanceARattacher[], dejaPrises: string[]): Record<string, string> {
  const prises = new Set(dejaPrises)
  const r: Record<string, string> = {}
  for (const a of [...sorties].sort((x, y) => y.duree_s - x.duree_s)) {
    const candidates = seances
      .filter((s) => s.date === a.date && s.sport === a.sport && (s.statut === 'validee' || s.statut === 'faite') && !prises.has(s.id))
      .sort((x, y) => Math.abs(x.duree_min * 60 - a.duree_s) - Math.abs(y.duree_min * 60 - a.duree_s))
    if (candidates[0]) {
      r[a.id] = candidates[0].id
      prises.add(candidates[0].id)
    }
  }
  return r
}
// --- fin regles ---

// ---------- Chiffrement AES-GCM de la clé API ----------

const b64 = (o: Uint8Array) => btoa(String.fromCharCode(...o))
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
let cleAes: CryptoKey | undefined
async function cleChiffrement() {
  if (!cleAes) {
    const brute = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`suivi-coaching-intervals|${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)))
    cleAes = await crypto.subtle.importKey('raw', brute, 'AES-GCM', false, ['encrypt', 'decrypt'])
  }
  return cleAes
}
async function chiffrer(texte: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cleChiffrement(), new TextEncoder().encode(texte)))
  return `${b64(iv)}.${b64(ct)}`
}
async function dechiffrer(valeur: string) {
  const [iv, ct] = valeur.split('.').map(deB64)
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await cleChiffrement(), ct))
}

// ---------- Intervals.icu ----------

async function intervals(chemin: string, cleApi: string) {
  const r = await fetch(`${API}${chemin}`, { headers: { Authorization: `Basic ${btoa(`API_KEY:${cleApi}`)}` } })
  if (r.status === 401 || r.status === 403) throw new Error('CLE')
  if (r.status === 429) throw new Error('LIMITE')
  if (!r.ok) throw new Error(`Intervals.icu ${r.status}`)
  return r.json()
}

const jourIso = (d: Date) => d.toISOString().slice(0, 10)
const ilYa = (jours: number) => jourIso(new Date(Date.now() - jours * 864e5))

/** Importe les sorties et la VFC des derniers jours d'un élève relié ; renvoie le nombre de nouvelles sorties. */
async function importer(eleve: string): Promise<number> {
  const { data: compte } = await admin.from('intervals_comptes').select('*').eq('eleve_id', eleve).maybeSingle()
  if (!compte) return 0
  const cle = await dechiffrer(compte.cle_chiffre)
  const depuis = compte.dernier_import ? ilYa(Math.min(14, Math.ceil((Date.now() - Date.parse(compte.dernier_import)) / 864e5) + 2)) : ilYa(14)
  const demain = jourIso(new Date(Date.now() + 864e5))

  const liste = (await intervals(`/athlete/${compte.athlete_id}/activities?oldest=${depuis}&newest=${demain}`, cle)) as Record<string, unknown>[]
  const sorties = liste
    .filter((a) => a.source !== 'STRAVA' && sportDe(String(a.type)))
    .map((a) => ({
      id: String(a.id),
      eleve_id: eleve,
      date: String(a.start_date_local ?? a.start_date).slice(0, 10),
      sport: sportDe(String(a.type))!,
      type: String(a.type),
      nom: String(a.name ?? '').slice(0, 120),
      duree_s: Math.round(Number(a.moving_time ?? a.elapsed_time ?? 0)),
      distance_m: a.distance ?? null,
      denivele_m: a.total_elevation_gain ?? null,
      puissance_moy: a.icu_average_watts ?? a.average_watts ?? null,
      puissance_norm: a.icu_weighted_avg_watts ?? null,
      fc_moy: a.average_heartrate ?? null,
      fc_max: a.max_heartrate ?? null,
    }))

  const { data: connues } = await admin.from('activites').select('id, seance_id').eq('eleve_id', eleve).gte('date', depuis)
  const dejaLa = new Map((connues ?? []).map((a: { id: string; seance_id: string | null }) => [a.id, a.seance_id]))
  const nouvelles = sorties.filter((a) => !dejaLa.has(a.id))
  if (nouvelles.length) {
    const { data: seances } = await admin.from('seances').select('id, date, sport, duree_min, statut').eq('eleve_id', eleve).gte('date', depuis).lte('date', demain)
    const prises = [...dejaLa.values()].filter((x): x is string => !!x)
    const liens = rattacher(nouvelles, (seances ?? []) as SeanceARattacher[], prises)
    const { error } = await admin.from('activites').upsert(nouvelles.map((a) => ({ ...a, seance_id: liens[a.id] ?? null })))
    if (error) throw error
  }

  // Séance validée avec sa sortie, pas saisie par l'élève à la fin du lendemain : marquée faite (durée réelle de la sortie)
  const { data: enAttente } = await admin
    .from('activites')
    .select('seance_id, duree_s, seances!inner(statut, date)')
    .eq('eleve_id', eleve)
    .not('seance_id', 'is', null)
    .eq('seances.statut', 'validee')
    .lt('seances.date', ilYa(1))
  for (const a of (enAttente ?? []) as { seance_id: string; duree_s: number }[]) {
    await admin.from('seances').update({ statut: 'faite', duree_reelle_min: Math.max(1, Math.round(a.duree_s / 60)), faite_le: new Date().toISOString() }).eq('id', a.seance_id).eq('statut', 'validee')
  }

  // VFC et FC de repos de la nuit
  const jours = (await intervals(`/athlete/${compte.athlete_id}/wellness?oldest=${ilYa(3)}&newest=${demain}`, cle).catch(() => [])) as Record<string, unknown>[]
  const mesures = jours.filter((j) => j.hrv || j.restingHR).map((j) => ({ eleve_id: eleve, date: String(j.id), vfc: j.hrv ?? null, fc_repos: j.restingHR ?? null }))
  if (mesures.length) await admin.from('bien_etre').upsert(mesures)

  await admin.from('intervals_comptes').update({ dernier_import: new Date().toISOString() }).eq('eleve_id', eleve)
  return nouvelles.length
}

/** L'utilisateur connecté, et l'élève visé : lui-même, ou un de ses élèves s'il est coach. */
async function qui(req: Request, eleve?: string) {
  const jeton = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } }
  if (!data.user) return null
  if (!eleve || eleve === data.user.id) return { user: data.user.id, eleve: data.user.id }
  const { data: p } = await admin.from('profils').select('id').eq('id', eleve).eq('coach_id', data.user.id).maybeSingle()
  return p ? { user: data.user.id, eleve } : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const route = new URL(req.url).pathname.split('/').pop()
  try {
    if (route === 'importer-tout') {
      const { data } = await admin.from('intervals_comptes').select('eleve_id')
      let n = 0
      for (const { eleve_id } of (data ?? []) as { eleve_id: string }[]) n += await importer(eleve_id).catch(() => 0)
      return json({ importees: n })
    }

    const corps = await req.json().catch(() => ({}))
    const q = await qui(req, typeof corps.eleve === 'string' ? corps.eleve : undefined)
    if (!q) return json({ erreur: 'Connecte-toi à ton compte.' }, 401)

    if (route === 'cle') {
      if (q.eleve !== q.user) return json({ erreur: 'Seul l’élève peut relier son compte.' }, 403)
      const cleApi = String(corps.cle ?? '').trim()
      if (!cleApi) return json({ erreur: 'Colle ta clé API.' }, 400)
      const profil = await intervals('/athlete/0', cleApi) // « 0 » = le propriétaire de la clé
      const { error } = await admin.from('intervals_comptes').upsert({ eleve_id: q.eleve, athlete_id: String(profil.id), cle_chiffre: await chiffrer(cleApi), maj_le: new Date().toISOString(), dernier_import: null })
      if (error) throw error
      await admin.from('profils_sportifs').update({ liaison: 'intervals' }).eq('eleve_id', q.eleve)
      const importees = await importer(q.eleve).catch(() => 0)
      return json({ connecte: true, nom: profil.name ?? '', importees })
    }
    if (route === 'etat') {
      const { data } = await admin.from('intervals_comptes').select('dernier_import').eq('eleve_id', q.eleve).maybeSingle()
      return json({ connecte: !!data, dernier_import: data?.dernier_import ?? null })
    }
    if (route === 'deconnexion') {
      if (q.eleve !== q.user) return json({ erreur: 'Seul l’élève peut délier son compte.' }, 403)
      await admin.from('intervals_comptes').delete().eq('eleve_id', q.eleve)
      await admin.from('profils_sportifs').update({ liaison: null }).eq('eleve_id', q.eleve)
      return json({ ok: true })
    }
    if (route === 'importer') return json({ importees: await importer(q.eleve) })
    return json({ erreur: 'Route inconnue.' }, 404)
  } catch (e) {
    const m = (e as Error).message
    if (m === 'CLE') return json({ erreur: 'Clé refusée par Intervals.icu : vérifie-la (Settings → Developer Settings → API Key).' }, 400)
    if (m === 'LIMITE') return json({ erreur: 'Intervals.icu est saturé : réessaie dans quelques minutes.' }, 429)
    return json({ erreur: m }, 500)
  }
})
