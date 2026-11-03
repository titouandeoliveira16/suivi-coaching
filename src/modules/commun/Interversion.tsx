import { useState } from 'react'
import { messageErreur } from '../../core/compte'
import { intervertirSeances } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Bouton } from '../../core/ui'
import { jour } from '../../moteur/dates'
import { echangePossible } from '../../moteur/echange'
import type { ProfilSportif, Seance } from '../../moteur/types'

/**
 * Intervertir deux séances (coach ou élève) : « ⇄ Intervertir » sur une séance, puis « Échanger avec celle-ci » sur une autre.
 * Les échanges impossibles (deux jours durs d'affilée, jour trop court…) sont expliqués au lieu d'être proposés.
 */
export function useInterversion(client: Client, toutes: Seance[], profilDe: (s: Seance) => ProfilSportif | undefined, auChangement: () => void) {
  const [choisie, setChoisie] = useState<Seance | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const aujourdhui = jour()

  async function intervertir(a: Seance, b: Seance) {
    setOccupe(true)
    setErreur('')
    try {
      await intervertirSeances(client, a, b)
      setChoisie(null)
      auChangement()
    } catch (e) {
      setErreur(messageErreur(e))
    }
    setOccupe(false)
  }

  function boutons(s: Seance) {
    const profil = profilDe(s)
    if (!profil || s.statut === 'faite' || s.statut === 'annulee' || s.date < aujourdhui) return null
    if (!choisie)
      return (
        <Bouton variante="discret" className="px-3 py-2 text-sm" onClick={() => setChoisie(s)}>
          ⇄ Intervertir
        </Bouton>
      )
    if (choisie.id === s.id)
      return (
        <Bouton variante="discret" className="px-3 py-2 text-sm" onClick={() => setChoisie(null)}>
          Annuler l’échange
        </Bouton>
      )
    // Une sortie ne s'échange qu'avec une sortie, un renfo avec un renfo : inutile d'afficher les autres
    if ((choisie.sport === 'renfo') !== (s.sport === 'renfo')) return null
    const v = echangePossible(choisie, s, toutes, profil, aujourdhui)
    return v.ok ? (
      <Bouton className="px-3 py-2 text-sm" disabled={occupe} onClick={() => intervertir(choisie, s)}>
        ⇄ Échanger avec celle-ci
      </Bouton>
    ) : (
      <p className="text-xs text-texte-3">Échange impossible : {v.raison}</p>
    )
  }

  return { boutons, erreur, enCours: !!choisie }
}
