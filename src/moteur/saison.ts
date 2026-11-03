import { ajouterJours, lundiDe } from './dates'
import { libelleObjectif, objectifPrincipal, param } from './objectifs'
import { phaseDeLaSemaine } from './phase'
import type { Objectif, Phase, ProfilSportif } from './types'

export interface SemaineSaison {
  lundi: string
  phase: Phase
  allegee: boolean
  recuperation: boolean
  /** Objectifs (courses) de la semaine. */
  courses: string[]
}

export interface BlocSaison {
  phase: Phase
  debut: string
  /** Dimanche de la dernière semaine du bloc. */
  fin: string
  semaines: SemaineSaison[]
}

/** But de chaque phase, en une phrase pour l'élève. */
export const BUT_PHASE: Record<Phase, string> = {
  base: 'Construire le moteur : beaucoup d’endurance facile, un peu d’intensité pour ne rien perdre, et de la force.',
  developpement: 'Élever le plafond : séances dures plus présentes, ciblées sur ce que demande ton objectif.',
  specifique: 'Ressembler à la course : séances clés au rythme et à la durée de ton objectif.',
  affutage: 'Arriver frais : moins de volume, l’intensité est gardée pour rester vif.',
}

/** Semaines de la saison, du début du suivi jusqu'au dernier objectif daté (ou 12 semaines devant soi). */
export function saison(p: ProfilSportif, objectifs: Objectif[], aujourdhui: string): { semaines: SemaineSaison[]; blocs: BlocSaison[] } {
  const debut = lundiDe(p.debut > aujourdhui ? aujourdhui : p.debut)
  const dates = objectifs.filter((o) => o.date && o.date >= debut).map((o) => o.date!)
  const horizon = [ajouterJours(lundiDe(aujourdhui), 7 * 12), ...dates.map((d) => ajouterJours(lundiDe(d), 7))].sort().at(-1)!
  const semaines: SemaineSaison[] = []
  for (let l = debut; l <= horizon && semaines.length < 60; l = ajouterJours(l, 7)) {
    const ph = phaseDeLaSemaine(p, l, objectifs)
    const dimanche = ajouterJours(l, 6)
    semaines.push({
      lundi: l,
      phase: ph.phase,
      allegee: ph.allegee,
      recuperation: ph.recuperation,
      courses: objectifs.filter((o) => o.date && o.date >= l && o.date <= dimanche).map((o) => `${o.priorite} · ${libelleObjectif(o)}`),
    })
  }
  const blocs: BlocSaison[] = []
  for (const s of semaines) {
    const b = blocs.at(-1)
    if (b && b.phase === s.phase && !s.recuperation) {
      b.semaines.push(s)
      b.fin = ajouterJours(s.lundi, 6)
    } else blocs.push({ phase: s.phase, debut: s.lundi, fin: ajouterJours(s.lundi, 6), semaines: [s] })
  }
  return { semaines, blocs }
}

/** Phrase sur l'objectif qui pilote la saison. */
export function resumeObjectif(objectifs: Objectif[], aujourdhui: string): string {
  const o = objectifPrincipal(objectifs, aujourdhui)
  return `${libelleObjectif(o)}${o.date ? ` le ${o.date.split('-').reverse().join('/')}` : ''} · ${param(o.type).aide}`
}
