import { messageErreur } from '../../core/compte'
import { seancesEntre, testsDe, useCharge } from '../../core/donnees'
import { activitesEntre, type Activite } from '../../core/intervals'
import type { Client } from '../../core/supabase'
import { Carte, Chargement, Message } from '../../core/ui'
import { Aide } from '../../core/ui/cadre'
import { GraphiqueBarres, GraphiqueLignes, SERIES } from '../../core/ui/graphiques'
import { ajouterJours, jour, lundiDe, versDate } from '../../moteur/dates'
import { chrono } from '../../moteur/tests'
import type { Test } from '../../moteur/types'
import { heures } from './VueSemaines'

const LIBELLE_TEST: Record<Test['type'], string> = { cp: 'CP vélo', vma: 'VMA', reference: 'Parcours de référence' }
const jj = (d: string) => versDate(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })
const virgule = (n: number, d = 0) => n.toFixed(d).replace('.', ',')

function valeurTest(t: Test): string {
  if (t.type === 'cp') return `${Math.round(t.valeur)} W`
  if (t.type === 'vma') return `${virgule(t.valeur, 1)} km/h`
  return chrono(t.valeur)
}

/** Efficacité aérobie : watts par battement sur les sorties faciles d'au moins 45 min (moyenne), comme dans Coach. */
function efficacite(activites: Activite[]): number | undefined {
  const v = activites
    .filter((a) => a.sport === 'velo' && a.duree_s >= 45 * 60 && a.puissance_moy && a.fc_moy && a.fc_moy > 60)
    .map((a) => a.puissance_moy! / a.fc_moy!)
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : undefined
}

function Tuile({ libelle, valeur, aide, sous, evolution, hausse }: { libelle: string; valeur: string; aide?: string; sous?: string; evolution?: string; hausse?: boolean }) {
  return (
    <div className="rounded-xl border border-bordure bg-surface p-2.5 text-center">
      <p className="text-xs text-texte-3">
        {libelle}
        {aide && <Aide titre={libelle} texte={aide} />}
      </p>
      <p className="text-xl font-bold tabular-nums">{valeur}</p>
      {evolution && <p className={`text-xs font-semibold ${hausse ? 'text-succes' : 'text-[#f87171]'}`}>{hausse ? '▲' : '▼'} {evolution}</p>}
      {sous && <p className="text-[11px] text-texte-3">{sous}</p>}
    </div>
  )
}

const pourcent = (a?: number, b?: number) => (a !== undefined && b ? Math.round(((a - b) / b) * 100) : undefined)
const signe = (n?: number) => (n === undefined ? undefined : `${n >= 0 ? '+' : ''}${n} %`)

/** Progrès (comme Coach) : 4 repères, l'évolution des tests, les prochains tests et les semaines d'entraînement. */
export function Progres({ client, eleve }: { client: Client; eleve: string }) {
  const aujourdhui = jour()
  const lundi = lundiDe(aujourdhui)
  const debut = ajouterJours(lundi, -49)
  const { donnees, erreur } = useCharge(async () => {
    const [seances, tests, activites] = await Promise.all([
      seancesEntre(client, eleve, ajouterJours(aujourdhui, -56), ajouterJours(lundi, 13)),
      testsDe(client, eleve),
      activitesEntre(client, eleve, ajouterJours(aujourdhui, -56), aujourdhui).catch(() => [] as Activite[]),
    ])
    return { seances, tests, activites }
  }, [client, eleve, aujourdhui, lundi])
  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!donnees) return <Chargement />

  const il28 = ajouterJours(aujourdhui, -28)
  const faites = (de: string, a: string) => donnees.seances.filter((s) => s.statut === 'faite' && s.date >= de && s.date < a)
  const minutes = (l: typeof donnees.seances) => l.filter((s) => s.sport !== 'renfo').reduce((t, s) => t + (s.duree_reelle_min ?? s.duree_min), 0)
  const min28 = minutes(faites(il28, aujourdhui))
  const min28Avant = minutes(faites(ajouterJours(aujourdhui, -56), il28))
  const passees = donnees.seances.filter((s) => s.date >= il28 && s.date < aujourdhui && s.statut !== 'proposee')
  const prevues = passees.filter((s) => s.statut === 'faite' || s.statut === 'validee' || (s.statut === 'annulee' && s.avant_ajustement === null)).length
  const regularite = prevues ? Math.round((passees.filter((s) => s.statut === 'faite').length / prevues) * 100) : undefined
  const effRecente = efficacite(donnees.activites.filter((a) => a.date >= il28))
  const effAvant = efficacite(donnees.activites.filter((a) => a.date < il28))
  const cp = donnees.tests.filter((t) => t.type === 'cp')
  const [dernierCp, avantCp] = cp
  const vma = donnees.tests.filter((t) => t.type === 'vma')
  const principal = dernierCp ?? vma[0]
  const precedent = dernierCp ? avantCp : vma[1]
  const chronologie = [...(dernierCp ? cp : vma)].reverse()
  const aVenir = donnees.seances.filter((s) => s.categorie === 'test' && s.date >= aujourdhui && s.statut !== 'annulee')

  const semaines = Array.from({ length: 8 }, (_, i) => ajouterJours(debut, 7 * i))
  const parSemaine = (sport: string) =>
    semaines.map((l) => donnees.seances.filter((s) => s.statut === 'faite' && s.sport === sport && s.date >= l && s.date <= ajouterJours(l, 6)).reduce((t, s) => t + (s.duree_reelle_min ?? s.duree_min), 0))

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Tuile
          libelle={principal ? LIBELLE_TEST[principal.type] : 'CP vélo'}
          valeur={principal ? valeurTest(principal) : '–'}
          sous={principal ? `test du ${jj(principal.date)}` : 'au premier test'}
          evolution={principal && precedent ? signe(pourcent(principal.valeur, precedent.valeur)) : undefined}
          hausse={principal && precedent ? principal.valeur >= precedent.valeur : undefined}
        />
        <Tuile
          libelle="Efficacité"
          aide="Watts produits par battement de cœur sur tes sorties à vélo d’au moins 45 min, ces 28 derniers jours. Si le chiffre monte, tu produis plus de watts pour le même cœur : ton endurance progresse. Il faut un capteur de puissance et une ceinture (ou une montre) cardio."
          valeur={effRecente ? virgule(effRecente, 2) : '–'}
          sous="W par bpm"
          evolution={signe(pourcent(effRecente, effAvant))}
          hausse={effRecente && effAvant ? effRecente >= effAvant : undefined}
        />
        <Tuile
          libelle="Régularité 28 j"
          aide="Séances faites sur les séances prévues ces 4 dernières semaines (les séances allégées par le feu comptent comme prévues). La régularité fait plus progresser que n’importe quelle séance."
          valeur={regularite !== undefined ? `${regularite} %` : '–'}
          sous={regularite !== undefined ? (regularite >= 90 ? 'top' : regularite >= 70 ? 'bien' : 'parles-en à ton coach') : 'pas encore de séance'}
        />
        <Tuile libelle="Entraînement 28 j" valeur={heures(min28)} sous="vs 28 j d’avant" evolution={signe(pourcent(min28, min28Avant))} hausse={min28Avant ? min28 >= min28Avant : undefined} />
      </div>

      <Carte titre="Évolution de mes tests">
        {chronologie.length === 0 ? (
          <p className="text-sm text-texte-3">Ton premier test donnera ton point de départ.</p>
        ) : (
          <>
            {chronologie.length >= 2 && (
              <GraphiqueLignes
                etiquettes={chronologie.map((t) => jj(t.date))}
                format={(n) => (dernierCp ? `${Math.round(n)} W` : `${virgule(n, 1)} km/h`)}
                series={[{ nom: dernierCp ? 'CP (W)' : 'VMA (km/h)', couleur: SERIES[0], valeurs: chronologie.map((t) => t.valeur) }]}
              />
            )}
            <ul className="mt-2 text-sm">
              {donnees.tests.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-2 border-t border-bordure py-1.5 first:border-0">
                  <span className="text-texte-2">
                    {LIBELLE_TEST[t.type]} · {versDate(t.date).toLocaleDateString('fr-FR')}
                  </span>
                  <b>{valeurTest(t)}</b>
                </li>
              ))}
            </ul>
          </>
        )}
      </Carte>

      <Carte titre="Mes prochains tests">
        <p className="text-sm text-texte-2">Chaque test met à jour tes cibles : les watts ou les allures de tes séances à venir.</p>
        {aVenir.length ? (
          <ul className="mt-2 text-sm">
            {aVenir.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-2 py-1">
                <b className="shrink-0 capitalize">{versDate(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</b>
                <span className="text-right text-texte-3">{s.titre}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-texte-3">Aucun dans les 2 semaines à venir : ton coach en place un toutes les 6 à 8 semaines, frais, après une semaine allégée.</p>
        )}
      </Carte>

      <Carte titre="Ma semaine d’entraînement">
        <p className="text-sm text-texte-2">Minutes faites par semaine</p>
        <GraphiqueBarres
          etiquettes={semaines.map(jj)}
          series={[
            { nom: 'Vélo', couleur: SERIES[0], valeurs: parSemaine('velo') },
            { nom: 'Course', couleur: SERIES[1], valeurs: parSemaine('course') },
            { nom: 'Renfo', couleur: SERIES[2], valeurs: parSemaine('renfo') },
          ].filter((x) => x.valeurs.some((v) => v > 0))}
          format={(n) => `${Math.round(n)} min`}
        />
      </Carte>
    </>
  )
}
