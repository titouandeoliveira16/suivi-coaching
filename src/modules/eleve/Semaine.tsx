import { useMemo } from 'react'
import { messageErreur } from '../../core/compte'
import { seancesEntre, semainesDe, useCharge } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Chargement, Message } from '../../core/ui'
import { ajouterJours, jour, lundiDe } from '../../moteur/dates'
import type { ProfilSportif } from '../../moteur/types'
import { useInterversion } from '../commun/Interversion'
import { VueSemaines } from '../commun/VueSemaines'

/** La semaine en cours et la suivante, avec la possibilité d'intervertir deux séances. */
export function Semaine({ client, eleve, profil }: { client: Client; eleve: string; profil: ProfilSportif }) {
  const lundi = lundiDe(jour())
  const { donnees, erreur, recharger } = useCharge(async () => {
    const [seances, semaines] = await Promise.all([seancesEntre(client, eleve, lundi, ajouterJours(lundi, 13)), semainesDe(client, eleve, lundi)])
    return { seances, semaines }
  }, [client, eleve, lundi])
  const seances = useMemo(() => donnees?.seances ?? [], [donnees])
  const echange = useInterversion(client, seances, () => profil, recharger)
  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!donnees) return <Chargement />
  return (
    <>
      {echange.enCours && <Message>Choisis la séance avec laquelle échanger. Si un échange est impossible, la raison est indiquée.</Message>}
      <VueSemaines seances={seances} profil={profil} lundi={lundi} semaines={donnees.semaines} actions={(s) => s.statut === 'validee' && echange.boutons(s)} />
      {echange.erreur && <Message type="erreur">{echange.erreur}</Message>}
    </>
  )
}
