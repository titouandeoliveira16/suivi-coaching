import { messageErreur } from '../../core/compte'
import { seancesEntre, testsDe, useCharge } from '../../core/donnees'
import type { Client } from '../../core/supabase'
import { Carte, Chargement, Message } from '../../core/ui'
import { ajouterJours, jour, lundiDe, versDate } from '../../moteur/dates'
import { chrono } from '../../moteur/tests'
import type { Test } from '../../moteur/types'

const LIBELLE_TEST: Record<Test['type'], string> = { cp: 'CP vélo', vma: 'VMA', reference: 'Parcours de référence' }

function valeurTest(t: Test): string {
  if (t.type === 'cp') return `${Math.round(t.valeur)} W`
  if (t.type === 'vma') return `${t.valeur} km/h`
  return chrono(t.valeur)
}

/** Volume des 8 dernières semaines et historique des tests. */
export function Progres({ client, eleve }: { client: Client; eleve: string }) {
  const lundi = lundiDe(jour())
  const debut = ajouterJours(lundi, -49)
  const { donnees, erreur } = useCharge(async () => {
    const [seances, tests] = await Promise.all([seancesEntre(client, eleve, debut, ajouterJours(lundi, 6)), testsDe(client, eleve)])
    return { seances, tests }
  }, [client, eleve, debut, lundi])
  if (erreur) return <Message type="erreur">{messageErreur(erreur)}</Message>
  if (!donnees) return <Chargement />

  const semaines = Array.from({ length: 8 }, (_, i) => {
    const l = ajouterJours(debut, 7 * i)
    const faites = donnees.seances.filter((s) => s.statut === 'faite' && s.date >= l && s.date <= ajouterJours(l, 6))
    return { lundi: l, minutes: faites.reduce((t, s) => t + (s.duree_reelle_min ?? s.duree_min), 0), nombre: faites.length }
  })
  const max = Math.max(60, ...semaines.map((s) => s.minutes))

  return (
    <>
      <Carte titre="Minutes faites par semaine">
        <div className="flex h-32 items-end gap-1.5">
          {semaines.map((s) => (
            <div key={s.lundi} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-texte-3">{s.minutes || ''}</span>
              <div className="w-full rounded-t bg-accent" style={{ height: `${(s.minutes / max) * 90}px` }} />
              <span className="text-[10px] text-texte-3">{versDate(s.lundi).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}</span>
            </div>
          ))}
        </div>
      </Carte>
      <Carte titre="Tests">
        {donnees.tests.length ? (
          <ul className="flex flex-col divide-y divide-bordure">
            {donnees.tests.map((t) => (
              <li key={t.id} className="flex justify-between py-2 text-sm">
                <span>
                  {LIBELLE_TEST[t.type]} <span className="text-texte-3">· {versDate(t.date).toLocaleDateString('fr-FR')}</span>
                </span>
                <span className="font-semibold">{valeurTest(t)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Message>Aucun test pour l’instant.</Message>
        )}
      </Carte>
    </>
  )
}
