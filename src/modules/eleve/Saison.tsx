import { messageErreur } from '../../core/compte'
import { objectifsDe, seancesEntre, semainesDe, useCharge } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Carte, Chargement, Message } from '../../core/ui'
import { Aide } from '../../core/ui/cadre'
import { ajouterJours, ecartJours, jour, lundiDe, versDate } from '../../moteur/dates'
import { objectifPrincipal, param } from '../../moteur/objectifs'
import { LIBELLE_PHASE } from '../../moteur/phase'
import { BUT_PHASE, resumeObjectif, saison, type SemaineSaison } from '../../moteur/saison'
import type { Phase, ProfilSportif } from '../../moteur/types'
import { heures } from '../commun/VueSemaines'

/** Couleur de chaque phase (rampe validée sur fond sombre, reprise de Coach). */
const COULEURS: Record<Phase, string> = { base: '#86b6ef', developpement: '#3987e5', specifique: '#1c5cab', affutage: '#199e70' }
const NOM_FAMILLE: Record<string, string> = { vo2max: 'VO2max', seuil: 'seuil', anaerobie: 'anaérobie', tempo: 'tempo', sprint: 'sprints' }
const jm = (d: string) => versDate(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

const AIDE_PHASES =
  'Base : beaucoup d’endurance facile et de la force. Développement : les séances dures ciblent ce que demande ton objectif. Spécifique (3 semaines avant l’affûtage) : séances au rythme de la course. Affûtage : volume en baisse, intensité gardée, pour arriver frais (Bosquet 2007). Une semaine sur 4 est allégée.'

/** Saison (comme Coach) : où j'en suis, la frise des blocs, puis les semaines regroupées par bloc. */
export function Saison({ client, eleve, profil }: { client: Client; eleve: string; profil: ProfilSportif }) {
  const aujourdhui = jour()
  const lundi = lundiDe(aujourdhui)
  const { donnees, erreur } = useCharge(async () => {
    const [objectifs, seances, semaines] = await Promise.all([objectifsDe(client, eleve), seancesEntre(client, eleve, lundi, ajouterJours(lundi, 13)), semainesDe(client, eleve, lundi)])
    return { objectifs, seances, semaines }
  }, [client, eleve, lundi])
  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!donnees) return <Chargement />

  const { semaines, blocs } = saison(profil, donnees.objectifs, aujourdhui)
  const pp = param(objectifPrincipal(donnees.objectifs, aujourdhui).type)
  const bloc = blocs.find((b) => b.debut <= lundi && b.fin >= lundi) ?? blocs[0]
  const rang = Math.max(1, bloc.semaines.findIndex((s) => s.lundi === lundi) + 1)
  const prochain = blocs.find((b) => b.debut > lundi)
  const debut = semaines[0].lundi
  const fin = ajouterJours(semaines[semaines.length - 1].lundi, 7)
  const total = Math.max(1, ecartJours(debut, fin))
  const position = Math.min(100, Math.max(0, (ecartJours(debut, aujourdhui) / total) * 100))

  /** Ce que travaille la semaine : les vraies séances dures pour les 2 semaines préparées, sinon le but du bloc. */
  function contenu(s: SemaineSaison): { titre: string; sous?: string } {
    const prevues = donnees!.seances.filter((x) => x.date >= s.lundi && x.date <= ajouterJours(s.lundi, 6) && x.statut !== 'annulee')
    const info = donnees!.semaines.find((x) => x.lundi === s.lundi)
    const dures = prevues.filter((x) => x.categorie === 'intense' || x.categorie === 'test').map((x) => x.titre)
    const prevu = info ? ` · ${heures(prevues.filter((x) => x.sport !== 'renfo').reduce((t, x) => t + x.duree_min, 0))} prévues` : ''
    if (s.courses.length) return { titre: `🏁 ${s.courses.join(', ')}`, sous: prevu.slice(3) || undefined }
    if (dures.length) return { titre: dures.join(' · '), sous: prevu.slice(3) }
    if (s.recuperation) return { titre: 'Récupération après la course' }
    if (s.allegee) return { titre: 'Semaine allégée' }
    const titre = { base: 'Endurance et un peu d’intensité', developpement: `Dominante ${NOM_FAMILLE[pp.dominante] ?? pp.dominante}`, specifique: 'Séances au rythme de ton objectif', affutage: 'Moins de volume, intensité gardée' }[s.phase]
    return { titre, sous: prevu.slice(3) || undefined }
  }

  return (
    <>
      <Carte>
        <p className="text-xs tracking-wider text-texte-3 uppercase">Où j’en suis</p>
        <p className="mt-1 text-xl font-bold" style={{ color: COULEURS[bloc.phase] }}>
          {LIBELLE_PHASE[bloc.phase]}
        </p>
        <p className="text-texte-2">
          Semaine {rang} sur {bloc.semaines.length}
          {prochain && ` · ${LIBELLE_PHASE[prochain.phase]} dans ${Math.ceil(ecartJours(aujourdhui, prochain.debut) / 7)} sem.`}
          <Aide titre="Les blocs de ta saison" texte={AIDE_PHASES} />
        </p>
        <p className="mt-1 text-sm text-texte-3">{BUT_PHASE[bloc.phase]}</p>

        <div className="relative mt-4 h-3 overflow-hidden rounded-full">
          <div className="flex h-full">
            {blocs.map((b) => (
              <div key={b.debut} style={{ width: `${(b.semaines.length * 7 * 100) / total}%`, background: COULEURS[b.phase] }} />
            ))}
          </div>
        </div>
        <div className="relative h-4">
          <span className="absolute -top-1 -translate-x-1/2 text-xs" style={{ left: `${position}%` }}>
            ▲
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-texte-3">
          {blocs
            .filter((b, i) => blocs.findIndex((x) => x.phase === b.phase) === i || b.debut >= lundi)
            .slice(0, 5)
            .map((b) => (
              <span key={b.debut} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: COULEURS[b.phase] }} />
                {LIBELLE_PHASE[b.phase]} · {jm(b.debut)}
              </span>
            ))}
        </div>
        <p className="mt-3 border-t border-bordure pt-2 text-xs text-texte-3">{resumeObjectif(donnees.objectifs, aujourdhui)}</p>
      </Carte>

      {blocs
        .filter((b) => b.fin >= lundi)
        .map((b) => (
          <section key={b.debut}>
            <h2 className="mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEURS[b.phase] }} />
              {LIBELLE_PHASE[b.phase]}
            </h2>
            <div className="divide-y divide-bordure rounded-2xl border border-bordure bg-surface">
              {b.semaines
                .filter((s) => s.lundi >= lundi)
                .map((s) => {
                  const c = contenu(s)
                  const n = b.semaines.indexOf(s) + 1
                  const badge = s.courses.length
                    ? { texte: 'course', classe: 'bg-[#f87171]/20 text-[#f87171]' }
                    : s.recuperation
                      ? { texte: 'récup', classe: 'bg-[#4ade80]/20 text-[#4ade80]' }
                      : s.allegee
                        ? { texte: 'allégée', classe: 'bg-accent/20 text-accent' }
                        : null
                  return (
                    <div key={s.lundi} className={`flex items-center gap-3 px-3 py-2.5 ${s.lundi === lundi ? 'bg-accent/10' : ''}`}>
                      <span className="w-14 shrink-0 text-sm text-texte-2">{jm(s.lundi)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.titre}</span>
                        <span className="block text-xs text-texte-3">
                          Sem. {n}/{b.semaines.length}
                          {c.sous ? ` · ${c.sous}` : ''}
                        </span>
                      </span>
                      {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.classe}`}>{badge.texte}</span>}
                    </div>
                  )
                })}
            </div>
          </section>
        ))}
      <p className="px-1 text-xs text-texte-3">Les semaines à venir sont une projection : ton coach ajuste le plan chaque semaine selon ce que tu fais et ta forme.</p>
    </>
  )
}
