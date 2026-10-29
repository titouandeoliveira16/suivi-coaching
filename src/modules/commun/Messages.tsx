import { useEffect, useState } from 'react'
import { messageErreur } from '../../core/compte'
import { envoyerMessage, marquerLus, messagesDe, useCharge } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Bouton, Chargement, Message } from '../../core/ui'

export function Messages({ client, eleve, moi, auLu }: { client: Client; eleve: string; moi: string; auLu?: () => void }) {
  const { donnees: messages, erreur, recharger } = useCharge(() => messagesDe(client, eleve), [client, eleve])
  const [texte, setTexte] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreurEnvoi, setErreurEnvoi] = useState('')

  const aLire = messages?.some((m) => !m.lu && m.auteur_id !== moi)
  useEffect(() => {
    if (aLire) marquerLus(client, eleve, moi).then(auLu, () => {})
  }, [aLire, client, eleve, moi, auLu])

  async function envoyer() {
    setOccupe(true)
    setErreurEnvoi('')
    try {
      await envoyerMessage(client, eleve, texte.trim())
      setTexte('')
      recharger()
    } catch (e) {
      setErreurEnvoi(messageErreur(e))
    }
    setOccupe(false)
  }

  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!messages) return <Chargement />

  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 && <Message>Pas encore de message. Une question, un retour sur une séance ? Écris ici.</Message>}
      <ul className="flex flex-col gap-2">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.auteur_id === moi ? 'self-end bg-accent text-fond' : 'self-start bg-surface-2 text-texte'}`}>
            {m.texte}
            <span className={`block text-[10px] ${m.auteur_id === moi ? 'text-fond/70' : 'text-texte-3'}`}>
              {new Date(m.cree_le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), texte.trim() && envoyer())}>
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Ton message"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-xl border border-bordure bg-surface-2 px-4 py-3 text-base text-texte outline-none focus:border-accent"
        />
        <Bouton type="submit" disabled={occupe || !texte.trim()}>
          Envoyer
        </Bouton>
      </form>
      {erreurEnvoi && <Message type="erreur">{erreurEnvoi}</Message>}
    </div>
  )
}
