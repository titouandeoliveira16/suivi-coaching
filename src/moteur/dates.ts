/** Dates locales au format AAAA-MM-JJ (pas d'heure, pas de fuseau). */

export function jour(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${j}`
}

export function versDate(iso: string): Date {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(a, m - 1, j)
}

export function ajouterJours(iso: string, n: number): string {
  const d = versDate(iso)
  d.setDate(d.getDate() + n)
  return jour(d)
}

/** 0 = lundi … 6 = dimanche */
export function jourSemaine(iso: string): number {
  return (versDate(iso).getDay() + 6) % 7
}

export function lundiDe(iso: string): string {
  return ajouterJours(iso, -jourSemaine(iso))
}

export function ecartJours(de: string, a: string): number {
  return Math.round((versDate(a).getTime() - versDate(de).getTime()) / 86_400_000)
}

export const NOMS_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

export function dateLisible(iso: string): string {
  return versDate(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
