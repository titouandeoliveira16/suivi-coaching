import { Bouton, Champ, OuiNon } from '../../core/ui'
import { GROUPES, OBJECTIFS, param, type TypeObjectif } from '../../moteur/objectifs'
import type { Objectif } from '../../moteur/types'

export const nouvelObjectif = (priorite: Objectif['priorite'] = 'A'): Objectif => ({
  id: crypto.randomUUID(),
  type: 'forme',
  nom: '',
  date: null,
  priorite,
  distance_km: null,
  denivele_m: null,
  chaleur: false,
  altitude: false,
})

const AVEC_DENIVELE = ['trail-court', 'trail-long', 'velo-montagne', 'velo-cyclo', 'velo-gravel-ultra', 'velo-kom']
const choix = 'w-full rounded-xl border border-bordure bg-surface-2 px-3 py-3 text-base text-texte'

/** Liste des objectifs de la saison, avec priorité A (le grand objectif), B (important) ou C (préparation). */
export function ObjectifsEditeur({ objectifs, onChange }: { objectifs: Objectif[]; onChange: (o: Objectif[]) => void }) {
  const maj = (id: string, champs: Partial<Objectif>) => onChange(objectifs.map((o) => (o.id === id ? { ...o, ...champs } : o)))
  return (
    <div className="flex flex-col gap-4">
      {objectifs.map((o, i) => {
        const pp = param(o.type)
        return (
          <div key={o.id} className="flex flex-col gap-3 rounded-xl border border-bordure p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Objectif {i + 1}</span>
              {objectifs.length > 1 && (
                <Bouton variante="lien" className="text-sm" onClick={() => onChange(objectifs.filter((x) => x.id !== o.id))}>
                  Retirer
                </Bouton>
              )}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-texte-2">Ce que tu veux faire</span>
              <select className={choix} value={o.type} onChange={(e) => maj(o.id, { type: e.target.value, date: param(e.target.value).competitif ? o.date : null })}>
                {GROUPES.map((g) => (
                  <optgroup key={g} label={g}>
                    {(Object.entries(OBJECTIFS) as [TypeObjectif, (typeof OBJECTIFS)[TypeObjectif]][])
                      .filter(([, v]) => v.groupe === g)
                      .map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.libelle}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <span className="text-xs text-texte-3">{pp.aide}</span>
            </label>
            <Champ etiquette="Nom (facultatif)" placeholder="ex. 10 km de ma ville, l’Étape du Tour, un premier 100 km" value={o.nom} onChange={(e) => maj(o.id, { nom: e.target.value })} />
            {(pp.competitif || o.type === 'debuter-course') && <Champ etiquette={pp.competitif ? 'Date' : 'Date d’une première course (facultatif)'} type="date" value={o.date ?? ''} onChange={(e) => maj(o.id, { date: e.target.value || null })} />}
            {pp.competitif && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-texte-2">Importance</span>
                <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
                  {(['A', 'B', 'C'] as const).map((pr) => (
                    <button key={pr} type="button" onClick={() => maj(o.id, { priorite: pr })} className={`flex-1 rounded-lg px-2 py-2 text-sm ${o.priorite === pr ? 'bg-accent font-semibold text-fond' : 'text-texte-3'}`}>
                      {pr === 'A' ? 'A · le grand objectif' : pr === 'B' ? 'B · important' : 'C · pour s’entraîner'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pp.competitif && (
              <div className="grid grid-cols-2 gap-2">
                <Champ etiquette="Distance (km)" inputMode="decimal" value={o.distance_km ?? ''} onChange={(e) => maj(o.id, { distance_km: e.target.value ? Number(e.target.value.replace(',', '.')) : null })} />
                {AVEC_DENIVELE.includes(o.type) && <Champ etiquette="Dénivelé + (m)" inputMode="numeric" value={o.denivele_m ?? ''} onChange={(e) => maj(o.id, { denivele_m: e.target.value ? Number(e.target.value) : null })} />}
              </div>
            )}
            {pp.competitif && (
              <>
                <OuiNon etiquette="Épreuve par forte chaleur ?" valeur={o.chaleur} onChange={(v) => maj(o.id, { chaleur: v })} />
                <OuiNon etiquette="Épreuve en altitude (plus de 1 500 m) ?" valeur={o.altitude} onChange={(v) => maj(o.id, { altitude: v })} />
              </>
            )}
          </div>
        )
      })}
      <Bouton variante="discret" onClick={() => onChange([...objectifs, nouvelObjectif(objectifs.length ? 'B' : 'A')])}>
        + Ajouter un objectif
      </Bouton>
    </div>
  )
}
