import { useState } from 'react'
import { messageErreur } from '../../core/compte'
import { enregistrerMatin } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Champ, ChoixNote, Message, OuiNon } from '../../core/ui'
import { jour } from '../../moteur/dates'
import type { ProfilSportif } from '../../moteur/types'

const QUESTIONS = [
  ['sommeil_q', 'Qualité de ton sommeil', 'très mauvaise', 'excellente'],
  ['fatigue', 'Ton niveau d’énergie', 'épuisé', 'en pleine forme'],
  ['courbatures', 'Tes jambes', 'très courbaturées', 'aucune courbature'],
  ['stress', 'Ton stress', 'très stressé', 'serein'],
  ['humeur', 'Ton humeur', 'très mauvaise', 'excellente'],
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

  return (
    <Carte titre="Comment vas-tu ce matin ?">
      <div className="flex flex-col gap-4">
        <Champ etiquette="Heures de sommeil cette nuit" inputMode="decimal" placeholder="ex. 7,5" value={sommeil} onChange={(e) => setSommeil(e.target.value)} />
        {QUESTIONS.map(([cle, libelle, bas, haut]) => (
          <ChoixNote key={cle} etiquette={libelle} min={1} max={5} bas={bas} haut={haut} valeur={notes[cle]} onChange={(v) => setNotes({ ...notes, [cle]: v })} />
        ))}
        <OuiNon etiquette="Une douleur (pas juste des courbatures) ?" valeur={douleur} onChange={setDouleur} />
        <OuiNon etiquette="Malade ?" valeur={malade} onChange={setMalade} />
        {malade && <OuiNon etiquette="De la fièvre, ou des symptômes sous le cou (toux, poitrine, courbatures générales) ?" valeur={fievre} onChange={setFievre} />}
        {profil.montre_vfc && (
          <div className="grid grid-cols-2 gap-2">
            <Champ etiquette="VFC (ms, facultatif)" inputMode="decimal" value={vfc} onChange={(e) => setVfc(e.target.value)} />
            <Champ etiquette="FC de repos (facultatif)" inputMode="numeric" value={fcRepos} onChange={(e) => setFcRepos(e.target.value)} />
          </div>
        )}
        <Bouton onClick={envoyer} disabled={!complet || occupe}>
          {occupe ? 'Envoi…' : 'Voir ma séance du jour'}
        </Bouton>
        {erreur && <Message type="erreur">{erreur}</Message>}
      </div>
    </Carte>
  )
}
