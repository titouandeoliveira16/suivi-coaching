import { ratioPic } from './charge'
import { ajouterJours } from './dates'
import type { Feu, Matin, Seance } from './types'

/** Note de forme du matin : moyenne des 5 réponses sur 5 (plus haut = mieux ; McLean 2010). */
export const noteMatin = (m: Matin) => (m.sommeil_q + m.fatigue + m.courbatures + m.stress + m.humeur) / 5

const moyenne = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
const ecartType = (v: number[]) => {
  const m = moyenne(v)
  return Math.sqrt(v.reduce((t, x) => t + (x - m) ** 2, 0) / Math.max(1, v.length - 1))
}

export const SEUILS = {
  sommeilMin: 6,
  ressentiFixe: 2.5,
  /** Matins nécessaires avant de passer au seuil personnel (3 semaines) */
  matinsPourSeuilPerso: 21,
  fcReposHausse: 5,
  pic: 1.3,
}

export interface Signal {
  feu: Feu
  raisons: string[]
}

/** Seuil de ressenti : 2,5/5 les 3 premières semaines, puis moyenne personnelle des 28 jours − 1 écart-type. */
export function seuilRessenti(precedents: Matin[], aujourdhui: string): number {
  if (precedents.length < SEUILS.matinsPourSeuilPerso) return SEUILS.ressentiFixe
  const depuis = ajouterJours(aujourdhui, -28)
  const notes = precedents.filter((m) => m.date >= depuis && m.date < aujourdhui).map(noteMatin)
  if (notes.length < 7) return SEUILS.ressentiFixe
  return moyenne(notes) - ecartType(notes)
}

/**
 * Feu du jour (règles de Coach) : vert = aucun indicateur, orange = 1, rouge = 2 ou plus ou malade ;
 * malade avec fièvre = repos complet.
 */
export function feuDuJour(m: Matin, precedents: Matin[], seances: Seance[]): Signal {
  if (m.malade && m.fievre) return { feu: 'repos', raisons: ['Malade avec fièvre : repos complet'] }
  const raisons: string[] = []
  if (m.malade) raisons.push('Malade')
  if (m.sommeil_h < SEUILS.sommeilMin) raisons.push('Nuit courte (moins de 6 h)')
  if (noteMatin(m) < seuilRessenti(precedents, m.date)) raisons.push('Forme du matin plus basse que d’habitude')
  if (m.douleur) raisons.push('Douleur signalée')

  const avant = precedents.filter((x) => x.date < m.date)
  const jusquA = [...avant, m]
  const depuis60 = ajouterJours(m.date, -60)
  const depuis7 = ajouterJours(m.date, -6)

  // VFC : moyenne des 7 jours (ln RMSSD) sous la zone normale des 60 jours (moyenne − 0,5 écart-type), après 14 mesures
  const vfc60 = jusquA.filter((x) => x.vfc && x.date >= depuis60).map((x) => Math.log(x.vfc!))
  const vfc7 = jusquA.filter((x) => x.vfc && x.date >= depuis7).map((x) => Math.log(x.vfc!))
  if (vfc60.length >= 14 && vfc7.length >= 3 && moyenne(vfc7) < moyenne(vfc60) - 0.5 * ecartType(vfc60)) raisons.push('VFC sous ta zone habituelle')

  // FC de repos : moyenne des 7 jours au-dessus de la base + 5 bpm
  const fc60 = jusquA.filter((x) => x.fc_repos && x.date >= depuis60).map((x) => x.fc_repos!)
  const fc7 = jusquA.filter((x) => x.fc_repos && x.date >= depuis7).map((x) => x.fc_repos!)
  if (fc60.length >= 14 && fc7.length >= 3 && moyenne(fc7) > moyenne(fc60) + SEUILS.fcReposHausse) raisons.push('FC de repos plus haute que d’habitude')

  const pic = ratioPic(seances, m.date)
  if (pic !== null && pic > SEUILS.pic) raisons.push('Charge de la semaine en forte hausse')

  const feu: Feu = m.malade || raisons.length >= 2 ? 'rouge' : raisons.length === 1 ? 'orange' : 'vert'
  return { feu, raisons }
}

export const LIBELLE_FEU: Record<Feu, string> = {
  vert: 'Feu vert : séance prévue',
  orange: 'Feu orange : on allège l’intensité',
  rouge: 'Feu rouge : séance très facile',
  repos: 'Repos complet aujourd’hui',
}
