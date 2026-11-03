import { arrondi5, type Nominal } from './charge'
import { ajusterDuree } from './semaine'
import type { Etape, Seance, Semaine } from './types'

const DUREE_MIN = 30

export interface Reajustement {
  nominal: number
  raison: string
  seances: { id: string; duree_min: number; contenu: Etape[] }[]
}

/**
 * Semaine préparée à l'avance : une fois la semaine précédente terminée, on recalcule son volume avec les règles
 * habituelles. S'il est plus bas que prévu, on raccourcit les séances faciles et la sortie longue (les séances dures
 * restent : on baisse le volume, pas l'intensité). Jamais de hausse sans le coach : un volume plus haut ne change rien.
 */
export function reajusterSemaine(semaine: Pick<Semaine, 'nominal_min'>, juste: Nominal, seances: Seance[]): Reajustement | null {
  if (juste.minutes >= semaine.nominal_min * 0.97) return null
  const coefficient = juste.minutes / semaine.nominal_min
  const faciles = seances.filter((s) => s.statut === 'validee' && (s.categorie === 'facile' || s.categorie === 'longue') && s.sport !== 'renfo')
  const total = seances.filter((s) => s.statut === 'validee' && s.sport !== 'renfo').reduce((t, s) => t + s.duree_min, 0)
  let aRetirer = total * (1 - coefficient)
  const modifiables = faciles.reduce((t, s) => t + Math.max(0, s.duree_min - DUREE_MIN), 0)
  if (!modifiables || aRetirer < 5) return null
  const part = Math.min(1, aRetirer / modifiables)
  const r: Reajustement['seances'] = []
  for (const s of faciles) {
    const duree = Math.max(DUREE_MIN, arrondi5(s.duree_min - (s.duree_min - DUREE_MIN) * part))
    if (duree >= s.duree_min) continue
    r.push({ id: s.id, duree_min: duree, contenu: s.contenu.length ? ajusterDuree(s.contenu, duree) : s.contenu })
    aRetirer -= s.duree_min - duree
  }
  return r.length ? { nominal: juste.minutes, raison: juste.raison, seances: r } : null
}
