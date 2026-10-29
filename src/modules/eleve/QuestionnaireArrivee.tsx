import { useState } from 'react'
import { messageErreur } from '../../core/compte'
import { enregistrerObjectifs, enregistrerProfilSportif } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Champ, Message, OuiNon, Page, Zone } from '../../core/ui'
import { jour, lundiDe, NOMS_JOURS } from '../../moteur/dates'
import { param } from '../../moteur/objectifs'
import type { Objectif, ProfilSportif, Sport } from '../../moteur/types'
import { nouvelObjectif, ObjectifsEditeur } from '../commun/ObjectifsEditeur'

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

const DUREES = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360]

type Brouillon = Omit<ProfilSportif, 'avis_medical' | 'avis_kine' | 'cp' | 'vma' | 'eleve_id' | 'debut' | 'parq_oui'>

const VIDE: Brouillon = {
  disciplines: [],
  objectif: '',
  date_objectif: null,
  duree_epreuve: null,
  jours_dispo: [],
  minutes_semaine: 0,
  duree_max_min: 0,
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
  sport_principal: null,
  minutes_jour: [0, 0, 0, 0, 0, 0, 0],
  jour_longue: null,
  jours_sans_intense: [],
  jours_club: [],
  exterieur: true,
  home_trainer: false,
  tapis: false,
  piste: false,
  cotes: false,
  renfo: false,
  longue_course_min: null,
  longue_velo_min: null,
  blessure_recente: false,
  fracture_fatigue: false,
  diabete: false,
  travail_poste: false,
  grossesse: false,
  post_partum: false,
  regime_restrictif: false,
  trouble_alimentaire: false,
}

const nombre = (v: string) => (v === '' ? null : Number(v.replace(',', '.')))
const heures = (minutes: number) => (minutes ? String(Math.round((minutes / 60) * 10) / 10) : '')
const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])

function Bascule({ actif, children, onClick }: { actif: boolean; children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl px-4 py-2.5 text-sm ${actif ? 'bg-accent font-semibold text-fond' : 'bg-surface-2 text-texte-2'}`}>
      {children}
    </button>
  )
}

function Jours({ etiquette, valeur, permis, onChange }: { etiquette: string; valeur: number[]; permis?: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-texte-2">{etiquette}</span>
      <div className="flex gap-1">
        {NOMS_JOURS.map((n, i) => (
          <button
            key={n}
            type="button"
            disabled={permis && !permis.includes(i)}
            onClick={() => onChange(basculer(valeur, i))}
            className={`h-10 flex-1 rounded-lg text-sm capitalize disabled:opacity-30 ${valeur.includes(i) ? 'bg-accent font-semibold text-fond' : 'bg-surface-2 text-texte-2'}`}
          >
            {n.slice(0, 2)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function QuestionnaireArrivee({
  client,
  eleve,
  initial,
  objectifsInitiaux,
  termine,
  annuler,
}: {
  client: Client
  eleve: string
  initial?: ProfilSportif | null
  objectifsInitiaux?: Objectif[]
  termine: () => void
  annuler?: () => void
}) {
  const depuisInitial = (): Brouillon => {
    if (!initial) return VIDE
    const minutes_jour = initial.minutes_jour?.length === 7 ? initial.minutes_jour : Array.from({ length: 7 }, (_, j) => (initial.jours_dispo.includes(j) ? initial.duree_max_min : 0))
    return { ...VIDE, ...initial, minutes_jour }
  }
  const [p, setP] = useState<Brouillon>(depuisInitial)
  const [objectifs, setObjectifs] = useState<Objectif[]>(objectifsInitiaux?.length ? objectifsInitiaux : [nouvelObjectif()])
  const [parq, setParq] = useState<(boolean | null)[]>(PARQ.map(() => null))
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const maj = (champs: Partial<Brouillon>) => setP((x) => ({ ...x, ...champs }))

  const minutes = p.minutes_jour ?? [0, 0, 0, 0, 0, 0, 0]
  const joursDispo = minutes.map((m, j) => (m > 0 ? j : -1)).filter((j) => j >= 0)
  const total = minutes.reduce((a, b) => a + b, 0)
  const perteDePoids = objectifs.some((o) => o.type === 'perte-poids')
  const competitifSansDate = objectifs.some((o) => param(o.type).competitif && !o.date)

  const manque = [
    !p.disciplines.length && 'ton ou tes sports',
    !objectifs.length && 'au moins un objectif',
    competitifSansDate && 'la date de chaque épreuve',
    total < 30 && 'ton temps disponible',
    !initial && parq.some((r) => r === null) && 'les questions santé',
  ].filter(Boolean)

  async function enregistrer() {
    setOccupe(true)
    setErreur('')
    try {
      const principal = objectifs.find((o) => o.priorite === 'A') ?? objectifs[0]
      await enregistrerProfilSportif(client, {
        ...p,
        eleve_id: eleve,
        cp: initial?.cp ?? null,
        vma: initial?.vma ?? null,
        debut: initial?.debut ?? lundiDe(jour()),
        parq_oui: initial && parq.every((r) => r === null) ? initial.parq_oui : parq.some((r) => r === true),
        jours_dispo: joursDispo,
        minutes_semaine: Math.max(30, total),
        duree_max_min: Math.max(20, ...minutes),
        objectif: principal ? principal.nom || param(principal.type).libelle : '',
        date_objectif: principal?.date ?? null,
        duree_epreuve: principal?.date ? (param(principal.type).dureeEpreuve > 60 ? 'longue' : 'courte') : null,
        sport_principal: p.disciplines.length === 2 ? p.sport_principal : null,
        jours_sans_intense: p.jours_sans_intense.filter((j) => joursDispo.includes(j)),
        jours_club: p.jours_club.filter((j) => joursDispo.includes(j)),
        jour_longue: p.jour_longue != null && joursDispo.includes(p.jour_longue) ? p.jour_longue : null,
        fracture_fatigue: p.blessure_recente && p.fracture_fatigue,
        regime_restrictif: perteDePoids && p.regime_restrictif,
        trouble_alimentaire: perteDePoids && p.trouble_alimentaire,
      })
      await enregistrerObjectifs(client, eleve, objectifs)
      termine()
    } catch (e) {
      setErreur(messageErreur(e))
    }
    setOccupe(false)
  }

  const selectClasse = 'rounded-xl border border-bordure bg-surface-2 px-3 py-2.5 text-base text-texte'

  return (
    <Page surtitre="Suivi Coaching" titre={initial ? 'Mon profil' : 'Faisons connaissance'} action={annuler && <Bouton variante="discret" onClick={annuler}>Fermer</Bouton>}>
      {!initial && <Message>Ces réponses permettent de te préparer un programme vraiment adapté. Compte 5 à 10 minutes.</Message>}

      <Carte titre="Tes sports">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {(['velo', 'course'] as Sport[]).map((s) => (
              <Bascule key={s} actif={p.disciplines.includes(s)} onClick={() => maj({ disciplines: basculer(p.disciplines, s) })}>
                {s === 'velo' ? '🚴 Vélo' : '🏃 Course à pied'}
              </Bascule>
            ))}
          </div>
          {p.disciplines.length === 2 && (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-texte-2">Ton sport principal</span>
              <div className="flex gap-2">
                <Bascule actif={p.sport_principal === 'velo'} onClick={() => maj({ sport_principal: 'velo' })}>Vélo</Bascule>
                <Bascule actif={p.sport_principal === 'course'} onClick={() => maj({ sport_principal: 'course' })}>Course</Bascule>
                <Bascule actif={!p.sport_principal} onClick={() => maj({ sport_principal: null })}>Les deux</Bascule>
              </div>
            </div>
          )}
        </div>
      </Carte>

      <Carte titre="Tes objectifs">
        <p className="mb-3 text-sm text-texte-2">Une course, un défi, la forme, la reprise… Ajoute-en plusieurs si tu as plusieurs rendez-vous dans la saison.</p>
        <ObjectifsEditeur objectifs={objectifs} onChange={setObjectifs} />
      </Carte>

      <Carte titre="Ton temps">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-texte-2">Combien de temps peux-tu t’entraîner chaque jour, au maximum ?</p>
          {NOMS_JOURS.map((n, j) => (
            <label key={n} className="flex items-center justify-between gap-3">
              <span className="text-sm capitalize">{n}</span>
              <select className={selectClasse} value={minutes[j]} onChange={(e) => maj({ minutes_jour: minutes.map((m, k) => (k === j ? Number(e.target.value) : m)) })}>
                {DUREES.map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? 'pas dispo' : d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60}` : ''}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p className="text-xs text-texte-3">Total : {heures(total) || 0} h par semaine</p>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-texte-2">Jour préféré pour la sortie longue</span>
            <select className={selectClasse} value={p.jour_longue ?? ''} onChange={(e) => maj({ jour_longue: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">peu importe</option>
              {joursDispo.map((j) => (
                <option key={j} value={j}>
                  {NOMS_JOURS[j]}
                </option>
              ))}
            </select>
          </label>
          <Jours etiquette="Jours où tu ne peux pas faire de séance intense (travail, fatigue…)" valeur={p.jours_sans_intense} permis={joursDispo} onChange={(v) => maj({ jours_sans_intense: v })} />
          <Jours etiquette="Jours de sortie en club ou en groupe (comptées comme intenses)" valeur={p.jours_club} permis={joursDispo} onChange={(v) => maj({ jours_club: v })} />
        </div>
      </Carte>

      <Carte titre="Où tu t’entraînes">
        <div className="flex flex-col gap-3">
          <OuiNon etiquette="Dehors" valeur={p.exterieur} onChange={(v) => maj({ exterieur: v })} />
          {p.disciplines.includes('velo') && <OuiNon etiquette="Home trainer" valeur={p.home_trainer} onChange={(v) => maj({ home_trainer: v })} />}
          {p.disciplines.includes('course') && <OuiNon etiquette="Tapis de course" valeur={p.tapis} onChange={(v) => maj({ tapis: v })} />}
          {p.disciplines.includes('course') && <OuiNon etiquette="Piste d’athlétisme accessible" valeur={p.piste} onChange={(v) => maj({ piste: v })} />}
          <OuiNon etiquette="Des côtes près de chez toi" valeur={p.cotes} onChange={(v) => maj({ cotes: v })} />
        </div>
      </Carte>

      <Carte titre="Ton expérience">
        <div className="flex flex-col gap-4">
          <Champ etiquette="Depuis combien d’années t’entraînes-tu régulièrement ?" inputMode="decimal" aide="0,5 = 6 mois" value={p.annees_pratique || ''} onChange={(e) => maj({ annees_pratique: nombre(e.target.value) ?? 0 })} />
          {p.disciplines.includes('velo') && (
            <div className="grid grid-cols-2 gap-2">
              <Champ etiquette="Vélo : h/semaine (4 dernières sem.)" inputMode="decimal" value={heures(p.volume_velo_min)} onChange={(e) => maj({ volume_velo_min: Math.round((nombre(e.target.value) ?? 0) * 60) })} />
              <Champ etiquette="Plus longue sortie du mois (min)" inputMode="numeric" value={p.longue_velo_min ?? ''} onChange={(e) => maj({ longue_velo_min: nombre(e.target.value) })} />
            </div>
          )}
          {p.disciplines.includes('course') && (
            <div className="grid grid-cols-2 gap-2">
              <Champ etiquette="Course : h/semaine (4 dernières sem.)" inputMode="decimal" value={heures(p.volume_course_min)} onChange={(e) => maj({ volume_course_min: Math.round((nombre(e.target.value) ?? 0) * 60) })} />
              <Champ etiquette="Plus longue course du mois (min)" inputMode="numeric" value={p.longue_course_min ?? ''} onChange={(e) => maj({ longue_course_min: nombre(e.target.value) })} />
            </div>
          )}
          <OuiNon etiquette="Tu fais des compétitions ?" valeur={p.competitions} onChange={(v) => maj({ competitions: v })} />
          <OuiNon etiquette="Une blessure ces 12 derniers mois ?" valeur={p.blessure_recente} onChange={(v) => maj({ blessure_recente: v })} />
          {p.blessure_recente && (
            <>
              <Zone etiquette="Laquelle ?" value={p.blessures} onChange={(e) => maj({ blessures: e.target.value })} />
              {p.disciplines.includes('course') && <OuiNon etiquette="Était-ce une fracture de fatigue ?" valeur={p.fracture_fatigue} onChange={(v) => maj({ fracture_fatigue: v })} />}
            </>
          )}
          <OuiNon etiquette="D’accord pour 2 séances de renfo par semaine (20-30 min, peu de matériel) ?" valeur={p.renfo} onChange={(v) => maj({ renfo: v })} />
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
          <OuiNon etiquette="Diabète ?" valeur={p.diabete} onChange={(v) => maj({ diabete: v })} />
          <OuiNon etiquette="Travail de nuit ou en horaires décalés ?" valeur={p.travail_poste} onChange={(v) => maj({ travail_poste: v })} />
          <p className="text-xs text-texte-3">Si tu es concernée (facultatif) :</p>
          <OuiNon etiquette="Enceinte actuellement ?" valeur={p.grossesse} onChange={(v) => maj({ grossesse: v })} />
          <OuiNon etiquette="Accouchement il y a moins de 12 mois ?" valeur={p.post_partum} onChange={(v) => maj({ post_partum: v })} />
          {perteDePoids && (
            <>
              <OuiNon etiquette="Suis-tu un régime alimentaire strict en ce moment ?" valeur={p.regime_restrictif} onChange={(v) => maj({ regime_restrictif: v })} />
              <OuiNon etiquette="As-tu déjà eu un trouble du comportement alimentaire ?" valeur={p.trouble_alimentaire} onChange={(v) => maj({ trouble_alimentaire: v })} />
            </>
          )}
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
