import { useState } from 'react'
import { messageErreur } from '../../core/compte'
import { enregistrerResultat, enregistrerTest } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Bouton, Champ, ChoixNote, Message, OuiNon, Zone } from '../../core/ui'
import { cpDeuxPoints, vmaCinqMinutes } from '../../moteur/tests'
import type { Seance } from '../../moteur/types'

const nombre = (v: string) => Number(v.replace(',', '.'))

function secondes(chrono: string): number | null {
  const m = /^(\d{1,3})[:'h ](\d{1,2})$/.exec(chrono.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Après la séance : durée, effort ressenti (Foster 2001), réussite, douleur, et le résultat si c'est un test. */
export function SaisieSeance({ client, seance: s, termine, annuler }: { client: Client; seance: Seance; termine: () => void; annuler: () => void }) {
  const [duree, setDuree] = useState(String(s.duree_min))
  const [rpe, setRpe] = useState<number | null>(null)
  const [reussie, setReussie] = useState<boolean | null>(null)
  const [douleur, setDouleur] = useState<number | null>(0)
  const [zone, setZone] = useState('')
  const [boiterie, setBoiterie] = useState<boolean | null>(false)
  const [note, setNote] = useState('')
  const [p3, setP3] = useState('')
  const [p12, setP12] = useState('')
  const [distance, setDistance] = useState('')
  const [temps, setTemps] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  const test = s.categorie === 'test' ? s.format_id : null
  const resultatTest = (() => {
    if (test === 'velo-test-cp-2-points' && nombre(p3) > 0 && nombre(p12) > 0) return { type: 'cp' as const, valeur: cpDeuxPoints(nombre(p3), nombre(p12)), details: { p3: nombre(p3), p12: nombre(p12) }, texte: `CP estimée : ${cpDeuxPoints(nombre(p3), nombre(p12))} W` }
    if (test === 'course-test-vma-5min' && nombre(distance) > 0) return { type: 'vma' as const, valeur: vmaCinqMinutes(nombre(distance)), details: { distance: nombre(distance) }, texte: `VMA estimée : ${vmaCinqMinutes(nombre(distance))} km/h` }
    if (test?.endsWith('-reference') && secondes(temps)) return { type: 'reference' as const, valeur: secondes(temps)!, details: { temps }, texte: '' }
    return null
  })()
  const testIncomplet = !!test && !resultatTest

  const complet = nombre(duree) > 0 && rpe !== null && reussie !== null && douleur !== null && !testIncomplet

  async function enregistrer() {
    setOccupe(true)
    setErreur('')
    try {
      if (resultatTest) await enregistrerTest(client, { eleve_id: s.eleve_id, date: s.date, sport: s.sport, type: resultatTest.type, valeur: resultatTest.valeur, details: resultatTest.details, seance_id: s.id })
      await enregistrerResultat(client, s, { duree: Math.round(nombre(duree)), rpe: rpe!, reussie: reussie!, douleur: douleur ?? 0, zone, boiterie: !!boiterie, note })
      termine()
    } catch (e) {
      setErreur(messageErreur(e))
      setOccupe(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 border-t border-bordure pt-4">
      {test === 'velo-test-cp-2-points' && (
        <div className="grid grid-cols-2 gap-2">
          <Champ etiquette="Puissance moyenne 3 min (W)" inputMode="numeric" value={p3} onChange={(e) => setP3(e.target.value)} />
          <Champ etiquette="Puissance moyenne 12 min (W)" inputMode="numeric" value={p12} onChange={(e) => setP12(e.target.value)} />
        </div>
      )}
      {test === 'course-test-vma-5min' && <Champ etiquette="Distance parcourue en 5 min (mètres)" inputMode="numeric" value={distance} onChange={(e) => setDistance(e.target.value)} />}
      {test?.endsWith('-reference') && <Champ etiquette="Temps sur le parcours (min:s)" placeholder="ex. 14:32" value={temps} onChange={(e) => setTemps(e.target.value)} />}
      {resultatTest?.texte && <Message type="succes">{resultatTest.texte}</Message>}

      <Champ etiquette="Durée réelle (minutes)" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} />
      <ChoixNote etiquette="Effort ressenti sur toute la séance" min={0} max={10} bas="repos" haut="maximal" valeur={rpe} onChange={setRpe} />
      <OuiNon etiquette="Séance réussie comme prévu ?" valeur={reussie} onChange={setReussie} />
      <ChoixNote etiquette="Douleur pendant ou après" min={0} max={10} bas="aucune" haut="insupportable" valeur={douleur} onChange={setDouleur} />
      {!!douleur && (
        <>
          <Champ etiquette="Où ?" placeholder="ex. genou droit, tendon d’Achille" value={zone} onChange={(e) => setZone(e.target.value)} />
          <OuiNon etiquette="Ça te fait boiter ?" valeur={boiterie} onChange={setBoiterie} />
        </>
      )}
      <Zone etiquette="Un mot pour ton coach (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Bouton variante="discret" onClick={annuler} className="flex-1">
          Annuler
        </Bouton>
        <Bouton onClick={enregistrer} disabled={!complet || occupe} className="flex-1">
          {occupe ? 'Envoi…' : 'Enregistrer'}
        </Bouton>
      </div>
      {erreur && <Message type="erreur">{erreur}</Message>}
    </div>
  )
}
