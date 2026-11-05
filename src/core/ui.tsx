import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function Page({ titre, surtitre, action, barre, children }: { titre: string; surtitre?: string; action?: ReactNode; barre?: ReactNode; children: ReactNode }) {
  return (
    <>
      <main className={`pt-sur mx-auto flex min-h-full max-w-md flex-col px-4 ${barre ? 'pb-28' : 'pb-sur'}`}>
        <header className="flex items-end justify-between gap-3 py-6">
          <div className="min-w-0">
            {surtitre && <p className="truncate text-sm text-texte-3">{surtitre}</p>}
            <h1 className="text-3xl font-bold">{titre}</h1>
          </div>
          {action}
        </header>
        <div className="flex flex-col gap-4">{children}</div>
        <footer className="mt-auto py-6 text-center text-xs text-texte-3">version {__VERSION__}</footer>
      </main>
      {barre}
    </>
  )
}

/** Bloc de contenu (comme Coach) : titre en petites majuscules grises, action éventuelle à droite. */
export function Carte({ titre, action, children, className = '' }: { titre?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-bordure bg-surface p-4 ${className}`}>
      {(titre || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {titre && <h2 className="text-xs font-semibold tracking-wider text-texte-3 uppercase">{titre}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Bouton({ variante = 'principal', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'discret' | 'lien' }) {
  const style =
    variante === 'principal'
      ? 'rounded-xl px-4 py-3 bg-accent text-fond font-semibold'
      : variante === 'discret'
        ? 'rounded-xl px-4 py-3 bg-surface-2 text-texte-2'
        : 'px-1 py-1 text-accent'
  return <button type="button" className={`${style} disabled:opacity-50 ${className}`} {...props} />
}

export function Champ({ etiquette, aide, ...props }: InputHTMLAttributes<HTMLInputElement> & { etiquette: string; aide?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-texte-2">{etiquette}</span>
      <input
        className="rounded-xl border border-bordure bg-surface-2 px-4 py-3 text-base text-texte outline-none focus:border-accent"
        {...props}
      />
      {aide && <span className="text-xs text-texte-3">{aide}</span>}
    </label>
  )
}

export function Zone({ etiquette, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { etiquette: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-texte-2">{etiquette}</span>
      <textarea
        rows={3}
        className="rounded-xl border border-bordure bg-surface-2 px-4 py-3 text-base text-texte outline-none focus:border-accent"
        {...props}
      />
    </label>
  )
}

export function Message({ type = 'info', children }: { type?: 'info' | 'erreur' | 'succes'; children: ReactNode }) {
  const couleur = type === 'erreur' ? 'text-alerte' : type === 'succes' ? 'text-succes' : 'text-texte-2'
  return <p className={`text-sm ${couleur}`}>{children}</p>
}

/** Couleur de chaque note de 1 à 5, du rouge (1) au vert (5), comme dans Coach. */
export const COULEURS_NOTE = ['#f87171', '#fb923c', '#facc15', '#a3e635', '#4ade80']

/** Grosses cases à toucher pour une note (1 à 5 colorées du rouge au vert, ou 0 à 10), comme dans Coach. */
export function ChoixNote({ etiquette, min, max, valeur, onChange, bas, haut }: { etiquette: string; min: number; max: number; valeur: number | null; onChange: (v: number) => void; bas?: string; haut?: string }) {
  const notes = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const cinq = notes.length === 5
  return (
    <div className="py-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-texte-2">{etiquette}</span>
        {(bas || haut) && (
          <span className="shrink-0 text-xs text-texte-3">
            {bas} → {haut}
          </span>
        )}
      </div>
      <div className={`grid gap-1.5 ${cinq ? 'grid-cols-5' : 'grid-cols-6'}`}>
        {notes.map((n, i) => {
          const actif = n === valeur
          const couleur = cinq ? COULEURS_NOTE[i] : 'var(--color-accent)'
          return (
            <button
              key={n}
              type="button"
              aria-pressed={actif}
              onClick={() => onChange(n)}
              className={`rounded-xl border font-bold active:scale-95 ${cinq ? 'h-12 text-lg' : 'h-11'}`}
              style={actif ? { background: couleur, borderColor: couleur, color: '#0b0d10' } : { borderColor: 'var(--color-bordure)', background: 'var(--color-surface-2)', color: 'var(--color-texte-2)' }}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function OuiNon({ etiquette, valeur, onChange }: { etiquette: string; valeur: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-texte-2">{etiquette}</span>
      <div className="flex shrink-0 gap-1 rounded-xl bg-surface-2 p-1">
        {([
          [true, 'Oui'],
          [false, 'Non'],
        ] as const).map(([v, l]) => (
          <button key={l} type="button" onClick={() => onChange(v)} className={`rounded-lg px-4 py-1.5 text-sm ${valeur === v ? 'bg-accent font-semibold text-fond' : 'text-texte-3'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Pastille({ children, ton = 'accent' }: { children: ReactNode; ton?: 'accent' | 'alerte' | 'succes' | 'neutre' }) {
  const c = { accent: 'bg-accent text-fond', alerte: 'bg-alerte text-fond', succes: 'bg-succes text-fond', neutre: 'bg-surface-2 text-texte-2' }[ton]
  return <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>
}

export function Chargement() {
  return <p className="py-8 text-center text-sm text-texte-3">Chargement…</p>
}
