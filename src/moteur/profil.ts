import type { Niveau, ProfilSportif, Sport } from './types'

/**
 * Niveau selon des repères d'entraîneur (classification McKay 2022 : niveaux 1-2 pour des amateurs).
 * Une inscription à une course ne suffit pas pour être « confirmé ».
 */
export function niveau(p: ProfilSportif): Niveau {
  const heures = (p.volume_velo_min + p.volume_course_min) / 60
  if (p.annees_pratique < 0.5 || heures < 3) return 'debutant'
  if (p.annees_pratique >= 2 && heures >= 6 && p.competitions) return 'confirme'
  return 'intermediaire'
}

export const LIBELLE_NIVEAU: Record<Niveau, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  confirme: 'Confirmé',
}

/** Un « oui » au questionnaire santé bloque l'intensité jusqu'à l'avis médical (Riebe 2015). */
export const intensiteAutorisee = (p: ProfilSportif) => !p.parq_oui || p.avis_medical

export type Unite = 'cp' | 'fc' | 'vma' | 'rpe'

/** Unité de pilotage selon le matériel (et selon les tests déjà faits). */
export function unite(p: ProfilSportif, sport: Sport): Unite {
  if (sport === 'velo') {
    if (p.capteur_puissance && p.cp) return 'cp'
    return p.cardio && p.fc_max ? 'fc' : 'rpe'
  }
  if (p.vma) return 'vma'
  return p.cardio && p.fc_max ? 'fc' : 'rpe'
}

/** FC max : mesurée si connue, sinon estimée (Tanaka 2001 : 208 − 0,7 × âge). */
export function fcMax(p: ProfilSportif): number | null {
  if (p.fc_max) return p.fc_max
  return p.age ? Math.round(208 - 0.7 * p.age) : null
}

export const pratique = (p: ProfilSportif, sport: Sport) => p.disciplines.includes(sport)
