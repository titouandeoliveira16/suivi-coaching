import { useCallback, useState } from 'react'
import { allerA, useAdresse } from '../../core/adresse'
import { messageErreur, type Profil } from '../../core/compte'
import { nonLus, objectifsDe, profilSportif, useCharge } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { BarreOnglets, Bouton, Chargement, Message, Page, type Onglet } from '../../core/ui'
import { Messages } from '../commun/Messages'
import { Progres } from '../commun/Progres'
import { Aujourdhui } from './Aujourdhui'
import { Programme } from './Programme'
import { QuestionnaireArrivee } from './QuestionnaireArrivee'

const ONGLETS = { '': 'Aujourd’hui', '#/programme': 'Programme', '#/progres': 'Progrès', '#/messages': 'Messages' } as const

export function EspaceEleve({ client, profil, deconnecter }: { client: Client; profil: Profil; deconnecter: () => void }) {
  const hash = useAdresse()
  const actif = (hash in ONGLETS ? hash : '') as keyof typeof ONGLETS
  const { donnees: d, erreur, recharger } = useCharge(async () => {
    const [sportif, objectifs] = await Promise.all([profilSportif(client, profil.id), objectifsDe(client, profil.id)])
    return { sportif, objectifs }
  }, [client, profil.id])
  const sportif = d?.sportif
  const { donnees: aLire, recharger: rechargerLus } = useCharge(() => nonLus(client, profil.id), [client, profil.id])
  const [editer, setEditer] = useState(false)
  const lus = useCallback(() => rechargerLus(), [rechargerLus])

  if (erreur) return <Page titre="Oups"><Message type="erreur">{messageErreur(erreur)}</Message></Page>
  if (!d) return <Page titre="…"><Chargement /></Page>
  if (!sportif || editer)
    return <QuestionnaireArrivee client={client} eleve={profil.id} initial={sportif} objectifsInitiaux={d.objectifs} annuler={sportif ? () => setEditer(false) : undefined} termine={() => (setEditer(false), recharger())} />

  const onglets: Onglet[] = [
    { cle: '', libelle: 'Aujourd’hui', icone: '☀️' },
    { cle: '#/programme', libelle: 'Programme', icone: '🗓️' },
    { cle: '#/progres', libelle: 'Progrès', icone: '📈' },
    { cle: '#/messages', libelle: 'Messages', icone: '💬', pastille: aLire?.[profil.id] },
  ]

  return (
    <Page
      surtitre={profil.nom ? `Bonjour ${profil.nom}` : 'Bonjour'}
      titre={ONGLETS[actif]}
      barre={<BarreOnglets onglets={onglets} actif={actif} choisir={allerA} />}
      action={
        actif === '#/progres' ? (
          <Bouton variante="discret" onClick={deconnecter}>
            Déconnexion
          </Bouton>
        ) : undefined
      }
    >
      {actif === '' && <Aujourdhui client={client} eleve={profil.id} profil={sportif} />}
      {actif === '#/programme' && <Programme client={client} eleve={profil.id} profil={sportif} />}
      {actif === '#/progres' && (
        <>
          <Progres client={client} eleve={profil.id} />
          <Bouton variante="discret" onClick={() => setEditer(true)}>
            Modifier mon profil (disponibilités, objectif…)
          </Bouton>
        </>
      )}
      {actif === '#/messages' && <Messages client={client} eleve={profil.id} moi={profil.id} auLu={lus} />}
    </Page>
  )
}
