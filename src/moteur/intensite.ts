import { fcMax, unite } from './profil'
import type { Etape, ProfilSportif, Sport } from './types'

/** Effort ressenti (0-10) correspondant à un pourcentage de CP ou de VMA. */
export function effortRessenti(sport: Sport, pct: number): string {
  if (sport === 'velo') {
    if (pct < 56) return '1-2'
    if (pct < 76) return '3-4'
    if (pct < 91) return '5-6'
    if (pct < 106) return '7-8'
    if (pct < 121) return '8-9'
    return '9-10'
  }
  if (pct < 60) return '2'
  if (pct < 75) return '3-4'
  if (pct < 85) return '5-6'
  if (pct < 92) return '7'
  if (pct < 101) return '8-9'
  return '9-10'
}

export function allure(kmh: number): string {
  const secondes = Math.round(3600 / kmh)
  return `${Math.floor(secondes / 60)}'${String(secondes % 60).padStart(2, '0')}/km`
}

export function duree(secondes: number): string {
  if (secondes < 60) return `${secondes} s`
  const m = Math.floor(secondes / 60)
  const s = secondes % 60
  if (m >= 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
  return s ? `${m} min ${s} s` : `${m} min`
}

/**
 * Cible lisible d'une étape selon le matériel de l'élève.
 * Sans capteur ni VMA : effort ressenti ; la FC n'est donnée que pour l'endurance facile
 * (elle réagit trop tard sur les efforts courts).
 */
export function cible(e: Etape, sport: Sport, p: ProfilSportif): string {
  if (e.max) return 'à fond, le plus régulier possible'
  if (!e.intensite) return ''
  const [a, b] = e.intensite
  const ressenti = `effort ${effortRessenti(sport, (a + b) / 2)}/10`
  const facile = b <= 75
  switch (unite(p, sport)) {
    case 'cp':
      return `${Math.round((p.cp! * a) / 100)}-${Math.round((p.cp! * b) / 100)} W · ${ressenti}`
    case 'vma':
      return b <= 50 ? `marche · ${ressenti}` : `${allure((p.vma! * b) / 100)} à ${allure((p.vma! * a) / 100)} · ${ressenti}`
    case 'fc': {
      const max = fcMax(p)
      if (facile && max) return `${Math.round(max * 0.6)}-${Math.round(max * 0.75)} bpm · ${ressenti}`
      return ressenti
    }
    default:
      return facile ? `${ressenti} · tu peux parler en phrases` : ressenti
  }
}
