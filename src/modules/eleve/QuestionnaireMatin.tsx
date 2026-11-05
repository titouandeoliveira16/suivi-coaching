import { useEffect, useState } from 'react'
import { messageErreur } from '../../core/compte'
import { enregistrerMatin } from '../../core/donnees'
import { bienEtreDuJour } from '../../core/intervals'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, ChoixNote, Message, OuiNon } from '../../core/ui'
import { jour } from '../../moteur/dates'
import type { ProfilSportif } from '../../moteur/types'

const QUESTIONS = [
  ['sommeil_q', 'Sommeil', 'Très mauvais', 'Excellent'],
  ['fatigue', 'Énergie', 'À plat', 'Plein de jus'],
  ['courbatures', 'Jambes', 'Très lourdes', 'Légères'],
  ['stress', 'Calme', 'Stress fort', 'Au calme'],
  ['humeur', 'Humeur', 'Très mauvaise', 'Excellente'],
] as const

type Notes = Record<(typeof QUESTIONS)[number][0], number | null>

/** Questionnaire de 30 secondes (inspiré de McLean 2010) qui donne le feu du jour. */
export function QuestionnaireMatin({ client, eleve, profil, termine }: { client: Client; eleve: string; profil: ProfilSportif; termine: () => void }) {
  const [sommeil, setSommeil] = useState('')
  const [notes, setNotes] = useState<Notes>({ sommeil_q: null, fatigue: null, courbatures: null, stress: null, humeur: null })
  const [douleur, setDouleur] = useState<boolean | null>(null)
  const [malade, setMalade] = useState<boolean | null>(null)
  const [fievre, setFievre] = useState<boolean | null>(null)
  const [vfc, setVfc] = useState('')
  const [fcRepos, setFcRepos] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  // VFC et FC de repos mesurées cette nuit par la montre (via Intervals.icu)
  useEffect(() => {
    if (profil.liaison !== 'intervals') return
    bienEtreDuJour(client, eleve, jour()).then((m) => {
      if (m?.vfc) setVfc((v) => v || String(Math.round(m.vfc!)))
      if (m?.fc_repos) setFcRepos((v) => v || String(m.fc_repos))
    })
  }, [client, eleve, profil.liaison])

  const heures = Number(sommeil.replace(',', '.'))
  const complet = sommeil !== '' && heures >= 0 && heures <= 16 && Object.values(notes).every((n) => n !== null) && douleur !== null && malade !== null && (!malade || fievre !== null)

  async function envoyer() {
    setOccupe(true)
    setErreur('')
    try {
      await enregistrerMatin(client, eleve, {
        date: jour(),
        sommeil_h: heures,
        sommeil_q: notes.sommeil_q!,
        fatigue: notes.fatigue!,
        courbatures: notes.courbatures!,
        stress: notes.stress!,
        humeur: notes.humeur!,
        douleur: douleur!,
        malade: malade!,
        fievre: malade ? fievre! : false,
        vfc: vfc ? Number(vfc.replace(',', '.')) : null,
        fc_repos: fcRepos ? Number(fcRepos) : null,
      })
      termine()
    } catch (e) {
      setErreur(messageErreur(e))
      setOccupe(false)
    }
  }

  const ligne = (libelle: string, valeur: string, changer: (v: string) => void, unite: string, mode: 'decimal' | 'numeric', exemple?: string) => (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-texte-2">{libelle}</span>
      <span className="flex items-center gap-2">
        <input
          inputMode={mode}
          placeholder={exemple}
          value={valeur}
          onChange={(e) => changer(e.target.value)}
          className="h-12 w-24 rounded-xl border border-bordure bg-surface-2 px-3 text-center text-lg text-texte outline-none focus:border-accent"
        />
        <span className="w-8 text-sm text-texte-3">{unite}</span>
      </span>
    </label>
  )

  return (
    <Carte titre="Ton matin">
      {profil.liaison === 'intervals' && <p className="mb-1 text-xs text-texte-3">VFC et FC de repos reprises de ta montre quand elle les mesure.</p>}
      {profil.montre_vfc && ligne('VFC', vfc, setVfc, 'ms', 'decimal')}
      {profil.montre_vfc && ligne('FC de repos', fcRepos, setFcRepos, 'bpm', 'numeric')}
      {ligne('Durée de sommeil', sommeil, setSommeil, 'h', 'decimal', '7,5')}
      <div className="my-3 border-t border-bordure" />
      {QUESTIONS.map(([cle, libelle, bas, haut]) => (
        <ChoixNote key={cle} etiquette={libelle} min={1} max={5} bas={bas} haut={haut} valeur={notes[cle]} onChange={(v) => setNotes({ ...notes, [cle]: v })} />
      ))}
      <div className="my-3 border-t border-bordure" />
      <div className="flex flex-col gap-3">
        <OuiNon etiquette="Une douleur (pas juste des courbatures) ?" valeur={douleur} onChange={setDouleur} />
        <OuiNon etiquette="Malade ?" valeur={malade} onChange={setMalade} />
        {malade && <OuiNon etiquette="De la fièvre, ou des symptômes sous le cou (toux, poitrine, courbatures générales) ?" valeur={fievre} onChange={setFievre} />}
        <Bouton onClick={envoyer} disabled={!complet || occupe}>
          {occupe ? 'Envoi…' : 'Voir ma séance du jour'}
        </Bouton>
        {erreur && <Message type="erreur">{erreur}</Message>}
      </div>
    </Carte>
  )
}
