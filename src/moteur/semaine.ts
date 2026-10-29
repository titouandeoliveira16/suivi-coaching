import { BANQUE, dureeMinutes, formatObligatoire } from './banque'
import { arrondi5, bilanSemaine, nominalSuivant, plafondCourse } from './charge'
import { ajouterJours, ecartJours } from './dates'
import { phaseDeLaSemaine } from './phase'
import { intensiteAutorisee, niveau, pratique } from './profil'
import type { Categorie, Etape, FormatSeance, Matin, Niveau, Phase, ProfilSportif, Seance, SeancePlanifiee, Semaine, Sport, Test } from './types'

export interface EntreesSemaine {
  profil: ProfilSportif
  lundi: string
  /** Premier jour où l'on peut placer une séance (ex. demain pour une semaine déjà commencée). */
  aPartirDe: string
  precedente: Semaine | null
  seances: Seance[]
  matins: Matin[]
  tests: Test[]
}

export interface SemaineProposee {
  semaine: Semaine
  seances: SeancePlanifiee[]
  explications: string[]
}

export type Creneau = { categorie: Categorie; sport?: Sport; formatId?: string; jour?: number; duree?: number }

const DUREE_MIN = 30
const ECART_TEST_JOURS = 49

// ---------- Choix des formats ----------

const PHASES_CATALOGUE: Record<Phase, string[]> = {
  base: ['base', 'toutes', 'début de phase'],
  developpement: ['construction', 'toutes', 'début de phase'],
  specifique: ['spécifique', 'toutes'],
  affutage: ['spécifique', 'construction', 'toutes'],
}

const NIVEAUX_PERMIS: Record<Niveau, string[]> = {
  debutant: ['tous'],
  intermediaire: ['tous', 'intermédiaire'],
  confirme: ['tous', 'intermédiaire', 'confirmé'],
}

/**
 * Famille de la séance intense selon la phase (dominante tournante, comme Coach : 2 sur 3 pour la dominante).
 * `indice` = rang de la séance intense dans la semaine : la 2e prend l'autre famille pour varier.
 */
export function familleIntense(p: ProfilSportif, sport: Sport, phase: Phase, rang: number, indice = 0): string {
  const dominante = p.duree_epreuve === 'longue' ? 'seuil' : 'vo2max'
  const autre = dominante === 'seuil' ? 'vo2max' : 'seuil'
  const tour = rang + indice
  switch (phase) {
    case 'base':
      return sport === 'velo' && tour % 2 === 1 ? 'tempo' : 'vo2max'
    case 'developpement':
      return indice > 0 ? (rang % 3 === 2 ? dominante : autre) : rang % 3 === 2 ? autre : dominante
    case 'specifique':
      return indice === 0 && sport === 'course' && p.date_objectif ? 'specifique' : dominante
    case 'affutage':
      return 'vo2max'
  }
}

function candidats(p: ProfilSportif, sport: Sport, famille: string, phase: Phase): FormatSeance[] {
  const niv = NIVEAUX_PERMIS[niveau(p)]
  const ok = (f: FormatSeance, avecPhase: boolean) =>
    f.sport === sport &&
    f.famille === famille &&
    niv.includes(f.niveau) &&
    f.dureeMin <= p.duree_max_min &&
    (!avecPhase || f.phases.some((ph) => PHASES_CATALOGUE[phase].includes(ph)))
  const parPhase = BANQUE.filter((f) => ok(f, true))
  return parPhase.length ? parPhase : BANQUE.filter((f) => ok(f, false))
}

/**
 * Rotation : on évite le dernier format utilisé dans la famille ; si la dernière séance de ce format a été ratée,
 * on la refait plutôt que de passer à une autre (pas de progression après un échec).
 */
export function choisirFormat(p: ProfilSportif, sport: Sport, famille: string, phase: Phase, historique: Seance[], exclus: string[] = []): FormatSeance | null {
  let liste = candidats(p, sport, famille, phase).filter((f) => !exclus.includes(f.id))
  if (phase === 'affutage') liste = [...liste].sort((a, b) => a.dureeMin - b.dureeMin).slice(0, 2)
  if (!liste.length) return null
  const ids = new Set(liste.map((f) => f.id))
  const passes = historique
    .filter((s) => s.format_id && ids.has(s.format_id) && s.statut !== 'proposee')
    .sort((a, b) => b.date.localeCompare(a.date))
  const dernier = passes[0]
  if (dernier?.statut === 'faite' && dernier.reussie === false) return liste.find((f) => f.id === dernier.format_id) ?? liste[0]
  const derniereFois = (id: string) => passes.find((s) => s.format_id === id)?.date ?? ''
  return [...liste].sort((a, b) => derniereFois(a.id).localeCompare(derniereFois(b.id)) || a.id.localeCompare(b.id))[0]
}

// ---------- Mise à la bonne durée ----------

/** Allonge ou raccourcit le bloc d'effort principal pour atteindre `minutes`. */
export function ajusterDuree(deroule: Etape[], minutes: number): Etape[] {
  const etapes = deroule.map((e) => ({ ...e }))
  const actuel = dureeMinutes(etapes)
  const principal = etapes
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.type === 'effort' && e.duree && e.intensite && !e.max)
    .sort((a, b) => (b.e.duree ?? 0) - (a.e.duree ?? 0))[0]
  if (principal) {
    const duree = Math.max(600, (principal.e.duree ?? 0) + (minutes - actuel) * 60)
    etapes[principal.i] = { ...principal.e, duree }
    return etapes
  }
  // Marche-course : on ajuste le nombre d'alternances
  const rep = etapes.findIndex((e) => e.type === 'repetition')
  if (rep >= 0) {
    const bloc = etapes[rep]
    const unite = dureeMinutes(bloc.etapes ?? []) || 1
    const fixe = actuel - unite * (bloc.fois ?? 1)
    etapes[rep] = { ...bloc, fois: Math.max(2, Math.round((minutes - fixe) / unite)) }
  }
  return etapes
}

// ---------- Placement dans la semaine ----------

/** Choisit `n` jours parmi ceux disponibles, bien répartis, en gardant un jour du week-end si possible. */
export function choisirJours(dispo: number[], n: number): number[] {
  const tries = [...new Set(dispo)].sort((a, b) => a - b)
  if (n >= tries.length) return tries
  const weekend = tries.filter((j) => j >= 5).at(-1)
  const choisis = new Set<number>(weekend !== undefined ? [weekend] : [])
  const reste = tries.filter((j) => !choisis.has(j))
  const aPrendre = n - choisis.size
  for (let k = 0; k < aPrendre; k++) choisis.add(reste[Math.floor((k * reste.length) / aPrendre)])
  return [...choisis].sort((a, b) => a - b)
}

const estDur = (c: Creneau) => c.categorie === 'intense' || (c.categorie === 'test' && !c.formatId?.endsWith('-reference'))

/**
 * Donne un jour à chaque créneau : sortie longue le week-end, jamais deux jours durs d'affilée.
 * Une séance dure impossible à espacer devient facile. Renvoie le nombre de séances déclassées.
 */
export function placer(creneaux: Creneau[], jours: number[]): number {
  const libres = [...jours].sort((a, b) => a - b)
  const prendre = (j: number) => libres.splice(libres.indexOf(j), 1)
  const durs: number[] = []
  let declasses = 0

  const longue = creneaux.find((c) => c.categorie === 'longue')
  if (longue) {
    const j = libres.filter((d) => d >= 5).at(-1) ?? libres.at(-1)!
    prendre(j)
    longue.jour = j
  }

  const eloignement = (d: number) => (durs.length ? Math.min(...durs.map((h) => Math.abs(h - d))) : 0)
  // On évite, si possible, la veille et le lendemain de la sortie longue
  const collee = (d: number) => (longue?.jour !== undefined && Math.abs(longue.jour - d) === 1 ? 1 : 0)
  for (const c of creneaux.filter(estDur)) {
    const possibles = libres.filter((d) => durs.every((h) => Math.abs(h - d) > 1))
    if (!possibles.length) {
      declasses++
      c.categorie = 'facile'
      c.formatId = undefined
      continue
    }
    const j = [...possibles].sort((a, b) => collee(a) - collee(b) || eloignement(b) - eloignement(a) || a - b)[0]
    prendre(j)
    durs.push(j)
    c.jour = j
  }

  for (const c of creneaux.filter((c) => c.jour === undefined)) {
    const j = libres.shift()
    if (j !== undefined) c.jour = j
  }
  return declasses
}

// ---------- Tests ----------

export interface TestPrevu {
  sport: Sport
  formatId: string
  maximal: boolean
}

/**
 * Tests à faire cette semaine. Débutant : pas de test à fond avant la 4e semaine (parcours de référence à la place) ;
 * ensuite CP (vélo avec capteur) ou VMA (course), puis toutes les 7 semaines. Jamais pendant l'affûtage.
 */
export function testsDeLaSemaine(p: ProfilSportif, rang: number, phase: Phase, tests: Test[], lundi: string): TestPrevu[] {
  if (phase === 'affutage') return []
  const debutant = niveau(p) === 'debutant'
  const dernier = (sport: Sport, type: Test['type']) =>
    tests.filter((t) => t.sport === sport && t.type === type).sort((a, b) => b.date.localeCompare(a.date))[0]
  const aRefaire = (sport: Sport, type: 'cp' | 'vma') => {
    const d = dernier(sport, type)
    return d ? ecartJours(d.date, lundi) >= ECART_TEST_JOURS : !debutant || rang >= 4
  }

  const prevus: TestPrevu[] = []
  if (intensiteAutorisee(p)) {
    if (pratique(p, 'velo') && p.capteur_puissance && aRefaire('velo', 'cp')) prevus.push({ sport: 'velo', formatId: 'velo-test-cp-2-points', maximal: true })
    else if (pratique(p, 'course') && aRefaire('course', 'vma')) prevus.push({ sport: 'course', formatId: 'course-test-vma-5min', maximal: true })
  }
  if (!prevus.length && debutant && rang < 4) {
    const sport = p.disciplines[0]
    if (!dernier(sport, 'reference')) prevus.push({ sport, formatId: `${sport}-reference`, maximal: false })
  }
  return prevus.slice(0, 1)
}

// ---------- Nombre de séances intenses ----------

/** Vélo et course comptés ensemble ; jamais plus de la moitié des séances, 3 au maximum. */
export function nombreIntenses(p: ProfilSportif, n: number, rang: number, allegee: boolean): number {
  if (!intensiteAutorisee(p)) return 0
  const niv = niveau(p)
  let k = niv === 'debutant' ? (rang < 4 ? 0 : 1) : niv === 'intermediaire' ? (n <= 3 ? 1 : 2) : 2
  if (allegee) k = Math.min(k, 1)
  return Math.min(k, Math.floor(n / 2), 3)
}

// ---------- Construction ----------

function formatFacile(p: ProfilSportif, sport: Sport, categorie: Categorie, rang: number, minutes: number): string {
  if (sport === 'velo') {
    if (categorie === 'longue') return niveau(p) !== 'debutant' && rang % 2 === 0 && minutes >= 90 ? 'velo-endurance-sprints' : 'velo-endurance-longue'
    return 'velo-endurance-courte'
  }
  const marcheCourse = niveau(p) === 'debutant' && p.volume_course_min < 90 && rang < 6
  if (marcheCourse) return 'course-marche-course'
  return categorie === 'longue' && niveau(p) !== 'debutant' ? 'course-sortie-longue' : 'course-footing'
}

function seanceDepuisFormat(f: FormatSeance, date: string, categorie: Categorie, minutes?: number): SeancePlanifiee {
  const contenu = minutes ? ajusterDuree(f.deroule, minutes) : f.deroule.map((e) => ({ ...e }))
  return {
    date,
    sport: f.sport,
    categorie,
    format_id: f.id,
    titre: f.nom,
    description: f.resume,
    contenu,
    duree_min: dureeMinutes(contenu),
  }
}

export function genererSemaine(e: EntreesSemaine): SemaineProposee {
  const { profil: p, lundi } = e
  const explications: string[] = []
  const ph = phaseDeLaSemaine(p, lundi)
  const precedenteLundi = ajouterJours(lundi, -7)
  const bilan = e.precedente ? bilanSemaine(e.seances, e.matins, precedenteLundi) : null
  const nominal = nominalSuivant(p, e.precedente, bilan)
  let cible = arrondi5(nominal.minutes * ph.coefficient)

  explications.push(nominal.raison)
  if (ph.allegee) explications.push('Semaine allégée (1 sur 4) : −35 %')
  if (ph.phase === 'affutage') explications.push(`Affûtage avant l'objectif : volume ×${ph.coefficient}, intensité gardée`)
  if (!intensiteAutorisee(p)) explications.push('Questionnaire santé : pas d’intensité avant l’avis médical')

  const plafond = pratique(p, 'course') ? plafondCourse(p, e.seances, lundi) : 0
  if (p.disciplines.length === 1 && p.disciplines[0] === 'course' && cible > plafond) {
    cible = plafond
    explications.push(`Course limitée à ${plafond} min (+30 % maximum par rapport aux 4 dernières semaines)`)
  }

  const jours = p.jours_dispo.filter((j) => ajouterJours(lundi, j) >= e.aPartirDe)
  const semaine: Semaine = { lundi, phase: ph.phase, nominal_min: nominal.minutes, cible_min: cible, allegee: ph.allegee, validee: false }
  if (!jours.length) return { semaine, seances: [], explications: [...explications, 'Aucun jour disponible cette semaine'] }

  const n = Math.max(1, Math.min(jours.length, Math.floor(cible / DUREE_MIN)))
  const joursChoisis = choisirJours(jours, n)
  const nbDurs = nombreIntenses(p, n, ph.rang, ph.allegee)
  const tests = testsDeLaSemaine(p, ph.rang, ph.phase, e.tests, lundi)

  // Créneaux
  const creneaux: Creneau[] = []
  let dursRestants = nbDurs
  for (const t of tests) {
    creneaux.push({ categorie: 'test', sport: t.sport, formatId: t.formatId })
    if (t.maximal) dursRestants = Math.max(0, dursRestants - 1)
  }
  const sportsIntenses: Sport[] = p.disciplines.length === 2 ? (ph.rang % 2 === 0 ? ['velo', 'course'] : ['course', 'velo']) : [p.disciplines[0]]
  for (let i = 0; i < dursRestants; i++) creneaux.push({ categorie: 'intense', sport: sportsIntenses[i % sportsIntenses.length] })
  const nbFaciles = n - creneaux.length
  for (let i = 0; i < nbFaciles; i++) creneaux.push({ categorie: i === 0 && nbFaciles >= 2 ? 'longue' : 'facile' })

  const declasses = placer(creneaux, joursChoisis)
  if (declasses) explications.push(`${declasses} séance(s) intense(s) remplacée(s) par du facile : pas assez de jours pour espacer`)

  // Durées : les séances dures gardent leur durée, le reste se partage (la sortie longue compte double, plafonnée)
  const formatsDurs = new Map<Creneau, FormatSeance>()
  const exclus: string[] = []
  let indice = 0
  for (const c of creneaux.filter((c) => c.categorie === 'intense' || c.categorie === 'test')) {
    const famille = c.formatId ? '' : familleIntense(p, c.sport!, ph.phase, ph.rang, indice++)
    const f = c.formatId ? formatObligatoire(c.formatId) : choisirFormat(p, c.sport!, famille, ph.phase, e.seances, exclus)
    if (f && f.dureeMin <= p.duree_max_min) {
      formatsDurs.set(c, f)
      exclus.push(f.id)
    } else c.categorie = 'facile'
  }
  const minutesDures = [...formatsDurs.values()].reduce((t, f) => t + f.dureeMin, 0)
  const faciles = creneaux.filter((c) => !formatsDurs.has(c))
  const poids = faciles.reduce((t, c) => t + (c.categorie === 'longue' ? 2 : 1), 0)
  const resteMinutes = Math.max(0, cible - minutesDures)
  for (const c of faciles) {
    const part = poids ? (resteMinutes * (c.categorie === 'longue' ? 2 : 1)) / poids : DUREE_MIN
    c.duree = arrondi5(Math.min(p.duree_max_min, Math.max(DUREE_MIN, part)))
  }

  // Sports des séances faciles : on vise la part de course déclarée, sans dépasser le plafond
  if (p.disciplines.length === 2) {
    const total = p.volume_velo_min + p.volume_course_min
    const part = total > 0 ? p.volume_course_min / total : 0.5
    const coursePrevue = [...formatsDurs.entries()].filter(([c]) => c.sport === 'course').reduce((t, [, f]) => t + f.dureeMin, 0)
    let course = coursePrevue
    const objectif = Math.min(plafond, cible * part)
    const longue = faciles.find((c) => c.categorie === 'longue')
    if (longue) longue.sport = part > 0.5 && course + (longue.duree ?? 0) <= plafond ? 'course' : 'velo'
    if (longue?.sport === 'course') course += longue.duree ?? 0
    for (const c of faciles.filter((c) => c !== longue)) {
      if (course + (c.duree ?? 0) <= objectif) {
        c.sport = 'course'
        course += c.duree ?? 0
      } else c.sport = 'velo'
    }
  } else {
    for (const c of faciles) c.sport = p.disciplines[0]
  }

  const seances: SeancePlanifiee[] = creneaux
    .filter((c) => c.jour !== undefined)
    .map((c) => {
      const date = ajouterJours(lundi, c.jour!)
      const f = formatsDurs.get(c)
      if (f) return seanceDepuisFormat(f, date, c.categorie)
      const minutes = c.duree ?? DUREE_MIN
      const id = formatFacile(p, c.sport!, c.categorie, ph.rang, minutes)
      return seanceDepuisFormat(formatObligatoire(id), date, c.categorie === 'longue' ? 'longue' : 'facile', minutes)
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const intenses = seances.filter((s) => s.categorie === 'intense').length
  explications.push(`${seances.length} séance(s), ${intenses} intense(s)${tests.length ? `, test : ${formatObligatoire(tests[0].formatId).nom}` : ''}`)
  semaine.cible_min = seances.reduce((t, s) => t + s.duree_min, 0)
  return { semaine, seances, explications }
}
