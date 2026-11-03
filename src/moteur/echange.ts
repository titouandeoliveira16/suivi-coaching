import { ajouterJours, jourSemaine, lundiDe } from './dates'
import { minutesParJour } from './profil'
import type { ProfilSportif, Seance } from './types'

const dure = (s: Pick<Seance, 'categorie'>) => s.categorie === 'intense' || s.categorie === 'test' || s.categorie === 'epreuve'

/** Séance à jour fixe : épreuve, ou sortie en club (le jour du club). */
const fixe = (s: Seance, p: ProfilSportif) => s.categorie === 'epreuve' || (s.categorie === 'intense' && !s.format_id && p.jours_club.includes(jourSemaine(s.date)))

export type Verdict = { ok: true } | { ok: false; raison: string }

/**
 * Peut-on intervertir les jours de deux séances ? Mêmes garde-fous que le moteur : même semaine, pas dans le passé,
 * le temps disponible du jour, les jours sans intensité, pas deux jours durs d'affilée, rien de dur juste avant une épreuve.
 * `toutes` : les séances autour (faites comprises), pour vérifier les voisins.
 */
export function echangePossible(a: Seance, b: Seance, toutes: Seance[], p: ProfilSportif, aujourdhui: string): Verdict {
  if (a.id === b.id) return { ok: false, raison: 'Même séance' }
  if (a.eleve_id !== b.eleve_id) return { ok: false, raison: 'Pas le même élève' }
  if (a.date === b.date) return { ok: false, raison: 'Même jour' }
  if (lundiDe(a.date) !== lundiDe(b.date)) return { ok: false, raison: 'Pas la même semaine' }
  if ((a.sport === 'renfo') !== (b.sport === 'renfo')) return { ok: false, raison: a.sport === 'renfo' ? 'Un renfo s’échange avec un autre renfo' : 'Une sortie s’échange avec une autre sortie' }
  for (const s of [a, b]) {
    if (s.date < aujourdhui) return { ok: false, raison: 'Jour passé' }
    if (s.statut === 'faite' || s.statut === 'annulee') return { ok: false, raison: 'Séance déjà faite ou annulée' }
    if (fixe(s, p)) return { ok: false, raison: s.categorie === 'epreuve' ? 'La course a une date fixe' : 'La sortie en club a un jour fixe' }
  }
  const minutes = minutesParJour(p)
  const apres = toutes
    .filter((s) => s.eleve_id === a.eleve_id && s.statut !== 'annulee')
    .map((s) => (s.id === a.id ? { ...s, date: b.date } : s.id === b.id ? { ...s, date: a.date } : s))
  for (const s of [{ ...a, date: b.date }, { ...b, date: a.date }]) {
    const j = jourSemaine(s.date)
    // Tout ce qui tombe ce jour-là après l'échange (sorties seulement : le renfo se glisse à côté)
    const duJour = apres.filter((x) => x.date === s.date && x.sport !== 'renfo').reduce((t, x) => t + x.duree_min, 0)
    if (s.sport !== 'renfo' && minutes[j] === 0) return { ok: false, raison: 'Jour sans disponibilité' }
    if (s.sport !== 'renfo' && duJour > minutes[j] + 10) return { ok: false, raison: `${duJour} min ce jour-là : trop long (${minutes[j]} min dispo)` }
    if (!dure(s)) continue
    if (p.jours_sans_intense.includes(j)) return { ok: false, raison: 'Jour sans intensité' }
    const voisins = apres.filter((x) => x.id !== s.id && (x.date === ajouterJours(s.date, -1) || x.date === ajouterJours(s.date, 1)))
    if (voisins.some(dure)) return { ok: false, raison: 'Deux jours durs d’affilée' }
    const epreuve = apres.find((x) => x.categorie === 'epreuve' && (x.date === ajouterJours(s.date, 1) || x.date === ajouterJours(s.date, 2)))
    if (epreuve && s.categorie !== 'epreuve') return { ok: false, raison: 'Trop près de la course' }
  }
  return { ok: true }
}
