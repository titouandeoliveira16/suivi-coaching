/** CP à partir de 2 efforts à fond de 3 et 12 min (modèle travail-durée, Karsten 2015). */
export function cpDeuxPoints(p3: number, p12: number): number {
  return Math.round((p12 * 720 - p3 * 180) / 540)
}

/** VMA estimée par la vitesse moyenne d'un effort de 5 min à fond (Berthon 1997). */
export function vmaCinqMinutes(distanceM: number): number {
  return Math.round(distanceM * 0.012 * 10) / 10
}

/** Temps lisible en minutes:secondes. */
export function chrono(secondes: number): string {
  return `${Math.floor(secondes / 60)}:${String(Math.round(secondes % 60)).padStart(2, '0')}`
}
