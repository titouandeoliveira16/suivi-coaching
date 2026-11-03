import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import source from '../../supabase/functions/intervals/index.ts?raw'

// Les règles vivent dans la fonction serveur (un seul fichier à coller dans Supabase) : on les extrait pour les tester
const section = source.slice(source.indexOf('// --- debut regles ---'), source.indexOf('// --- fin regles ---'))
const js = ts.transpileModule(section, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod: Record<string, unknown> = {}
new Function('exports', js)(mod)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { rattacher, sportDe } = mod as any

const s = (id: string, date: string, sport: string, duree_min: number, statut = 'validee') => ({ id, date, sport, duree_min, statut })
const a = (id: string, date: string, sport: string, minutes: number) => ({ id, date, sport, duree_s: minutes * 60 })

describe('import Intervals.icu', () => {
  it('reconnaît les sports (VTT, home trainer, trail, renfo) et ignore le reste', () => {
    expect(['MountainBikeRide', 'VirtualRide', 'TrailRun', 'WeightTraining', 'Swim', 'Walk'].map(sportDe)).toEqual(['velo', 'velo', 'course', 'renfo', null, null])
  })
  it('rattache chaque sortie à la séance du même jour et du même sport, la plus proche en durée', () => {
    const seances = [s('court', '2026-11-03', 'velo', 60), s('long', '2026-11-03', 'velo', 180), s('cap', '2026-11-03', 'course', 40), s('renfo', '2026-11-03', 'renfo', 30)]
    expect(rattacher([a('x', '2026-11-03', 'velo', 170), a('y', '2026-11-03', 'velo', 55), a('z', '2026-11-03', 'renfo', 25)], seances, [])).toEqual({ x: 'long', y: 'court', z: 'renfo' })
  })
  it('ne rattache pas aux séances annulées, proposées, d’un autre jour ou déjà prises', () => {
    const seances = [s('annulee', '2026-11-03', 'velo', 60, 'annulee'), s('proposee', '2026-11-03', 'velo', 60, 'proposee'), s('demain', '2026-11-04', 'velo', 60), s('prise', '2026-11-03', 'velo', 60)]
    expect(rattacher([a('x', '2026-11-03', 'velo', 60)], seances, ['prise'])).toEqual({})
  })
  it('une sortie de trop reste hors programme', () => {
    expect(rattacher([a('x', '2026-11-03', 'velo', 60), a('y', '2026-11-03', 'velo', 30)], [s('une', '2026-11-03', 'velo', 60)], [])).toEqual({ x: 'une' })
  })
})
