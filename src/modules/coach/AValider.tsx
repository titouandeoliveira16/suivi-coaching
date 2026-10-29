import { useCallback, useState } from 'react'
import { messageErreur } from '../../core/compte'
import { modifierSeance, proposerSemaine, supprimerSeance, useCharge, validerSemaine, type SemaineStockee } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Chargement, Message } from '../../core/ui'
import { ajouterJours, jour, lundiDe, NOMS_JOURS, versDate } from '../../moteur/dates'
import { LIBELLE_PHASE } from '../../moteur/phase'
import type { ProfilSportif, Seance } from '../../moteur/types'
import { CarteSeance } from '../commun/CarteSeance'

type Bloc = { semaine: SemaineStockee; nom: string; profil: ProfilSportif; seances: Seance[] }

/** Les semaines proposées par le moteur, à valider (ou ajuster) avant qu'elles partent aux élèves. */
export function AValider({ client, eleve, auChangement }: { client: Client; eleve?: string; auChangement?: () => void }) {
  const aujourdhui = jour()
  const charger = useCallback(async (): Promise<Bloc[]> => {
    let q = client.from('semaines').select('*').eq('validee', false).gte('lundi', lundiDe(aujourdhui)).order('lundi')
    if (eleve) q = q.eq('eleve_id', eleve)
    const semaines = await q
    if (semaines.error) throw semaines.error
    const liste = semaines.data as SemaineStockee[]
    if (!liste.length) return []
    const ids = [...new Set(liste.map((s) => s.eleve_id))]
    const [noms, profils, seances] = await Promise.all([
      client.from('profils').select('id, nom').in('id', ids),
      client.from('profils_sportifs').select('*').in('eleve_id', ids),
      client.from('seances').select('*').in('eleve_id', ids).eq('statut', 'proposee').gte('date', lundiDe(aujourdhui)).order('date'),
    ])
    const erreur = noms.error ?? profils.error ?? seances.error
    if (erreur) throw erreur
    return liste
      .map((s) => ({
        semaine: s,
        nom: (noms.data as { id: string; nom: string }[]).find((n) => n.id === s.eleve_id)?.nom ?? '',
        profil: (profils.data as ProfilSportif[]).find((p) => p.eleve_id === s.eleve_id)!,
        seances: (seances.data as Seance[]).filter((x) => x.eleve_id === s.eleve_id && x.date >= s.lundi && x.date <= ajouterJours(s.lundi, 6)),
      }))
      .filter((b) => b.profil)
  }, [client, eleve, aujourdhui])
  const { donnees, erreur, recharger } = useCharge(charger, [charger])
  const [occupe, setOccupe] = useState('')
  const [erreurAction, setErreurAction] = useState('')

  async function agir(cle: string, action: () => Promise<unknown>) {
    setOccupe(cle)
    setErreurAction('')
    try {
      await action()
      recharger()
      auChangement?.()
    } catch (e) {
      setErreurAction(messageErreur(e))
    }
    setOccupe('')
  }

  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!donnees) return <Chargement />
  if (!donnees.length) return eleve ? null : <Message>Rien à valider pour l’instant. Les semaines suivantes sont proposées chaque dimanche.</Message>

  return (
    <>
      {donnees.map(({ semaine: s, nom, profil, seances }) => {
        const cle = `${s.eleve_id}|${s.lundi}`
        return (
          <div key={cle} className="flex flex-col gap-2">
            <Carte titre={`${eleve ? '' : `${nom} · `}semaine du ${versDate(s.lundi).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}>
              <p className="text-sm text-texte-2">
                {LIBELLE_PHASE[s.phase]} · {s.cible_min} min{s.allegee ? ' · semaine allégée' : ''}
              </p>
              <ul className="mt-2 list-disc pl-5 text-xs text-texte-3">
                {s.explications.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Bouton variante="discret" className="flex-1" disabled={!!occupe} onClick={() => agir(cle + 'refaire', () => proposerSemaine(client, s.eleve_id, s.lundi, s.lundi < aujourdhui ? aujourdhui : s.lundi))}>
                  Refaire
                </Bouton>
                <Bouton className="flex-1" disabled={!!occupe || !seances.length} onClick={() => agir(cle, () => validerSemaine(client, s.eleve_id, s.lundi))}>
                  {occupe === cle ? 'Validation…' : 'Valider la semaine'}
                </Bouton>
              </div>
            </Carte>
            {seances.map((x) => (
              <CarteSeance key={x.id} seance={x} profil={profil} avecDate>
                <div className="flex items-center gap-2">
                  <select
                    value={x.date}
                    onChange={(e) => agir(x.id, () => modifierSeance(client, x.id, { date: e.target.value }))}
                    className="flex-1 rounded-xl border border-bordure bg-surface-2 px-3 py-2 text-sm text-texte capitalize"
                  >
                    {NOMS_JOURS.map((n, i) => {
                      const d = ajouterJours(s.lundi, i)
                      return (
                        <option key={d} value={d} disabled={d < aujourdhui}>
                          {n}
                        </option>
                      )
                    })}
                  </select>
                  <Bouton variante="discret" className="px-3 py-2 text-sm" disabled={!!occupe} onClick={() => agir(x.id, () => supprimerSeance(client, x.id))}>
                    Retirer
                  </Bouton>
                </div>
              </CarteSeance>
            ))}
          </div>
        )
      })}
      {erreurAction && <Message type="erreur">{erreurAction}</Message>}
    </>
  )
}
