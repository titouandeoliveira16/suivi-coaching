import { useCallback, useEffect, useState } from 'react'
import { adapterAuFeu, raisonDouleur, remplacerCourse, type Allegement } from '../moteur/adaptation'
import { ajouterJours, jour, lundiDe } from '../moteur/dates'
import { feuDuJour, type Signal } from '../moteur/feu'
import { genererSemaine } from '../moteur/semaine'
import type { Matin, ProfilSportif, Seance, Semaine, Test } from '../moteur/types'
import type { Client } from './supabase'

/** Charge des données et permet de les recharger ; `undefined` pendant le chargement. */
export function useCharge<T>(charger: () => Promise<T>, deps: unknown[]) {
  const [donnees, setDonnees] = useState<T | undefined>(undefined)
  const [erreur, setErreur] = useState<unknown>(null)
  const fn = useCallback(charger, deps)
  const recharger = useCallback(() => {
    fn().then(
      (d) => (setDonnees(d), setErreur(null)),
      (e) => setErreur(e),
    )
  }, [fn])
  useEffect(recharger, [recharger])
  return { donnees, erreur, recharger }
}

function verifier<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error
  return data as T
}

// ---------- Lecture ----------

export async function profilSportif(c: Client, eleve: string): Promise<ProfilSportif | null> {
  return verifier(await c.from('profils_sportifs').select('*').eq('eleve_id', eleve).maybeSingle()) as ProfilSportif | null
}

export async function seancesEntre(c: Client, eleve: string, de: string, a: string): Promise<Seance[]> {
  return verifier(await c.from('seances').select('*').eq('eleve_id', eleve).gte('date', de).lte('date', a).order('date')) as Seance[]
}

export async function matinsDepuis(c: Client, eleve: string, de: string): Promise<Matin[]> {
  return verifier(await c.from('matins').select('*').eq('eleve_id', eleve).gte('date', de).order('date')) as Matin[]
}

export async function testsDe(c: Client, eleve: string): Promise<(Test & { id: string; details: Record<string, unknown> })[]> {
  return verifier(await c.from('tests').select('*').eq('eleve_id', eleve).order('date', { ascending: false })) as (Test & {
    id: string
    details: Record<string, unknown>
  })[]
}

export type SemaineStockee = Semaine & { eleve_id: string; explications: string[] }

export async function semainesDe(c: Client, eleve: string, depuis: string): Promise<SemaineStockee[]> {
  return verifier(await c.from('semaines').select('*').eq('eleve_id', eleve).gte('lundi', depuis).order('lundi')) as SemaineStockee[]
}

// ---------- Élève ----------

export async function enregistrerProfilSportif(c: Client, p: Omit<ProfilSportif, 'avis_medical'>) {
  verifier(await c.from('profils_sportifs').upsert(p))
}

/** Enregistre le questionnaire du matin et calcule le feu du jour. */
export async function enregistrerMatin(c: Client, eleve: string, m: Matin): Promise<Signal> {
  const aujourdhui = m.date
  const [precedents, seances] = await Promise.all([
    matinsDepuis(c, eleve, ajouterJours(aujourdhui, -60)),
    seancesEntre(c, eleve, ajouterJours(aujourdhui, -35), aujourdhui),
  ])
  const signal = feuDuJour(m, precedents.filter((x) => x.date < aujourdhui), seances)
  verifier(await c.from('matins').upsert({ ...m, eleve_id: eleve, feu: signal.feu }))
  return signal
}

/** Allègement à appliquer à la séance du jour (douleur d'abord, puis feu), ou null. */
export function allegementDuJour(s: Seance, p: ProfilSportif, m: Matin, historique: Seance[]): Allegement | null {
  if (s.ajustement || s.statut !== 'validee') return null
  const douleur = raisonDouleur(historique, m, s.date)
  const parDouleur = douleur ? remplacerCourse(s, p, douleur) : null
  if (parDouleur) return parDouleur
  return m.feu ? adapterAuFeu(s, m.feu) : null
}

export async function appliquerAllegement(c: Client, s: Seance, a: Allegement) {
  verifier(
    await c.rpc('ajuster_seance', {
      p_seance: s.id,
      p_titre: a.seance.titre,
      p_description: a.seance.description,
      p_contenu: a.seance.contenu,
      p_duree: a.seance.duree_min,
      p_categorie: a.seance.categorie,
      p_sport: a.seance.sport,
      p_annuler: a.annuler,
      p_raison: a.raison,
    }),
  )
}

export interface Resultat {
  duree: number
  rpe: number
  reussie: boolean
  douleur: number
  zone: string
  boiterie: boolean
  note: string
}

export async function enregistrerResultat(c: Client, s: Seance, r: Resultat) {
  verifier(
    await c.rpc('enregistrer_seance', {
      p_seance: s.id,
      p_duree: r.duree,
      p_rpe: r.rpe,
      p_reussie: r.reussie,
      p_douleur: r.douleur,
      p_zone: r.zone,
      p_boiterie: r.boiterie,
      p_note: r.note,
    }),
  )
}

export async function enregistrerTest(c: Client, t: { eleve_id: string; date: string; sport: Test['sport']; type: Test['type']; valeur: number; details: object; seance_id?: string }) {
  verifier(await c.from('tests').insert(t))
}

/** Lundi sans semaine validée : reconduit la précédente (une fois par jour au plus). */
export async function reconduireSiBesoin(c: Client, eleve: string): Promise<boolean> {
  const aujourdhui = jour()
  const cle = `reconduite-${eleve}-${aujourdhui}`
  try {
    if (localStorage.getItem(cle)) return false
    localStorage.setItem(cle, '1')
  } catch {
    // stockage indisponible : on tente quand même, le serveur refuse les doublons
  }
  const n = verifier(await c.rpc('reconduire_semaine', { p_lundi: lundiDe(aujourdhui) })) as number
  return n > 0
}

// ---------- Coach ----------

/** Prépare (ou refait) la proposition de la semaine : remplace les séances encore proposées. */
export async function proposerSemaine(c: Client, eleve: string, lundi: string, aPartirDe: string) {
  const p = await profilSportif(c, eleve)
  if (!p) return null
  const [seances, matins, tests, semaines] = await Promise.all([
    seancesEntre(c, eleve, ajouterJours(lundi, -63), ajouterJours(lundi, -1)),
    matinsDepuis(c, eleve, ajouterJours(lundi, -14)),
    testsDe(c, eleve),
    semainesDe(c, eleve, ajouterJours(lundi, -7)),
  ])
  const precedente = semaines.find((s) => s.lundi === ajouterJours(lundi, -7)) ?? null
  const r = genererSemaine({ profil: p, lundi, aPartirDe, precedente, seances, matins, tests })
  verifier(await c.from('seances').delete().eq('eleve_id', eleve).eq('statut', 'proposee').gte('date', lundi).lte('date', ajouterJours(lundi, 6)))
  verifier(await c.from('semaines').upsert({ ...r.semaine, eleve_id: eleve, explications: r.explications }))
  if (r.seances.length) verifier(await c.from('seances').insert(r.seances.map((s) => ({ ...s, eleve_id: eleve, statut: 'proposee', origine: 'moteur' }))))
  return r
}

/** Propose automatiquement la semaine en cours (si rien n'existe) et, à partir du dimanche, la suivante. */
export async function proposerAutomatiquement(c: Client, eleve: string) {
  const aujourdhui = jour()
  const lundi = lundiDe(aujourdhui)
  const suivant = ajouterJours(lundi, 7)
  const existantes = await semainesDe(c, eleve, lundi)
  if (!existantes.some((s) => s.lundi === lundi)) {
    const faites = await seancesEntre(c, eleve, lundi, ajouterJours(lundi, 6))
    if (!faites.length) await proposerSemaine(c, eleve, lundi, aujourdhui)
  }
  const dimanche = ajouterJours(lundi, 6) === aujourdhui
  if (dimanche && !existantes.some((s) => s.lundi === suivant)) await proposerSemaine(c, eleve, suivant, suivant)
}

export async function validerSemaine(c: Client, eleve: string, lundi: string) {
  const dimanche = ajouterJours(lundi, 6)
  verifier(await c.from('seances').delete().eq('eleve_id', eleve).eq('origine', 'reconduite').eq('statut', 'validee').gte('date', lundi).lte('date', dimanche))
  verifier(await c.from('seances').update({ statut: 'validee' }).eq('eleve_id', eleve).eq('statut', 'proposee').gte('date', lundi).lte('date', dimanche))
  verifier(await c.from('semaines').update({ validee: true }).eq('eleve_id', eleve).eq('lundi', lundi))
}

export async function modifierSeance(c: Client, id: string, champs: Partial<Seance>) {
  verifier(await c.from('seances').update(champs).eq('id', id))
}

export async function supprimerSeance(c: Client, id: string) {
  verifier(await c.from('seances').delete().eq('id', id))
}

export async function ajouterSeanceMain(c: Client, s: Pick<Seance, 'eleve_id' | 'date' | 'sport' | 'categorie' | 'titre' | 'description' | 'duree_min'>) {
  verifier(await c.from('seances').insert({ ...s, contenu: [], statut: 'validee', origine: 'coach' }))
}

export async function modifierProfilParCoach(c: Client, eleve: string, champs: Partial<Pick<ProfilSportif, 'avis_medical' | 'cp' | 'vma'>>) {
  verifier(await c.from('profils_sportifs').update(champs).eq('eleve_id', eleve))
}

export type Alerte = { id: string; eleve_id: string; type: string; texte: string; vue: boolean; cree_le: string }

export async function alertesNonVues(c: Client, eleve?: string): Promise<Alerte[]> {
  let q = c.from('alertes').select('*').eq('vue', false).order('cree_le', { ascending: false })
  if (eleve) q = q.eq('eleve_id', eleve)
  return verifier(await q) as Alerte[]
}

export async function marquerAlerteVue(c: Client, id: string) {
  verifier(await c.from('alertes').update({ vue: true }).eq('id', id))
}

// ---------- Messages ----------

export type Message = { id: string; eleve_id: string; auteur_id: string; seance_id: string | null; texte: string; lu: boolean; cree_le: string }

export async function messagesDe(c: Client, eleve: string): Promise<Message[]> {
  return verifier(await c.from('messages').select('*').eq('eleve_id', eleve).order('cree_le')) as Message[]
}

export async function envoyerMessage(c: Client, eleve: string, texte: string, seance?: string) {
  verifier(await c.from('messages').insert({ eleve_id: eleve, texte, seance_id: seance ?? null }))
}

export async function marquerLus(c: Client, eleve: string, moi: string) {
  verifier(await c.from('messages').update({ lu: true }).eq('eleve_id', eleve).neq('auteur_id', moi).eq('lu', false))
}

export async function nonLus(c: Client, moi: string): Promise<Record<string, number>> {
  const lignes = verifier(await c.from('messages').select('eleve_id').neq('auteur_id', moi).eq('lu', false)) as { eleve_id: string }[]
  return lignes.reduce<Record<string, number>>((t, l) => ((t[l.eleve_id] = (t[l.eleve_id] ?? 0) + 1), t), {})
}
