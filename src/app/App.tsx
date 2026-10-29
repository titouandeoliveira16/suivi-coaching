import { useEffect, useState } from 'react'
import { remplacerAdresse, useAdresse } from '../core/adresse'
import { chargerProfil, messageErreur, useSession, type Profil } from '../core/compte'
import {
  ecrireInvitationEnAttente,
  effacerInvitationEnAttente,
  jetonDepuisAdresse,
  lireInvitationEnAttente,
} from '../core/invitation'
import { supabase, type Client } from '../core/supabase'
import { Bouton, Carte, Message, Page } from '../core/ui'
import { EspaceCoach } from '../modules/coach/EspaceCoach'
import { EspaceEleve } from '../modules/eleve/EspaceEleve'
import { Connexion } from './Connexion'
import { Inscription } from './Inscription'

export default function App() {
  if (!supabase)
    return (
      <Page surtitre="Suivi Coaching" titre="Bienvenue">
        <Carte>
          <Message>L’appli n’est pas encore reliée à son serveur. Ton coach finit de l’installer.</Message>
        </Carte>
      </Page>
    )
  return <AppConnectee client={supabase} />
}

type Etat = { profil: Profil | null; erreur: string }

function AppConnectee({ client }: { client: Client }) {
  const hash = useAdresse()
  const [voirConnexion, setVoirConnexion] = useState(false)
  const session = useSession(client)
  const [etat, setEtat] = useState<Etat | undefined>(undefined)
  const jetonAdresse = jetonDepuisAdresse(hash)
  const userId = session?.user.id

  useEffect(() => {
    if (jetonAdresse && lireInvitationEnAttente()?.jeton !== jetonAdresse) ecrireInvitationEnAttente({ jeton: jetonAdresse, nom: '' })
  }, [jetonAdresse])

  useEffect(() => {
    if (!userId) return setEtat(undefined)
    let annule = false
    ;(async () => {
      let suivant: Etat
      try {
        let profil = await chargerProfil(client, userId)
        let erreur = ''
        const attente = lireInvitationEnAttente()
        if (!profil && attente) {
          const { error } = await client.rpc('accepter_invitation', { p_jeton: attente.jeton, p_nom: attente.nom })
          if (error) erreur = messageErreur(error)
          else profil = await chargerProfil(client, userId)
        }
        if (attente) {
          effacerInvitationEnAttente()
          remplacerAdresse('')
        }
        suivant = { profil, erreur }
      } catch (e) {
        suivant = { profil: null, erreur: messageErreur(e) }
      }
      if (!annule) setEtat(suivant)
    })()
    return () => {
      annule = true
    }
  }, [client, userId])

  const deconnecter = () => {
    setVoirConnexion(false)
    client.auth.signOut()
  }

  if (session === undefined || (session && !etat)) return <Page titre="…">{null}</Page>

  if (!session) {
    const jeton = jetonAdresse ?? lireInvitationEnAttente()?.jeton
    return jeton && !voirConnexion ? (
      <Inscription client={client} jeton={jeton} allerConnexion={() => setVoirConnexion(true)} />
    ) : (
      <Connexion client={client} />
    )
  }

  const { profil, erreur } = etat!
  if (!profil)
    return (
      <Page surtitre="Suivi Coaching" titre="Compte">
        <Carte>
          <Message type={erreur ? 'erreur' : 'info'}>
            {erreur || 'Ce compte n’est rattaché à aucun coach. Ouvre le lien d’invitation envoyé par ton coach.'}
          </Message>
        </Carte>
        <Bouton variante="discret" onClick={deconnecter}>
          Déconnexion
        </Bouton>
      </Page>
    )

  return profil.role === 'coach' ? (
    <EspaceCoach client={client} profil={profil} deconnecter={deconnecter} />
  ) : (
    <EspaceEleve client={client} profil={profil} deconnecter={deconnecter} />
  )
}
