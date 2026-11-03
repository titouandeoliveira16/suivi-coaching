import { allerA } from '../../core/adresse'
import type { Client } from '../../core/supabase'
import { Bouton, Carte } from '../../core/ui'
import { ReglagesNotifications } from '../commun/ReglagesNotifications'
import { MaMontre } from './MaMontre'

/** Le strict nécessaire : profil, notifications, mode d'emploi, déconnexion. */
export function Reglages({ client, moi, modifierProfil, deconnecter, auChangement }: { client: Client; moi: string; modifierProfil: () => void; deconnecter: () => void; auChangement: () => void }) {
  return (
    <>
      <Carte titre="👤 Mon profil">
        <p className="mb-3 text-sm text-texte-2">Tes disponibilités, tes objectifs et ton matériel : le programme suit tes changements dès la semaine suivante.</p>
        <Bouton variante="discret" className="w-full" onClick={modifierProfil}>
          Modifier mon profil
        </Bouton>
      </Carte>
      <MaMontre client={client} auChangement={auChangement} />
      <ReglagesNotifications client={client} moi={moi} role="eleve" />
      <Carte titre="📖 Mode d’emploi">
        <p className="mb-3 text-sm text-texte-2">Comment marche l’appli, en 2 minutes.</p>
        <Bouton variante="discret" className="w-full" onClick={() => allerA('#/aide')}>
          Lire le mode d’emploi
        </Bouton>
      </Carte>
      <Bouton variante="discret" onClick={deconnecter}>
        Me déconnecter
      </Bouton>
    </>
  )
}
