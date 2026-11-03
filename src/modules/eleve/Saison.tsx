import { messageErreur } from '../../core/compte'
import { objectifsDe, useCharge } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Carte, Chargement, Message } from '../../core/ui'
import { ajouterJours, ecartJours, jour, lundiDe, versDate } from '../../moteur/dates'
import { LIBELLE_PHASE } from '../../moteur/phase'
import { BUT_PHASE, resumeObjectif, saison } from '../../moteur/saison'
import type { Phase, ProfilSportif } from '../../moteur/types'

/** Couleur de chaque phase (rampe validée sur fond sombre, reprise de Coach). */
const COULEURS: Record<Phase, string> = { base: '#86b6ef', developpement: '#3987e5', specifique: '#1c5cab', affutage: '#199e70' }
const jm = (d: string) => versDate(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Saison : les blocs, où l'élève en est, et les semaines à venir. */
export function Saison({ client, eleve, profil }: { client: Client; eleve: string; profil: ProfilSportif }) {
  const aujourdhui = jour()
  const { donnees: objectifs, erreur } = useCharge(() => objectifsDe(client, eleve), [client, eleve])
  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!objectifs) return <Chargement />

  const { semaines, blocs } = saison(profil, objectifs, aujourdhui)
  const lundi = lundiDe(aujourdhui)
  const total = semaines.length
  const rangActuel = Math.max(0, semaines.findIndex((s) => s.lundi === lundi))
  const bloc = blocs.find((b) => b.debut <= lundi && b.fin >= lundi) ?? blocs[0]
  const rangDansBloc = bloc.semaines.findIndex((s) => s.lundi === lundi) + 1
  const avenir = semaines.filter((s) => s.lundi >= lundi).slice(0, 8)
  const position = ((rangActuel + ecartJours(lundi, aujourdhui) / 7) / total) * 100

  return (
    <>
      <Carte titre="Ton objectif">
        <p className="text-sm text-texte-2">{resumeObjectif(objectifs, aujourdhui)}</p>
      </Carte>

      <Carte titre="Ta saison">
        <div className="relative pt-5">
          <span className="absolute top-0 -translate-x-1/2 text-xs text-accent" style={{ left: `${position}%` }}>
            ▼
          </span>
          <div className="flex h-4 overflow-hidden rounded-full">
            {blocs.map((b) => (
              <div key={b.debut} title={LIBELLE_PHASE[b.phase]} style={{ width: `${(b.semaines.length / total) * 100}%`, background: COULEURS[b.phase] }} className="border-r border-fond last:border-0" />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-texte-3">
            <span>{jm(semaines[0].lundi)}</span>
            <span>{jm(ajouterJours(semaines[total - 1].lundi, 6))}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-texte-3">
          {(Object.keys(COULEURS) as Phase[])
            .filter((ph) => blocs.some((b) => b.phase === ph))
            .map((ph) => (
              <span key={ph} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: COULEURS[ph] }} />
                {LIBELLE_PHASE[ph]}
              </span>
            ))}
        </div>
      </Carte>

      <Carte titre={`Bloc en cours : ${LIBELLE_PHASE[bloc.phase]}`}>
        <p className="text-sm text-texte-3">
          Semaine {Math.max(1, rangDansBloc)} sur {bloc.semaines.length} · jusqu’au {jm(bloc.fin)}
        </p>
        <p className="mt-2 text-sm text-texte-2">{BUT_PHASE[bloc.phase]}</p>
      </Carte>

      <Carte titre="Les semaines à venir">
        <ul className="flex flex-col divide-y divide-bordure">
          {avenir.map((s) => (
            <li key={s.lundi} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COULEURS[s.phase] }} />
                {s.lundi === lundi ? 'Cette semaine' : `Semaine du ${jm(s.lundi)}`}
              </span>
              <span className="text-right text-xs text-texte-3">
                {s.courses.length ? `🏁 ${s.courses.join(', ')}` : s.recuperation ? 'récupération' : s.allegee ? 'allégée' : LIBELLE_PHASE[s.phase]}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-texte-3">Une semaine sur 4 est allégée : c’est là que le corps assimile le travail. Ton coach peut ajuster le plan à tout moment.</p>
      </Carte>
    </>
  )
}
