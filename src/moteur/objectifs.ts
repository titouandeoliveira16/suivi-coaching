import { ajouterJours, ecartJours } from './dates'
import type { Objectif, ProfilSportif, Sport } from './types'

export type TypeObjectif =
  | 'course-piste'
  | 'course-cross'
  | 'course-5k'
  | 'course-10k'
  | 'course-semi'
  | 'course-marathon'
  | 'trail-court'
  | 'trail-long'
  | 'velo-cyclo'
  | 'velo-route'
  | 'velo-clm'
  | 'velo-montagne'
  | 'velo-kom'
  | 'velo-gravel-ultra'
  | 'velo-vtt-xc'
  | 'duathlon'
  | 'triathlon'
  | 'forme'
  | 'perte-poids'
  | 'debuter-course'
  | 'reprise-blessure'
  | 'reprise-coupure'
  | 'progresser'
  | 'hivernal'
  | 'entretien-muscu'

export interface ParamObjectif {
  libelle: string
  groupe: 'Course à pied' | 'Vélo' | 'Enchaînement' | 'Sans compétition'
  /** Sport de l'épreuve (null : celui du profil). */
  sport: Sport | null
  /** Une date d'épreuve a du sens. */
  competitif: boolean
  /** Famille dominante en développement, et l'autre pour varier. */
  dominante: string
  autre: string
  /** Séances clés de la phase spécifique (ids de la banque). */
  specifique: string[]
  /** Sortie longue maximale (minutes) — choix d'entraîneur. */
  longueMax: number
  /** Durée de l'affûtage en jours (Bosquet 2007 : 8-14 j ; marathon jusqu'à 3 sem, Smyth 2021). */
  affutageJours: number
  /** Préparation conseillée minimale, en semaines. */
  semainesMin: number
  /** Durée estimée de l'épreuve (minutes), pour la charge. */
  dureeEpreuve: number
  maxIntenses?: number
  /** Pas de progression du volume (entretien). */
  sansProgression?: boolean
  /** Sorties longues dos à dos le week-end (trail long). */
  dosADos?: boolean
  /** Sortie longue avec effort final (durabilité). */
  durabilite?: boolean
  /** Consigne ajoutée à la sortie longue en phase spécifique. */
  noteLongue?: string
  aide: string
}

const C = 'Course à pied'
const V = 'Vélo'

export const OBJECTIFS: Record<TypeObjectif, ParamObjectif> = {
  'course-piste': { libelle: 'Piste (800 m à 3 000 m)', groupe: C, sport: 'course', competitif: true, dominante: 'vo2max', autre: 'anaerobie', specifique: ['course-vma-30-30', 'course-sprints-30s', 'course-4x4-helgerud'], longueMax: 60, affutageJours: 10, semainesMin: 8, dureeEpreuve: 15, aide: 'Vitesse et VMA, séances courtes et intenses.' },
  'course-cross': { libelle: 'Cross', groupe: C, sport: 'course', competitif: true, dominante: 'vo2max', autre: 'seuil', specifique: ['course-cotes-courtes', 'course-vma-longue', 'course-fartlek'], longueMax: 75, affutageJours: 10, semainesMin: 8, dureeEpreuve: 35, aide: 'VMA, changements de rythme, côtes.' },
  'course-5k': { libelle: '5 km', groupe: C, sport: 'course', competitif: true, dominante: 'vo2max', autre: 'seuil', specifique: ['course-allure-5km', 'course-vma-longue'], longueMax: 75, affutageJours: 10, semainesMin: 8, dureeEpreuve: 30, aide: 'VMA et allure 5 km.' },
  'course-10k': { libelle: '10 km', groupe: C, sport: 'course', competitif: true, dominante: 'vo2max', autre: 'seuil', specifique: ['course-allure-10km', 'course-seuil-fractionne'], longueMax: 90, affutageJours: 10, semainesMin: 8, dureeEpreuve: 55, aide: 'VMA puis seuil, allure 10 km.' },
  'course-semi': { libelle: 'Semi-marathon (15 à 21 km)', groupe: C, sport: 'course', competitif: true, dominante: 'seuil', autre: 'vo2max', specifique: ['course-tempo-continu', 'course-seuil-fractionne', 'course-double-seuil'], longueMax: 120, affutageJours: 14, semainesMin: 10, dureeEpreuve: 120, aide: 'Seuil et sortie longue jusqu’à 2 h.' },
  'course-marathon': { libelle: 'Marathon', groupe: C, sport: 'course', competitif: true, dominante: 'seuil', autre: 'vo2max', specifique: ['course-tempo-continu', 'course-seuil-fractionne'], longueMax: 165, affutageJours: 21, semainesMin: 16, dureeEpreuve: 240, noteLongue: 'Termine les 20 à 40 dernières minutes à ton allure marathon.', aide: 'Seuil, allure marathon dans la sortie longue, 16 semaines conseillées.' },
  'trail-court': { libelle: 'Trail court (moins de 42 km)', groupe: C, sport: 'course', competitif: true, dominante: 'seuil', autre: 'vo2max', specifique: ['course-cotes-longues', 'course-cotes-courtes', 'course-seuil-fractionne'], longueMax: 150, affutageJours: 14, semainesMin: 10, dureeEpreuve: 240, noteLongue: 'Avec du dénivelé, et des descentes de plus en plus longues pour habituer tes cuisses (Bontemps 2020).', aide: 'Côtes, seuil, sorties longues en dénivelé.' },
  'trail-long': { libelle: 'Trail long / ultra', groupe: C, sport: 'course', competitif: true, dominante: 'seuil', autre: 'vo2max', specifique: ['course-cotes-longues', 'course-tempo-continu'], longueMax: 240, affutageJours: 21, semainesMin: 16, dureeEpreuve: 600, maxIntenses: 1, dosADos: true, noteLongue: 'Avec du dénivelé et des descentes progressives ; mange et bois comme le jour J.', aide: 'Endurance avant tout, sorties longues dos à dos le week-end.' },
  'velo-cyclo': { libelle: 'Cyclosportive / gran fondo', groupe: V, sport: 'velo', competitif: true, dominante: 'seuil', autre: 'vo2max', specifique: ['velo-sweet-spot-3x15', 'velo-seuil-2x20', 'velo-sweet-spot-long'], longueMax: 300, affutageJours: 14, semainesMin: 10, dureeEpreuve: 300, durabilite: true, aide: 'Sweet spot, seuil, sorties longues avec effort final.' },
  'velo-route': { libelle: 'Course sur route / critérium', groupe: V, sport: 'velo', competitif: true, dominante: 'vo2max', autre: 'anaerobie', specifique: ['velo-vo2-30-15-ronnestad', 'velo-sit-30s', 'velo-anaerobie-1min', 'velo-sprints-courts'], longueMax: 240, affutageJours: 10, semainesMin: 8, dureeEpreuve: 150, aide: 'VO2max, efforts répétés, sprints.' },
  'velo-clm': { libelle: 'Contre-la-montre', groupe: V, sport: 'velo', competitif: true, dominante: 'seuil', autre: 'vo2max', specifique: ['velo-over-unders', 'velo-seuil-continu', 'velo-seuil-4x10', 'velo-seuil-2x20'], longueMax: 180, affutageJours: 10, semainesMin: 8, dureeEpreuve: 60, aide: 'Seuil, over-unders, effort continu.' },
  'velo-montagne': { libelle: 'Montagne / cols', groupe: V, sport: 'velo', competitif: true, dominante: 'seuil', autre: 'vo2max', specifique: ['velo-seuil-2x20', 'velo-sweet-spot-long', 'velo-force-basse-cadence'], longueMax: 300, affutageJours: 14, semainesMin: 10, dureeEpreuve: 300, durabilite: true, aide: 'Seuil long, sorties longues avec montées.' },
  'velo-kom': { libelle: 'Montée sèche / record en côte', groupe: V, sport: 'velo', competitif: true, dominante: 'vo2max', autre: 'seuil', specifique: ['velo-vo2-4x5', 'velo-vo2-4x8-seiler', 'velo-anaerobie-1min'], longueMax: 180, affutageJours: 7, semainesMin: 6, dureeEpreuve: 20, aide: 'VO2max et seuil pour un effort court à fond.' },
  'velo-gravel-ultra': { libelle: 'Gravel / longue distance / ultra', groupe: V, sport: 'velo', competitif: true, dominante: 'seuil', autre: 'vo2max', specifique: ['velo-sweet-spot-3x15', 'velo-tempo-2x20'], longueMax: 360, affutageJours: 14, semainesMin: 12, dureeEpreuve: 480, maxIntenses: 1, durabilite: true, aide: 'Endurance très majoritaire, très longues sorties.' },
  'velo-vtt-xc': { libelle: 'VTT cross-country', groupe: V, sport: 'velo', competitif: true, dominante: 'vo2max', autre: 'anaerobie', specifique: ['velo-vo2-30-15-ronnestad', 'velo-vo2-40-20', 'velo-sit-30s'], longueMax: 180, affutageJours: 10, semainesMin: 8, dureeEpreuve: 100, aide: 'Efforts répétés à haute intensité.' },
  duathlon: { libelle: 'Duathlon', groupe: 'Enchaînement', sport: null, competitif: true, dominante: 'vo2max', autre: 'seuil', specifique: ['duathlon-enchainement', 'course-allure-10km', 'velo-seuil-4x10'], longueMax: 150, affutageJours: 10, semainesMin: 10, dureeEpreuve: 120, aide: 'Course et vélo, enchaînements vélo → course.' },
  triathlon: { libelle: 'Triathlon (vélo + course ici)', groupe: 'Enchaînement', sport: null, competitif: true, dominante: 'seuil', autre: 'vo2max', specifique: ['duathlon-enchainement', 'course-tempo-continu', 'velo-sweet-spot-3x15'], longueMax: 180, affutageJours: 14, semainesMin: 12, dureeEpreuve: 180, aide: 'Vélo, course et enchaînements ; la natation est à programmer à part.' },
  forme: { libelle: 'Être en forme / santé', groupe: 'Sans compétition', sport: null, competitif: false, dominante: 'vo2max', autre: 'tempo', specifique: [], longueMax: 120, affutageJours: 0, semainesMin: 0, dureeEpreuve: 0, maxIntenses: 1, aide: '150 à 300 min par semaine et du renfo 2 fois (OMS 2020).' },
  'perte-poids': { libelle: 'Perdre du poids', groupe: 'Sans compétition', sport: null, competitif: false, dominante: 'tempo', autre: 'vo2max', specifique: [], longueMax: 150, affutageJours: 0, semainesMin: 0, dureeEpreuve: 0, maxIntenses: 1, aide: 'Surtout du volume d’endurance, en visant 250 min par semaine ou plus, progressivement (Donnelly 2009).' },
  'debuter-course': { libelle: 'Débuter la course (jusqu’à 30 min ou 5 km)', groupe: 'Sans compétition', sport: 'course', competitif: false, dominante: 'vo2max', autre: 'seuil', specifique: [], longueMax: 45, affutageJours: 7, semainesMin: 8, dureeEpreuve: 35, maxIntenses: 0, aide: 'Marche-course 3 fois par semaine pendant 8 à 10 semaines (Buist 2008).' },
  'reprise-blessure': { libelle: 'Reprendre après une blessure', groupe: 'Sans compétition', sport: null, competitif: false, dominante: 'tempo', autre: 'vo2max', specifique: [], longueMax: 90, affutageJours: 0, semainesMin: 0, dureeEpreuve: 0, aide: 'Pas d’intensité le premier mois ; on progresse selon la douleur.' },
  'reprise-coupure': { libelle: 'Reprendre après une longue coupure', groupe: 'Sans compétition', sport: null, competitif: false, dominante: 'tempo', autre: 'vo2max', specifique: [], longueMax: 120, affutageJours: 0, semainesMin: 0, dureeEpreuve: 0, aide: 'Volume réduit au départ, intensité réintroduite après 3 semaines.' },
  progresser: { libelle: 'Progresser (VMA, FTP…) sans date', groupe: 'Sans compétition', sport: null, competitif: false, dominante: 'vo2max', autre: 'seuil', specifique: [], longueMax: 180, affutageJours: 0, semainesMin: 0, dureeEpreuve: 0, aide: 'Blocs de 6 à 8 semaines avec un test à chaque fin de bloc.' },
  hivernal: { libelle: 'Entretien d’hiver / home trainer', groupe: 'Sans compétition', sport: null, competitif: false, dominante: 'vo2max', autre: 'tempo', specifique: [], longueMax: 120, affutageJours: 0, semainesMin: 0, dureeEpreuve: 0, aide: 'Séances structurées en intérieur.' },
  'entretien-muscu': { libelle: 'Garder la forme pendant un bloc de musculation', groupe: 'Sans compétition', sport: null, competitif: false, dominante: 'vo2max', autre: 'tempo', specifique: [], longueMax: 90, affutageJours: 0, semainesMin: 0, dureeEpreuve: 0, maxIntenses: 1, sansProgression: true, aide: 'Volume stable et une seule séance intense pour ne pas gêner la muscu.' },
}

export const GROUPES = ['Course à pied', 'Vélo', 'Enchaînement', 'Sans compétition'] as const

export function param(type: string): ParamObjectif {
  return OBJECTIFS[type as TypeObjectif] ?? OBJECTIFS.forme
}

const PAR_DEFAUT: Objectif = { id: '', type: 'progresser', nom: '', date: null, priorite: 'A', distance_km: null, denivele_m: null, chaleur: false, altitude: false }

/** Objectif qui pilote la saison : le prochain objectif A daté, sinon un objectif A sans date, sinon le plus proche. */
export function objectifPrincipal(objectifs: Objectif[], lundi: string): Objectif {
  const avenir = objectifs.filter((o) => !o.date || o.date >= lundi)
  const dates = avenir.filter((o) => o.date).sort((a, b) => a.date!.localeCompare(b.date!))
  return dates.find((o) => o.priorite === 'A') ?? avenir.find((o) => o.priorite === 'A' && !o.date) ?? dates[0] ?? avenir[0] ?? PAR_DEFAUT
}

/** Sport qui reçoit l'essentiel du travail clé. */
export function sportPrincipal(p: ProfilSportif, o: Objectif): Sport {
  const s = param(o.type).sport
  if (s && p.disciplines.includes(s)) return s
  if (p.sport_principal && p.disciplines.includes(p.sport_principal)) return p.sport_principal
  return p.disciplines[0]
}

/** Épreuves de la semaine (A, B ou C), à placer comme séances fixes. */
export const epreuvesDeLaSemaine = (objectifs: Objectif[], lundi: string) =>
  objectifs.filter((o) => o.date && o.date >= lundi && o.date <= ajouterJours(lundi, 6) && param(o.type).competitif)

/** La semaine suit-elle un objectif A (récupération) ? */
export function apresObjectifA(objectifs: Objectif[], lundi: string): Objectif | null {
  return objectifs.find((o) => o.priorite === 'A' && o.date && o.date < lundi && ecartJours(o.date, lundi) <= 7 && param(o.type).competitif) ?? null
}

export function libelleObjectif(o: Objectif): string {
  return o.nom ? `${o.nom} (${param(o.type).libelle})` : param(o.type).libelle
}

/** Points à surveiller pour le coach (rien n'est bloqué ici, sauf mention). */
export function pointsAttention(p: ProfilSportif, objectifs: Objectif[], aujourdhui: string): string[] {
  const points: string[] = []
  const principal = objectifPrincipal(objectifs, aujourdhui)
  const pp = param(principal.type)
  if (principal.date) {
    const semaines = Math.floor(ecartJours(aujourdhui, principal.date) / 7)
    if (pp.semainesMin && semaines < pp.semainesMin) points.push(`${libelleObjectif(principal)} dans ${semaines} semaine(s) : ${pp.semainesMin} conseillées, préparation courte`)
  }
  if (principal.type === 'course-marathon' && (p.longue_course_min ?? 0) < 60) points.push('Marathon : plus longue sortie du mois sous 60 min, base encore fragile')
  if (principal.type === 'perte-poids' && p.minutes_semaine < 250) points.push('Perte de poids : moins de 250 min/sem disponibles, effet modeste à attendre (Donnelly 2009)')
  if (principal.type === 'forme' && p.minutes_semaine < 150) points.push('Sous les 150 min/sem recommandées par l’OMS')
  if (objectifs.some((o) => o.type === 'triathlon')) points.push('Triathlon : la natation n’est pas gérée ici, à programmer toi-même')
  if (objectifs.some((o) => o.type.startsWith('trail')) && !p.cotes) points.push('Trail sans côtes à proximité : côtes remplacées par du seuil, escaliers ou tapis incliné à prévoir')
  if (p.fracture_fatigue && !p.avis_kine) points.push('Fracture de fatigue : aucune course avant l’avis du kiné ou du médecin')
  if (p.grossesse || p.post_partum) points.push('Grossesse ou post-partum : avis médical, aucune intensité imposée (Mottola 2018)')
  if (p.regime_restrictif || p.trouble_alimentaire) points.push('Régime restrictif ou trouble alimentaire : orienter vers un professionnel de santé')
  if (p.diabete) points.push('Diabète : vigilance sur l’hypoglycémie, à voir avec son médecin')
  if (p.travail_poste) points.push('Travail posté : le sommeil peut assombrir le feu du jour')
  if (p.blessure_recente) points.push('Blessure dans les 12 derniers mois : facteur de risque reconnu, prudence sur la course')
  if (p.medicaments.trim()) points.push(`Médicaments : « ${p.medicaments.trim()} » — vérifier s’ils modifient la FC`)
  if (p.age && p.age >= 50) points.push('50 ans ou plus : surveiller la récupération (72 h entre séances dures possible)')
  for (const o of objectifs) {
    if (o.date && o.date < aujourdhui && o.priorite === 'A') points.push(`${libelleObjectif(o)} est passé : fixer le prochain objectif`)
    if (o.chaleur || o.altitude) points.push(`${libelleObjectif(o)} en ${[o.chaleur && 'chaleur', o.altitude && 'altitude'].filter(Boolean).join(' et ')} : prévoir une acclimatation`)
  }
  return points
}
