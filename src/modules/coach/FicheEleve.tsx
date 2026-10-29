import { useCallback, useState, type ReactNode } from 'react'
import { allerA } from '../../core/adresse'
import { messageErreur } from '../../core/compte'
import {
  ajouterSeanceMain,
  alertesNonVues,
  enregistrerTest,
  marquerAlerteVue,
  matinsDepuis,
  modifierProfilParCoach,
  profilSportif,
  proposerSemaine,
  seancesEntre,
  useCharge,
} from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Champ, Chargement, Message, Page, Pastille, Zone } from '../../core/ui'
import { ajouterJours, jour, lundiDe, NOMS_JOURS, versDate } from '../../moteur/dates'
import { feuDuJour, LIBELLE_FEU } from '../../moteur/feu'
import { LIBELLE_PHASE, phaseDeLaSemaine } from '../../moteur/phase'
import { LIBELLE_NIVEAU, niveau } from '../../moteur/profil'
import type { Categorie, ProfilSportif, Sport } from '../../moteur/types'
import { Messages } from '../commun/Messages'
import { Progres } from '../commun/Progres'
import { Semaines } from '../eleve/Programme'
import { CarteSeance } from '../commun/CarteSeance'
import { AValider } from './AValider'

const h = (min: number) => `${Math.round((min / 60) * 10) / 10} h`

function Resume({ p }: { p: ProfilSportif }) {
  const ph = phaseDeLaSemaine(p, lundiDe(jour()))
  const lignes: [string, string][] = [
    ['Niveau', LIBELLE_NIVEAU[niveau(p)]],
    ['Sports', p.disciplines.map((s) => (s === 'velo' ? 'vélo' : 'course')).join(' + ')],
    ['Objectif', `${p.objectif || '—'}${p.date_objectif ? ` · ${versDate(p.date_objectif).toLocaleDateString('fr-FR')} (${p.duree_epreuve === 'longue' ? '> 1 h' : '< 1 h'})` : ''}`],
    ['Phase', `${LIBELLE_PHASE[ph.phase]}${ph.semainesAvant !== null ? ` · J-${Math.max(0, Math.round((versDate(p.date_objectif!).getTime() - Date.now()) / 86_400_000))}` : ''}`],
    ['Disponible', `${p.jours_dispo.slice().sort().map((j) => NOMS_JOURS[j].slice(0, 3)).join(', ')} · ${h(p.minutes_semaine)}/sem · ${p.duree_max_min} min max`],
    ['Volume déclaré', `vélo ${h(p.volume_velo_min)} · course ${h(p.volume_course_min)} · ${p.annees_pratique} an(s)${p.competitions ? ' · compétitions' : ''}`],
    ['Matériel', [p.capteur_puissance && 'capteur', p.cardio && 'cardio', p.montre_gps && 'GPS', p.montre_vfc && 'VFC'].filter(Boolean).join(', ') || 'aucun'],
    ['Repères', `CP ${p.cp ? `${p.cp} W` : '—'} · VMA ${p.vma ? `${p.vma} km/h` : '—'} · FC max ${p.fc_max ?? '—'} · âge ${p.age ?? '—'}`],
  ]
  if (p.blessures) lignes.push(['Blessures', p.blessures])
  if (p.medicaments) lignes.push(['Médicaments', p.medicaments])
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
      {lignes.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-texte-3">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function AjoutSeance({ client, eleve, fini }: { client: Client; eleve: string; fini: () => void }) {
  const [date, setDate] = useState(ajouterJours(jour(), 1))
  const [sport, setSport] = useState<Sport>('velo')
  const [categorie, setCategorie] = useState<Categorie>('facile')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [duree, setDuree] = useState('60')
  const [erreur, setErreur] = useState('')

  async function ajouter() {
    try {
      await ajouterSeanceMain(client, { eleve_id: eleve, date, sport, categorie, titre: titre.trim(), description: description.trim(), duree_min: Number(duree) })
      fini()
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  const choix = 'flex-1 rounded-xl border border-bordure bg-surface-2 px-3 py-3 text-sm text-texte'
  return (
    <div className="flex flex-col gap-3">
      <Champ etiquette="Date" type="date" value={date} min={jour()} onChange={(e) => setDate(e.target.value)} />
      <div className="flex gap-2">
        <select className={choix} value={sport} onChange={(e) => setSport(e.target.value as Sport)}>
          <option value="velo">Vélo</option>
          <option value="course">Course</option>
        </select>
        <select className={choix} value={categorie} onChange={(e) => setCategorie(e.target.value as Categorie)}>
          <option value="facile">Facile</option>
          <option value="longue">Sortie longue</option>
          <option value="intense">Intense</option>
        </select>
      </div>
      <Champ etiquette="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      <Zone etiquette="Consignes" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Champ etiquette="Durée (minutes)" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} />
      <Bouton onClick={ajouter} disabled={!titre.trim() || !(Number(duree) > 0)}>
        Ajouter (validée directement)
      </Bouton>
      {erreur && <Message type="erreur">{erreur}</Message>}
    </div>
  )
}

function SaisieTest({ client, eleve, fini }: { client: Client; eleve: string; fini: () => void }) {
  const [type, setType] = useState<'cp' | 'vma'>('cp')
  const [valeur, setValeur] = useState('')
  const [erreur, setErreur] = useState('')
  async function enregistrer() {
    try {
      await enregistrerTest(client, { eleve_id: eleve, date: jour(), sport: type === 'cp' ? 'velo' : 'course', type, valeur: Number(valeur.replace(',', '.')), details: { saisiPar: 'coach' } })
      fini()
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <select className="rounded-xl border border-bordure bg-surface-2 px-3 py-3 text-sm text-texte" value={type} onChange={(e) => setType(e.target.value as 'cp' | 'vma')}>
          <option value="cp">CP (W)</option>
          <option value="vma">VMA (km/h)</option>
        </select>
        <input className="min-w-0 flex-1 rounded-xl border border-bordure bg-surface-2 px-4 py-3 text-base text-texte" inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} />
      </div>
      <Bouton onClick={enregistrer} disabled={!(Number(valeur.replace(',', '.')) > 0)}>
        Enregistrer le test
      </Bouton>
      {erreur && <Message type="erreur">{erreur}</Message>}
    </div>
  )
}

export function FicheEleve({ client, id, moi, barre }: { client: Client; id: string; moi: string; barre: ReactNode }) {
  const aujourdhui = jour()
  const lundi = lundiDe(aujourdhui)
  const charger = useCallback(async () => {
    const [nom, profil, seances, matins, alertes] = await Promise.all([
      client.from('profils').select('nom, cree_le').eq('id', id).eq('role', 'eleve').maybeSingle(),
      profilSportif(client, id),
      seancesEntre(client, id, ajouterJours(aujourdhui, -21), ajouterJours(lundi, 13)),
      matinsDepuis(client, id, ajouterJours(aujourdhui, -60)),
      alertesNonVues(client, id),
    ])
    if (nom.error) throw nom.error
    return { eleve: nom.data as { nom: string; cree_le: string } | null, profil, seances, matins, alertes }
  }, [client, id, aujourdhui, lundi])
  const { donnees: d, erreur, recharger } = useCharge(charger, [charger])
  const [ouvert, setOuvert] = useState<'' | 'ajout' | 'test'>('')
  const [occupe, setOccupe] = useState(false)
  const [erreurAction, setErreurAction] = useState('')
  const [version, setVersion] = useState(0)
  const rafraichir = () => (recharger(), setVersion((v) => v + 1))

  async function agir(action: () => Promise<unknown>) {
    setOccupe(true)
    setErreurAction('')
    try {
      await action()
      rafraichir()
    } catch (e) {
      setErreurAction(messageErreur(e))
    }
    setOccupe(false)
  }

  const retour = (
    <Bouton variante="discret" onClick={() => allerA('')}>
      ‹ Élèves
    </Bouton>
  )
  if (erreur) return <Page titre="Élève" action={retour} barre={barre}><Message type="erreur">{messageErreur(erreur)}</Message></Page>
  if (!d) return <Page titre="…" action={retour} barre={barre}><Chargement /></Page>
  if (!d.eleve) return <Page titre="Élève" action={retour} barre={barre}><Message type="erreur">Cet élève n’existe pas ou n’est pas suivi par toi.</Message></Page>

  const p = d.profil
  const matin = d.matins.find((m) => m.date === aujourdhui)
  const signal = matin ? feuDuJour(matin, d.matins.filter((m) => m.date < aujourdhui), d.seances) : null
  const faites = d.seances.filter((s) => s.statut === 'faite' && s.date < lundi).reverse()

  return (
    <Page surtitre={`Élève · suivi depuis le ${new Date(d.eleve.cree_le).toLocaleDateString('fr-FR')}`} titre={d.eleve.nom || 'Sans prénom'} action={retour} barre={barre}>
      {!p ? (
        <Carte>
          <Message>N’a pas encore rempli son questionnaire d’arrivée. Son programme sera proposé dès que ce sera fait.</Message>
        </Carte>
      ) : (
        <>
          {p.parq_oui && !p.avis_medical && (
            <Carte>
              <p className="font-semibold text-alerte">Questionnaire santé : au moins un « oui »</p>
              <p className="mt-1 text-sm text-texte-2">Pas d’intensité ni de test à fond tant que tu n’as pas eu le feu vert d’un médecin.</p>
              <Bouton className="mt-3 w-full" disabled={occupe} onClick={() => agir(() => modifierProfilParCoach(client, id, { avis_medical: true }))}>
                Avis médical favorable reçu
              </Bouton>
            </Carte>
          )}

          {d.alertes.length > 0 && (
            <Carte titre="Alertes">
              <ul className="flex flex-col divide-y divide-bordure">
                {d.alertes.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                    <span>
                      {a.texte}
                      <span className="block text-xs text-texte-3">{new Date(a.cree_le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    <Bouton variante="lien" className="shrink-0 text-sm" onClick={() => agir(() => marquerAlerteVue(client, a.id))}>
                      Vu
                    </Bouton>
                  </li>
                ))}
              </ul>
            </Carte>
          )}

          <Carte titre="Aujourd’hui">
            {signal ? (
              <>
                <p className="font-semibold">{LIBELLE_FEU[signal.feu]}</p>
                {signal.raisons.length > 0 && <p className="text-sm text-texte-2">{signal.raisons.join(' · ')}</p>}
                <p className="mt-1 text-xs text-texte-3">
                  Sommeil {matin!.sommeil_h} h · forme {[matin!.sommeil_q, matin!.fatigue, matin!.courbatures, matin!.stress, matin!.humeur].join('/')}
                </p>
              </>
            ) : (
              <Message>Questionnaire du matin pas encore rempli.</Message>
            )}
          </Carte>

          <AValider key={version} client={client} eleve={id} auChangement={rafraichir} />

          <Semaines seances={d.seances.filter((s) => s.statut !== 'proposee')} profil={p} lundi={lundi} avecStatut />
          <div className="flex gap-2">
            <Bouton variante="discret" className="flex-1" disabled={occupe} onClick={() => agir(() => proposerSemaine(client, id, ajouterJours(lundi, 7), ajouterJours(lundi, 7)))}>
              Proposer la semaine prochaine
            </Bouton>
            <Bouton variante="discret" className="flex-1" onClick={() => setOuvert(ouvert === 'ajout' ? '' : 'ajout')}>
              Ajouter une séance
            </Bouton>
          </div>
          {ouvert === 'ajout' && (
            <Carte titre="Séance écrite à la main">
              <AjoutSeance client={client} eleve={id} fini={() => (setOuvert(''), rafraichir())} />
            </Carte>
          )}

          {faites.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="mt-2 text-sm font-semibold text-texte-3 uppercase">Séances faites avant cette semaine</h2>
              {faites.map((s) => (
                <CarteSeance key={s.id} seance={s} profil={p} avecDate />
              ))}
            </div>
          )}

          <Progres key={`progres-${version}`} client={client} eleve={id} />
          <Bouton variante="discret" onClick={() => setOuvert(ouvert === 'test' ? '' : 'test')}>
            Saisir un test (CP ou VMA)
          </Bouton>
          {ouvert === 'test' && (
            <Carte>
              <SaisieTest client={client} eleve={id} fini={() => (setOuvert(''), rafraichir())} />
            </Carte>
          )}

          <Carte titre="Profil">
            <Resume p={p} />
          </Carte>
        </>
      )}

      <Carte titre="Messages" action={<Pastille ton="neutre">💬</Pastille>}>
        <Messages client={client} eleve={id} moi={moi} />
      </Carte>
      {erreurAction && <Message type="erreur">{erreurAction}</Message>}
    </Page>
  )
}
