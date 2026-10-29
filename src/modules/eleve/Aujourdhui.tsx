import { useEffect, useRef, useState } from 'react'
import { messageErreur } from '../../core/compte'
import { allegementDuJour, appliquerAllegement, matinsDepuis, reconduireSiBesoin, seancesEntre, useCharge } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Chargement, Message } from '../../core/ui'
import { ajouterJours, dateLisible, jour } from '../../moteur/dates'
import { feuDuJour, LIBELLE_FEU } from '../../moteur/feu'
import type { Feu, ProfilSportif } from '../../moteur/types'
import { CarteSeance } from '../commun/CarteSeance'
import { QuestionnaireMatin } from './QuestionnaireMatin'
import { SaisieSeance } from './SaisieSeance'

const COULEUR_FEU: Record<Feu, string> = { vert: 'bg-succes', orange: 'bg-alerte', rouge: 'bg-[#f87171]', repos: 'bg-[#f87171]' }

export function Aujourdhui({ client, eleve, profil }: { client: Client; eleve: string; profil: ProfilSportif }) {
  const aujourdhui = jour()
  const { donnees, erreur, recharger } = useCharge(async () => {
    const [seances, matins] = await Promise.all([
      seancesEntre(client, eleve, ajouterJours(aujourdhui, -35), ajouterJours(aujourdhui, 14)),
      matinsDepuis(client, eleve, ajouterJours(aujourdhui, -60)),
    ])
    return { seances, matins }
  }, [client, eleve, aujourdhui])
  const [saisie, setSaisie] = useState<string | null>(null)
  const [erreurAjustement, setErreurAjustement] = useState('')
  const dejaTente = useRef(false)

  // Lundi sans semaine validée par le coach : la précédente est reconduite, sans hausse
  useEffect(() => {
    reconduireSiBesoin(client, eleve).then((fait) => fait && recharger(), () => {})
  }, [client, eleve, recharger])

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

  return (
    <>
      {!matin ? (
        <QuestionnaireMatin client={client} eleve={eleve} profil={profil} termine={() => ((dejaTente.current = false), recharger())} />
      ) : (
        signal && (
          <Carte>
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-4 w-4 shrink-0 rounded-full ${COULEUR_FEU[signal.feu]}`} />
              <div>
                <p className="font-semibold">{LIBELLE_FEU[signal.feu]}</p>
                {signal.raisons.length > 0 && <p className="text-sm text-texte-2">{signal.raisons.join(' · ')}</p>}
              </div>
            </div>
          </Carte>
        )
      )}
      {erreurAjustement && <Message type="erreur">{erreurAjustement}</Message>}

      {duJour.length ? (
        duJour.map((s) => (
          <CarteSeance key={s.id} seance={s} profil={profil} ouverte={s.statut === 'validee'}>
            {s.statut === 'validee' &&
              (saisie === s.id ? (
                <SaisieSeance client={client} seance={s} annuler={() => setSaisie(null)} termine={() => (setSaisie(null), recharger())} />
              ) : (
                <Bouton onClick={() => setSaisie(s.id)}>J’ai fait ma séance</Bouton>
              ))}
          </CarteSeance>
        ))
      ) : (
        <Carte>
          <p className="font-semibold">Pas de séance aujourd’hui</p>
          <p className="text-sm text-texte-2">Repos : c’est là que le corps progresse.</p>
        </Carte>
      )}

      {prochaine && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texte-3">Prochaine séance · {dateLisible(prochaine.date)}</p>
          <CarteSeance seance={prochaine} profil={profil} />
        </div>
      )}
      {!prochaine && !duJour.length && <Message>Ton coach prépare tes prochaines séances.</Message>}
    </>
  )
}
