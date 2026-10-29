import { dureeMinutes, formatObligatoire } from './banque'
import { ajouterJours, ecartJours } from './dates'
import { pratique } from './profil'
import { ajusterDuree } from './semaine'
import type { Etape, Feu, Matin, ProfilSportif, Seance, SeancePlanifiee } from './types'

export interface Allegement {
  annuler: boolean
  seance: SeancePlanifiee
  raison: string
}

const versPlanifiee = (s: Seance): SeancePlanifiee => ({
  date: s.date,
  sport: s.sport,
  categorie: s.categorie,
  format_id: s.format_id,
  titre: s.titre,
  description: s.description,
  contenu: s.contenu,
  duree_min: s.duree_min,
})

/** Moins de répétitions, mêmes intensités : une série en moins ou −⅓ des répétitions (Coach). */
export function raccourcir(etapes: Etape[]): Etape[] {
  let touche = false
  const r = etapes.map((e) => {
    if (e.type !== 'repetition' || (e.fois ?? 1) <= 1) return e
    touche = true
    const fois = e.fois ?? 1
    return { ...e, fois: Math.max(1, fois - Math.max(1, Math.round(fois / 3))) }
  })
  if (touche) return r
  // Effort continu : on retire un tiers du bloc principal
  return etapes.map((e) => (e.type === 'effort' && e.duree && !e.max && e.duree >= 900 ? { ...e, duree: Math.round((e.duree * 2) / 3) } : e))
}

function tresFacile(s: Seance, minutes: number): SeancePlanifiee {
  const f = formatObligatoire(s.sport === 'velo' ? 'velo-recuperation-active' : 'course-footing-tres-facile')
  const contenu = ajusterDuree(f.deroule, minutes)
  return { date: s.date, sport: s.sport, categorie: 'facile', format_id: f.id, titre: f.nom, description: f.resume, contenu, duree_min: dureeMinutes(contenu) }
}

/** Ce que devient la séance du jour selon le feu (null = rien ne change). Jamais plus longue que prévu. */
export function adapterAuFeu(s: Seance, feu: Feu): Allegement | null {
  if (feu === 'vert') return null
  if (feu === 'repos') return { annuler: true, seance: versPlanifiee(s), raison: 'Malade avec fièvre : repos complet' }
  if (feu === 'rouge') {
    return { annuler: false, seance: tresFacile(s, Math.min(s.duree_min, s.sport === 'velo' ? 35 : 30)), raison: 'Feu rouge : 30-45 min très facile à la place' }
  }
  if (s.categorie === 'intense') {
    const contenu = raccourcir(s.contenu)
    return {
      annuler: false,
      seance: { ...versPlanifiee(s), contenu, duree_min: Math.min(s.duree_min, dureeMinutes(contenu)), titre: `${s.titre} (raccourcie)` },
      raison: 'Feu orange : moins de répétitions, même intensité',
    }
  }
  if (s.categorie === 'test' && !s.format_id?.endsWith('-reference')) {
    const f = formatObligatoire(s.sport === 'velo' ? 'velo-endurance-courte' : 'course-footing')
    const contenu = ajusterDuree(f.deroule, Math.min(45, s.duree_min))
    return {
      annuler: false,
      seance: { date: s.date, sport: s.sport, categorie: 'facile', format_id: f.id, titre: f.nom, description: f.resume, contenu, duree_min: Math.min(s.duree_min, dureeMinutes(contenu)) },
      raison: 'Feu orange : test reporté, endurance facile à la place',
    }
  }
  return null
}

/**
 * Douleur (Silbernagel 2007, version prudente) : la course est remplacée si la douleur dépasse 5/10,
 * persiste le lendemain matin, augmente, fait boiter, ou atteint 3/10 deux séances de suite.
 */
export function raisonDouleur(faites: Seance[], matin: Matin | null, aujourdhui: string): string | null {
  const recentes = faites
    .filter((s) => s.statut === 'faite' && s.douleur != null && ecartJours(s.date, aujourdhui) <= 7 && s.date < aujourdhui)
    .sort((a, b) => b.date.localeCompare(a.date))
  const [derniere, avant] = recentes
  if (!derniere) return null
  const d = derniere.douleur ?? 0
  if (d > 5) return `Douleur de ${d}/10 à la dernière séance`
  if (derniere.boiterie) return 'Boiterie à la dernière séance'
  if (d >= 3 && matin?.douleur && derniere.date === ajouterJours(aujourdhui, -1)) return 'Douleur encore présente ce matin'
  if (d >= 3 && avant && (avant.douleur ?? 0) >= 3) return 'Douleur d’au moins 3/10 deux séances de suite'
  if (d >= 3 && avant && d > (avant.douleur ?? 0)) return 'Douleur en hausse'
  return null
}

/** La course du jour devient du vélo facile (si l'élève en fait), sinon repos. */
export function remplacerCourse(s: Seance, p: ProfilSportif, raison: string): Allegement | null {
  if (s.sport !== 'course') return null
  if (!pratique(p, 'velo')) return { annuler: true, seance: versPlanifiee(s), raison: `${raison} : repos à la place de la course` }
  const f = formatObligatoire('velo-endurance-courte')
  const contenu = ajusterDuree(f.deroule, Math.min(s.duree_min, 60))
  return {
    annuler: false,
    seance: { date: s.date, sport: 'velo', categorie: 'facile', format_id: f.id, titre: f.nom, description: f.resume, contenu, duree_min: Math.min(s.duree_min, dureeMinutes(contenu)) },
    raison: `${raison} : vélo facile à la place de la course`,
  }
}
