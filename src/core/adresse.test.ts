import { describe, expect, it } from 'vitest'
import { adresseEleve, eleveDepuisAdresse } from './adresse'

const ID = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90'

describe('adresse d’une fiche élève', () => {
  it('fait l’aller-retour', () => {
    expect(eleveDepuisAdresse(adresseEleve(ID))).toBe(ID)
    expect(eleveDepuisAdresse(`#/eleve/${ID}/`)).toBe(ID)
  })

  it('ignore les autres adresses', () => {
    expect(eleveDepuisAdresse('')).toBeNull()
    expect(eleveDepuisAdresse('#/eleve/123')).toBeNull()
    expect(eleveDepuisAdresse(`#/invitation/${ID.replaceAll('-', '')}`)).toBeNull()
  })
})
