export type Sport = 'velo' | 'course'
export type Niveau = 'debutant' | 'intermediaire' | 'confirme'
export type Categorie = 'facile' | 'longue' | 'intense' | 'test'
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
}

export interface FormatSeance {
  id: string
  sport: Sport
  famille: string
  nom: string
  objectif: string
  resume: string
  unite: '%CP' | '%VMA'
  zone: string
  rpe: string
  niveau: string
  dureeMin: number
  deroule: Etape[]
  phases: string[]
  conseils: string[]
  preuve: { niveau: string; references: string[] }
}

/** Séance telle que stockée (proposée, validée, faite…). */
export interface Seance {
  id: string
  eleve_id: string
  date: string
  sport: Sport
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
