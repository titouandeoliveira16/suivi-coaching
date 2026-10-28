import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { Client } from './supabase'

export type Profil = { id: string; role: 'coach' | 'eleve'; coach_id: string | null; nom: string }

/** `undefined` tant que la session enregistrée n'est pas relue. */
export function useSession(client: Client): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    client.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = client.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [client])
  return session
}

export async function chargerProfil(client: Client, id: string): Promise<Profil | null> {
  const { data, error } = await client.from('profils').select('id, role, coach_id, nom').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Profil | null
}

const MESSAGES: [RegExp, string][] = [
  [/invitation_invalide/, 'Ce lien d’invitation n’est plus valable. Demande-en un nouveau à ton coach.'],
  [/deja_inscrit/, 'Ce compte est déjà rattaché à un coach.'],
  [/Invalid login credentials/i, 'Email ou mot de passe incorrect.'],
  [/User already registered/i, 'Un compte existe déjà avec cet email : connecte-toi plutôt.'],
  [/Password should be at least/i, 'Le mot de passe doit faire au moins 8 caractères.'],
  [/rate limit|too many|security purposes/i, 'Trop de demandes d’affilée : réessaie dans quelques minutes.'],
  [/Failed to fetch|NetworkError|Load failed/i, 'Pas de connexion internet.'],
]

export function messageErreur(e: unknown): string {
  const texte = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e)
  return MESSAGES.find(([motif]) => motif.test(texte))?.[1] ?? 'Une erreur est survenue. Réessaie.'
}
