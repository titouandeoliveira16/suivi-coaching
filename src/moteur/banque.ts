import donnees from './banque.json'
import type { Etape, FormatSeance, Sport } from './types'

/** Séances ajoutées pour les débutants (absentes du catalogue de Coach). */
const AJOUTS: FormatSeance[] = [
  {
    id: 'course-marche-course',
    sport: 'course',
    famille: 'endurance',
    nom: 'Marche-course',
    objectif: 'Habituer le corps à courir sans se blesser',
    resume: 'Alternance de course très facile et de marche rapide.',
    unite: '%VMA',
    zone: 'Z1-Z2',
    rpe: '3-4',
    niveau: 'tous',
    dureeMin: 30,
    deroule: [
      { type: 'echauffement', duree: 300, intensite: [40, 50], note: 'marche rapide' },
      { type: 'repetition', fois: 8, etapes: [
        { type: 'effort', duree: 120, intensite: [60, 68], note: 'course très facile' },
        { type: 'recup', duree: 60, intensite: [40, 50], note: 'marche' },
      ] },
      { type: 'retour', duree: 120, intensite: [40, 50], note: 'marche' },
    ],
    phases: ['toutes'],
    conseils: ['Tu dois pouvoir parler en courant.', 'Si tout est facile, ton coach allongera les passages courus.'],
    preuve: { niveau: 'pratique', references: ['Garber 2011 (ACSM)'] },
  },
  {
    id: 'course-reference',
    sport: 'course',
    famille: 'test',
    nom: 'Parcours de référence',
    objectif: 'Mesurer tes progrès sans effort maximal',
    resume: 'Un parcours toujours identique, chronométré à effort moyen (5-6/10).',
    unite: '%VMA',
    zone: 'Z3',
    rpe: '5-6',
    niveau: 'tous',
    dureeMin: 30,
    deroule: [
      { type: 'echauffement', duree: 600, intensite: [60, 70] },
      { type: 'effort', duree: 900, intensite: [75, 82], note: 'parcours chronométré, effort 5-6/10 : note ton temps' },
      { type: 'retour', duree: 300, intensite: [55, 65] },
    ],
    phases: ['toutes'],
    conseils: ['Garde toujours le même parcours pour comparer.'],
    preuve: { niveau: 'pratique', references: ['Riebe 2015 (ACSM)'] },
  },
  {
    id: 'velo-reference',
    sport: 'velo',
    famille: 'test',
    nom: 'Parcours de référence',
    objectif: 'Mesurer tes progrès sans effort maximal',
    resume: 'Un parcours toujours identique, chronométré à effort moyen (5-6/10).',
    unite: '%CP',
    zone: 'Z3',
    rpe: '5-6',
    niveau: 'tous',
    dureeMin: 45,
    deroule: [
      { type: 'echauffement', duree: 900, intensite: [50, 65] },
      { type: 'effort', duree: 1200, intensite: [76, 85], note: 'parcours chronométré, effort 5-6/10 : note ton temps' },
      { type: 'retour', duree: 600, intensite: [45, 55] },
    ],
    phases: ['toutes'],
    conseils: ['Garde toujours le même parcours pour comparer.'],
    preuve: { niveau: 'pratique', references: ['Riebe 2015 (ACSM)'] },
  },
  {
    id: 'course-footing-tres-facile',
    sport: 'course',
    famille: 'recuperation',
    nom: 'Footing très facile',
    objectif: 'Bouger sans ajouter de fatigue',
    resume: 'Course très lente, ou marche si besoin.',
    unite: '%VMA',
    zone: 'Z1',
    rpe: '1-2',
    niveau: 'tous',
    dureeMin: 30,
    deroule: [{ type: 'effort', duree: 1800, intensite: [55, 62] }],
    phases: ['toutes'],
    conseils: ['Remplace sans regret par du repos complet.'],
    preuve: { niveau: 'faible', references: ['Van Hooren 2018'] },
  },
]

export const BANQUE: FormatSeance[] = [...(donnees.seances as unknown as FormatSeance[]), ...AJOUTS]
export const SOURCE_BANQUE = donnees.source

export function format(id: string): FormatSeance | undefined {
  return BANQUE.find((f) => f.id === id)
}

export function formatObligatoire(id: string): FormatSeance {
  const f = format(id)
  if (!f) throw new Error(`Format inconnu : ${id}`)
  return f
}

/** Durée totale d'un déroulé, en secondes. */
export function dureeSecondes(etapes: Etape[]): number {
  return etapes.reduce((t, e) => t + (e.type === 'repetition' ? (e.fois ?? 1) * dureeSecondes(e.etapes ?? []) : (e.duree ?? 0)), 0)
}

export function dureeMinutes(etapes: Etape[]): number {
  return Math.round(dureeSecondes(etapes) / 60)
}

export const formatsDuSport = (sport: Sport) => BANQUE.filter((f) => f.sport === sport)
