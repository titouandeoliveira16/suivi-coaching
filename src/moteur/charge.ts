import { ajouterJours } from './dates'
import { pratique } from './profil'
import type { Matin, ProfilSportif, Seance, Semaine, Sport } from './types'

export const arrondi5 = (n: number) => Math.round(n / 5) * 5

/** Durée prévue d'une séance avant tout allègement. */
export function dureePrevue(s: Pick<Seance, 'duree_min' | 'avant_ajustement'>): number {
  const avant = s.avant_ajustement?.duree_min
  return typeof avant === 'number' ? avant : s.duree_min
}

const compteDansLePrevu = (s: Seance) =>
  s.statut === 'validee' || s.statut === 'faite' || (s.statut === 'annulee' && s.avant_ajustement !== null)

export interface Bilan {
  prevu: number
  realise: number
  rouges: number
  oranges: number
}

export function bilanSemaine(seances: Seance[], matins: Matin[], lundi: string): Bilan {
  const dimanche = ajouterJours(lundi, 6)
  const dansLaSemaine = (d: string) => d >= lundi && d <= dimanche
  const sem = seances.filter((s) => dansLaSemaine(s.date))
  const feux = matins.filter((m) => dansLaSemaine(m.date)).map((m) => m.feu)
  return {
    prevu: sem.filter(compteDansLePrevu).reduce((t, s) => t + dureePrevue(s), 0),
    realise: sem.filter((s) => s.statut === 'faite').reduce((t, s) => t + (s.duree_reelle_min ?? s.duree_min), 0),
    rouges: feux.filter((f) => f === 'rouge' || f === 'repos').length,
    oranges: feux.filter((f) => f === 'orange').length,
  }
}

/** Volume de départ : le volume réel des 4 dernières semaines (on garde le plus bas entre déclaré et mesuré). */
export function volumeDepart(p: ProfilSportif, mesure?: number | null): number {
  const declare = (pratique(p, 'velo') ? p.volume_velo_min : 0) + (pratique(p, 'course') ? p.volume_course_min : 0)
  const v = mesure != null ? Math.min(declare, mesure) : declare
  // Quasi rien : reprise à 3 × 30 min
  const depart = v < 60 ? 90 : v
  return arrondi5(Math.min(depart, p.minutes_semaine))
}

export interface Nominal {
  minutes: number
  raison: string
}

/**
 * Volume nominal de la semaine suivante (règles de Coach) :
 * +7,5 % si au moins 90 % réalisé, aucun jour rouge et au plus 1 orange ; −15 % si 2 jours rouges ou plus ;
 * sinon stable. Borné entre 60 % du départ et les minutes disponibles.
 */
export function nominalSuivant(p: ProfilSportif, precedente: Semaine | null, bilan: Bilan | null, sansProgression = false): Nominal {
  const depart = volumeDepart(p)
  if (!precedente || !bilan) return { minutes: depart, raison: 'Première semaine : volume de départ' }
  let minutes = precedente.nominal_min
  let raison = 'Volume stable'
  if (bilan.rouges >= 2) {
    minutes *= 0.85
    raison = '2 jours rouges ou plus la semaine dernière : −15 %'
  } else if (sansProgression) {
    raison = 'Objectif d’entretien : volume stable'
  } else if (bilan.prevu > 0 && bilan.realise / bilan.prevu >= 0.9 && bilan.rouges === 0 && bilan.oranges <= 1) {
    minutes *= 1.075
    raison = 'Semaine dernière réussie : +7,5 %'
  } else if (bilan.prevu > 0 && bilan.realise / bilan.prevu < 0.9) {
    raison = 'Moins de 90 % réalisé la semaine dernière : volume stable'
  }
  const borne = Math.min(Math.max(minutes, depart * 0.6), p.minutes_semaine)
  if (borne === p.minutes_semaine && minutes > p.minutes_semaine) raison += ' (limité à tes minutes disponibles)'
  return { minutes: arrondi5(borne), raison }
}

/** Minutes réellement faites dans un sport, semaine par semaine, sur les `n` semaines avant ce lundi. */
export function minutesParSemaine(seances: Seance[], sport: Sport, lundi: string, n = 4): number[] {
  return Array.from({ length: n }, (_, i) => {
    const debut = ajouterJours(lundi, -7 * (i + 1))
    const fin = ajouterJours(debut, 6)
    return seances
      .filter((s) => s.sport === sport && s.statut === 'faite' && s.date >= debut && s.date <= fin)
      .reduce((t, s) => t + (s.duree_reelle_min ?? s.duree_min), 0)
  })
}

/**
 * Garde-fou hebdomadaire de course (choix d'entraîneur, inspiré de Nielsen 2014) : pas plus de +30 % au-dessus
 * de la moyenne des 4 semaines précédentes dès 3 semaines de course ; avant, on part du volume déclaré.
 */
export function plafondCourse(p: ProfilSportif, seances: Seance[], lundi: string): number {
  const semaines = minutesParSemaine(seances, 'course', lundi)
  const avecCourse = semaines.filter((m) => m > 0)
  const reference = avecCourse.length >= 3 ? semaines.reduce((a, b) => a + b, 0) / 4 : p.volume_course_min
  return arrondi5(Math.max(60, reference * 1.3))
}

/** Charge (minutes × effort ressenti, Foster 2001) par jour. */
export function chargeDuJour(seances: Seance[], date: string): number {
  return seances
    .filter((s) => s.statut === 'faite' && s.date === date && s.rpe != null)
    .reduce((t, s) => t + (s.duree_reelle_min ?? s.duree_min) * (s.rpe ?? 0), 0)
}

/** Ratio charge des 7 derniers jours / moyenne hebdomadaire des 28 jours d'avant (null si trop peu d'historique). */
export function ratioPic(seances: Seance[], aujourdhui: string): number | null {
  const somme = (de: number, a: number) => {
    let t = 0
    for (let i = de; i <= a; i++) t += chargeDuJour(seances, ajouterJours(aujourdhui, -i))
    return t
  }
  const semaines = [0, 1, 2, 3].map((k) => somme(7 + 7 * k, 13 + 7 * k))
  if (semaines.filter((c) => c > 0).length < 3) return null
  const moyenne = semaines.reduce((a, b) => a + b, 0) / 4
  return moyenne > 0 ? somme(0, 6) / moyenne : null
}

/**
 * Règle de la plus longue sortie de course (Frandsen 2025, 5 205 coureurs) : aucune séance ne dépasse de plus de 10 %
 * la plus longue course des 30 derniers jours (mesurée, sinon déclarée, sinon 30 min).
 */
export function plafondSeanceCourse(p: ProfilSportif, seances: Seance[], lundi: string): number {
  const depuis = ajouterJours(lundi, -30)
  const mesure = Math.max(0, ...seances.filter((s) => s.statut === 'faite' && s.sport === 'course' && s.date >= depuis && s.date < lundi).map((s) => s.duree_reelle_min ?? s.duree_min))
  const reference = mesure || p.longue_course_min || 30
  return Math.max(20, Math.floor((reference * 1.1) / 5) * 5)
}
