import { useEffect, useState } from 'react'
import { allerA, eleveDepuisAdresse, useAdresse } from '../../core/adresse'
import type { Profil } from '../../core/compte'
import { proposerAutomatiquement } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { jour, lundiDe } from '../../moteur/dates'
import { BarreOnglets, Bouton, Page, type Onglet } from '../../core/ui'
import { AValider } from './AValider'
import { FicheEleve } from './FicheEleve'
import { MesEleves } from './MesEleves'
import { ReglagesNotifications } from '../commun/ReglagesNotifications'

export function EspaceCoach({ client, profil, deconnecter }: { client: Client; profil: Profil; deconnecter: () => void }) {
  const hash = useAdresse()
  const [aValider, setAValider] = useState(0)
  const [version, setVersion] = useState(0)

  // Prépare les propositions manquantes (semaine en cours, et la suivante à partir du dimanche)
  useEffect(() => {
    let fini = false
    ;(async () => {
      const { data } = await client.from('profils_sportifs').select('eleve_id')
      for (const { eleve_id } of (data ?? []) as { eleve_id: string }[]) {
        await proposerAutomatiquement(client, eleve_id).catch(() => {})
      }
      if (!fini) setVersion((v) => v + 1)
    })()
    return () => {
      fini = true
    }
  }, [client])

  useEffect(() => {
    client
      .from('semaines')
      .select('eleve_id', { count: 'exact', head: true })
      .eq('validee', false)
      .gte('lundi', lundiDe(jour()))
      .then(({ count }) => setAValider(count ?? 0))
  }, [client, version, hash])

  const onglets: Onglet[] = [
    { cle: '', libelle: 'Élèves', icone: '👥' },
    { cle: '#/a-valider', libelle: 'À valider', icone: '✅', pastille: aValider },
  ]
  const eleve = eleveDepuisAdresse(hash)
  const actif = hash === '#/a-valider' ? '#/a-valider' : ''
  const barre = <BarreOnglets onglets={onglets} actif={eleve ? '' : actif} choisir={allerA} />

  if (eleve) return <FicheEleve key={`${eleve}-${version}`} client={client} id={eleve} moi={profil.id} barre={barre} />

  return (
    <Page
      surtitre={`Coach · ${profil.nom}`}
      titre={actif ? 'À valider' : 'Mes élèves'}
      barre={barre}
      action={
        !actif && (
          <Bouton variante="discret" onClick={deconnecter}>
            Déconnexion
          </Bouton>
        )
      }
    >
      {actif ? (
        <AValider key={version} client={client} auChangement={() => setVersion((v) => v + 1)} />
      ) : (
        <>
          <MesEleves key={version} client={client} profil={profil} />
          <ReglagesNotifications client={client} moi={profil.id} role="coach" />
        </>
      )}
    </Page>
  )
}
