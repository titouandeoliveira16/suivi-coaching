import { describe, expect, it } from 'vitest'
import { jetonDepuisAdresse, lienInvitation } from './invitation'

const JETON = '0123456789abcdef0123456789abcdef'

describe('invitations', () => {
  it('retrouve le jeton dans l’adresse', () => {
    expect(jetonDepuisAdresse(`#/invitation/${JETON}`)).toBe(JETON)
    expect(jetonDepuisAdresse(`#/invitation/${JETON}/`)).toBe(JETON)
    expect(jetonDepuisAdresse('#/invitation/abc')).toBeNull()
    expect(jetonDepuisAdresse('')).toBeNull()
  })

  it('construit le lien à partir de l’adresse de l’appli', () => {
    expect(lienInvitation('https://exemple.github.io/suivi-coaching/#/autre', JETON)).toBe(
      `https://exemple.github.io/suivi-coaching/#/invitation/${JETON}`,
    )
    expect(jetonDepuisAdresse(new URL(lienInvitation('https://x.io/app/', JETON)).hash)).toBe(JETON)
  })
})
