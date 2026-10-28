export default function App() {
  return (
    <main className="pt-sur pb-sur mx-auto flex min-h-full max-w-md flex-col px-4">
      <header className="py-6">
        <p className="text-sm text-texte-3">Suivi Coaching</p>
        <h1 className="text-3xl font-bold">Bienvenue</h1>
      </header>

      <section className="rounded-2xl border border-bordure bg-surface p-5">
        <div className="mb-3 h-1 w-10 rounded-full bg-accent" />
        <h2 className="text-lg font-semibold">L’appli arrive bientôt</h2>
        <p className="mt-2 text-texte-2">
          Ton coach prépare ton espace. Tu recevras un lien d’invitation pour créer ton compte.
        </p>
      </section>

      <footer className="mt-auto py-6 text-center text-xs text-texte-3">version {__VERSION__}</footer>
    </main>
  )
}
