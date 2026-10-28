import { useEffect, useState } from 'react'
import type { Profil } from '../../core/compte'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Page } from '../../core/ui'

export function Aujourdhui({ client, profil, deconnecter }: { client: Client; profil: Profil; deconnecter: () => void }) {
  const [coach, setCoach] = useState('')

  useEffect(() => {
    if (!profil.coach_id) return
    client
      .from('profils')
      .select('nom')
      .eq('id', profil.coach_id)
      .maybeSingle()
      .then(({ data }) => setCoach((data?.nom as string | undefined) ?? ''))
  }, [client, profil.coach_id])

  return (
    <Page
      surtitre={profil.nom ? `Bonjour ${profil.nom}` : 'Bonjour'}
      titre="Aujourd’hui"
      action={
        <Bouton variante="discret" onClick={deconnecter}>
          Déconnexion
        </Bouton>
      }
    >
      <Carte>
        <div className="mb-3 h-1 w-10 rounded-full bg-accent" />
        <h2 className="text-lg font-semibold">Ton compte est prêt</h2>
        <p className="mt-2 text-texte-2">
          {coach || 'Ton coach'} prépare ta première séance. Elle apparaîtra ici dès qu’elle sera prête.
        </p>
      </Carte>
    </Page>
  )
}
