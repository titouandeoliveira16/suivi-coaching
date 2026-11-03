import type { ReactNode } from 'react'
import type { SemaineStockee } from '../../core/donnees'
import { Message } from '../../core/ui'
import { ajouterJours, NOMS_JOURS, versDate } from '../../moteur/dates'
import { LIBELLE_PHASE } from '../../moteur/phase'
import type { ProfilSportif, Seance } from '../../moteur/types'
import { CarteSeance } from './CarteSeance'

export const heures = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`)

/** La semaine en cours et la suivante, jour par jour ; `actions` ajoute des boutons sous chaque séance. */
export function VueSemaines({
  seances,
  profil,
  lundi,
  semaines = [],
  avecStatut,
  actions,
}: {
  seances: Seance[]
  profil: ProfilSportif
  lundi: string
  semaines?: SemaineStockee[]
  avecStatut?: boolean
  actions?: (s: Seance) => ReactNode
}) {
  return (
    <>
      {[lundi, ajouterJours(lundi, 7)].map((l, i) => {
        const sem = seances.filter((s) => s.date >= l && s.date <= ajouterJours(l, 6))
        const info = semaines.find((s) => s.lundi === l)
        const total = sem.filter((s) => s.sport !== 'renfo' && s.statut !== 'annulee').reduce((t, s) => t + (s.duree_reelle_min ?? s.duree_min), 0)
        return (
          <section key={l} className="flex flex-col gap-2">
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-texte-3 uppercase">{i === 0 ? 'Cette semaine' : 'Semaine prochaine'}</h2>
              {sem.length > 0 && (
                <span className="text-xs text-texte-3">
                  {info ? `${LIBELLE_PHASE[info.phase]}${info.allegee ? ' · allégée' : ''} · ` : ''}
                  {heures(total)}
                </span>
              )}
            </div>
            {sem.length ? (
              NOMS_JOURS.map((nom, j) => {
                const date = ajouterJours(l, j)
                const duJour = sem.filter((s) => s.date === date)
                const titre = `${nom} ${versDate(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                return duJour.length ? (
                  <div key={date} className="flex flex-col gap-2">
                    <p className="text-xs text-texte-3 capitalize">{titre}</p>
                    {duJour.map((s) => (
                      <CarteSeance key={s.id} seance={s} profil={profil} avecStatut={avecStatut ?? s.statut !== 'validee'}>
                        {actions?.(s)}
                      </CarteSeance>
                    ))}
                  </div>
                ) : (
                  <p key={date} className="px-1 text-xs text-texte-3 capitalize">
                    {titre} · repos
                  </p>
                )
              })
            ) : (
              <Message>{i === 0 ? 'Rien de prévu.' : 'Ton coach prépare cette semaine.'}</Message>
            )}
          </section>
        )
      })}
    </>
  )
}
