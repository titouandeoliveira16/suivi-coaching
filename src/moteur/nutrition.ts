/**
 * Nutrition autour d'une séance (consensus ACSM / AND / DC 2016 ; Jeukendrup ; Podlogar 2022) :
 *  - < 45 min : eau ; 45-75 min : un peu (ou bain de bouche) si c'est intense ;
 *  - 1 h 15-2 h 30 : 30-60 g de glucides par heure ; > 2 h 30 : 60-90 g/h, glucose + fructose ;
 *  - hydratation selon la soif, plus sur home trainer (pas d'air) ; sodium au-delà d'1 h ;
 *  - après une séance dure ou longue : 20-25 g de protéines dans les 2 h.
 * Les glucides pris pendant l'effort comptent dans les glucides du jour.
 */
export interface SeanceNutrition {
  sport: 'velo' | 'course' | 'natation' | 'renfo' | 'autre'
  dureeMin: number
  intensite: 'basse' | 'moyenne' | 'haute'
  test?: boolean
  homeTrainer?: boolean
}

export interface ConseilsNutrition {
  avant?: string
  pendant: string
  hydratation: string
  apres: string
  /** Glucides à prendre pendant la séance (g), fourchette */
  glucides?: [number, number]
}

const arrondi5 = (n: number) => Math.round(n / 5) * 5

export function conseilsSeance(s: SeanceNutrition): ConseilsNutrition {
  const h = s.dureeMin / 60
  const dure = s.intensite !== 'basse' || !!s.test
  const longue = s.dureeMin >= 90
  const endurance = s.sport === 'velo' || s.sport === 'course'

  let pendant: string
  let glucides: [number, number] | undefined
  if (s.test) {
    glucides = [20, 40]
    pendant = '1 bidon de boisson d’effort (20-40 g de glucides), à boire entre les efforts.'
  } else if (!endurance || s.dureeMin < 45) {
    pendant = 'Rien à manger, de l’eau suffit.'
  } else if (s.dureeMin < 75) {
    if (dure) {
      glucides = [20, 30]
      pendant = '1 bidon de boisson d’effort (20-30 g de glucides), ou au moins un bain de bouche sucré pour les derniers blocs.'
    } else pendant = 'Rien à manger, de l’eau suffit.'
  } else if (s.dureeMin <= 150) {
    glucides = [arrondi5(30 * h), arrondi5(60 * h)]
    pendant = `30-60 g de glucides par heure, soit ${glucides[0]}-${glucides[1]} g au total (boisson d'effort, gels, barre), dès la 30e minute.`
  } else {
    glucides = [arrondi5(60 * h), arrondi5(90 * h)]
    pendant = `60-90 g de glucides par heure (mélange glucose + fructose), soit ${glucides[0]}-${glucides[1]} g au total, régulièrement toutes les 20 min.`
  }

  const ht = s.sport === 'velo' && s.homeTrainer !== false
  const hydratation = !endurance && s.dureeMin < 60
    ? 'Bois selon ta soif.'
    : ht
      ? `Home trainer : 500-750 ml par heure (≈ ${Math.round((Math.max(0.5, h) * 600) / 50) * 50} ml)${s.dureeMin >= 60 ? ', avec du sodium (boisson d’effort ou une pincée de sel)' : ''}, et un ventilateur.`
      : `Bois selon ta soif${s.dureeMin >= 60 ? ', avec du sodium au-delà d’1 h s’il fait chaud' : ''}.`

  const avant = s.test || (dure && endurance) || longue
    ? 'Repas riche en glucides 2-3 h avant (ou une collation 1 h avant : banane, pain, compote).'
    : undefined

  const apres = dure || longue
    ? '20-25 g de protéines dans les 2 h (repas ou collation : skyr, lait, œufs…), avec des glucides.'
    : 'Ton repas habituel suffit.'

  return { avant, pendant, hydratation, apres, glucides }
}

/** Conseils pour une séance de l'appli (module Nutrition). */
export function conseilsPourSeance(s: { sport: string; categorie: string; duree_min: number }, homeTrainer: boolean): ConseilsNutrition {
  const intensite = s.categorie === 'intense' || s.categorie === 'epreuve' ? 'haute' : s.categorie === 'longue' ? 'moyenne' : 'basse'
  return conseilsSeance({
    sport: s.sport === 'velo' || s.sport === 'course' || s.sport === 'renfo' ? s.sport : 'autre',
    dureeMin: s.duree_min,
    intensite,
    test: s.categorie === 'test',
    homeTrainer,
  })
}
