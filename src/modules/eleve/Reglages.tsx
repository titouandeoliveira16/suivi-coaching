import type { Client } from '../../core/supabase'
import { Bouton, Carte } from '../../core/ui'
import { CarteModules } from '../commun/CarteModules'
import { ReglagesNotifications } from '../commun/ReglagesNotifications'
import { MaMontre } from './MaMontre'

/** Le strict nécessaire : profil, notifications, mode d'emploi, déconnexion. */
export function Reglages({ client, moi, modifierProfil, deconnecter, auChangement }: { client: Client; moi: string; modifierProfil: () => void; deconnecter: () => void; auChangement: () => void }) {
  return (
    <>
      <Carte titre="Mon profil">
        <p className="mb-3 text-sm text-texte-2">Tes disponibilités, tes objectifs et ton matériel : le programme suit tes changements dès la semaine suivante.</p>
        <Bouton variante="discret" className="w-full" onClick={modifierProfil}>
          Modifier mon profil
        </Bouton>
      </Carte>
      <MaMontre client={client} auChangement={auChangement} />
      <CarteModules client={client} eleve={moi} role="eleve" auChangement={auChangement} />
      <ReglagesNotifications client={client} moi={moi} role="eleve" />
      <Bouton variante="discret" onClick={deconnecter}>
        Me déconnecter
      </Bouton>
    </>
  )
}
