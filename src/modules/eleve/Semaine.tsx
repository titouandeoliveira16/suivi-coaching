import { useState } from 'react'
import { messageErreur } from '../../core/compte'
import { intervertirSeances, seancesEntre, semainesDe, useCharge } from '../../core/donnees'
import { activitesEntre } from '../../core/intervals'
import type { Client } from '../../core/supabase'
import { Chargement, Message } from '../../core/ui'
import { Feuille } from '../../core/ui/cadre'
import { ajouterJours, jour, lundiDe, NOMS_JOURS, versDate } from '../../moteur/dates'
import { echangePossible } from '../../moteur/echange'
import { LIBELLE_PHASE } from '../../moteur/phase'
import type { ProfilSportif, Seance } from '../../moteur/types'
import { CarteSeance, ICONE_SPORT } from '../commun/CarteSeance'
import { heures } from '../commun/VueSemaines'

const VERT = '#4ade80'
const ROUGE = '#f87171'
const ORANGE = '#fb923c'

/** Couleur et mot affichés sur une séance selon où elle en est (comme Coach). */
function etat(s: Seance, aujourdhui: string): { couleur?: string; libelle: string } {
  if (s.statut === 'faite') return { couleur: VERT, libelle: 'Faite' }
  if (s.statut === 'annulee') return { couleur: ROUGE, libelle: 'Annulée' }
  if (s.date === aujourdhui) return { couleur: 'var(--color-accent)', libelle: 'Aujourd’hui' }
  if (s.date < aujourdhui) return { couleur: ORANGE, libelle: 'À saisir' }
  return { libelle: '' }
}

/** Semaine : la semaine en cours et la suivante, jour par jour ; un toucher ouvre la séance et permet de l'échanger. */
export function Semaine({ client, eleve, profil }: { client: Client; eleve: string; profil: ProfilSportif }) {
  const aujourdhui = jour()
  const actuel = lundiDe(aujourdhui)
  const [lundi, setLundi] = useState(actuel)
  const { donnees, erreur, recharger } = useCharge(async () => {
    const [seances, semaines, activites] = await Promise.all([
      seancesEntre(client, eleve, actuel, ajouterJours(actuel, 13)),
      semainesDe(client, eleve, actuel),
      activitesEntre(client, eleve, actuel, ajouterJours(actuel, 13)).catch(() => []),
    ])
    return { seances, semaines, activites }
  }, [client, eleve, actuel])
  const [choisie, setChoisie] = useState<Seance | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreurEchange, setErreurEchange] = useState('')

  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!donnees) return <Chargement />

  const sem = donnees.seances.filter((s) => s.date >= lundi && s.date <= ajouterJours(lundi, 6))
  const info = donnees.semaines.find((s) => s.lundi === lundi)
  const total = sem.filter((s) => s.sport !== 'renfo' && s.statut !== 'annulee').reduce((t, s) => t + s.duree_min, 0)
  const suivante = lundi !== actuel

  async function echanger(a: Seance, b: Seance) {
    setOccupe(true)
    setErreurEchange('')
    try {
      await intervertirSeances(client, a, b)
      setChoisie(null)
      recharger()
    } catch (e) {
      setErreurEchange(messageErreur(e))
    }
    setOccupe(false)
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Semaine précédente" disabled={!suivante} onClick={() => setLundi(actuel)} className="px-3 py-1 text-2xl text-accent disabled:opacity-20">
          ‹
        </button>
        <div className="text-center">
          <p className="font-semibold">Semaine du {versDate(lundi).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
          {sem.length > 0 && (
            <p className="text-xs text-texte-3">
              {info ? `${LIBELLE_PHASE[info.phase]}${info.allegee ? ' · allégée' : ''} · ` : ''}
              {heures(total)}
            </p>
          )}
        </div>
        <button type="button" aria-label="Semaine suivante" disabled={suivante} onClick={() => setLundi(ajouterJours(actuel, 7))} className="px-3 py-1 text-2xl text-accent disabled:opacity-20">
          ›
        </button>
      </div>

      {!sem.length && <Message>{suivante ? 'Ton coach prépare cette semaine : elle arrive bientôt.' : 'Rien de prévu cette semaine.'}</Message>}

      {sem.length > 0 &&
        NOMS_JOURS.map((nom, j) => {
          const d = ajouterJours(lundi, j)
          const duJour = sem.filter((s) => s.date === d)
          return (
            <section key={d} className={`rounded-2xl border bg-surface p-3 ${d === aujourdhui ? 'border-accent' : 'border-bordure'}`}>
              <p className="font-semibold capitalize">
                {nom} {versDate(d).getDate()}
              </p>
              {duJour.map((s) => {
                const e = etat(s, aujourdhui)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setChoisie(s)}
                    className="mt-2 block w-full rounded-xl border-l-4 bg-surface-2 p-2.5 text-left"
                    style={{ borderLeftColor: e.couleur ?? 'transparent', background: e.couleur ? `color-mix(in srgb, ${e.couleur} 12%, var(--color-surface-2))` : undefined }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={`font-semibold ${s.statut === 'annulee' ? 'line-through opacity-70' : ''}`}>
                        {ICONE_SPORT[s.sport]} {s.titre}
                      </span>
                      <span className="shrink-0 text-xs font-semibold" style={{ color: e.couleur }}>
                        {e.libelle}
                      </span>
                    </span>
                    <span className="block text-sm text-texte-2">
                      {s.duree_reelle_min ?? s.duree_min} min{s.categorie === 'intense' || s.categorie === 'test' ? ' · intense' : s.categorie === 'longue' ? ' · sortie longue' : ''}
                    </span>
                  </button>
                )
              })}
              {!duJour.length && <p className="mt-1 text-sm text-texte-3">Repos</p>}
            </section>
          )
        })}

      {choisie && (
        <Feuille titre={versDate(choisie.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} onFermer={() => (setChoisie(null), setErreurEchange(''))}>
          <CarteSeance seance={choisie} profil={profil} ouverte activite={donnees.activites.find((a) => a.seance_id === choisie.id)} />
          {choisie.statut === 'validee' && choisie.date >= aujourdhui && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold tracking-wider text-texte-3 uppercase">Échanger avec une autre séance</p>
              <div className="flex flex-col gap-2">
                {sem
                  .filter((x) => x.id !== choisie.id && x.statut === 'validee' && (x.sport === 'renfo') === (choisie.sport === 'renfo'))
                  .map((x) => {
                    const v = echangePossible(choisie, x, donnees.seances, profil, aujourdhui)
                    return (
                      <button
                        key={x.id}
                        type="button"
                        disabled={!v.ok || occupe}
                        onClick={() => echanger(choisie, x)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${v.ok ? 'border-accent' : 'border-bordure opacity-60'}`}
                      >
                        <span>
                          <span className="font-semibold capitalize">{NOMS_JOURS[(versDate(x.date).getDay() + 6) % 7]}</span> · {x.titre}
                        </span>
                        <span className="shrink-0 text-xs text-texte-3">{v.ok ? '⇄' : v.raison}</span>
                      </button>
                    )
                  })}
              </div>
              <p className="mt-2 text-xs text-texte-3">Ton coach est prévenu de l’échange. Ce qui serait mauvais pour toi est grisé, avec la raison.</p>
              {erreurEchange && <Message type="erreur">{erreurEchange}</Message>}
            </div>
          )}
        </Feuille>
      )}
    </>
  )
}
