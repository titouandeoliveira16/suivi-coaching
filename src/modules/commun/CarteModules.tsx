import { useState } from 'react'
import { messageErreur } from '../../core/compte'
import { useCharge } from '../../core/donnees'
import { deciderModule, demanderModule, MODULES, modulesDe, type NomModule } from '../../core/modules'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Message, Pastille } from '../../core/ui'

const ETAT = { demande: 'Demande envoyée', actif: 'Actif', refuse: 'Pas pour l’instant' } as const

/** Modules : l'élève les demande, le coach les active (ou les active de lui-même). */
export function CarteModules({ client, eleve, role, auChangement }: { client: Client; eleve: string; role: 'eleve' | 'coach'; auChangement?: () => void }) {
  const { donnees: lignes, recharger } = useCharge(() => modulesDe(client, eleve), [client, eleve])
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  async function agir(action: () => Promise<void>) {
    setOccupe(true)
    setErreur('')
    try {
      await action()
      recharger()
      auChangement?.()
    } catch (e) {
      setErreur(messageErreur(e))
    }
    setOccupe(false)
  }
  if (!lignes) return null
  const statut = (m: NomModule) => lignes.find((l) => l.module === m)?.statut

  return (
    <Carte titre="Modules">
      <p className="mb-3 text-sm text-texte-2">
        {role === 'eleve' ? 'En plus de ton entraînement, sur demande : ton coach valide et les adapte à ton programme.' : 'Demandés par l’élève ou activés par toi ; ils s’intègrent au programme dès la semaine suivante.'}
      </p>
      <ul className="flex flex-col divide-y divide-bordure">
        {MODULES.map((m) => {
          const s = statut(m.nom)
          return (
            <li key={m.nom} className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {m.icone} {m.titre}
                </span>
                {s && <Pastille ton={s === 'actif' ? 'succes' : s === 'demande' ? 'accent' : 'neutre'}>{ETAT[s]}</Pastille>}
              </div>
              <p className="text-sm text-texte-2">{m.texte}</p>
              {role === 'eleve' && (!s || s === 'refuse') && (
                <Bouton variante="discret" disabled={occupe} onClick={() => agir(() => demanderModule(client, eleve, m.nom, s === 'refuse'))}>
                  {s === 'refuse' ? 'Redemander' : 'Demander à mon coach'}
                </Bouton>
              )}
              {role === 'coach' && (
                <div className="flex gap-2">
                  {s !== 'actif' && (
                    <Bouton className="flex-1 py-2 text-sm" disabled={occupe} onClick={() => agir(() => deciderModule(client, eleve, m.nom, 'actif'))}>
                      {s === 'demande' ? 'Accepter' : 'Activer'}
                    </Bouton>
                  )}
                  {s === 'demande' && (
                    <Bouton variante="discret" className="flex-1 py-2 text-sm" disabled={occupe} onClick={() => agir(() => deciderModule(client, eleve, m.nom, 'refuse'))}>
                      Refuser
                    </Bouton>
                  )}
                  {s === 'actif' && (
                    <Bouton variante="discret" className="flex-1 py-2 text-sm" disabled={occupe} onClick={() => agir(() => deciderModule(client, eleve, m.nom, null))}>
                      Retirer
                    </Bouton>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {erreur && <Message type="erreur">{erreur}</Message>}
    </Carte>
  )
}
