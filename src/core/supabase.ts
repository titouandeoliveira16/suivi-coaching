import { createClient } from '@supabase/supabase-js'

// Fournis au moment de la construction (variables du dépôt GitHub) ; la clé « publishable »
// est publique par nature : la sécurité repose sur les règles RLS du serveur.
const url = import.meta.env.VITE_SUPABASE_URL
const cle = import.meta.env.VITE_SUPABASE_CLE

export const supabase =
  url && cle
    ? createClient(url, cle, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null

export type Client = NonNullable<typeof supabase>
