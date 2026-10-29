import { messageErreur } from '../../core/compte'
import { seancesEntre, useCharge } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Chargement, Message } from '../../core/ui'
import { ajouterJours, jour, lundiDe } from '../../moteur/dates'
import type { ProfilSportif, Seance } from '../../moteur/types'
import { CarteSeance } from '../commun/CarteSeance'

export function Semaines({ seances, profil, lundi, avecStatut }: { seances: Seance[]; profil: ProfilSportif; lundi: string; avecStatut?: boolean }) {
  return (
    <>
      {[lundi, ajouterJours(lundi, 7)].map((l, i) => {
        const sem = seances.filter((s) => s.date >= l && s.date <= ajouterJours(l, 6))
        return (
          <div key={l} className="flex flex-col gap-2">
            <h2 className="mt-2 text-sm font-semibold text-texte-3 uppercase">{i === 0 ? 'Cette semaine' : 'Semaine prochaine'}</h2>
            {sem.length ? (
              sem.map((s) => <CarteSeance key={s.id} seance={s} profil={profil} avecDate avecStatut={avecStatut ?? s.statut !== 'validee'} />)
            ) : (
              <Message>{i === 0 ? 'Rien de prévu.' : 'Pas encore préparée.'}</Message>
            )}
          </div>
        )
      })}
    </>
  )
}

export function Programme({ client, eleve, profil }: { client: Client; eleve: string; profil: ProfilSportif }) {
  const lundi = lundiDe(jour())
  const { donnees, erreur } = useCharge(() => seancesEntre(client, eleve, lundi, ajouterJours(lundi, 13)), [client, eleve, lundi])
  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!donnees) return <Chargement />
  return <Semaines seances={donnees} profil={profil} lundi={lundi} />
}
