export type Sport = 'velo' | 'course'
export type SportSeance = Sport | 'renfo'
export type Niveau = 'debutant' | 'intermediaire' | 'confirme'
export type Categorie = 'facile' | 'longue' | 'intense' | 'test' | 'renfo' | 'epreuve'
export type Phase = 'base' | 'developpement' | 'specifique' | 'affutage'
export type Feu = 'vert' | 'orange' | 'rouge' | 'repos'
export type Statut = 'proposee' | 'validee' | 'faite' | 'annulee'

export interface ProfilSportif {
  eleve_id: string
  disciplines: Sport[]
  objectif: string
  date_objectif: string | null
  duree_epreuve: 'courte' | 'longue' | null
  /** 0 = lundi … 6 = dimanche */
  jours_dispo: number[]
  minutes_semaine: number
  duree_max_min: number
  capteur_puissance: boolean
  cardio: boolean
  montre_gps: boolean
  montre_vfc: boolean
  volume_velo_min: number
  volume_course_min: number
  annees_pratique: number
  competitions: boolean
  blessures: string
  age: number | null
  fc_max: number | null
  fc_repos: number | null
  medicaments: string
  parq_oui: boolean
  avis_medical: boolean
  cp: number | null
  vma: number | null
  debut: string
  sport_principal: Sport | null
  /** Minutes disponibles par jour (lundi → dimanche, 0 = pas dispo) */
  minutes_jour: number[] | null
  jour_longue: number | null
  jours_sans_intense: number[]
  /** Jours de sortie en club ou en groupe (comptés comme séances dures) */
  jours_club: number[]
  exterieur: boolean
  home_trainer: boolean
  tapis: boolean
  piste: boolean
  cotes: boolean
  renfo: boolean
  /** Plus longue sortie des 30 derniers jours, en minutes */
  longue_course_min: number | null
  longue_velo_min: number | null
  blessure_recente: boolean
  fracture_fatigue: boolean
  avis_kine: boolean
  diabete: boolean
  travail_poste: boolean
  grossesse: boolean
  post_partum: boolean
  regime_restrictif: boolean
  trouble_alimentaire: boolean
}

export interface Objectif {
  id: string
  type: string
  nom: string
  date: string | null
  priorite: 'A' | 'B' | 'C'
  distance_km: number | null
  denivele_m: number | null
  chaleur: boolean
  altitude: boolean
}

/** Étape du déroulé d'une séance (reprend le format du catalogue de Coach). */
export interface Etape {
  type: 'echauffement' | 'effort' | 'recup' | 'retour' | 'repetition'
  duree?: number
  intensite?: [number, number]
  max?: boolean
  fois?: number
  etapes?: Etape[]
  note?: string
  cadence?: string
  /** Sport de l'étape quand il diffère de la séance (enchaînement vélo → course) */
  sport?: Sport
}

export interface Exercice {
  nom: string
  series: number
  reps: string
  repos: number
}

export interface FormatSeance {
  id: string
  sport: SportSeance
  famille: string
  nom: string
  objectif: string
  resume: string
  unite: '%CP' | '%VMA' | '%1RM'
  zone: string
  rpe: string
  niveau: string
  dureeMin: number
  deroule: Etape[]
  phases: string[]
  conseils: string[]
  preuve: { niveau: string; references: string[] }
  exercices?: Exercice[]
}

/** Séance telle que stockée (proposée, validée, faite…). */
export interface Seance {
  id: string
  eleve_id: string
  date: string
  sport: SportSeance
  categorie: Categorie
  format_id: string | null
  titre: string
  description: string
  contenu: Etape[]
  duree_min: number
  statut: Statut
  origine: 'moteur' | 'coach' | 'reconduite'
  ajustement: string | null
  avant_ajustement: Record<string, unknown> | null
  duree_reelle_min: number | null
  rpe: number | null
  reussie: boolean | null
  douleur: number | null
  douleur_zone: string | null
  boiterie: boolean | null
  note: string | null
}

/** Séance produite par le moteur, avant enregistrement. */
export type SeancePlanifiee = Pick<Seance, 'date' | 'sport' | 'categorie' | 'format_id' | 'titre' | 'description' | 'contenu' | 'duree_min'>

export interface Matin {
  date: string
  sommeil_h: number
  sommeil_q: number
  fatigue: number
  courbatures: number
  stress: number
  humeur: number
  douleur: boolean
  malade: boolean
  fievre: boolean
  vfc: number | null
  fc_repos: number | null
  feu?: Feu | null
}

export interface Test {
  date: string
  sport: Sport
  type: 'cp' | 'vma' | 'reference'
  valeur: number
}

export interface Semaine {
  lundi: string
  phase: Phase
  nominal_min: number
  cible_min: number
  allegee: boolean
  validee: boolean
}
