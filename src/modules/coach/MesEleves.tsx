import { useCallback, useEffect, useState } from 'react'
import { adresseEleve, allerA } from '../../core/adresse'
import { messageErreur, type Profil } from '../../core/compte'
import { lienInvitation } from '../../core/invitation'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Champ, Message, Page } from '../../core/ui'

type Invitation = { id: string; jeton: string; nom: string; expire_le: string }

export function MesEleves({ client, profil, deconnecter }: { client: Client; profil: Profil; deconnecter: () => void }) {
  const [eleves, setEleves] = useState<Profil[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [erreur, setErreur] = useState('')
  const [nouveau, setNouveau] = useState<string | null>(null)
  const [prenom, setPrenom] = useState('')
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async () => {
    const [e, i] = await Promise.all([
      client.from('profils').select('id, role, coach_id, nom').eq('coach_id', profil.id).order('nom'),
      client
        .from('invitations')
        .select('id, jeton, nom, expire_le')
        .eq('statut', 'en_attente')
        .gt('expire_le', new Date().toISOString())
        .order('cree_le', { ascending: false }),
    ])
    if (e.error || i.error) return setErreur(messageErreur(e.error ?? i.error))
    setEleves(e.data as Profil[])
    setInvitations(i.data as Invitation[])
  }, [client, profil.id])

  useEffect(() => {
    charger()
  }, [charger])

  async function inviter() {
    setOccupe(true)
    setErreur('')
    const { data, error } = await client.from('invitations').insert({ nom: prenom.trim() }).select('jeton').single()
    setOccupe(false)
    if (error) return setErreur(messageErreur(error))
    setNouveau(lienInvitation(location.href, data.jeton))
    setPrenom('')
    charger()
  }

  async function annuler(id: string) {
    const { error } = await client.from('invitations').delete().eq('id', id)
    if (error) setErreur(messageErreur(error))
    charger()
  }

  return (
    <Page
      surtitre={`Coach · ${profil.nom}`}
      titre="Mes élèves"
      action={
        <Bouton variante="discret" onClick={deconnecter}>
          Déconnexion
        </Bouton>
      }
    >
      <Carte>
        <p className="mb-3 text-sm text-texte-3">{eleves.length} élève{eleves.length > 1 ? 's' : ''}</p>
        {eleves.length === 0 ? (
          <Message>Aucun élève pour l’instant : invite ton premier élève ci-dessous.</Message>
        ) : (
          <ul className="flex flex-col divide-y divide-bordure">
            {eleves.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => allerA(adresseEleve(e.id))}
                  className="flex w-full items-center justify-between py-3 text-left font-semibold"
                >
                  {e.nom || 'Sans prénom'}
                  <span className="text-texte-3">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte>
        <h2 className="mb-3 text-lg font-semibold">Inviter un élève</h2>
        {nouveau ? (
          <LienAPartager lien={nouveau} fermer={() => setNouveau(null)} />
        ) : (
          <form className="flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), inviter())}>
            <Champ etiquette="Prénom de l’élève" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            <Bouton type="submit" disabled={occupe}>
              {occupe ? 'Création…' : 'Créer le lien d’invitation'}
            </Bouton>
          </form>
        )}
      </Carte>

      {invitations.length > 0 && (
        <Carte>
          <h2 className="mb-1 text-lg font-semibold">Invitations en attente</h2>
          <ul className="flex flex-col divide-y divide-bordure">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-3">
                <span>
                  {i.nom || 'Sans prénom'}
                  <span className="block text-xs text-texte-3">valable jusqu’au {new Date(i.expire_le).toLocaleDateString('fr-FR')}</span>
                </span>
                <span className="flex gap-2">
                  <Bouton variante="discret" className="px-3 py-2 text-sm" onClick={() => setNouveau(lienInvitation(location.href, i.jeton))}>
                    Lien
                  </Bouton>
                  <Bouton variante="discret" className="px-3 py-2 text-sm" onClick={() => annuler(i.id)}>
                    Annuler
                  </Bouton>
                </span>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {erreur && <Message type="erreur">{erreur}</Message>}
    </Page>
  )
}

function LienAPartager({ lien, fermer }: { lien: string; fermer: () => void }) {
  const [copie, setCopie] = useState(false)
  const peutPartager = typeof navigator.share === 'function'

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien)
      setCopie(true)
    } catch {
      setCopie(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Message>Envoie ce lien à ton élève (SMS, WhatsApp…). Il est valable 14 jours et ne sert qu’une fois.</Message>
      <p className="break-all rounded-xl bg-surface-2 p-3 text-sm text-texte-2 select-all">{lien}</p>
      {peutPartager && (
        <Bouton onClick={() => navigator.share({ title: 'Suivi Coaching', text: 'Crée ton compte pour suivre ton entraînement :', url: lien }).catch(() => {})}>
          Partager
        </Bouton>
      )}
      <Bouton variante={peutPartager ? 'discret' : 'principal'} onClick={copier}>
        {copie ? 'Lien copié' : 'Copier le lien'}
      </Bouton>
      <Bouton variante="discret" onClick={fermer}>
        Terminé
      </Bouton>
    </div>
  )
}
