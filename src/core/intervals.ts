import type { Client } from './supabase'

/** Sortie importée d'Intervals.icu (jamais de trace GPS). */
export interface Activite {
  id: string
  eleve_id: string
  date: string
  sport: 'velo' | 'course' | 'renfo'
  type: string
  nom: string
  duree_s: number
  distance_m: number | null
  denivele_m: number | null
  puissance_moy: number | null
  puissance_norm: number | null
  fc_moy: number | null
  fc_max: number | null
  seance_id: string | null
}

async function appeler<T>(c: Client, route: string, corps?: unknown): Promise<T> {
  const { data } = await c.auth.getSession()
  if (!data.session) throw new Error('Connecte-toi d’abord.')
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/intervals/${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_CLE ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps ?? {}),
  }).catch(() => {
    throw new Error('Pas de connexion internet (ou fonction « intervals » pas encore installée sur Supabase).')
  })
  const json = await r.json().catch(() => ({}))
  if (r.status === 404 && !json.erreur) throw new Error('La fonction « intervals » n’est pas encore installée sur Supabase.')
  if (!r.ok) throw new Error(json.erreur ?? json.message ?? `Erreur ${r.status}`)
  return json as T
}

export const relierIntervals = (c: Client, cle: string) => appeler<{ connecte: boolean; nom: string; importees: number }>(c, 'cle', { cle })
export const etatIntervals = (c: Client, eleve?: string) => appeler<{ connecte: boolean; dernier_import: string | null }>(c, 'etat', { eleve })
export const delierIntervals = (c: Client) => appeler<{ ok: boolean }>(c, 'deconnexion')
export const importerIntervals = (c: Client, eleve?: string) => appeler<{ importees: number }>(c, 'importer', { eleve })

/** Import à l'ouverture de l'appli, au plus toutes les 20 minutes par appareil ; renvoie vrai si du nouveau est arrivé. */
export async function importerSiBesoin(c: Client, eleve: string): Promise<boolean> {
  const cle = `import-${eleve}`
  try {
    const dernier = Number(localStorage.getItem(cle) ?? 0)
    if (Date.now() - dernier < 20 * 60e3) return false
    localStorage.setItem(cle, String(Date.now()))
  } catch {
    // stockage indisponible : on importe quand même
  }
  return (await importerIntervals(c, eleve)).importees > 0
}

export async function activitesEntre(c: Client, eleve: string, de: string, a: string): Promise<Activite[]> {
  const { data, error } = await c.from('activites').select('*').eq('eleve_id', eleve).gte('date', de).lte('date', a).order('date')
  if (error) throw error
  return data as Activite[]
}

export async function bienEtreDuJour(c: Client, eleve: string, date: string): Promise<{ vfc: number | null; fc_repos: number | null } | null> {
  const { data, error } = await c.from('bien_etre').select('vfc, fc_repos').eq('eleve_id', eleve).eq('date', date).maybeSingle()
  if (error) return null
  return data
}

const hm = (s: number) => {
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`
}

/** Résumé d'une sortie en une ligne : durée, distance, puissance, FC. */
export function resumeActivite(a: Activite): string {
  return [
    hm(a.duree_s),
    a.distance_m ? `${(a.distance_m / 1000).toFixed(1).replace('.', ',')} km` : '',
    a.denivele_m ? `D+ ${Math.round(a.denivele_m)} m` : '',
    a.puissance_norm ? `${Math.round(a.puissance_norm)} W NP` : a.puissance_moy ? `${Math.round(a.puissance_moy)} W moy.` : '',
    a.fc_moy ? `FC ${Math.round(a.fc_moy)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
