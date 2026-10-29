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

/**
 * Pas d'intensité sans avis médical en cas de « oui » au questionnaire santé (Riebe 2015)
 * ou de grossesse / post-partum (Mottola 2018).
 */
export const intensiteAutorisee = (p: ProfilSportif) => p.avis_medical || !(p.parq_oui || p.grossesse || p.post_partum)

/** Sports réellement programmables : pas de course après une fracture de fatigue sans avis du kiné. */
export function disciplinesActives(p: ProfilSportif): Sport[] {
  return p.disciplines.filter((s) => !(s === 'course' && p.fracture_fatigue && !p.avis_kine))
}

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

export const pratique = (p: ProfilSportif, sport: Sport) => disciplinesActives(p).includes(sport)

/** Minutes disponibles chaque jour (0 = pas dispo), à partir du détail par jour ou des jours + durée max. */
export function minutesParJour(p: ProfilSportif): number[] {
  if (p.minutes_jour?.length === 7) return p.minutes_jour
  return Array.from({ length: 7 }, (_, j) => (p.jours_dispo.includes(j) ? p.duree_max_min : 0))
}

/** Seulement en intérieur : la sortie longue est gardée confortable (préférence, pas une règle prouvée). */
export const interieurSeulement = (p: ProfilSportif) => !p.exterieur && (p.home_trainer || p.tapis)
