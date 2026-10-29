import { BANQUE, dureeMinutes, formatObligatoire, minutesCourues } from './banque'
import { arrondi5, bilanSemaine, nominalSuivant, plafondCourse, plafondSeanceCourse } from './charge'
import { ajouterJours, ecartJours, jourSemaine } from './dates'
import { epreuvesDeLaSemaine, libelleObjectif, objectifPrincipal, param, sportPrincipal, type ParamObjectif } from './objectifs'
import { phaseDeLaSemaine, type PhaseSemaine } from './phase'
import { disciplinesActives, intensiteAutorisee, interieurSeulement, minutesParJour, niveau, pratique } from './profil'
import type { Categorie, Etape, FormatSeance, Matin, Niveau, Objectif, Phase, ProfilSportif, Seance, SeancePlanifiee, Semaine, Sport, SportSeance, Test } from './types'

export interface EntreesSemaine {
  profil: ProfilSportif
  lundi: string
  /** Premier jour où l'on peut placer une séance (ex. aujourd'hui pour une semaine déjà commencée). */
  aPartirDe: string
  precedente: Semaine | null
  seances: Seance[]
  matins: Matin[]
  tests: Test[]
  objectifs?: Objectif[]
}

export interface SemaineProposee {
  semaine: Semaine
  seances: SeancePlanifiee[]
  explications: string[]
}

export type Creneau = {
  categorie: Categorie
  sport?: SportSeance
  formatId?: string
  jour?: number
  duree?: number
  titre?: string
  description?: string
  /** Placé d'avance (épreuve, sortie en club) */
  fixe?: boolean
  /** 2e sortie longue, le lendemain de la première (trail long) */
  dosADos?: boolean
}

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

const besoinCotes = (f: FormatSeance) => f.id.includes('cotes')

/**
 * Famille de la séance intense : base = VO2max (ou tempo à vélo une semaine sur deux) ; développement = dominante
 * de l'objectif 2 semaines sur 3 ; la 2e séance de la semaine prend l'autre famille pour varier.
 */
export function familleIntense(pp: ParamObjectif, sport: Sport, phase: Phase, rang: number, indice = 0): string {
  const tour = rang + indice
  switch (phase) {
    case 'base':
      return sport === 'velo' && tour % 2 === 1 ? 'tempo' : 'vo2max'
    case 'developpement':
      return (rang % 3 === 2) !== indice > 0 ? pp.autre : pp.dominante
    case 'specifique':
      return indice === 0 ? pp.dominante : pp.autre
    case 'affutage':
      return 'vo2max'
  }
}

function permis(p: ProfilSportif, f: FormatSeance, dureeMax: number): boolean {
  return NIVEAUX_PERMIS[niveau(p)].includes(f.niveau) && f.dureeMin <= dureeMax && (!besoinCotes(f) || p.cotes)
}

/** Le moins récemment utilisé ; refait le même format si la dernière fois a été ratée (pas de progression après un échec). */
function rotation(liste: FormatSeance[], historique: Seance[]): FormatSeance | null {
  if (!liste.length) return null
  const ids = new Set(liste.map((f) => f.id))
  const passes = historique.filter((s) => s.format_id && ids.has(s.format_id) && s.statut !== 'proposee').sort((a, b) => b.date.localeCompare(a.date))
  const dernier = passes[0]
  if (dernier?.statut === 'faite' && dernier.reussie === false) return liste.find((f) => f.id === dernier.format_id) ?? liste[0]
  const derniereFois = (id: string) => passes.find((s) => s.format_id === id)?.date ?? ''
  return [...liste].sort((a, b) => derniereFois(a.id).localeCompare(derniereFois(b.id)) || a.id.localeCompare(b.id))[0]
}

export function choisirFormat(p: ProfilSportif, sport: Sport, famille: string, phase: Phase, historique: Seance[], exclus: string[] = [], dureeMax = p.duree_max_min): FormatSeance | null {
  const ok = (f: FormatSeance, avecPhase: boolean) =>
    f.sport === sport && f.famille === famille && !exclus.includes(f.id) && permis(p, f, dureeMax) && (!avecPhase || f.phases.some((ph) => PHASES_CATALOGUE[phase].includes(ph)))
  let liste = BANQUE.filter((f) => ok(f, true))
  if (!liste.length) liste = BANQUE.filter((f) => ok(f, false))
  if (phase === 'affutage') liste = [...liste].sort((a, b) => a.dureeMin - b.dureeMin).slice(0, 2)
  return rotation(liste, historique)
}

/** Séance clé de la phase spécifique, tirée de la liste propre à l'objectif. */
function formatSpecifique(p: ProfilSportif, pp: ParamObjectif, sport: Sport, historique: Seance[], exclus: string[], dureeMax: number): FormatSeance | null {
  const liste = pp.specifique
    .map((id) => BANQUE.find((f) => f.id === id))
    .filter((f): f is FormatSeance => !!f && f.sport === sport && !exclus.includes(f.id) && permis(p, f, dureeMax))
    .filter((f) => f.id !== 'duathlon-enchainement' || disciplinesActives(p).length === 2)
  return rotation(liste, historique)
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

/** Choisit `n` jours parmi ceux disponibles, bien répartis, en gardant le jour de sortie longue si possible. */
export function choisirJours(dispo: number[], n: number, prefere?: number | null): number[] {
  const tries = [...new Set(dispo)].sort((a, b) => a - b)
  if (n >= tries.length) return tries
  const garde = prefere != null && tries.includes(prefere) ? prefere : tries.filter((j) => j >= 5).at(-1)
  const choisis = new Set<number>(garde !== undefined ? [garde] : [])
  const reste = tries.filter((j) => !choisis.has(j))
  const aPrendre = n - choisis.size
  for (let k = 0; k < aPrendre; k++) choisis.add(reste[Math.floor((k * reste.length) / aPrendre)])
  return [...choisis].sort((a, b) => a - b)
}

export interface Contraintes {
  /** Minutes disponibles par jour (0 → 6) */
  minutes?: number[]
  /** Jours où aucune séance dure n'est permise */
  sansIntense?: number[]
  jourLongue?: number | null
}

const estDur = (c: Creneau) => c.categorie === 'intense' || c.categorie === 'epreuve' || (c.categorie === 'test' && !c.formatId?.endsWith('-reference'))

/**
 * Donne un jour à chaque créneau : sortie longue le jour préféré (sinon le week-end), jamais deux jours durs
 * d'affilée, pas d'intensité les jours interdits. Une séance dure impossible à placer devient facile.
 */
export function placer(creneaux: Creneau[], jours: number[], c: Contraintes = {}): number {
  const minutes = c.minutes ?? Array(7).fill(600)
  const libres = [...jours].sort((a, b) => a - b)
  const prendre = (j: number) => libres.splice(libres.indexOf(j), 1)
  const durs = creneaux.filter((x) => x.fixe && estDur(x) && x.jour !== undefined).map((x) => x.jour!)
  let declasses = 0

  const longue = creneaux.find((x) => x.categorie === 'longue' && !x.dosADos && x.jour === undefined)
  const enchainee = creneaux.some((x) => x.dosADos)
  if (longue && libres.length) {
    // Avec deux sorties longues enchaînées, il faut un lendemain libre (samedi + dimanche de préférence)
    const candidats = enchainee && libres.some((d) => libres.includes(d + 1)) ? libres.filter((d) => libres.includes(d + 1)) : libres
    const j =
      c.jourLongue != null && candidats.includes(c.jourLongue)
        ? c.jourLongue
        : ([...candidats].filter((d) => d >= 5 || (enchainee && d >= 4)).sort((a, b) => minutes[b] - minutes[a] || b - a)[0] ?? [...candidats].sort((a, b) => minutes[b] - minutes[a])[0])
    prendre(j)
    longue.jour = j
    const second = creneaux.find((x) => x.dosADos)
    if (second) {
      if (libres.includes(j + 1)) {
        prendre(j + 1)
        second.jour = j + 1
      } else {
        second.dosADos = false
        second.categorie = 'facile'
      }
    }
  }

  const eloignement = (d: number) => (durs.length ? Math.min(...durs.map((h) => Math.abs(h - d))) : 0)
  const collee = (d: number) => (longue?.jour !== undefined && Math.abs(longue.jour - d) === 1 ? 1 : 0)
  for (const x of creneaux.filter((x) => estDur(x) && x.jour === undefined)) {
    const espaces = libres.filter((d) => !c.sansIntense?.includes(d) && durs.every((h) => Math.abs(h - d) > 1))
    // Un test ou une séance de durée connue va de préférence un jour qui a le temps de l'accueillir
    const assez = espaces.filter((d) => minutes[d] >= (x.duree ?? 0))
    const possibles = assez.length ? assez : espaces
    if (!possibles.length) {
      declasses++
      x.categorie = 'facile'
      x.formatId = undefined
      continue
    }
    const j = [...possibles].sort((a, b) => collee(a) - collee(b) || Number(minutes[b] >= 45) - Number(minutes[a] >= 45) || eloignement(b) - eloignement(a) || a - b)[0]
    prendre(j)
    durs.push(j)
    x.jour = j
  }

  for (const x of creneaux.filter((x) => x.jour === undefined)) {
    const j = libres.shift()
    if (j !== undefined) x.jour = j
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
 * ensuite CP (vélo avec capteur) ou VMA (course), puis toutes les 7 semaines. Jamais pendant l'affûtage,
 * ni s'il en reste un de prévu ou fait il y a moins de 2 semaines (résultat pas encore saisi).
 */
export function testsDeLaSemaine(p: ProfilSportif, rang: number, phase: Phase, tests: Test[], lundi: string, historique: Seance[] = []): TestPrevu[] {
  if (phase === 'affutage') return []
  const debutant = niveau(p) === 'debutant'
  const dernier = (sport: Sport, type: Test['type']) => tests.filter((t) => t.sport === sport && t.type === type).sort((a, b) => b.date.localeCompare(a.date))[0]
  const dejaPrevu = (formatId: string) => historique.some((s) => s.format_id === formatId && s.statut !== 'annulee' && s.date >= ajouterJours(lundi, -14))
  const aRefaire = (sport: Sport, type: 'cp' | 'vma', formatId: string) => {
    if (dejaPrevu(formatId)) return false
    const d = dernier(sport, type)
    return d ? ecartJours(d.date, lundi) >= ECART_TEST_JOURS : !debutant || rang >= 4
  }

  const prevus: TestPrevu[] = []
  if (intensiteAutorisee(p)) {
    if (pratique(p, 'velo') && p.capteur_puissance && aRefaire('velo', 'cp', 'velo-test-cp-2-points')) prevus.push({ sport: 'velo', formatId: 'velo-test-cp-2-points', maximal: true })
    else if (pratique(p, 'course') && aRefaire('course', 'vma', 'course-test-vma-5min')) prevus.push({ sport: 'course', formatId: 'course-test-vma-5min', maximal: true })
  }
  if (!prevus.length && debutant && rang < 4) {
    const sport = disciplinesActives(p)[0]
    if (sport && !dernier(sport, 'reference') && !dejaPrevu(`${sport}-reference`)) prevus.push({ sport, formatId: `${sport}-reference`, maximal: false })
  }
  return prevus.slice(0, 1)
}

// ---------- Nombre de séances intenses ----------

/** Vélo et course comptés ensemble ; jamais plus de la moitié des séances, 3 au maximum. */
export function nombreIntenses(p: ProfilSportif, n: number, rang: number, allegee: boolean, objectif: string = 'progresser'): number {
  if (!intensiteAutorisee(p)) return 0
  const pp = param(objectif)
  if (objectif === 'debuter-course') return 0
  if (objectif === 'reprise-blessure' && rang < 4) return 0
  if (objectif === 'reprise-coupure' && rang < 3) return 0
  const niv = niveau(p)
  let k = niv === 'debutant' ? (rang < 4 ? 0 : 1) : niv === 'intermediaire' ? (n <= 3 ? 1 : 2) : 2
  if (pp.maxIntenses !== undefined) k = Math.min(k, pp.maxIntenses)
  if (allegee) k = Math.min(k, 1)
  return Math.min(k, Math.floor(n / 2), 3)
}

// ---------- Construction ----------

function formatFacile(p: ProfilSportif, sport: Sport, categorie: Categorie, ph: PhaseSemaine, pp: ParamObjectif, objectif: string, minutes: number): string {
  if (sport === 'velo') {
    if (categorie !== 'longue') return 'velo-endurance-courte'
    const durabilite = pp.durabilite && niveau(p) === 'confirme' && (ph.phase === 'developpement' || ph.phase === 'specifique') && ph.rang % 2 === 0 && minutes >= 150
    if (durabilite) return 'velo-durabilite-effort-final'
    return niveau(p) !== 'debutant' && ph.rang % 2 === 0 && minutes >= 90 ? 'velo-endurance-sprints' : 'velo-endurance-longue'
  }
  const marcheCourse = objectif === 'debuter-course' ? ph.rang < 8 : niveau(p) === 'debutant' && p.volume_course_min < 90 && ph.rang < 6
  if (marcheCourse || (objectif === 'reprise-blessure' && ph.rang < 4)) return 'course-marche-course'
  return categorie === 'longue' && niveau(p) !== 'debutant' ? 'course-sortie-longue' : 'course-footing'
}

function seanceDepuisFormat(f: FormatSeance, date: string, categorie: Categorie, minutes?: number, note?: string): SeancePlanifiee {
  const contenu = minutes && f.deroule.length ? ajusterDuree(f.deroule, minutes) : f.deroule.map((e) => ({ ...e }))
  return {
    date,
    sport: f.sport,
    categorie,
    format_id: f.id,
    titre: f.nom,
    description: note ? `${f.resume} ${note}` : f.resume,
    contenu,
    duree_min: contenu.length ? dureeMinutes(contenu) : f.dureeMin,
  }
}

export function genererSemaine(e: EntreesSemaine): SemaineProposee {
  const { profil: p, lundi } = e
  const objectifs = e.objectifs ?? []
  const explications: string[] = []
  const ph = phaseDeLaSemaine(p, lundi, objectifs)
  const principal = objectifPrincipal(objectifs, lundi)
  const pp = param(principal.type)
  const actifs = disciplinesActives(p)
  const semaine: Semaine = { lundi, phase: ph.phase, nominal_min: 0, cible_min: 0, allegee: ph.allegee, validee: false }
  if (!actifs.length) return { semaine, seances: [], explications: ['Aucun sport programmable (course suspendue après une fracture de fatigue)'] }
  const sportP = actifs.includes(sportPrincipal(p, principal)) ? sportPrincipal(p, principal) : actifs[0]

  const bilan = e.precedente ? bilanSemaine(e.seances, e.matins, ajouterJours(lundi, -7)) : null
  const nominal = nominalSuivant(p, e.precedente, bilan, pp.sansProgression)
  semaine.nominal_min = nominal.minutes
  let cible = arrondi5(nominal.minutes * ph.coefficient)
  explications.push(`Objectif principal : ${libelleObjectif(principal)}${principal.date ? ` le ${principal.date.split('-').reverse().join('/')}` : ''}`)
  explications.push(nominal.raison)
  if (ph.recuperation) explications.push('Semaine de récupération après l’objectif : −40 %, pas d’intensité')
  else if (ph.allegee) explications.push('Semaine allégée (1 sur 4) : −35 %')
  if (ph.phase === 'affutage') explications.push(`Affûtage : volume ×${ph.coefficient}, intensité gardée (Bosquet 2007)`)
  if (!intensiteAutorisee(p)) explications.push('Santé : pas d’intensité avant l’avis médical')
  if (actifs.length < p.disciplines.length) explications.push('Course suspendue jusqu’à l’avis du kiné (fracture de fatigue)')

  const minutes = minutesParJour(p)
  const dureeMax = Math.max(...minutes)
  const plafond = pratique(p, 'course') ? plafondCourse(p, e.seances, lundi) : 0
  const plafondSeance = plafondSeanceCourse(p, e.seances, lundi)
  if (actifs.length === 1 && actifs[0] === 'course' && cible > plafond) {
    cible = plafond
    explications.push(`Course limitée à ${plafond} min cette semaine (+30 % maximum)`)
  }

  // Épreuves (fixes) et jours interdits d'intensité autour
  const creneaux: Creneau[] = []
  const sansIntense = new Set(p.jours_sans_intense)
  for (const o of epreuvesDeLaSemaine(objectifs, lundi)) {
    if (o.date! < e.aPartirDe) continue
    const j = jourSemaine(o.date!)
    const po = param(o.type)
    const sport = po.sport && actifs.includes(po.sport) ? po.sport : sportP
    creneaux.push({ categorie: 'epreuve', sport, jour: j, fixe: true, duree: po.dureeEpreuve, titre: `🏁 ${libelleObjectif(o)}`, description: `Objectif ${o.priorite}${o.distance_km ? ` · ${o.distance_km} km` : ''}${o.denivele_m ? ` · D+ ${o.denivele_m} m` : ''}. Bonne course !` })
    sansIntense.add(j - 1)
    if (o.priorite !== 'C') sansIntense.add(j - 2)
    if (o.priorite === 'B' && o.id !== principal.id) {
      cible = arrondi5(cible * 0.8)
      explications.push(`${libelleObjectif(o)} (objectif B) : semaine −20 %, pas d’intensité les 2 jours d’avant`)
    }
    cible = Math.max(0, cible - Math.min(po.dureeEpreuve, cible))
  }
  const fixes = new Set(creneaux.map((c) => c.jour!))

  // Sorties en club (comptées comme séances dures)
  for (const j of p.jours_club) {
    if (fixes.has(j) || minutes[j] <= 0 || ajouterJours(lundi, j) < e.aPartirDe) continue
    const sport: Sport = pratique(p, 'velo') ? 'velo' : 'course'
    const duree = Math.min(minutes[j], sport === 'velo' ? 150 : 75)
    creneaux.push({ categorie: 'intense', sport, jour: j, fixe: true, duree, titre: 'Sortie en club / en groupe', description: 'Comptée comme séance dure : garde un peu de réserve si le groupe roule vite.' })
    fixes.add(j)
    cible = Math.max(0, cible - duree)
  }

  const jours = [0, 1, 2, 3, 4, 5, 6].filter((j) => minutes[j] > 0 && !fixes.has(j) && ajouterJours(lundi, j) >= e.aPartirDe)
  if (!jours.length && !creneaux.length) return { semaine, seances: [], explications: [...explications, 'Aucun jour disponible cette semaine'] }

  const n = jours.length ? Math.max(cible >= DUREE_MIN ? 1 : 0, Math.min(jours.length, Math.floor(cible / DUREE_MIN))) : 0
  const joursChoisis = choisirJours(jours, n, p.jour_longue)
  const durFixes = creneaux.filter(estDur).length
  let dursRestants = ph.recuperation ? 0 : Math.max(0, nombreIntenses(p, n + creneaux.length, ph.rang, ph.allegee, principal.type) - durFixes)
  const avecEpreuve = creneaux.some((c) => c.categorie === 'epreuve')
  const tests = ph.recuperation || avecEpreuve ? [] : testsDeLaSemaine(p, ph.rang, ph.phase, e.tests, lundi, e.seances)

  // Créneaux à placer
  const aPlacer: Creneau[] = []
  for (const t of tests) {
    aPlacer.push({ categorie: 'test', sport: t.sport, formatId: t.formatId, duree: formatObligatoire(t.formatId).dureeMin })
    if (t.maximal) dursRestants = Math.max(0, dursRestants - 1)
  }
  const autreSport = actifs.find((s) => s !== sportP)
  for (let i = 0; i < dursRestants; i++) aPlacer.push({ categorie: 'intense', sport: i === 1 && autreSport && pp.sport === null ? autreSport : sportP })
  const nbFaciles = Math.max(0, n - aPlacer.length)
  for (let i = 0; i < nbFaciles; i++) aPlacer.push({ categorie: i === 0 && nbFaciles >= 2 ? 'longue' : 'facile' })
  if (pp.dosADos && nbFaciles >= 3 && (ph.phase === 'developpement' || ph.phase === 'specifique')) {
    const f = aPlacer.find((c) => c.categorie === 'facile')
    if (f) Object.assign(f, { categorie: 'longue', dosADos: true })
  }

  const tous = [...creneaux, ...aPlacer]
  const declasses = placer(tous, joursChoisis, { minutes, sansIntense: [...sansIntense], jourLongue: p.jour_longue })
  if (declasses) explications.push(`${declasses} séance(s) intense(s) remplacée(s) par du facile : pas assez de jours pour les espacer`)

  // Séances dures : test, séance clé de l'objectif, ou famille de la phase
  const formats = new Map<Creneau, FormatSeance>()
  const exclus: string[] = []
  let indice = 0
  for (const c of aPlacer.filter((c) => c.categorie === 'intense' || c.categorie === 'test')) {
    const max = Math.min(minutes[c.jour ?? 0] || dureeMax, c.sport === 'course' ? plafondSeance : 999)
    let f: FormatSeance | null
    if (c.formatId) f = formatObligatoire(c.formatId)
    else {
      const sport = c.sport as Sport
      const cle = ph.phase === 'specifique' && indice === 0 ? formatSpecifique(p, pp, sport, e.seances, exclus, max) : null
      f = cle ?? choisirFormat(p, sport, familleIntense(pp, sport, ph.phase, ph.rang, indice), ph.phase, e.seances, exclus, max)
      indice++
    }
    if (f && f.dureeMin <= max) {
      formats.set(c, f)
      exclus.push(f.id)
    } else c.categorie = 'facile'
  }

  // Durées des séances faciles : la sortie longue compte double ; plafonds du jour, de l'objectif, de la course
  const faciles = aPlacer.filter((c) => !formats.has(c) && c.jour !== undefined)
  const minutesDures = [...formats.values()].reduce((t, f) => t + f.dureeMin, 0)
  const resteMinutes = Math.max(0, cible - minutesDures)
  const poids = faciles.reduce((t, c) => t + (c.categorie === 'longue' ? (c.dosADos ? 1.3 : 2) : 1), 0)
  const longueMax = interieurSeulement(p) || principal.type === 'hivernal' ? Math.min(pp.longueMax, 90) : pp.longueMax
  for (const c of faciles) {
    const part = poids ? (resteMinutes * (c.categorie === 'longue' ? (c.dosADos ? 1.3 : 2) : 1)) / poids : DUREE_MIN
    const plafondJour = minutes[c.jour!] || dureeMax
    c.duree = arrondi5(Math.min(plafondJour, c.categorie === 'longue' ? longueMax : 999, Math.max(DUREE_MIN, part)))
  }

  // Sports des séances faciles : sortie longue dans le sport principal ; part de course visée sans dépasser les plafonds
  if (actifs.length === 2) {
    const total = p.volume_velo_min + p.volume_course_min
    let part = total > 0 ? p.volume_course_min / total : 0.5
    if (sportP === 'course') part = Math.max(part, 0.5)
    let course = [...formats.entries()].reduce((t, [c, f]) => t + (c.sport === 'course' ? f.dureeMin : minutesCourues(f.sport, f.deroule)), 0)
    const objectifCourse = Math.min(plafond, cible * part)
    for (const c of faciles.sort((a, b) => Number(b.categorie === 'longue') - Number(a.categorie === 'longue'))) {
      const duree = Math.min(c.duree ?? 0, plafondSeance)
      const veutCourse = c.categorie === 'longue' ? sportP === 'course' : course + duree <= objectifCourse
      if (veutCourse && course + duree <= plafond) {
        c.sport = 'course'
        c.duree = duree
        course += duree
      } else c.sport = 'velo'
    }
  } else {
    for (const c of faciles) {
      c.sport = actifs[0]
      if (c.sport === 'course') c.duree = Math.min(c.duree ?? 0, plafondSeance)
    }
  }
  if (actifs.includes('course') && faciles.some((c) => c.sport === 'course' && (c.duree ?? 0) >= plafondSeance)) {
    explications.push(`Aucune course au-delà de ${plafondSeance} min (+10 % de la plus longue du mois, Frandsen 2025)`)
  }

  // Séances
  const seances: SeancePlanifiee[] = []
  for (const c of tous.filter((c) => c.jour !== undefined)) {
    const date = ajouterJours(lundi, c.jour!)
    if (c.fixe) {
      seances.push({ date, sport: c.sport!, categorie: c.categorie, format_id: null, titre: c.titre!, description: c.description ?? '', contenu: [], duree_min: c.duree ?? 60 })
      continue
    }
    const f = formats.get(c)
    if (f) {
      seances.push(seanceDepuisFormat(f, date, c.categorie))
      continue
    }
    const duree = c.duree ?? DUREE_MIN
    const sport = c.sport as Sport
    const categorie: Categorie = c.categorie === 'longue' ? 'longue' : 'facile'
    const note = categorie === 'longue' && (ph.phase === 'specifique' || principal.type.startsWith('trail')) ? pp.noteLongue : undefined
    const texte = [c.dosADos ? 'Deuxième jour d’affilée : allure très facile.' : '', note ?? '', interieurSeulement(p) && sport === 'velo' ? 'En intérieur.' : ''].filter(Boolean).join(' ') || undefined
    let seance = seanceDepuisFormat(formatObligatoire(formatFacile(p, sport, categorie, ph, pp, principal.type, duree)), date, categorie, duree, texte)
    // Un format qui ne se raccourcit pas assez laisse la place à une endurance simple
    if (seance.duree_min > duree + 10) seance = seanceDepuisFormat(formatObligatoire(sport === 'velo' ? (categorie === 'longue' ? 'velo-endurance-longue' : 'velo-endurance-courte') : 'course-footing'), date, categorie, duree, texte)
    seances.push(seance)
  }

  // Renfo : 2 fois par semaine (OMS 2020), 1 en spécifique, affûtage et récupération ; jamais un jour d'épreuve
  if (p.renfo) {
    const nb = ph.phase === 'specifique' || ph.phase === 'affutage' || ph.recuperation ? 1 : 2
    const occupes = new Set(seances.map((s) => jourSemaine(s.date)))
    const jourEpreuve = new Set(creneaux.filter((c) => c.categorie === 'epreuve').map((c) => c.jour!))
    const candidats = [0, 1, 2, 3, 4, 5, 6].filter((j) => ajouterJours(lundi, j) >= e.aPartirDe && !jourEpreuve.has(j) && !jourEpreuve.has(j + 1))
    const libres = candidats.filter((j) => !occupes.has(j) && minutes[j] > 0)
    const faciles = candidats.filter((j) => seances.some((s) => jourSemaine(s.date) === j && (s.categorie === 'facile' || s.categorie === 'longue')))
    // Jamais la veille d'une séance dure ou d'un test si on peut l'éviter (jambes fraîches)
    const veilleDure = (j: number) => Number(seances.some((s) => jourSemaine(s.date) === j + 1 && (s.categorie === 'intense' || s.categorie === 'test')))
    const joursRenfo = [...libres, ...faciles].filter((j, i, t) => t.indexOf(j) === i).sort((a, b) => veilleDure(a) - veilleDure(b))
    const choix: number[] = []
    for (const j of joursRenfo) if (choix.length < nb && choix.every((k) => Math.abs(k - j) > 1)) choix.push(j)
    choix.forEach((j, i) => {
      const id = i === 1 && niveau(p) !== 'debutant' && (ph.phase === 'base' || ph.phase === 'developpement') ? (sportP === 'velo' ? 'force-lourde-jambes-cycliste' : 'force-explosive-coureur') : 'force-prevention-genoux'
      seances.push(seanceDepuisFormat(formatObligatoire(id), ajouterJours(lundi, j), 'renfo'))
    })
    if (choix.length) explications.push(`${choix.length} séance(s) de renfo (OMS 2020 ; Lauersen 2014)`)
  }

  seances.sort((a, b) => a.date.localeCompare(b.date) || Number(a.sport === 'renfo') - Number(b.sport === 'renfo'))
  const endurance = seances.filter((s) => s.sport !== 'renfo')
  const intenses = endurance.filter((s) => s.categorie === 'intense').length
  const test = endurance.find((s) => s.categorie === 'test')
  explications.push(`${endurance.length} séance(s) dont ${intenses} intense(s)${test ? `, test : ${test.titre}` : ''}`)
  semaine.cible_min = endurance.reduce((t, s) => t + s.duree_min, 0)
  return { semaine, seances, explications }
}

export type { PhaseSemaine }
