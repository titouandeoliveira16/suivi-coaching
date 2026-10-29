import { ecartJours } from './dates'
import { niveau } from './profil'
import type { Phase, ProfilSportif } from './types'

export interface PhaseSemaine {
  phase: Phase
  /** Semaines pleines entre ce lundi et l'objectif (0 = semaine de l'objectif). */
  semainesAvant: number | null
  /** Rang de la semaine depuis le début du suivi (0 = première). */
  rang: number
  allegee: boolean
  /** Coefficient appliqué au volume nominal (1 = normal). */
  coefficient: number
}

export const LIBELLE_PHASE: Record<Phase, string> = {
  base: 'Base',
  developpement: 'Développement',
  specifique: 'Spécifique',
  affutage: 'Affûtage',
}

/**
 * Phase de la semaine selon le temps restant avant l'objectif.
 * Affûtage (Bosquet 2007) : 2 semaines, volume −40 puis −60 %, intensité et fréquence gardées ;
 * 1 semaine (−50 %) pour un objectif court chez un débutant.
 * Sans objectif : 3 semaines normales puis 1 allégée (−35 %), comme Coach.
 */
export function phaseDeLaSemaine(p: ProfilSportif, lundi: string): PhaseSemaine {
  const rang = Math.max(0, Math.floor(ecartJours(p.debut, lundi) / 7))
  const allegeeCycle = rang % 4 === 3

  if (!p.date_objectif || ecartJours(lundi, p.date_objectif) < 0) {
    return { phase: rang < 8 ? 'base' : 'developpement', semainesAvant: null, rang, allegee: allegeeCycle, coefficient: allegeeCycle ? 0.65 : 1 }
  }

  const semainesAvant = Math.floor(ecartJours(lundi, p.date_objectif) / 7)
  const affutageCourt = niveau(p) === 'debutant' && p.duree_epreuve === 'courte'

  if (affutageCourt && semainesAvant === 0) return { phase: 'affutage', semainesAvant, rang, allegee: false, coefficient: 0.5 }
  if (!affutageCourt && semainesAvant <= 1) {
    return { phase: 'affutage', semainesAvant, rang, allegee: false, coefficient: semainesAvant === 1 ? 0.6 : 0.4 }
  }
  if (semainesAvant <= 3) return { phase: 'specifique', semainesAvant, rang, allegee: false, coefficient: 1 }
  const phase: Phase = semainesAvant <= 12 ? 'developpement' : 'base'
  return { phase, semainesAvant, rang, allegee: allegeeCycle, coefficient: allegeeCycle ? 0.65 : 1 }
}
