import { ecartJours } from './dates'
import { apresObjectifA, objectifPrincipal, param } from './objectifs'
import type { Objectif, Phase, ProfilSportif } from './types'

export interface PhaseSemaine {
  phase: Phase
  /** Semaines pleines entre ce lundi et l'objectif principal (0 = semaine de l'objectif). */
  semainesAvant: number | null
  /** Rang de la semaine depuis le début du suivi (0 = première). */
  rang: number
  allegee: boolean
  /** Coefficient appliqué au volume nominal (1 = normal). */
  coefficient: number
  /** Semaine de récupération après un objectif A. */
  recuperation: boolean
}

export const LIBELLE_PHASE: Record<Phase, string> = {
  base: 'Base',
  developpement: 'Développement',
  specifique: 'Spécifique',
  affutage: 'Affûtage',
}

/**
 * Coefficients de l'affûtage, de la plus lointaine à la semaine de l'épreuve.
 * Bosquet 2007 : 8-14 jours, volume −41 à −60 %, intensité et fréquence gardées ;
 * marathon : jusqu'à 3 semaines (Smyth & Lawlor 2021).
 */
export function coefficientsAffutage(jours: number): number[] {
  if (jours <= 0) return []
  if (jours <= 7) return [0.5]
  if (jours <= 10) return [0.75, 0.5]
  if (jours <= 14) return [0.6, 0.45]
  return [0.6, 0.5, 0.4]
}

/** Phase de la semaine selon le temps restant avant l'objectif principal. */
export function phaseDeLaSemaine(p: ProfilSportif, lundi: string, objectifs: Objectif[] = []): PhaseSemaine {
  const rang = Math.max(0, Math.floor(ecartJours(p.debut, lundi) / 7))
  const allegeeCycle = rang % 4 === 3
  const base = { rang, recuperation: false }

  // Semaine qui suit un objectif A : récupération (choix d'entraîneur)
  if (apresObjectifA(objectifs, lundi)) return { ...base, phase: 'base', semainesAvant: null, allegee: true, coefficient: 0.6, recuperation: true }

  const principal = objectifPrincipal(objectifs, lundi)
  const pp = param(principal.type)
  if (!principal.date || !pp.competitif || ecartJours(lundi, principal.date) < 0) {
    // Sans échéance : base 8 semaines puis développement, une semaine allégée sur 4
    return { ...base, phase: rang < 8 ? 'base' : 'developpement', semainesAvant: null, allegee: allegeeCycle, coefficient: allegeeCycle ? 0.65 : 1 }
  }

  const semainesAvant = Math.floor(ecartJours(lundi, principal.date) / 7)
  const affutage = coefficientsAffutage(pp.affutageJours)
  if (semainesAvant < affutage.length) {
    return { ...base, phase: 'affutage', semainesAvant, allegee: false, coefficient: affutage[affutage.length - 1 - semainesAvant] }
  }
  if (semainesAvant < affutage.length + 3) return { ...base, phase: 'specifique', semainesAvant, allegee: false, coefficient: 1 }
  const phase: Phase = semainesAvant <= 12 ? 'developpement' : 'base'
  return { ...base, phase, semainesAvant, allegee: allegeeCycle, coefficient: allegeeCycle ? 0.65 : 1 }
}
