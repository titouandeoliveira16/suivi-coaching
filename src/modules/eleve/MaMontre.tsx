import { useState } from 'react'
import { messageErreur } from '../../core/compte'
import { useCharge } from '../../core/donnees'
import { delierIntervals, etatIntervals, importerIntervals } from '../../core/intervals'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Message } from '../../core/ui'
import { LierMontre } from './LierMontre'

/** Réglages : état de la liaison Intervals.icu, synchro à la demande, relier / délier. */
export function MaMontre({ client, auChangement }: { client: Client; auChangement: () => void }) {
  const { donnees: etat, erreur, recharger } = useCharge(() => etatIntervals(client), [client])
  const [ouvert, setOuvert] = useState(false)
  const [info, setInfo] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)

  async function agir(action: () => Promise<string>) {
    setOccupe(true)
    setInfo(null)
    try {
      setInfo({ type: 'succes', texte: await action() })
      recharger()
      auChangement()
    } catch (e) {
      setInfo({ type: 'erreur', texte: e instanceof Error ? e.message : messageErreur(e) })
    }
    setOccupe(false)
  }

  return (
    <Carte titre="Ma montre">
      {erreur ? (
        <Message type="erreur">{erreur instanceof Error ? erreur.message : messageErreur(erreur)}</Message>
      ) : !etat ? null : etat.connecte ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texte-2">
            Reliée par Intervals.icu{etat.dernier_import ? ` · dernière synchro ${new Date(etat.dernier_import).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}. Tes sorties arrivent toutes seules, environ toutes les heures.
          </p>
          <div className="flex gap-2">
            <Bouton variante="discret" className="flex-1" disabled={occupe} onClick={() => agir(async () => `${(await importerIntervals(client)).importees} nouvelle(s) sortie(s).`)}>
              Synchroniser
            </Bouton>
            <Bouton variante="discret" className="flex-1" disabled={occupe} onClick={() => agir(async () => (await delierIntervals(client), 'Montre déliée.'))}>
              Délier
            </Bouton>
          </div>
        </div>
      ) : ouvert ? (
        <div className="flex flex-col gap-3">
          <LierMontre client={client} fini={(t) => (setOuvert(false), setInfo({ type: 'succes', texte: t }), recharger(), auChangement())} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texte-2">Pas de montre reliée : tu saisis tes séances à la main.</p>
          <Bouton variante="discret" onClick={() => setOuvert(true)}>
            Relier ma montre
          </Bouton>
        </div>
      )}
      {info && (
        <div className="mt-3">
          <Message type={info.type}>{info.texte}</Message>
        </div>
      )}
    </Carte>
  )
}
