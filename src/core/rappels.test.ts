import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import source from '../../supabase/functions/notifications/index.ts?raw'

// Les règles vivent dans la fonction serveur (un seul fichier à coller dans Supabase) : on les extrait pour les tester
const section = source.slice(source.indexOf('// --- debut regles ---'), source.indexOf('// --- fin regles ---'))
const js = ts.transpileModule(section, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod: Record<string, unknown> = {}
new Function('exports', js)(mod)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { rappelsDus, maintenantDans, PREFERENCES_DEFAUT: P } = mod as any

const eleve = (e: object = {}) => ({ role: 'eleve', seancesDuJour: ['validee'], matinFait: false, nbEleves: 0, dejaEnvoyes: [], ...e })
const types = (r: { type: string }[]) => r.map((x) => x.type)
const MARDI = { date: '2026-11-03', jour: 2 }

describe('rappels programmés', () => {
  it('matin : à partir de l’heure choisie, seulement avec une séance prévue et sans questionnaire rempli', () => {
    expect(types(rappelsDus({ ...MARDI, heure: '07:15' }, P, eleve()))).toEqual([])
    expect(types(rappelsDus({ ...MARDI, heure: '07:30' }, P, eleve()))).toEqual(['matin'])
    expect(types(rappelsDus({ ...MARDI, heure: '07:30' }, P, eleve({ matinFait: true })))).toEqual([])
    expect(types(rappelsDus({ ...MARDI, heure: '07:30' }, P, eleve({ seancesDuJour: [] })))).toEqual([])
    expect(types(rappelsDus({ ...MARDI, heure: '07:30' }, P, eleve({ seancesDuJour: ['faite'] })))).toEqual([])
    expect(types(rappelsDus({ ...MARDI, heure: '11:00' }, P, eleve()))).toEqual([])
    expect(types(rappelsDus({ ...MARDI, heure: '09:00' }, { ...P, heure_matin: '09:00' }, eleve()))).toEqual(['matin'])
    expect(types(rappelsDus({ ...MARDI, heure: '07:45' }, P, eleve({ dejaEnvoyes: ['matin'] })))).toEqual([])
    expect(types(rappelsDus({ ...MARDI, heure: '07:45' }, { ...P, matin: false }, eleve()))).toEqual([])
  })

  it('soir : à 20 h si la séance du jour n’est pas saisie', () => {
    expect(types(rappelsDus({ ...MARDI, heure: '20:00' }, P, eleve({ matinFait: true })))).toEqual(['soir'])
    expect(types(rappelsDus({ ...MARDI, heure: '20:00' }, P, eleve({ seancesDuJour: ['faite'] })))).toEqual([])
    expect(types(rappelsDus({ ...MARDI, heure: '20:00' }, P, eleve({ seancesDuJour: ['annulee'] })))).toEqual([])
    expect(types(rappelsDus({ ...MARDI, heure: '22:00' }, P, eleve()))).toEqual([])
    expect(types(rappelsDus({ ...MARDI, heure: '20:15' }, { ...P, soir: false }, eleve()))).toEqual([])
  })

  it('coach : résumé le dimanche à 18 h, s’il a des élèves', () => {
    const coach = (e: object = {}) => ({ role: 'coach', seancesDuJour: [], matinFait: false, nbEleves: 3, dejaEnvoyes: [], ...e })
    const r = rappelsDus({ date: '2026-11-08', jour: 0, heure: '18:00' }, P, coach())
    expect(types(r)).toEqual(['resume'])
    expect(r[0].texte).toContain('3 élèves')
    expect(types(rappelsDus({ date: '2026-11-07', jour: 6, heure: '18:00' }, P, coach()))).toEqual([])
    expect(types(rappelsDus({ date: '2026-11-08', jour: 0, heure: '18:00' }, P, coach({ nbEleves: 0 })))).toEqual([])
    expect(types(rappelsDus({ date: '2026-11-08', jour: 0, heure: '18:00' }, { ...P, resume: false }, coach()))).toEqual([])
  })

  it('heure locale du fuseau de l’appareil', () => {
    expect(maintenantDans('Europe/Paris', new Date('2026-11-08T17:00:00Z'))).toEqual({ date: '2026-11-08', heure: '18:00', jour: 0 })
    expect(maintenantDans('Europe/Paris', new Date('2026-07-01T22:30:00Z'))).toEqual({ date: '2026-07-02', heure: '00:30', jour: 4 })
  })
})
