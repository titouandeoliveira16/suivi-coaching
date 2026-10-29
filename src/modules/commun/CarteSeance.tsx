import { useState, type ReactNode } from 'react'
import { format } from '../../moteur/banque'
import { dateLisible } from '../../moteur/dates'
import { cible, duree } from '../../moteur/intensite'
import type { Categorie, Etape, ProfilSportif, Seance, Sport } from '../../moteur/types'
import { Pastille } from '../../core/ui'

export const ICONE_SPORT: Record<Sport, string> = { velo: '🚴', course: '🏃' }
const LIBELLE_CATEGORIE: Record<Categorie, string> = { facile: 'Facile', longue: 'Sortie longue', intense: 'Intense', test: 'Test' }
const LIBELLE_ETAPE: Record<Etape['type'], string> = {
  echauffement: 'Échauffement',
  effort: 'Effort',
  recup: 'Récup',
  retour: 'Retour au calme',
  repetition: 'Répéter',
}
const LIBELLE_STATUT = { proposee: 'À valider', validee: 'Prévue', faite: 'Faite', annulee: 'Annulée' } as const

function Etapes({ etapes, sport, profil }: { etapes: Etape[]; sport: Sport; profil: ProfilSportif }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {etapes.map((e, i) =>
        e.type === 'repetition' ? (
          <li key={i} className="rounded-xl bg-surface-2 p-3">
            <p className="mb-1.5 text-sm font-semibold">{e.fois} fois :</p>
            <Etapes etapes={e.etapes ?? []} sport={sport} profil={profil} />
          </li>
        ) : (
          <li key={i} className="text-sm">
            <span className="font-semibold">
              {LIBELLE_ETAPE[e.type]} {e.duree ? duree(e.duree) : ''}
            </span>
            {(e.max || e.intensite) && <span className="text-texte-2"> · {cible(e, sport, profil)}</span>}
            {e.cadence && <span className="text-texte-3"> · cadence {e.cadence}</span>}
            {e.note && <span className="block text-xs text-texte-3">{e.note}</span>}
          </li>
        ),
      )}
    </ul>
  )
}

export function CarteSeance({ seance: s, profil, avecDate, avecStatut, ouverte, children }: { seance: Seance; profil: ProfilSportif; avecDate?: boolean; avecStatut?: boolean; ouverte?: boolean; children?: ReactNode }) {
  const [details, setDetails] = useState(!!ouverte)
  const f = s.format_id ? format(s.format_id) : undefined
  return (
    <section className={`rounded-2xl border bg-surface p-5 ${s.statut === 'annulee' ? 'border-bordure opacity-70' : s.categorie === 'intense' || s.categorie === 'test' ? 'border-accent/60' : 'border-bordure'}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-texte-3">
        <span className="text-lg">{ICONE_SPORT[s.sport]}</span>
        {avecDate && <span className="capitalize">{dateLisible(s.date)}</span>}
        <Pastille ton={s.categorie === 'intense' || s.categorie === 'test' ? 'accent' : 'neutre'}>{LIBELLE_CATEGORIE[s.categorie]}</Pastille>
        <span>{s.duree_min} min</span>
        {avecStatut && <Pastille ton={s.statut === 'faite' ? 'succes' : 'neutre'}>{LIBELLE_STATUT[s.statut]}</Pastille>}
      </div>
      <h3 className="text-lg font-semibold">{s.titre}</h3>
      {s.description && <p className="mt-1 text-sm text-texte-2">{s.description}</p>}
      {s.ajustement && <p className="mt-2 text-sm text-alerte">↓ {s.ajustement}</p>}

      {s.statut === 'faite' && (
        <p className="mt-2 text-sm text-succes">
          ✓ {s.duree_reelle_min ?? s.duree_min} min · effort {s.rpe}/10 · {s.reussie ? 'réussie' : 'pas réussie'}
          {s.douleur ? ` · douleur ${s.douleur}/10${s.douleur_zone ? ` (${s.douleur_zone})` : ''}` : ''}
          {s.note && <span className="block text-texte-2">« {s.note} »</span>}
        </p>
      )}

      {s.contenu.length > 0 && (
        <button type="button" className="mt-2 text-sm text-accent" onClick={() => setDetails(!details)}>
          {details ? 'Masquer le déroulé' : 'Voir le déroulé'}
        </button>
      )}
      {details && (
        <div className="mt-3 flex flex-col gap-3">
          <Etapes etapes={s.contenu} sport={s.sport} profil={profil} />
          {f && f.conseils.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-texte-3">
              {f.conseils.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          {f && f.preuve.references.length > 0 && (
            <p className="text-xs text-texte-3">
              Source : {f.preuve.references.join(', ')} (preuve {f.preuve.niveau})
            </p>
          )}
        </div>
      )}
      {children && <div className="mt-4 flex flex-col gap-2">{children}</div>}
    </section>
  )
}
