import { useState } from 'react'
import { Aide } from '../../core/ui/cadre'
import { noteMatin, type Signal } from '../../moteur/feu'
import type { Feu, Matin } from '../../moteur/types'

export const COULEUR_FEU: Record<Feu, string> = { vert: '#4ade80', orange: '#fb923c', rouge: '#f87171', repos: '#f87171' }
const TITRE: Record<Feu, string> = { vert: 'Feu vert', orange: 'Feu orange', rouge: 'Feu rouge', repos: 'Repos' }
const CONSEIL: Record<Feu, string> = {
  vert: 'Séance prévue, comme ton coach l’a préparée.',
  orange: 'On allège l’intensité aujourd’hui.',
  rouge: '30 à 45 min très faciles à la place.',
  repos: 'Repos complet aujourd’hui.',
}
const NOTES: [keyof Matin, string][] = [
  ['sommeil_q', 'Sommeil'],
  ['fatigue', 'Énergie'],
  ['courbatures', 'Jambes'],
  ['stress', 'Calme'],
  ['humeur', 'Humeur'],
]

/** « Ta forme » (comme Coach) : le feu du jour et ses 4 repères ; un toucher montre le détail. */
export function CarteForme({ matin: m, signal }: { matin: Matin; signal: Signal }) {
  const [ouverte, setOuverte] = useState(false)
  const alerte = (mot: string) => signal.raisons.some((r) => r.includes(mot))
  const cases = [
    { nom: 'VFC', valeur: m.vfc ? `${Math.round(m.vfc)}` : '—', unite: m.vfc ? 'ms' : '', alerte: alerte('VFC') },
    { nom: 'FC repos', valeur: m.fc_repos ? `${m.fc_repos}` : '—', unite: m.fc_repos ? 'bpm' : '', alerte: alerte('FC de repos') },
    { nom: 'Sommeil', valeur: `${String(m.sommeil_h).replace('.', ',')} h`, unite: '', alerte: alerte('Nuit courte') },
    { nom: 'Ressenti', valeur: noteMatin(m).toFixed(1).replace('.', ','), unite: '/ 5', alerte: alerte('Forme') || m.douleur || m.malade },
  ]
  const couleur = COULEUR_FEU[signal.feu]
  return (
    <section className={`flex flex-col gap-2.5 rounded-2xl border bg-surface p-3 ${ouverte ? 'border-accent' : 'border-bordure'}`}>
      <button type="button" onClick={() => setOuverte(!ouverte)} className="flex items-center justify-between text-left">
        <span className="text-xs font-semibold tracking-wider text-texte-3 uppercase">Ta forme</span>
        <span className="flex items-center gap-1.5 font-bold" style={{ color: couleur }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: couleur }} />
          {TITRE[signal.feu]}
          <span className={`text-sm ${ouverte ? 'text-accent' : 'font-normal text-texte-3'}`}>{ouverte ? 'Réduire ▴' : '▾'}</span>
        </span>
      </button>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {cases.map((c) => (
          <div key={c.nom} className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 ${c.alerte ? 'text-fond' : 'bg-surface-2 text-texte-2'}`} style={c.alerte ? { background: COULEUR_FEU.orange } : undefined}>
            <span className="text-[11px] opacity-85">{c.nom}</span>
            <span className="text-sm leading-tight font-semibold">{c.valeur}</span>
            {c.unite && <span className="text-[11px] leading-tight opacity-85">{c.unite}</span>}
          </div>
        ))}
      </div>
      <p className="text-sm text-texte-2">
        {CONSEIL[signal.feu]}
        <Aide
          titre="Le feu du jour"
          texte="Il combine tes 5 notes du matin (questionnaire inspiré de McLean 2010), ta nuit, et quand ta montre les mesure ta VFC et ta FC de repos comparées à ta moyenne des 2 derniers mois (Plews 2013). Orange : l’intensité est allégée ; rouge : séance très facile ; malade avec de la fièvre : repos. Ton coach est prévenu."
        />
      </p>
      {ouverte && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-5 gap-1 text-center">
            {NOTES.map(([cle, nom]) => (
              <span key={cle} className="rounded-lg bg-surface-2 py-1">
                <span className="block text-[10px] text-texte-3">{nom}</span>
                <b className="text-sm">{m[cle] as number}</b>
              </span>
            ))}
          </div>
          {signal.raisons.length > 0 ? (
            <ul className="flex flex-col gap-0.5 text-sm">
              {signal.raisons.map((r) => (
                <li key={r} style={{ color: COULEUR_FEU.orange }}>
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-texte-3">Rien d’anormal ce matin.</p>
          )}
        </div>
      )}
    </section>
  )
}
