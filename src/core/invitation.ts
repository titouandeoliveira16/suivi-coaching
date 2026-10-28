const CLE_STOCKAGE = 'invitation-en-attente'

export type InvitationEnAttente = { jeton: string; nom: string }

export function jetonDepuisAdresse(hash: string): string | null {
  const m = /^#\/invitation\/([0-9a-f]{32})\/?$/.exec(hash)
  return m ? m[1] : null
}

export function lienInvitation(adresseApp: string, jeton: string): string {
  return `${adresseApp.replace(/[?#].*$/, '')}#/invitation/${jeton}`
}

export function lireInvitationEnAttente(): InvitationEnAttente | null {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE)
    if (!brut) return null
    const v = JSON.parse(brut) as Partial<InvitationEnAttente>
    return typeof v.jeton === 'string' ? { jeton: v.jeton, nom: v.nom ?? '' } : null
  } catch {
    return null
  }
}

export function ecrireInvitationEnAttente(inv: InvitationEnAttente) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(inv))
  } catch {
    // stockage indisponible (navigation privée) : l'invitation reste dans l'adresse de la page
  }
}

export function effacerInvitationEnAttente() {
  try {
    localStorage.removeItem(CLE_STOCKAGE)
  } catch {
    // rien à effacer
  }
}
