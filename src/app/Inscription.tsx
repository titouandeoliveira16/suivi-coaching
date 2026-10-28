import { useEffect, useState } from 'react'
import { messageErreur } from '../core/compte'
import { ecrireInvitationEnAttente, effacerInvitationEnAttente } from '../core/invitation'
import type { Client } from '../core/supabase'
import { Bouton, Carte, Champ, Message, Page } from '../core/ui'

type Invitation = { nom: string; coach_nom: string; valide: boolean }

/** Création du compte d'un élève à partir du lien envoyé par son coach. */
export function Inscription({ client, jeton, allerConnexion }: { client: Client; jeton: string; allerConnexion: () => void }) {
  const [invitation, setInvitation] = useState<Invitation | null | undefined>(undefined)
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const [aConfirmer, setAConfirmer] = useState(false)

  useEffect(() => {
    client.rpc('voir_invitation', { p_jeton: jeton }).then(({ data, error }) => {
      const inv = !error && Array.isArray(data) ? ((data[0] as Invitation | undefined) ?? null) : null
      setInvitation(inv)
      if (inv) setPrenom(inv.nom)
    })
  }, [client, jeton])

  const memoriser = () => ecrireInvitationEnAttente({ jeton, nom: prenom.trim() })

  async function creer() {
    setOccupe(true)
    setErreur('')
    memoriser()
    const { data, error } = await client.auth.signUp({ email: email.trim(), password: mdp })
    setOccupe(false)
    if (error) setErreur(messageErreur(error))
    else if (!data.session) setAConfirmer(true)
  }

  if (invitation === undefined) return <Page titre="Invitation">{null}</Page>

  if (!invitation?.valide)
    return (
      <Page surtitre="Suivi Coaching" titre="Invitation">
        <Carte>
          <Message type="erreur">Ce lien d’invitation n’est plus valable. Demande-en un nouveau à ton coach.</Message>
        </Carte>
        <Bouton variante="discret" onClick={() => (effacerInvitationEnAttente(), allerConnexion())}>
          J’ai déjà un compte
        </Bouton>
      </Page>
    )

  return (
    <Page surtitre="Suivi Coaching" titre="Bienvenue">
      <Carte>
        <p className="text-texte-2">
          {invitation.coach_nom || 'Ton coach'} t’invite à suivre ton entraînement ici. Crée ton compte en quelques secondes.
        </p>
      </Carte>
      <Carte>
        <div className="flex flex-col gap-4">
          <Champ etiquette="Prénom" autoComplete="given-name" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          {aConfirmer ? (
            <Message type="succes">Compte créé : confirme ton email avec le lien reçu, puis reviens te connecter.</Message>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), creer())}>
              <Champ etiquette="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Champ
                etiquette="Mot de passe (8 caractères minimum)"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={mdp}
                onChange={(e) => setMdp(e.target.value)}
              />
              <Bouton type="submit" disabled={occupe || !email || mdp.length < 8}>
                {occupe ? 'Création…' : 'Créer mon compte'}
              </Bouton>
              {erreur && <Message type="erreur">{erreur}</Message>}
            </form>
          )}
        </div>
      </Carte>
      <Bouton variante="discret" onClick={() => (memoriser(), allerConnexion())}>
        J’ai déjà un compte
      </Bouton>
    </Page>
  )
}
