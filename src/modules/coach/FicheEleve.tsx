import { useEffect, useState } from 'react'
import { allerA } from '../../core/adresse'
import { messageErreur } from '../../core/compte'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Message, Page } from '../../core/ui'

type Eleve = { id: string; nom: string; cree_le: string }

export function FicheEleve({ client, id }: { client: Client; id: string }) {
  const [eleve, setEleve] = useState<Eleve | null | undefined>(undefined)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    client
      .from('profils')
      .select('id, nom, cree_le')
      .eq('id', id)
      .eq('role', 'eleve')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErreur(messageErreur(error))
        setEleve(data as Eleve | null)
      })
  }, [client, id])

  const retour = (
    <Bouton variante="discret" onClick={() => allerA('')}>
      ‹ Élèves
    </Bouton>
  )

  if (eleve === undefined) return <Page titre="…" action={retour}>{null}</Page>

  if (!eleve)
    return (
      <Page titre="Élève" action={retour}>
        <Carte>
          <Message type="erreur">{erreur || 'Cet élève n’existe pas ou n’est pas suivi par toi.'}</Message>
        </Carte>
      </Page>
    )

  return (
    <Page surtitre="Élève" titre={eleve.nom || 'Sans prénom'} action={retour}>
      <Carte>
        <p className="text-sm text-texte-3">Suivi depuis le {new Date(eleve.cree_le).toLocaleDateString('fr-FR')}</p>
      </Carte>
      <Bloc titre="Programme" vide="Aucune séance prévue. Les séances proposées pour cet élève apparaîtront ici, à valider." />
      <Bloc titre="Séances faites" vide="Aucune séance faite pour l’instant." />
      <Bloc titre="Tests physiques" vide="Aucun test pour l’instant." />
    </Page>
  )
}

function Bloc({ titre, vide }: { titre: string; vide: string }) {
  return (
    <Carte>
      <h2 className="mb-2 text-lg font-semibold">{titre}</h2>
      <Message>{vide}</Message>
    </Carte>
  )
}
