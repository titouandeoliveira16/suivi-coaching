import { useState } from 'react'
import { messageErreur } from '../../core/compte'
import { relierIntervals } from '../../core/intervals'
import type { Client } from '../../core/supabase'
import { Bouton, Carte, Champ, Message } from '../../core/ui'

const ETAPES: { titre: string; points: string[]; lien?: [string, string] }[] = [
  {
    titre: 'Crée ton compte Intervals.icu',
    points: ['C’est gratuit. Inscris-toi avec ton email (ou ton compte Google).', 'Intervals.icu récupère les sorties de presque toutes les montres et compteurs, et les transmet à ton coach.'],
    lien: ['Ouvrir intervals.icu', 'https://intervals.icu'],
  },
  {
    titre: 'Relie ta montre et ton compteur',
    points: [
      'Sur Intervals : menu ☰ → Settings → rubrique « Connections ».',
      'Touche « Connect » à côté de chacun de tes appareils : Garmin Connect, COROS, Wahoo, Polar, Suunto ou Zwift. Accepte le partage sur la page qui s’ouvre.',
      'Ne passe pas par Strava : Strava interdit de transmettre tes sorties à d’autres applis.',
    ],
    lien: ['Ouvrir les réglages Intervals', 'https://intervals.icu/settings'],
  },
  {
    titre: 'Copie ta clé',
    points: ['Toujours dans Settings, tout en bas : « Developer Settings ».', 'À la ligne « API Key », touche « View » (ou « Generate » s’il n’y en a pas encore), puis copie la clé (une suite de lettres et de chiffres).'],
  },
  {
    titre: 'Colle-la ici',
    points: ['Elle est gardée chiffrée sur le serveur et sert seulement à lire tes sorties (durée, puissance, fréquence cardiaque) et ta VFC de la nuit. Jamais ta trace GPS.'],
  },
]

/** Tuto pour relier sa montre via Intervals.icu, avec l'option « pas de montre connectée ». */
export function LierMontre({ client, fini, sansMontre }: { client: Client; fini: (texte: string) => void; sansMontre?: () => Promise<void> }) {
  const [cle, setCle] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  async function agir(action: () => Promise<string>) {
    setOccupe(true)
    setErreur('')
    try {
      fini(await action())
    } catch (e) {
      setErreur(e instanceof Error && !/^[a-z_]+$/.test(e.message) ? e.message : messageErreur(e))
      setOccupe(false)
    }
  }

  return (
    <>
      {ETAPES.map((e, i) => (
        <Carte key={e.titre} titre={`${i + 1}. ${e.titre}`}>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-texte-2">
            {e.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {e.lien && (
            <a href={e.lien[1]} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl bg-surface-2 px-4 py-3 text-center text-sm font-semibold text-accent">
              {e.lien[0]} ↗
            </a>
          )}
          {i === ETAPES.length - 1 && (
            <div className="mt-3 flex flex-col gap-2">
              <Champ etiquette="Ta clé API Intervals.icu" autoComplete="off" autoCapitalize="off" spellCheck={false} value={cle} onChange={(x) => setCle(x.target.value)} />
              <Bouton disabled={occupe || cle.trim().length < 10} onClick={() => agir(async () => {
                const r = await relierIntervals(client, cle)
                return `✅ Relié${r.nom ? ` au compte de ${r.nom}` : ''} : ${r.importees} sortie(s) récente(s) trouvée(s).`
              })}>
                {occupe ? 'Vérification…' : 'Relier ma montre'}
              </Bouton>
            </div>
          )}
        </Carte>
      ))}
      {erreur && <Message type="erreur">{erreur}</Message>}
      {sansMontre && (
        <Bouton variante="discret" disabled={occupe} onClick={() => agir(async () => (await sansMontre(), 'Pas de montre : tu saisiras tes séances à la main.'))}>
          Je n’ai pas de montre connectée
        </Bouton>
      )}
    </>
  )
}
