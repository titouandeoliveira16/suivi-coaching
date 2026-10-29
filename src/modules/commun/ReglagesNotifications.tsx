import { useEffect, useState } from 'react'
import { messageErreur } from '../../core/compte'
import { useCharge } from '../../core/donnees'
import {
  abonnementActuel,
  activerNotifications,
  appliInstallee,
  desactiverNotifications,
  enregistrerPreferences,
  preferencesNotifications,
  surIphone,
  testerNotifications,
  type PreferencesNotifications,
} from '../../core/notifications'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Message, OuiNon } from '../../core/ui'

const HEURES = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00']

const CHOIX: Record<'eleve' | 'coach', [keyof PreferencesNotifications, string][]> = {
  eleve: [
    ['matin', 'Le matin, un jour de séance : ton questionnaire'],
    ['soir', 'À 20 h, si ta séance n’est pas encore saisie'],
    ['semaine', 'Quand ton programme de la semaine est prêt'],
    ['messages', 'Quand ton coach t’écrit'],
  ],
  coach: [
    ['resume', 'Le dimanche à 18 h : semaines à valider'],
    ['alertes', 'Alertes (douleur, santé, séance allégée)'],
    ['messages', 'Messages des élèves'],
  ],
}

/** Activation des notifications sur cet appareil et choix de ce qu'on reçoit. */
export function ReglagesNotifications({ client, moi, role }: { client: Client; moi: string; role: 'eleve' | 'coach' }) {
  const { donnees: prefs, recharger } = useCharge(() => preferencesNotifications(client, moi), [client, moi])
  const [actif, setActif] = useState<boolean | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [info, setInfo] = useState<{ type: 'erreur' | 'succes'; texte: string } | null>(null)

  useEffect(() => {
    abonnementActuel().then((a) => setActif(!!a), () => setActif(false))
  }, [])

  async function agir(action: () => Promise<string | void>) {
    setOccupe(true)
    setInfo(null)
    try {
      const texte = await action()
      if (texte) setInfo({ type: 'succes', texte })
    } catch (e) {
      setInfo({ type: 'erreur', texte: messageErreur(e) })
    }
    setOccupe(false)
  }

  const changer = (champs: Partial<PreferencesNotifications>) =>
    prefs &&
    agir(async () => {
      await enregistrerPreferences(client, moi, { ...prefs, ...champs })
      recharger()
    })

  return (
    <Carte titre="🔔 Notifications">
      <div className="flex flex-col gap-3">
        {surIphone() && !appliInstallee() && !actif && (
          <Message>Sur iPhone, les notifications ne marchent que depuis l’écran d’accueil : dans Safari, touche Partager puis « Sur l’écran d’accueil », et ouvre l’appli depuis l’icône.</Message>
        )}
        {actif === false && (
          <Bouton disabled={occupe} onClick={() => agir(async () => (await activerNotifications(client), setActif(true), 'Notifications activées sur cet appareil.'))}>
            Activer les notifications sur cet appareil
          </Bouton>
        )}
        {actif && (
          <div className="flex gap-2">
            <Bouton variante="discret" className="flex-1" disabled={occupe} onClick={() => agir(async () => ((await testerNotifications(client)).envoyes ? 'Notification d’essai envoyée.' : 'Aucun appareil n’a reçu l’essai : désactive puis réactive.'))}>
              Essayer
            </Bouton>
            <Bouton variante="discret" className="flex-1" disabled={occupe} onClick={() => agir(async () => (await desactiverNotifications(client), setActif(false)))}>
              Désactiver ici
            </Bouton>
          </div>
        )}
        {info && <Message type={info.type}>{info.texte}</Message>}
        {prefs &&
          CHOIX[role].map(([cle, libelle]) => (
            <div key={cle} className="flex flex-col gap-2">
              <OuiNon etiquette={libelle} valeur={prefs[cle] as boolean} onChange={(v) => changer({ [cle]: v })} />
              {cle === 'matin' && prefs.matin && (
                <label className="flex items-center justify-between gap-3 text-sm text-texte-2">
                  <span>À partir de</span>
                  <select className="rounded-xl border border-bordure bg-surface-2 px-3 py-2 text-texte" value={prefs.heure_matin} onChange={(e) => changer({ heure_matin: e.target.value })}>
                    {HEURES.map((h) => (
                      <option key={h} value={h}>
                        {h.replace(':', ' h ').replace(' h 00', ' h')}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
      </div>
    </Carte>
  )
}
