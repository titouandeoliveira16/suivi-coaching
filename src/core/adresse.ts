import { useEffect, useState } from 'react'

/** Partie « #/… » de l'adresse, mise à jour quand elle change. */
export function useAdresse(): string {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const suivre = () => setHash(location.hash)
    addEventListener('hashchange', suivre)
    return () => removeEventListener('hashchange', suivre)
  }, [])
  return hash
}

export function allerA(hash: string) {
  if (location.hash !== hash) location.hash = hash
}

/** Remplace l'adresse sans créer d'entrée d'historique, en prévenant `useAdresse`. */
export function remplacerAdresse(hash: string) {
  history.replaceState(null, '', location.pathname + location.search + hash)
  dispatchEvent(new HashChangeEvent('hashchange'))
}

export const adresseEleve = (id: string) => `#/eleve/${id}`

export function eleveDepuisAdresse(hash: string): string | null {
  const m = /^#\/eleve\/([0-9a-f-]{36})\/?$/.exec(hash)
  return m ? m[1] : null
}
