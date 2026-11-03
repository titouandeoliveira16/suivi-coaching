import { ajouterJours, ecartJours, lundiDe } from './dates'
import type { PhaseSemaine } from './phase'
import type { SeancePlanifiee, Sport } from './types'

/**
 * Module Muscu : force lourde des jambes ajoutée à l'endurance, sans en retirer (Rønnestad 2010 ; Beattie 2014 ; Blagrove 2018).
 * - Préparation (base, développement) : 2 séances par semaine pendant 12 semaines, charge alternée lourd / moins lourd
 *   (Rønnestad 2010) : semaines 1-3 10RM et 6RM ; 4-6 8RM et 5RM ; 7-12 6RM et 4RM.
 * - Ensuite, et en phase spécifique ou en affûtage : 1 séance par semaine pour entretenir (Rønnestad 2010) ;
 *   5RM pour l'entretien = choix d'entraîneur.
 * - Semaine de récupération après une course A : pas de muscu (choix d'entraîneur).
 */
export function chargesMuscu(debut: string, lundi: string, ph: Pick<PhaseSemaine, 'phase' | 'recuperation'>): number[] {
  if (ph.recuperation) return []
  const semaine = Math.max(0, Math.floor(ecartJours(lundiDe(debut), lundi) / 7))
  const entretien = semaine >= 12 || ph.phase === 'specifique' || ph.phase === 'affutage'
  if (entretien) return [semaine < 3 ? 6 : 5]
  if (semaine < 3) return [10, 6]
  if (semaine < 6) return [8, 5]
  return [6, 4]
}

const dure = (s: Pick<SeancePlanifiee, 'categorie'>) => s.categorie === 'intense' || s.categorie === 'test' || s.categorie === 'epreuve'

/**
 * Jours de muscu : jamais la veille d'une séance dure, d'un test ou d'une course (Doma 2017 : jambes moins efficaces
 * jusqu'à 48 h), ni dans les 4 jours avant une course ni le lendemain, 48 h entre deux séances (choix d'entraîneur).
 * De préférence le jour d'une séance dure (après, principe « dur le jour dur »), sinon un jour facile, sinon un jour libre.
 */
export function joursMuscu(seances: SeancePlanifiee[], lundi: string, aPartirDe: string, minutes: number[], nombre: number, courses: string[], avant: SeancePlanifiee[] = []): number[] {
  // Muscu le dimanche d'avant : pas le lundi (48 h)
  const muscuDimanche = avant.some((s) => s.date === ajouterJours(lundi, -1) && s.format_id?.startsWith('muscu-'))
  const duJour = (j: number) => seances.filter((s) => s.date === ajouterJours(lundi, j) && s.sport !== 'renfo')
  const veilleDur = (j: number) => duJour(j + 1).some(dure) || courses.includes(ajouterJours(lundi, j + 1))
  const procheCourse = (j: number) => courses.some((c) => { const e = ecartJours(ajouterJours(lundi, j), c); return e >= -1 && e <= 4 })
  const candidats = [0, 1, 2, 3, 4, 5, 6].filter(
    (j) => ajouterJours(lundi, j) >= aPartirDe && !veilleDur(j) && !procheCourse(j) && !(j === 0 && muscuDimanche) && (duJour(j).length > 0 || minutes[j] > 0),
  )
  // Le dimanche en dernier recours : on ne sait pas encore si le lundi suivant sera dur
  const rang = (j: number) => (duJour(j).some(dure) ? 0 : duJour(j).length ? 1 : 2) + (j === 6 ? 3 : 0)
  const ordre = [...candidats].sort((a, b) => rang(a) - rang(b) || a - b)
  const choix: number[] = []
  for (const j of ordre) if (choix.length < nombre && choix.every((k) => Math.abs(k - j) >= 2)) choix.push(j)
  return choix.sort((a, b) => a - b)
}

export const formatMuscu = (sport: Sport, rm: number) => `muscu-${sport}-${rm}rm`
