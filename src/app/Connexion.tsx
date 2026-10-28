import { useState } from 'react'
import { messageErreur } from '../core/compte'
import type { Client } from '../core/supabase'
import { Bouton, Carte, Champ, Message, Page } from '../core/ui'

export function Connexion({ client }: { client: Client }) {
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  async function connecter() {
    setOccupe(true)
    setErreur('')
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password: mdp })
    setOccupe(false)
    if (error) setErreur(messageErreur(error))
  }

  return (
    <Page surtitre="Suivi Coaching" titre="Connexion">
      <Carte>
        <form className="flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), connecter())}>
          <Champ etiquette="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Champ etiquette="Mot de passe" type="password" autoComplete="current-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} />
          <Bouton type="submit" disabled={occupe || !email || !mdp}>
            {occupe ? 'Connexion…' : 'Se connecter'}
          </Bouton>
          {erreur && <Message type="erreur">{erreur}</Message>}
        </form>
      </Carte>
      <Message>Pas encore de compte ? Ton coach t’envoie un lien d’invitation pour le créer.</Message>
      <Message>Mot de passe oublié ? Demande à ton coach de le réinitialiser.</Message>
    </Page>
  )
}
