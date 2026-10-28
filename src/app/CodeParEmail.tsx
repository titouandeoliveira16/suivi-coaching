import { useState } from 'react'
import { messageErreur } from '../core/compte'
import { codeValide } from '../core/invitation'
import type { Client } from '../core/supabase'
import { Bouton, Champ, Message } from '../core/ui'

/** Connexion par code à usage unique reçu par email (fonctionne aussi dans l'appli installée sur iPhone). */
export function CodeParEmail({ client, creerCompte, avantEnvoi }: { client: Client; creerCompte: boolean; avantEnvoi?: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [envoye, setEnvoye] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  async function envoyer() {
    setOccupe(true)
    setErreur('')
    avantEnvoi?.()
    const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: creerCompte } })
    setOccupe(false)
    if (error) setErreur(messageErreur(error))
    else setEnvoye(true)
  }

  async function verifier() {
    setOccupe(true)
    setErreur('')
    const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setOccupe(false)
    if (error) setErreur(messageErreur(error))
  }

  if (!envoye)
    return (
      <form className="flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), envoyer())}>
        <Champ etiquette="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Bouton type="submit" disabled={occupe || !email.includes('@')}>
          {occupe ? 'Envoi…' : 'Recevoir un code'}
        </Bouton>
        {erreur && <Message type="erreur">{erreur}</Message>}
      </form>
    )

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), verifier())}>
      <Message>Un code vient d’être envoyé à {email.trim()}. Il peut mettre une minute à arriver (pense aux indésirables).</Message>
      <Champ
        etiquette="Code reçu"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
      <Bouton type="submit" disabled={occupe || !codeValide(code)}>
        {occupe ? 'Vérification…' : 'Valider'}
      </Bouton>
      <Bouton variante="discret" onClick={() => (setEnvoye(false), setCode(''))}>
        Changer d’email
      </Bouton>
      {erreur && <Message type="erreur">{erreur}</Message>}
    </form>
  )
}
