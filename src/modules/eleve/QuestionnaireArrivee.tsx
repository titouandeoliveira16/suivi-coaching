import { useState } from 'react'
import { messageErreur } from '../../core/compte'
import { enregistrerProfilSportif } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Champ, Message, OuiNon, Page, Zone } from '../../core/ui'
import { jour, lundiDe, NOMS_JOURS } from '../../moteur/dates'
import type { ProfilSportif, Sport } from '../../moteur/types'

/** Questions générales du PAR-Q+ (version 2023, reformulées) : un « oui » demande un avis médical avant l'intensité. */
const PARQ = [
  'Un médecin t’a-t-il déjà dit que tu avais un problème cardiaque ou de l’hypertension ?',
  'Ressens-tu une douleur à la poitrine au repos, dans la vie quotidienne ou pendant un effort ?',
  'As-tu perdu l’équilibre à cause d’un vertige, ou perdu connaissance, au cours des 12 derniers mois ?',
  'As-tu une autre maladie chronique diagnostiquée (autre que cardiaque ou hypertension) ?',
  'Prends-tu actuellement des médicaments prescrits pour une maladie chronique ?',
  'As-tu (ou as-tu eu ces 12 derniers mois) un problème d’os, d’articulation, de muscle ou de tendon qui pourrait s’aggraver avec plus d’activité ?',
  'Un médecin t’a-t-il dit de ne faire de l’activité physique que sous surveillance médicale ?',
]

type Brouillon = Omit<ProfilSportif, 'avis_medical' | 'cp' | 'vma' | 'eleve_id' | 'debut' | 'parq_oui'>

const VIDE: Brouillon = {
  disciplines: [],
  objectif: '',
  date_objectif: null,
  duree_epreuve: null,
  jours_dispo: [],
  minutes_semaine: 0,
  duree_max_min: 90,
  capteur_puissance: false,
  cardio: false,
  montre_gps: false,
  montre_vfc: false,
  volume_velo_min: 0,
  volume_course_min: 0,
  annees_pratique: 0,
  competitions: false,
  blessures: '',
  age: null,
  fc_max: null,
  fc_repos: null,
  medicaments: '',
}

const nombre = (v: string) => (v === '' ? null : Number(v.replace(',', '.')))
const heures = (minutes: number) => (minutes ? String(Math.round((minutes / 60) * 10) / 10) : '')

function Bascule({ actif, children, onClick }: { actif: boolean; children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl px-4 py-2.5 text-sm ${actif ? 'bg-accent font-semibold text-fond' : 'bg-surface-2 text-texte-2'}`}>
      {children}
    </button>
  )
}

export function QuestionnaireArrivee({ client, eleve, initial, termine, annuler }: { client: Client; eleve: string; initial?: ProfilSportif | null; termine: () => void; annuler?: () => void }) {
  const [p, setP] = useState<Brouillon>(initial ? { ...VIDE, ...initial } : VIDE)
  const [parq, setParq] = useState<(boolean | null)[]>(PARQ.map(() => null))
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const maj = (champs: Partial<Brouillon>) => setP((x) => ({ ...x, ...champs }))
  const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])

  const manque = [
    !p.disciplines.length && 'ton ou tes sports',
    !p.jours_dispo.length && 'tes jours disponibles',
    p.minutes_semaine < 30 && 'ton temps disponible par semaine',
    p.duree_max_min < 20 && 'la durée maximale d’une séance',
    !initial && parq.some((r) => r === null) && 'les questions santé',
  ].filter(Boolean)

  async function enregistrer() {
    setOccupe(true)
    setErreur('')
    try {
      await enregistrerProfilSportif(client, {
        ...p,
        eleve_id: eleve,
        cp: initial?.cp ?? null,
        vma: initial?.vma ?? null,
        debut: initial?.debut ?? lundiDe(jour()),
        parq_oui: initial && parq.every((r) => r === null) ? initial.parq_oui : parq.some((r) => r === true),
        duree_epreuve: p.date_objectif ? p.duree_epreuve ?? 'courte' : null,
      })
      termine()
    } catch (e) {
      setErreur(messageErreur(e))
    }
    setOccupe(false)
  }

  return (
    <Page surtitre="Suivi Coaching" titre={initial ? 'Mon profil' : 'Faisons connaissance'} action={annuler && <Bouton variante="discret" onClick={annuler}>Fermer</Bouton>}>
      {!initial && <Message>Ces réponses permettent de te préparer un programme adapté. Compte 5 minutes.</Message>}

      <Carte titre="Ton sport et ton objectif">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {(['velo', 'course'] as Sport[]).map((s) => (
              <Bascule key={s} actif={p.disciplines.includes(s)} onClick={() => maj({ disciplines: basculer(p.disciplines, s) })}>
                {s === 'velo' ? '🚴 Vélo' : '🏃 Course à pied'}
              </Bascule>
            ))}
          </div>
          <Champ etiquette="Ton objectif" placeholder="ex. finir un 10 km, une cyclosportive, être en forme" value={p.objectif} onChange={(e) => maj({ objectif: e.target.value })} />
          <Champ etiquette="Date de l’objectif (facultatif)" type="date" value={p.date_objectif ?? ''} onChange={(e) => maj({ date_objectif: e.target.value || null })} />
          {p.date_objectif && (
            <div className="flex gap-2">
              <Bascule actif={p.duree_epreuve !== 'longue'} onClick={() => maj({ duree_epreuve: 'courte' })}>
                Épreuve de moins d’1 h
              </Bascule>
              <Bascule actif={p.duree_epreuve === 'longue'} onClick={() => maj({ duree_epreuve: 'longue' })}>
                Plus d’1 h
              </Bascule>
            </div>
          )}
        </div>
      </Carte>

      <Carte titre="Ton temps">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-texte-2">Jours où tu peux t’entraîner</span>
            <div className="flex gap-1">
              {NOMS_JOURS.map((n, i) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => maj({ jours_dispo: basculer(p.jours_dispo, i) })}
                  className={`h-10 flex-1 rounded-lg text-sm capitalize ${p.jours_dispo.includes(i) ? 'bg-accent font-semibold text-fond' : 'bg-surface-2 text-texte-2'}`}
                >
                  {n.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>
          <Champ etiquette="Heures disponibles par semaine, au maximum" inputMode="decimal" value={heures(p.minutes_semaine)} onChange={(e) => maj({ minutes_semaine: Math.round((nombre(e.target.value) ?? 0) * 60) })} />
          <Champ etiquette="Durée maximale d’une séance (minutes)" inputMode="numeric" value={p.duree_max_min || ''} onChange={(e) => maj({ duree_max_min: nombre(e.target.value) ?? 0 })} />
        </div>
      </Carte>

      <Carte titre="Ton expérience">
        <div className="flex flex-col gap-4">
          <Champ etiquette="Depuis combien d’années t’entraînes-tu régulièrement ?" inputMode="decimal" aide="0,5 = 6 mois" value={p.annees_pratique || ''} onChange={(e) => maj({ annees_pratique: nombre(e.target.value) ?? 0 })} />
          {p.disciplines.includes('velo') && (
            <Champ etiquette="Vélo : heures par semaine, ces 4 dernières semaines" inputMode="decimal" value={heures(p.volume_velo_min)} onChange={(e) => maj({ volume_velo_min: Math.round((nombre(e.target.value) ?? 0) * 60) })} />
          )}
          {p.disciplines.includes('course') && (
            <Champ etiquette="Course : heures par semaine, ces 4 dernières semaines" inputMode="decimal" value={heures(p.volume_course_min)} onChange={(e) => maj({ volume_course_min: Math.round((nombre(e.target.value) ?? 0) * 60) })} />
          )}
          <OuiNon etiquette="Tu fais des compétitions ?" valeur={p.competitions} onChange={(v) => maj({ competitions: v })} />
          <Zone etiquette="Blessures ces 12 derniers mois (facultatif)" value={p.blessures} onChange={(e) => maj({ blessures: e.target.value })} />
        </div>
      </Carte>

      <Carte titre="Ton matériel">
        <div className="flex flex-col gap-3">
          {p.disciplines.includes('velo') && <OuiNon etiquette="Capteur de puissance sur le vélo" valeur={p.capteur_puissance} onChange={(v) => maj({ capteur_puissance: v })} />}
          <OuiNon etiquette="Cardiofréquencemètre (ceinture ou montre)" valeur={p.cardio} onChange={(v) => maj({ cardio: v })} />
          <OuiNon etiquette="Montre GPS" valeur={p.montre_gps} onChange={(v) => maj({ montre_gps: v })} />
          <OuiNon etiquette="Montre qui mesure la VFC le matin" valeur={p.montre_vfc} onChange={(v) => maj({ montre_vfc: v })} />
        </div>
      </Carte>

      <Carte titre="Ta santé">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Champ etiquette="Âge" inputMode="numeric" value={p.age ?? ''} onChange={(e) => maj({ age: nombre(e.target.value) })} />
            <Champ etiquette="FC max" inputMode="numeric" placeholder="si connue" value={p.fc_max ?? ''} onChange={(e) => maj({ fc_max: nombre(e.target.value) })} />
            <Champ etiquette="FC repos" inputMode="numeric" placeholder="si connue" value={p.fc_repos ?? ''} onChange={(e) => maj({ fc_repos: nombre(e.target.value) })} />
          </div>
          <Zone etiquette="Médicaments pris régulièrement (facultatif)" placeholder="certains, comme les bêtabloquants, changent la fréquence cardiaque" value={p.medicaments} onChange={(e) => maj({ medicaments: e.target.value })} />
          {!initial && (
            <>
              <p className="text-sm text-texte-2">Questionnaire santé (PAR-Q+) : un seul « oui » et ton coach attendra l’avis d’un médecin avant de te proposer de l’intensité.</p>
              {PARQ.map((q, i) => (
                <OuiNon key={q} etiquette={q} valeur={parq[i]} onChange={(v) => setParq(parq.map((r, k) => (k === i ? v : r)))} />
              ))}
            </>
          )}
        </div>
      </Carte>

      {manque.length > 0 && <Message>Il manque : {manque.join(', ')}.</Message>}
      <Bouton onClick={enregistrer} disabled={occupe || manque.length > 0}>
        {occupe ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Envoyer à mon coach'}
      </Bouton>
      {erreur && <Message type="erreur">{erreur}</Message>}
    </Page>
  )
}
