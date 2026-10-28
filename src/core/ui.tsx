import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Page({ titre, surtitre, action, children }: { titre: string; surtitre?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <main className="pt-sur pb-sur mx-auto flex min-h-full max-w-md flex-col px-4">
      <header className="flex items-end justify-between gap-3 py-6">
        <div>
          {surtitre && <p className="text-sm text-texte-3">{surtitre}</p>}
          <h1 className="text-3xl font-bold">{titre}</h1>
        </div>
        {action}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
      <footer className="mt-auto py-6 text-center text-xs text-texte-3">version {__VERSION__}</footer>
    </main>
  )
}

export function Carte({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl border border-bordure bg-surface p-5">{children}</section>
}

export function Bouton({ variante = 'principal', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'discret' }) {
  const style =
    variante === 'principal'
      ? 'bg-accent text-fond font-semibold disabled:opacity-50'
      : 'bg-surface-2 text-texte-2 disabled:opacity-50'
  return <button type="button" className={`rounded-xl px-4 py-3 ${style} ${className}`} {...props} />
}

export function Champ({ etiquette, ...props }: InputHTMLAttributes<HTMLInputElement> & { etiquette: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-texte-2">{etiquette}</span>
      <input
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
