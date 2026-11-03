import { useCallback, useState } from 'react'
import { allerA, useAdresse } from '../../core/adresse'
import { messageErreur, type Profil } from '../../core/compte'
import { choisirSansMontre, nonLus, objectifsDe, profilSportif, useCharge } from '../../core/donnees'
import { ModulesActifs, modulesDe } from '../../core/modules'
import type { Client } from '../../core/supabase'
import { BarreOnglets, Chargement, Message, Page, Pastille, type Onglet } from '../../core/ui'
import { Messages } from '../commun/Messages'
import { Progres } from '../commun/Progres'
import { Aujourdhui } from './Aujourdhui'
import { LierMontre } from './LierMontre'
import { ModeEmploi } from './ModeEmploi'
import { QuestionnaireArrivee } from './QuestionnaireArrivee'
import { Reglages } from './Reglages'
import { Saison } from './Saison'
import { Semaine } from './Semaine'

const TITRES = {
  '': 'Aujourd’hui',
  '#/semaine': 'Semaine',
  '#/saison': 'Saison',
  '#/progres': 'Progrès',
  '#/messages': 'Messages',
  '#/reglages': 'Réglages',
  '#/aide': 'Mode d’emploi',
} as const

export function EspaceEleve({ client, profil, deconnecter }: { client: Client; profil: Profil; deconnecter: () => void }) {
  const hash = useAdresse()
  const actif = (hash in TITRES ? hash : '') as keyof typeof TITRES
  const { donnees: d, erreur, recharger } = useCharge(async () => {
    const [sportif, objectifs, modules] = await Promise.all([profilSportif(client, profil.id), objectifsDe(client, profil.id), modulesDe(client, profil.id)])
    return { sportif, objectifs, actifs: modules.filter((m) => m.statut === 'actif').map((m) => m.module) }
  }, [client, profil.id])
  const sportif = d?.sportif
  const { donnees: aLire, recharger: rechargerLus } = useCharge(() => nonLus(client, profil.id), [client, profil.id])
  const [editer, setEditer] = useState(false)
  const lus = useCallback(() => rechargerLus(), [rechargerLus])

  if (erreur) return <Page titre="Oups"><Message type="erreur">{messageErreur(erreur)}</Message></Page>
  if (!d) return <Page titre="…"><Chargement /></Page>
  if (!sportif || editer)
    return <QuestionnaireArrivee client={client} eleve={profil.id} initial={sportif} objectifsInitiaux={d.objectifs} annuler={sportif ? () => setEditer(false) : undefined} termine={() => (setEditer(false), recharger())} />

  // Avant d'accéder à l'appli : relier sa montre (ou dire qu'on n'en a pas)
  if (sportif.liaison === null)
    return (
      <Page surtitre="Dernière étape" titre="Relie ta montre">
        <p className="text-sm text-texte-2">Tes sorties arriveront toutes seules dans l’appli et chez ton coach : tu n’auras plus qu’à dire comment s’est passée ta séance. 5 minutes, une seule fois.</p>
        <LierMontre client={client} fini={() => recharger()} sansMontre={() => choisirSansMontre(client, profil.id)} />
      </Page>
    )

  const onglets: Onglet[] = [
    { cle: '', libelle: 'Aujourd’hui', icone: '☀️' },
    { cle: '#/semaine', libelle: 'Semaine', icone: '🗓️' },
    { cle: '#/saison', libelle: 'Saison', icone: '🧭' },
    { cle: '#/progres', libelle: 'Progrès', icone: '📈' },
  ]
  const aLireMoi = aLire?.[profil.id] ?? 0
  const icone = (cle: string, symbole: string, libelle: string, pastille = 0) => (
    <button type="button" aria-label={libelle} onClick={() => allerA(actif === cle ? '' : cle)} className={`relative rounded-xl px-2 py-1 text-2xl ${actif === cle ? 'bg-surface-2' : ''}`}>
      {symbole}
      {pastille > 0 && (
        <span className="absolute -top-1 -right-1">
          <Pastille ton="alerte">{pastille}</Pastille>
        </span>
      )}
    </button>
  )

  return (
    <ModulesActifs.Provider value={d.actifs}>
    <Page
      surtitre={profil.nom ? `Bonjour ${profil.nom}` : 'Bonjour'}
      titre={TITRES[actif]}
      barre={<BarreOnglets onglets={onglets} actif={onglets.some((o) => o.cle === actif) ? actif : 'aucun'} choisir={allerA} />}
      action={
        <div className="flex gap-1">
          {icone('#/messages', '💬', 'Messages', aLireMoi)}
          {icone('#/reglages', '⚙️', 'Réglages')}
        </div>
      }
    >
      {actif === '' && <Aujourdhui client={client} eleve={profil.id} profil={sportif} />}
      {actif === '#/semaine' && <Semaine client={client} eleve={profil.id} profil={sportif} />}
      {actif === '#/saison' && <Saison client={client} eleve={profil.id} profil={sportif} />}
      {actif === '#/progres' && <Progres client={client} eleve={profil.id} />}
      {actif === '#/messages' && <Messages client={client} eleve={profil.id} moi={profil.id} auLu={lus} />}
      {actif === '#/reglages' && <Reglages client={client} moi={profil.id} modifierProfil={() => setEditer(true)} deconnecter={deconnecter} auChangement={recharger} />}
      {actif === '#/aide' && <ModeEmploi />}
    </Page>
    </ModulesActifs.Provider>
  )
}
