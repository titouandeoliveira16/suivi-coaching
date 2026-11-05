import { useState, type ComponentType, type ReactNode } from 'react'

/** Titre de page collé en haut, sous l'encoche (comme Coach) ; la date ou une action à droite, les onglets dessous. */
export function EnTete({ titre, aDroite, children }: { titre: string; aDroite?: ReactNode; children?: ReactNode }) {
  return (
    <header className="pt-sur sticky top-0 z-10 bg-fond px-4 pb-3">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{titre}</h1>
        {aDroite && <span className="text-sm text-texte-2">{aDroite}</span>}
      </div>
      {children}
    </header>
  )
}

/** Onglets en haut (style « segmenté » iOS), pilotés par l'adresse #/… */
export function OngletsHaut({ onglets, actif, choisir }: { onglets: { cle: string; libelle: string }[]; actif: string; choisir: (cle: string) => void }) {
  return (
    <nav className="mt-3 flex rounded-xl bg-surface-2 p-1">
      {onglets.map((o) => (
        <button
          key={o.cle}
          type="button"
          onClick={() => choisir(o.cle)}
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${o.cle === actif ? 'bg-accent text-fond' : 'text-texte-2'}`}
        >
          {o.libelle}
        </button>
      ))}
    </nav>
  )
}

export type EntreeBarre = { cle: string; nom: string; Icone: ComponentType<{ className?: string }>; pastille?: number }

/** Barre du bas, au pouce (comme Coach) : icônes dessinées, la couleur d'accent sur l'entrée active. */
export function BarreBas({ entrees, actif, choisir }: { entrees: EntreeBarre[]; actif: string; choisir: (cle: string) => void }) {
  return (
    <nav className="pb-barre fixed inset-x-0 bottom-0 z-20 border-t border-bordure bg-fond">
      <ul className="mx-auto flex max-w-lg">
        {entrees.map(({ cle, nom, Icone, pastille }) => (
          <li key={cle} className="flex-1">
            <button type="button" onClick={() => choisir(cle)} className={`relative flex w-full flex-col items-center gap-1 pt-2 pb-1 text-[11px] font-medium ${cle === actif ? 'text-accent' : 'text-texte-3'}`}>
              <Icone className="h-7 w-7" />
              {nom}
              {!!pastille && <span className="absolute top-1 left-1/2 ml-2.5 min-w-5 rounded-full bg-alerte px-1.5 text-xs font-semibold text-fond">{pastille}</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Cadre d'un écran : en-tête collé en haut, contenu, barre du bas. */
export function Cadre({ entete, barre, children }: { entete: ReactNode; barre?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className={`mx-auto min-h-full max-w-md ${barre ? 'pb-28' : 'pb-sur'}`}>
        {entete}
        <div className="flex flex-col gap-3 px-4">{children}</div>
        <footer className="py-6 text-center text-xs text-texte-3">version {__VERSION__}</footer>
      </div>
      {barre}
    </>
  )
}

/**
 * Petit « ? » à côté d'un chiffre : un toucher ouvre en bas de l'écran une phrase qui explique comment il est calculé.
 */
export function Aide({ texte, titre }: { texte: string; titre?: string }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={`Comment est calculé : ${titre ?? 'ce chiffre'}`}
        onClick={(e) => {
          e.stopPropagation()
          setOuvert(true)
        }}
        className="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-bordure align-middle text-[11px] font-bold text-texte-3"
      >
        ?
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setOuvert(false)}>
          <div className="pb-sur w-full rounded-t-3xl border-t border-bordure bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            {titre && <p className="mb-2 text-lg font-bold">{titre}</p>}
            <p className="text-texte-2">{texte}</p>
            <button type="button" onClick={() => setOuvert(false)} className="mt-4 w-full rounded-xl bg-surface-2 py-3 font-semibold">
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** Feuille qui monte du bas de l'écran (détail d'une séance, choix d'action). */
export function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={onFermer}>
      <div className="pb-sur max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border-t border-bordure bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-bold">{titre}</p>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="px-2 text-2xl text-texte-3">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
