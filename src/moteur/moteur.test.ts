import { describe, expect, it } from 'vitest'
import { adapterAuFeu, raccourcir, raisonDouleur, remplacerCourse } from './adaptation'
import { BANQUE, dureeMinutes } from './banque'
import { nominalSuivant, plafondCourse, volumeDepart } from './charge'
import { ajouterJours, jourSemaine } from './dates'
import { feuDuJour, seuilRessenti } from './feu'
import { cible } from './intensite'
import { phaseDeLaSemaine } from './phase'
import { intensiteAutorisee, niveau } from './profil'
import { genererSemaine, nombreIntenses, placer, type Creneau } from './semaine'
import { cpDeuxPoints, vmaCinqMinutes } from './tests'
import type { Matin, ProfilSportif, Seance, Test } from './types'

const LUNDI = '2026-11-02'

function profil(p: Partial<ProfilSportif> = {}): ProfilSportif {
  return {
    eleve_id: 'e1',
    disciplines: ['velo'],
    objectif: '',
    date_objectif: null,
    duree_epreuve: null,
    jours_dispo: [1, 3, 5, 6],
    minutes_semaine: 360,
    duree_max_min: 180,
    capteur_puissance: true,
    cardio: true,
    montre_gps: true,
    montre_vfc: false,
    volume_velo_min: 300,
    volume_course_min: 0,
    annees_pratique: 3,
    competitions: false,
    blessures: '',
    age: 30,
    fc_max: null,
    fc_repos: null,
    medicaments: '',
    parq_oui: false,
    avis_medical: false,
    cp: 250,
    vma: null,
    debut: LUNDI,
    ...p,
  }
}

function seance(s: Partial<Seance>): Seance {
  return {
    id: Math.random().toString(),
    eleve_id: 'e1',
    date: LUNDI,
    sport: 'velo',
    categorie: 'facile',
    format_id: null,
    titre: 'Séance',
    description: '',
    contenu: [],
    duree_min: 60,
    statut: 'faite',
    origine: 'moteur',
    ajustement: null,
    avant_ajustement: null,
    duree_reelle_min: null,
    rpe: 4,
    reussie: true,
    douleur: 0,
    douleur_zone: null,
    boiterie: false,
    note: null,
    ...s,
  }
}

const matin = (date: string, m: Partial<Matin> = {}): Matin => ({
  date,
  sommeil_h: 8,
  sommeil_q: 4,
  fatigue: 4,
  courbatures: 4,
  stress: 4,
  humeur: 4,
  douleur: false,
  malade: false,
  fievre: false,
  vfc: null,
  fc_repos: null,
  ...m,
})

const semaine = (p: ProfilSportif, autres: { tests?: Test[]; seances?: Seance[] } = {}) =>
  genererSemaine({ profil: p, lundi: LUNDI, aPartirDe: LUNDI, precedente: null, seances: autres.seances ?? [], matins: [], tests: autres.tests ?? [] })

const durs = (r: ReturnType<typeof semaine>) => r.seances.filter((s) => s.categorie === 'intense' || (s.categorie === 'test' && !s.format_id?.endsWith('reference')))

describe('profil', () => {
  it('classe le niveau selon les repères', () => {
    expect(niveau(profil({ annees_pratique: 0.2 }))).toBe('debutant')
    expect(niveau(profil({ volume_velo_min: 120 }))).toBe('debutant')
    expect(niveau(profil())).toBe('intermediaire')
    expect(niveau(profil({ volume_velo_min: 400, competitions: true }))).toBe('confirme')
    // Une compétition ne suffit pas pour être confirmé
    expect(niveau(profil({ annees_pratique: 0.3, competitions: true }))).toBe('debutant')
  })

  it('bloque l’intensité sur un oui au questionnaire santé, jusqu’à l’avis médical', () => {
    expect(intensiteAutorisee(profil({ parq_oui: true }))).toBe(false)
    expect(intensiteAutorisee(profil({ parq_oui: true, avis_medical: true }))).toBe(true)
  })
})

describe('phases', () => {
  it('suit le temps restant avant l’objectif', () => {
    const p = (date: string) => profil({ date_objectif: date, duree_epreuve: 'longue' })
    expect(phaseDeLaSemaine(p(ajouterJours(LUNDI, 7 * 20)), LUNDI).phase).toBe('base')
    expect(phaseDeLaSemaine(p(ajouterJours(LUNDI, 7 * 8)), LUNDI).phase).toBe('developpement')
    expect(phaseDeLaSemaine(p(ajouterJours(LUNDI, 7 * 3)), LUNDI).phase).toBe('specifique')
    expect(phaseDeLaSemaine(p(ajouterJours(LUNDI, 10)), LUNDI)).toMatchObject({ phase: 'affutage', coefficient: 0.6 })
    expect(phaseDeLaSemaine(p(ajouterJours(LUNDI, 5)), LUNDI)).toMatchObject({ phase: 'affutage', coefficient: 0.4 })
  })

  it('affûte une seule semaine pour un débutant sur une épreuve courte', () => {
    const p = profil({ annees_pratique: 0.2, date_objectif: ajouterJours(LUNDI, 10), duree_epreuve: 'courte' })
    expect(phaseDeLaSemaine(p, LUNDI).phase).toBe('specifique')
    expect(phaseDeLaSemaine(p, ajouterJours(LUNDI, 7)).phase).toBe('affutage')
  })

  it('allège une semaine sur 4 sans objectif', () => {
    const p = profil()
    expect(phaseDeLaSemaine(p, ajouterJours(LUNDI, 14)).allegee).toBe(false)
    expect(phaseDeLaSemaine(p, ajouterJours(LUNDI, 21))).toMatchObject({ allegee: true, coefficient: 0.65 })
  })
})

describe('charge', () => {
  it('repart à 3 × 30 min quand il n’y a presque rien', () => {
    expect(volumeDepart(profil({ volume_velo_min: 20 }))).toBe(90)
    expect(volumeDepart(profil({ volume_velo_min: 500 }))).toBe(360)
  })

  it('progresse de 7,5 % après une semaine réussie, baisse de 15 % après 2 jours rouges', () => {
    const p = profil()
    const prec = { lundi: LUNDI, phase: 'base' as const, nominal_min: 300, cible_min: 300, allegee: false, validee: true }
    expect(nominalSuivant(p, prec, { prevu: 300, realise: 290, rouges: 0, oranges: 1 }).minutes).toBe(325)
    expect(nominalSuivant(p, prec, { prevu: 300, realise: 200, rouges: 0, oranges: 0 }).minutes).toBe(300)
    expect(nominalSuivant(p, prec, { prevu: 300, realise: 300, rouges: 2, oranges: 0 }).minutes).toBe(255)
  })

  it('plafonne la course à +30 % de la moyenne des 4 semaines', () => {
    const p = profil({ disciplines: ['course'], volume_course_min: 100 })
    const faites = [1, 2, 3, 4].map((k) => seance({ sport: 'course', date: ajouterJours(LUNDI, -7 * k), duree_min: 100 }))
    expect(plafondCourse(p, faites, LUNDI)).toBe(130)
  })
})

describe('construction de la semaine', () => {
  it('ne met jamais deux jours durs d’affilée', () => {
    const creneaux: Creneau[] = [{ categorie: 'intense' }, { categorie: 'intense' }, { categorie: 'facile' }]
    const declasses = placer(creneaux, [0, 1, 2])
    const jours = creneaux.filter((c) => c.categorie === 'intense').map((c) => c.jour!)
    expect(declasses).toBe(0)
    expect(Math.abs(jours[0] - jours[1])).toBeGreaterThan(1)
  })

  it('débutant : pas d’intensité le premier mois, parcours de référence en semaine 1', () => {
    const p = profil({ disciplines: ['course'], annees_pratique: 0, volume_velo_min: 0, volume_course_min: 30, capteur_puissance: false, cp: null, jours_dispo: [0, 2, 5] })
    const r = semaine(p)
    expect(r.seances.filter((s) => s.categorie === 'intense')).toHaveLength(0)
    expect(r.seances.map((s) => s.format_id)).toContain('course-reference')
    expect(r.seances.some((s) => s.format_id === 'course-marche-course')).toBe(true)
    expect(r.seances.every((s) => s.duree_min <= p.duree_max_min)).toBe(true)
  })

  it('intermédiaire vélo avec capteur : test CP la première semaine', () => {
    const r = semaine(profil())
    expect(r.seances.map((s) => s.format_id)).toContain('velo-test-cp-2-points')
  })

  it('confirmé : 2 séances dures bien espacées et une sortie longue le week-end', () => {
    const tests: Test[] = [{ date: ajouterJours(LUNDI, -10), sport: 'velo', type: 'cp', valeur: 250 }]
    const p = profil({ volume_velo_min: 420, competitions: true, jours_dispo: [0, 1, 2, 3, 4, 5, 6], minutes_semaine: 480 })
    const r = semaine(p, { tests })
    const jours = durs(r).map((s) => jourSemaine(s.date)).sort()
    expect(jours).toHaveLength(2)
    expect(jours[1] - jours[0]).toBeGreaterThan(1)
    const longue = r.seances.find((s) => s.categorie === 'longue')
    expect(longue && jourSemaine(longue.date)).toBeGreaterThanOrEqual(5)
  })

  it('respecte le questionnaire santé : aucune séance dure', () => {
    const r = semaine(profil({ parq_oui: true }))
    expect(durs(r)).toHaveLength(0)
  })

  it('ne place rien avant la date de départ', () => {
    const r = genererSemaine({ profil: profil(), lundi: LUNDI, aPartirDe: ajouterJours(LUNDI, 4), precedente: null, seances: [], matins: [], tests: [] })
    expect(r.seances.every((s) => s.date >= ajouterJours(LUNDI, 4))).toBe(true)
  })

  it('reste proche du volume visé', () => {
    const tests: Test[] = [{ date: ajouterJours(LUNDI, -10), sport: 'velo', type: 'cp', valeur: 250 }]
    const r = semaine(profil(), { tests })
    expect(Math.abs(r.semaine.cible_min - 300)).toBeLessThanOrEqual(45)
  })

  it('vélo + course : la course reste sous son plafond', () => {
    const p = profil({ disciplines: ['velo', 'course'], volume_velo_min: 200, volume_course_min: 150, jours_dispo: [0, 1, 3, 5, 6], vma: 15 })
    const r = semaine(p, { tests: [{ date: ajouterJours(LUNDI, -10), sport: 'velo', type: 'cp', valeur: 250 }] })
    const course = r.seances.filter((s) => s.sport === 'course').reduce((t, s) => t + s.duree_min, 0)
    expect(course).toBeLessThanOrEqual(plafondCourse(p, [], LUNDI) + 60)
    expect(new Set(r.seances.map((s) => s.sport)).size).toBe(2)
  })

  it('compte les séances intenses vélo et course ensemble', () => {
    expect(nombreIntenses(profil({ volume_velo_min: 420, competitions: true }), 6, 0, false)).toBe(2)
    expect(nombreIntenses(profil(), 3, 0, false)).toBe(1)
    expect(nombreIntenses(profil({ volume_velo_min: 420, competitions: true }), 6, 0, true)).toBe(1)
  })

  it('n’utilise que des formats de la banque', () => {
    const ids = new Set(BANQUE.map((f) => f.id))
    expect(semaine(profil()).seances.every((s) => ids.has(s.format_id!))).toBe(true)
  })
})

describe('feu du jour', () => {
  const avant = Array.from({ length: 30 }, (_, i) => matin(ajouterJours(LUNDI, -30 + i)))

  it('vert, orange puis rouge selon le nombre d’indicateurs', () => {
    expect(feuDuJour(matin(LUNDI), avant, []).feu).toBe('vert')
    expect(feuDuJour(matin(LUNDI, { sommeil_h: 5 }), avant, []).feu).toBe('orange')
    expect(feuDuJour(matin(LUNDI, { sommeil_h: 5, douleur: true }), avant, []).feu).toBe('rouge')
  })

  it('malade avec fièvre : repos ; malade sans fièvre : rouge', () => {
    expect(feuDuJour(matin(LUNDI, { malade: true, fievre: true }), avant, []).feu).toBe('repos')
    expect(feuDuJour(matin(LUNDI, { malade: true }), avant, []).feu).toBe('rouge')
  })

  it('seuil de ressenti fixe au début, personnel ensuite', () => {
    expect(seuilRessenti(avant.slice(0, 10), LUNDI)).toBe(2.5)
    const variables = avant.map((m, i) => ({ ...m, humeur: 3 + (i % 3) }))
    expect(seuilRessenti(variables, LUNDI)).toBeGreaterThan(2.5)
  })

  it('VFC basse sur 7 jours', () => {
    const vfc = Array.from({ length: 30 }, (_, i) => matin(ajouterJours(LUNDI, -30 + i), { vfc: i >= 24 ? 40 : 70 + (i % 5) }))
    expect(feuDuJour(matin(LUNDI, { vfc: 40 }), vfc, []).raisons).toContain('VFC sous ta zone habituelle')
  })
})

describe('allègements', () => {
  const vo2 = BANQUE.find((f) => f.id === 'velo-vo2-4x8-seiler')!
  const intense = seance({ categorie: 'intense', format_id: vo2.id, contenu: vo2.deroule, duree_min: vo2.dureeMin, statut: 'validee' })

  it('orange : moins de répétitions, jamais plus long', () => {
    const r = adapterAuFeu(intense, 'orange')!
    expect(dureeMinutes(r.seance.contenu)).toBeLessThan(vo2.dureeMin)
    expect(r.seance.duree_min).toBeLessThanOrEqual(intense.duree_min)
    expect(raccourcir(vo2.deroule).find((e) => e.type === 'repetition')!.fois).toBe(3)
  })

  it('rouge : très facile ; repos : annulée ; vert : rien', () => {
    expect(adapterAuFeu(intense, 'rouge')!.seance.categorie).toBe('facile')
    expect(adapterAuFeu(intense, 'repos')!.annuler).toBe(true)
    expect(adapterAuFeu(intense, 'vert')).toBeNull()
  })

  it('douleur : remplace la course selon les règles', () => {
    const hier = ajouterJours(LUNDI, -1)
    expect(raisonDouleur([seance({ date: hier, douleur: 6 })], null, LUNDI)).toMatch(/6\/10/)
    expect(raisonDouleur([seance({ date: hier, douleur: 3 })], matin(LUNDI, { douleur: true }), LUNDI)).toMatch(/ce matin/)
    expect(raisonDouleur([seance({ date: hier, douleur: 3 }), seance({ date: ajouterJours(LUNDI, -3), douleur: 3 })], null, LUNDI)).toMatch(/deux séances/)
    expect(raisonDouleur([seance({ date: hier, douleur: 2 })], matin(LUNDI, { douleur: true }), LUNDI)).toBeNull()
    const course = seance({ sport: 'course', statut: 'validee', duree_min: 45 })
    expect(remplacerCourse(course, profil({ disciplines: ['velo', 'course'] }), 'Douleur')!.seance.sport).toBe('velo')
    expect(remplacerCourse(course, profil({ disciplines: ['course'] }), 'Douleur')!.annuler).toBe(true)
  })
})

describe('tests et cibles', () => {
  it('calcule CP et VMA', () => {
    expect(cpDeuxPoints(330, 270)).toBe(250)
    expect(vmaCinqMinutes(1250)).toBe(15)
  })

  it('affiche les watts avec capteur, l’effort ressenti sinon', () => {
    const e = { type: 'effort' as const, duree: 600, intensite: [90, 95] as [number, number] }
    expect(cible(e, 'velo', profil())).toMatch(/225-238 W/)
    expect(cible(e, 'velo', profil({ capteur_puissance: false, cardio: false }))).toMatch(/^effort/)
  })
})
