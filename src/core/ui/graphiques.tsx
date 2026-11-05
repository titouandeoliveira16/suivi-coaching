import { useRef, useState, type ReactNode } from 'react'

/**
 * Graphiques SVG légers (aucune dépendance), pensés pour le thème sombre et l'iPhone :
 * traits fins, grille discrète, légende toujours visible, info-bulle au toucher.
 * Palette catégorielle validée sur le fond sombre (contraste ≥ 3:1, séparation daltonisme ΔE ≥ 9) :
 */
export const SERIES = ['#3987e5', '#d95926', '#199e70'] as const
/** Rampe ordinale bleue pour les domaines d'intensité (basse → haute). */
export const INTENSITES = ['#86b6ef', '#3987e5', '#1c5cab'] as const

const H = 160
const MARGE = { haut: 8, droite: 8, bas: 22, gauche: 34 }

export interface Serie {
  nom: string
  couleur: string
  valeurs: (number | undefined)[]
  /** Trait pointillé (ex. moyenne, prévu) */
  pointille?: boolean
}

function echelle(min: number, max: number) {
  if (min === max) return { min: min - 1, max: max + 1, pas: 1 }
  const brut = (max - min) / 4
  const p = 10 ** Math.floor(Math.log10(brut))
  const pas = [1, 2, 5, 10].map((m) => m * p).find((x) => x >= brut)!
  return { min: Math.floor(min / pas) * pas, max: Math.ceil(max / pas) * pas, pas }
}

function useLargeur() {
  const ref = useRef<HTMLDivElement>(null)
  const [l, setL] = useState(340)
  return {
    ref: (el: HTMLDivElement | null) => {
      ref.current = el
      if (el && Math.abs(el.clientWidth - l) > 2) setL(el.clientWidth)
    },
    largeur: l,
  }
}

function Legende({ series }: { series: { nom: string; couleur: string; pointille?: boolean }[] }) {
  if (series.length < 2) return null
  return (
    <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-texte-2">
      {series.map((s) => (
        <span key={s.nom} className="flex items-center gap-1.5">
          <svg width="14" height="4" aria-hidden><line x1="0" y1="2" x2="14" y2="2" stroke={s.couleur} strokeWidth="2" strokeDasharray={s.pointille ? '3 2' : undefined} /></svg>
          {s.nom}
        </span>
      ))}
    </div>
  )
}

function Bulle({ x, largeur, children }: { x: number; largeur: number; children: ReactNode }) {
  const gauche = Math.min(Math.max(x - 70, 0), largeur - 140)
  return (
    <div className="pointer-events-none absolute top-0 w-[140px] rounded-lg border border-bordure bg-fond/95 px-2 py-1.5 text-xs shadow-lg" style={{ left: gauche }}>
      {children}
    </div>
  )
}

/**
 * Courbes sur un même axe (une seule échelle verticale).
 * `bande` : zone colorée entre deux valeurs (ex. zone normale de la VFC).
 */
export function GraphiqueLignes({
  etiquettes, series, bande, format: formatDonne, formatAxe: formatAxeDonne, zero = false,
}: {
  etiquettes: string[]
  series: Serie[]
  bande?: { bas: (number | undefined)[]; haut: (number | undefined)[]; nom: string }
  format?: (n: number) => string
  /** Graduations de l'axe (plus courtes) ; par défaut `format` */
  formatAxe?: (n: number) => string
  zero?: boolean
}) {
  const { ref, largeur } = useLargeur()
  const [survol, setSurvol] = useState<number>()
  const n = etiquettes.length
  const toutes = [...series.flatMap((s) => s.valeurs), ...(bande ? [...bande.bas, ...bande.haut] : [])].filter((v): v is number => v !== undefined)
  if (!n || !toutes.length) return <p className="py-6 text-center text-sm text-texte-3">Pas encore de données.</p>
  const e = echelle(Math.min(...toutes, ...(zero ? [0] : [])), Math.max(...toutes, ...(zero ? [0] : [])))
  // Par défaut : entiers, ou 1 décimale si les graduations sont plus fines que 1
  const format = formatDonne ?? ((v: number) => (e.pas < 1 ? v.toFixed(1).replace('.', ',') : String(Math.round(v))))
  const formatAxe = formatAxeDonne ?? format
  const lp = largeur - MARGE.gauche - MARGE.droite
  const hp = H - MARGE.haut - MARGE.bas
  const x = (i: number) => MARGE.gauche + (n === 1 ? lp / 2 : (i / (n - 1)) * lp)
  const y = (v: number) => MARGE.haut + hp - ((v - e.min) / (e.max - e.min)) * hp
  const chemin = (vals: (number | undefined)[]) =>
    vals.map((v, i) => (v === undefined ? '' : `${i === 0 || vals[i - 1] === undefined ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join('')
  const graduations = Array.from({ length: Math.round((e.max - e.min) / e.pas) + 1 }, (_, i) => e.min + i * e.pas)
  const reperes = [0, Math.floor((n - 1) / 2), n - 1]

  const surDeplacement = (px: number) => setSurvol(Math.max(0, Math.min(n - 1, Math.round(((px - MARGE.gauche) / lp) * (n - 1)))))

  return (
    <div ref={ref} className="relative">
      <Legende series={[...series, ...(bande ? [{ nom: bande.nom, couleur: '#3987e555' }] : [])]} />
      <svg width={largeur} height={H} role="img" aria-label={series.map((s) => s.nom).join(', ')}
        onPointerMove={(ev) => surDeplacement(ev.clientX - ev.currentTarget.getBoundingClientRect().left)}
        onPointerDown={(ev) => surDeplacement(ev.clientX - ev.currentTarget.getBoundingClientRect().left)}
        onPointerLeave={() => setSurvol(undefined)} className="touch-pan-y">
        {graduations.map((g) => (
          <g key={g}>
            <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(g)} y2={y(g)} stroke="var(--color-bordure)" strokeWidth={g === 0 && zero ? 1.5 : 1} />
            <text x={MARGE.gauche - 4} y={y(g) + 3} textAnchor="end" fontSize="10" fill="var(--color-texte-3)">{formatAxe(g)}</text>
          </g>
        ))}
        {reperes.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="10" fill="var(--color-texte-3)">{etiquettes[i]}</text>
        ))}
        {bande && (
          <path fill="#3987e5" fillOpacity={0.28} stroke="#3987e5" strokeOpacity={0.5} strokeWidth={1}
            d={(() => {
              const pts = bande.haut.map((v, i) => [i, v, bande.bas[i]] as const).filter(([, h, b]) => h !== undefined && b !== undefined)
              if (!pts.length) return ''
              return `M${pts.map(([i, h]) => `${x(i)},${y(h!)}`).join('L')}L${[...pts].reverse().map(([i, , b]) => `${x(i)},${y(b!)}`).join('L')}Z`
            })()} />
        )}
        {series.map((s) => (
          <path key={s.nom} d={chemin(s.valeurs)} fill="none" stroke={s.couleur} strokeWidth={2} strokeLinejoin="round" strokeDasharray={s.pointille ? '4 3' : undefined} />
        ))}
        {survol !== undefined && (
          <g>
            <line x1={x(survol)} x2={x(survol)} y1={MARGE.haut} y2={H - MARGE.bas} stroke="var(--color-texte-3)" strokeWidth={1} />
            {series.map((s) => s.valeurs[survol] !== undefined && (
              <circle key={s.nom} cx={x(survol)} cy={y(s.valeurs[survol]!)} r={4} fill={s.couleur} stroke="var(--color-surface)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {survol !== undefined && (
        <Bulle x={x(survol)} largeur={largeur}>
          <p className="font-semibold text-texte">{etiquettes[survol]}</p>
          {series.map((s) => (
            <p key={s.nom} className="flex justify-between gap-2 text-texte-2">
              <span><span style={{ color: s.couleur }}>●</span> {s.nom}</span>
              <span className="text-texte">{s.valeurs[survol] !== undefined ? format(s.valeurs[survol]!) : '–'}</span>
            </p>
          ))}
        </Bulle>
      )}
    </div>
  )
}

/** Barres empilées (ex. charge hebdo vélo + course), avec repère optionnel (ex. charge prévue). */
export function GraphiqueBarres({
  etiquettes, series, repere, format = (n) => String(Math.round(n)), formatAxe: formatAxeDonne,
}: {
  etiquettes: string[]
  series: { nom: string; couleur: string; valeurs: number[] }[]
  repere?: { nom: string; valeurs: (number | undefined)[] }
  format?: (n: number) => string
  /** Graduations de l'axe (plus courtes) ; par défaut `format` */
  formatAxe?: (n: number) => string
}) {
  const formatAxe = formatAxeDonne ?? format
  const { ref, largeur } = useLargeur()
  const [survol, setSurvol] = useState<number>()
  const n = etiquettes.length
  const totaux = etiquettes.map((_, i) => series.reduce((a, s) => a + (s.valeurs[i] ?? 0), 0))
  const max = Math.max(...totaux, ...(repere?.valeurs.filter((v): v is number => v !== undefined) ?? []), 0)
  if (!n || max === 0) return <p className="py-6 text-center text-sm text-texte-3">Pas encore de données.</p>
  const e = echelle(0, max)
  const lp = largeur - MARGE.gauche - MARGE.droite
  const hp = H - MARGE.haut - MARGE.bas
  const pas = lp / n
  const lb = Math.min(28, pas * 0.6)
  const y = (v: number) => MARGE.haut + hp - (v / e.max) * hp
  const graduations = Array.from({ length: Math.round(e.max / e.pas) + 1 }, (_, i) => i * e.pas)

  return (
    <div ref={ref} className="relative">
      <Legende series={[...series, ...(repere ? [{ nom: repere.nom, couleur: 'var(--color-texte)', pointille: true }] : [])]} />
      <svg width={largeur} height={H} role="img" aria-label={series.map((s) => s.nom).join(', ')} onPointerLeave={() => setSurvol(undefined)}>
        {graduations.map((g) => (
          <g key={g}>
            <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(g)} y2={y(g)} stroke="var(--color-bordure)" />
            <text x={MARGE.gauche - 4} y={y(g) + 3} textAnchor="end" fontSize="10" fill="var(--color-texte-3)">{formatAxe(g)}</text>
          </g>
        ))}
        {etiquettes.map((et, i) => {
          const cx = MARGE.gauche + pas * i + pas / 2
          let base = 0
          return (
            <g key={i} onPointerEnter={() => setSurvol(i)} onPointerDown={() => setSurvol(i)}>
              <rect x={cx - pas / 2} y={MARGE.haut} width={pas} height={hp} fill="transparent" />
              {series.map((s) => {
                const v = s.valeurs[i] ?? 0
                if (v <= 0) return null
                const y0 = y(base)
                base += v
                const y1 = y(base)
                // 2 px d'écart entre segments empilés
                return <rect key={s.nom} x={cx - lb / 2} y={y1} width={lb} height={Math.max(0, y0 - y1 - 2)} rx={2} fill={s.couleur} opacity={survol === undefined || survol === i ? 1 : 0.5} />
              })}
              {repere?.valeurs[i] !== undefined && (
                <line x1={cx - lb / 2 - 3} x2={cx + lb / 2 + 3} y1={y(repere.valeurs[i]!)} y2={y(repere.valeurs[i]!)} stroke="var(--color-texte)" strokeWidth={2} strokeDasharray="3 2" />
              )}
              {(i === 0 || i === n - 1 || i === Math.floor(n / 2)) && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-texte-3)">{et}</text>
              )}
            </g>
          )
        })}
      </svg>
      {survol !== undefined && (
        <Bulle x={MARGE.gauche + pas * survol + pas / 2} largeur={largeur}>
          <p className="font-semibold text-texte">{etiquettes[survol]}</p>
          {series.map((s) => (
            <p key={s.nom} className="flex justify-between gap-2 text-texte-2">
              <span><span style={{ color: s.couleur }}>●</span> {s.nom}</span><span className="text-texte">{format(s.valeurs[survol] ?? 0)}</span>
            </p>
          ))}
          {series.length > 1 && <p className="flex justify-between text-texte-2"><span>Total</span><span className="text-texte">{format(totaux[survol])}</span></p>}
          {repere?.valeurs[survol] !== undefined && <p className="flex justify-between text-texte-2"><span>{repere.nom}</span><span className="text-texte">{format(repere.valeurs[survol]!)}</span></p>}
        </Bulle>
      )}
    </div>
  )
}

/** Barre horizontale de répartition (ex. basse / moyenne / haute intensité), libellée en %. */
export function BarreRepartition({ parts }: { parts: { nom: string; couleur: string; valeur: number }[] }) {
  const total = parts.reduce((a, p) => a + p.valeur, 0)
  if (!total) return <p className="text-sm text-texte-3">Pas encore de données.</p>
  return (
    <div>
      <div className="flex h-4 gap-0.5 overflow-hidden rounded">
        {parts.filter((p) => p.valeur > 0).map((p) => (
          <div key={p.nom} style={{ width: `${(p.valeur / total) * 100}%`, background: p.couleur }} title={p.nom} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-texte-2">
        {parts.map((p) => (
          <span key={p.nom}><span style={{ color: p.couleur }}>■</span> {p.nom} <span className="font-semibold text-texte">{Math.round((p.valeur / total) * 100)} %</span></span>
        ))}
      </div>
    </div>
  )
}

/**
 * Camembert en anneau (ex. répartition des dépenses du mois), avec légende toujours visible.
 * Au-delà de `max` parts, les plus petites sont regroupées dans « Autres ». Toucher une part affiche son montant au centre.
 */
export function Camembert({
  parts, format, max = 6,
}: {
  parts: { nom: string; couleur: string; valeur: number }[]
  format: (n: number) => string
  max?: number
}) {
  const [choix, setChoix] = useState<number>()
  const triees = parts.filter((p) => p.valeur > 0).sort((a, b) => b.valeur - a.valeur)
  const visibles = triees.length > max
    ? [...triees.slice(0, max - 1), { nom: 'Autres', couleur: '#6b7380', valeur: triees.slice(max - 1).reduce((a, p) => a + p.valeur, 0) }]
    : triees
  const total = visibles.reduce((a, p) => a + p.valeur, 0)
  if (!total) return <p className="py-6 text-center text-sm text-texte-3">Pas encore de dépenses ce mois-ci.</p>

  const R = 70, EP = 26, C = 2 * Math.PI * R
  // Début de chaque part le long du cercle
  const debuts = visibles.map((_, i) => visibles.slice(0, i).reduce((a, p) => a + (p.valeur / total) * C, 0))
  const centre = choix !== undefined ? visibles[choix] : undefined
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 180 180" className="h-40 w-40 shrink-0" role="img" aria-label="Répartition des dépenses">
        <g transform="rotate(-90 90 90)">
          {visibles.map((p, i) => {
            const long = (p.valeur / total) * C
            // 2 px d'écart entre les parts (sauf s'il n'y en a qu'une)
            const trait = visibles.length > 1 ? Math.max(long - 2, 0.5) : long
            return (
              <circle key={p.nom} cx="90" cy="90" r={R} fill="none" stroke={p.couleur} strokeWidth={choix === i ? EP + 6 : EP}
                strokeDasharray={`${trait} ${C - trait}`} strokeDashoffset={-debuts[i]} opacity={choix === undefined || choix === i ? 1 : 0.45}
                onPointerDown={() => setChoix(choix === i ? undefined : i)} />
            )
          })}
        </g>
        <text x="90" y="86" textAnchor="middle" fontSize="12" fill="var(--color-texte-2)">{centre ? centre.nom : 'Total'}</text>
        <text x="90" y="106" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--color-texte)">{format(centre ? centre.valeur : total)}</text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-sm">
        {visibles.map((p, i) => (
          <li key={p.nom} className="flex items-center gap-2" onClick={() => setChoix(choix === i ? undefined : i)}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.couleur }} />
            <span className="min-w-0 flex-1 truncate text-texte-2">{p.nom}</span>
            <span className="font-semibold">{Math.round((p.valeur / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
