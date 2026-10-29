import { useCallback, useState } from 'react'
import { adresseEleve, allerA } from '../../core/adresse'
import { messageErreur, type Profil } from '../../core/compte'
import { alertesNonVues, nonLus, useCharge } from '../../core/donnees'
import { lienInvitation } from '../../core/invitation'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Champ, Chargement, Message, Pastille } from '../../core/ui'
import { jour, lundiDe } from '../../moteur/dates'
import type { Feu } from '../../moteur/types'

type Invitation = { id: string; jeton: string; nom: string; expire_le: string }
const POINT_FEU: Record<Feu, string> = { vert: 'bg-succes', orange: 'bg-alerte', rouge: 'bg-[#f87171]', repos: 'bg-[#f87171]' }

export function MesEleves({ client, profil }: { client: Client; profil: Profil }) {
  const aujourdhui = jour()
  const charger = useCallback(async () => {
    const [eleves, invitations, sportifs, semaines, alertes, lus, matins] = await Promise.all([
      client.from('profils').select('id, role, coach_id, nom').eq('coach_id', profil.id).order('nom'),
      client.from('invitations').select('id, jeton, nom, expire_le').eq('statut', 'en_attente').gt('expire_le', new Date().toISOString()).order('cree_le', { ascending: false }),
      client.from('profils_sportifs').select('eleve_id'),
      client.from('semaines').select('eleve_id, lundi').eq('validee', false).gte('lundi', lundiDe(aujourdhui)),
      alertesNonVues(client),
      nonLus(client, profil.id),
      client.from('matins').select('eleve_id, feu').eq('date', aujourdhui),
    ])
    const erreur = eleves.error ?? invitations.error ?? sportifs.error ?? semaines.error ?? matins.error
    if (erreur) throw erreur
    return {
      eleves: eleves.data as Profil[],
      invitations: invitations.data as Invitation[],
      avecProfil: new Set((sportifs.data as { eleve_id: string }[]).map((s) => s.eleve_id)),
      aValider: (semaines.data as { eleve_id: string }[]).reduce<Record<string, number>>((t, s) => ((t[s.eleve_id] = (t[s.eleve_id] ?? 0) + 1), t), {}),
      alertes: alertes.reduce<Record<string, number>>((t, a) => ((t[a.eleve_id] = (t[a.eleve_id] ?? 0) + 1), t), {}),
      lus,
      feux: Object.fromEntries((matins.data as { eleve_id: string; feu: Feu }[]).map((m) => [m.eleve_id, m.feu])),
    }
  }, [client, profil.id, aujourdhui])
  const { donnees: d, erreur, recharger } = useCharge(charger, [charger])
  const [nouveau, setNouveau] = useState<string | null>(null)
  const [prenom, setPrenom] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreurAction, setErreurAction] = useState('')

  async function inviter() {
    setOccupe(true)
    setErreurAction('')
    const { data, error } = await client.from('invitations').insert({ nom: prenom.trim() }).select('jeton').single()
    setOccupe(false)
    if (error) return setErreurAction(messageErreur(error))
    setNouveau(lienInvitation(location.href, data.jeton))
    setPrenom('')
    recharger()
  }

  async function annuler(id: string) {
    const { error } = await client.from('invitations').delete().eq('id', id)
    if (error) setErreurAction(messageErreur(error))
    recharger()
  }

  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!d) return <Chargement />

  return (
    <>
      <Carte>
        <p className="mb-1 text-sm text-texte-3">
          {d.eleves.length} élève{d.eleves.length > 1 ? 's' : ''}
        </p>
        {d.eleves.length === 0 ? (
          <Message>Aucun élève pour l’instant : invite ton premier élève ci-dessous.</Message>
        ) : (
          <ul className="flex flex-col divide-y divide-bordure">
            {d.eleves.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => allerA(adresseEleve(e.id))} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${d.feux[e.id] ? POINT_FEU[d.feux[e.id]] : 'bg-surface-2'}`} title="Feu du jour" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{e.nom || 'Sans prénom'}</span>
                    {!d.avecProfil.has(e.id) && <span className="block text-xs text-texte-3">Questionnaire pas encore rempli</span>}
                  </span>
                  {!!d.aValider[e.id] && <Pastille>à valider</Pastille>}
                  {!!d.alertes[e.id] && <Pastille ton="alerte">{d.alertes[e.id]} alerte{d.alertes[e.id] > 1 ? 's' : ''}</Pastille>}
                  {!!d.lus[e.id] && <Pastille ton="neutre">💬 {d.lus[e.id]}</Pastille>}
                  <span className="text-texte-3">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte titre="Inviter un élève">
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

      {d.invitations.length > 0 && (
        <Carte titre="Invitations en attente">
          <ul className="flex flex-col divide-y divide-bordure">
            {d.invitations.map((i) => (
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
      {erreurAction && <Message type="erreur">{erreurAction}</Message>}
    </>
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
