import { createContext, useContext } from 'react'
import type { Client } from './supabase'

export type NomModule = 'renfo' | 'muscu' | 'nutrition'
export interface LigneModule {
  eleve_id: string
  module: NomModule
  statut: 'demande' | 'actif' | 'refuse'
  debut: string | null
  demande_le: string
}

export const MODULES: { nom: NomModule; titre: string; icone: string; texte: string }[] = [
  { nom: 'renfo', titre: 'Renfo', icone: '🧱', texte: 'Gainage, ischios, mollets : 20-30 min au poids du corps pour prévenir les blessures.' },
  { nom: 'muscu', titre: 'Muscu', icone: '🏋️', texte: 'Force lourde des jambes, en salle : plus de puissance et d’efficacité, progression sur 12 semaines.' },
  { nom: 'nutrition', titre: 'Nutrition', icone: '🍽️', texte: 'Pour chaque séance : quoi manger avant, pendant et après.' },
]

/** Modules d'un élève (vide si la table n'existe pas encore sur le serveur). */
export async function modulesDe(c: Client, eleve: string): Promise<LigneModule[]> {
  const { data, error } = await c.from('modules').select('*').eq('eleve_id', eleve)
  if (error) return []
  return data as LigneModule[]
}

/** Élève : demande (ou redemande après un refus). */
export async function demanderModule(c: Client, eleve: string, module: NomModule, refuse: boolean) {
  const { error } = refuse
    ? await c.from('modules').update({ statut: 'demande' }).eq('eleve_id', eleve).eq('module', module)
    : await c.from('modules').insert({ eleve_id: eleve, module })
  if (error) throw error
}

/** Coach : activer, refuser, ou retirer (null). */
export async function deciderModule(c: Client, eleve: string, module: NomModule, statut: 'actif' | 'refuse' | null) {
  const { error } = statut ? await c.from('modules').upsert({ eleve_id: eleve, module, statut }) : await c.from('modules').delete().eq('eleve_id', eleve).eq('module', module)
  if (error) throw error
}

/** Modules actifs de l'élève affiché (pour les cartes de séance). */
export const ModulesActifs = createContext<NomModule[]>([])
export const useModulesActifs = () => useContext(ModulesActifs)
