import { useEffect, useRef, useState } from 'react'
import { messageErreur } from '../../core/compte'
import { allegementDuJour, appliquerAllegement, matinsDepuis, reconduireSiBesoin, reevaluerSemaine, seancesEntre, useCharge } from '../../core/donnees'
import { activitesEntre, importerSiBesoin } from '../../core/intervals'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Chargement, Message } from '../../core/ui'
import { ajouterJours, dateLisible, jour } from '../../moteur/dates'
import { feuDuJour } from '../../moteur/feu'
import type { ProfilSportif, Seance } from '../../moteur/types'
import { CarteSeance } from '../commun/CarteSeance'
import { CarteForme } from './CarteForme'
import { QuestionnaireMatin } from './QuestionnaireMatin'
import { SaisieSeance } from './SaisieSeance'


export function Aujourdhui({ client, eleve, profil }: { client: Client; eleve: string; profil: ProfilSportif }) {
  const aujourdhui = jour()
  const { donnees, erreur, recharger } = useCharge(async () => {
    const [seances, matins, activites] = await Promise.all([
      seancesEntre(client, eleve, ajouterJours(aujourdhui, -35), ajouterJours(aujourdhui, 14)),
      matinsDepuis(client, eleve, ajouterJours(aujourdhui, -60)),
      activitesEntre(client, eleve, ajouterJours(aujourdhui, -3), aujourdhui).catch(() => []),
    ])
    return { seances, matins, activites }
  }, [client, eleve, aujourdhui])
  const [saisie, setSaisie] = useState<string | null>(null)
  const [erreurAjustement, setErreurAjustement] = useState('')
  const dejaTente = useRef(false)

  // Lundi sans semaine validée par le coach : la précédente est reconduite, sans hausse
  useEffect(() => {
    reconduireSiBesoin(client, eleve).then((fait) => fait && recharger(), () => {})
    // Semaine préparée à l'avance : allégée si la précédente a été plus dure que prévu
    reevaluerSemaine(client, eleve).then(recharger, () => {})
    // Montre reliée : les sorties récentes arrivent d'Intervals.icu
    if (profil.liaison === 'intervals') importerSiBesoin(client, eleve).then((nouveau) => nouveau && recharger(), () => {})
  }, [client, eleve, recharger, profil.liaison])

  const matin = donnees?.matins.find((m) => m.date === aujourdhui) ?? null

  // Le matin est rempli : on allège tout seul la séance du jour si besoin (le coach est prévenu)
  useEffect(() => {
    if (!donnees || !matin || dejaTente.current) return
    dejaTente.current = true
    const duJour = donnees.seances.filter((s) => s.date === aujourdhui)
    ;(async () => {
      let change = false
      for (const s of duJour) {
        const a = allegementDuJour(s, profil, matin, donnees.seances)
        if (a) {
          await appliquerAllegement(client, s, a)
          change = true
        }
      }
      if (change) recharger()
    })().catch((e) => setErreurAjustement(messageErreur(e)))
  }, [donnees, matin, aujourdhui, profil, client, recharger])

  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!donnees) return <Chargement />

  const duJour = donnees.seances.filter((s) => s.date === aujourdhui)
  const prochaine = donnees.seances.find((s) => s.date > aujourdhui && s.statut === 'validee')
  const signal = matin ? feuDuJour(matin, donnees.matins.filter((m) => m.date < aujourdhui), donnees.seances) : null

  const activiteDe = (id: string) => donnees.activites.find((a) => a.seance_id === id)
  // Séances des 3 derniers jours dont la sortie est arrivée (ou marquées faites par la montre) sans le ressenti de l'élève
  const aCompleter = donnees.seances.filter(
    (s) => s.date < aujourdhui && s.date >= ajouterJours(aujourdhui, -3) && ((s.statut === 'validee' && activiteDe(s.id)) || (s.statut === 'faite' && s.rpe === null)),
  )
  const carte = (s: Seance, saisissable: boolean, etiquette?: string) => (
    <CarteSeance key={s.id} seance={s} profil={profil} ouverte={s.statut === 'validee' && s.date === aujourdhui} activite={activiteDe(s.id)} avecDate={s.date !== aujourdhui} etiquette={etiquette}>
      {saisissable &&
        (saisie === s.id ? (
          <SaisieSeance client={client} seance={s} activite={activiteDe(s.id)} annuler={() => setSaisie(null)} termine={() => (setSaisie(null), recharger())} />
        ) : (
          <Bouton onClick={() => setSaisie(s.id)}>{s.statut === 'faite' || activiteDe(s.id) ? 'Ajouter mon ressenti' : 'J’ai fait ma séance'}</Bouton>
        ))}
    </CarteSeance>
  )

  return (
    <>
      {!matin ? (
        <QuestionnaireMatin client={client} eleve={eleve} profil={profil} termine={() => ((dejaTente.current = false), recharger())} />
      ) : (
        signal && <CarteForme matin={matin} signal={signal} />
      )}
      {erreurAjustement && <Message type="erreur">{erreurAjustement}</Message>}

      {aCompleter.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-xs font-semibold tracking-wider text-texte-3 uppercase">À compléter : ton ressenti</p>
          {aCompleter.map((s) => carte(s, true))}
        </div>
      )}

      {duJour.length ? (
        duJour.map((s, i) => carte(s, s.statut === 'validee', i === 0 ? 'Séance du jour' : 'Encore prévu'))
      ) : (
        <Carte titre="Séance du jour">
          <p className="font-semibold">Repos</p>
          <p className="text-sm text-texte-2">C’est là que le corps assimile le travail et progresse.</p>
        </Carte>
      )}

      {prochaine && <CarteSeance seance={prochaine} profil={profil} etiquette={`Prochaine séance · ${dateLisible(prochaine.date)}`} />}
      {!prochaine && !duJour.length && <Message>Ton coach prépare tes prochaines séances.</Message>}
    </>
  )
}
