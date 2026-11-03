import { Carte } from '../../core/ui'

const SECTIONS: [string, string[]][] = [
  ['☀️ Chaque matin', [
    'Réponds au questionnaire du matin : 30 secondes (sommeil, énergie, jambes, stress, humeur).',
    'Tu obtiens ton feu du jour. Vert : la séance est faite comme prévu. Orange : elle est allégée. Rouge : 30 à 45 min très faciles, ou repos si tu es malade.',
    'L’allègement se fait tout seul, et ton coach est prévenu. Réponds honnêtement : c’est ce qui te fait progresser sans te blesser.',
  ]],
  ['🚴 Ta séance', [
    'Touche « Voir le déroulé » : chaque étape a sa durée et sa cible (en watts si tu as un capteur, sinon en fréquence cardiaque ou en sensations).',
    'Après la séance, touche « J’ai fait ma séance » : durée, effort ressenti, et si tu as eu mal quelque part.',
    'Montre reliée (Réglages → Ma montre) : ta sortie arrive toute seule, environ une heure après. Il ne reste qu’à ajouter ton ressenti.',
    'L’effort ressenti va de 0 (repos) à 10 (maximal) : 3-4 pour une sortie facile, 7-8 pour des intervalles durs.',
  ]],
  ['🗓️ Ta semaine', [
    'Tu vois toujours la semaine en cours et la suivante, préparées par ton coach.',
    'Un empêchement ? Touche « ⇄ Intervertir » sur une séance, puis choisis le jour avec lequel échanger. L’appli refuse ce qui serait mauvais pour toi (deux jours durs d’affilée, un jour trop court…) et ton coach est prévenu.',
    'Si ta semaine a été plus dure que prévu, la suivante est allégée automatiquement. Elle n’est jamais alourdie sans ton coach.',
  ]],
  ['📈 Ta saison et tes progrès', [
    'Saison : les blocs de ton année (base, développement, spécifique, affûtage) et où tu en es.',
    'Une semaine sur 4 est plus légère : c’est là que le corps assimile le travail.',
    'Des tests réguliers (CP en vélo) mettent tes cibles à jour : fais-les à fond, ils servent à tout le reste.',
  ]],
  ['🩹 Douleur ou maladie', [
    'Signale toute douleur, même petite. Au-delà de 3/10, ou si tu boites, ton coach est prévenu et tes séances sont adaptées.',
    'Malade avec de la fièvre : repos complet, l’appli le gère pour toi.',
  ]],
  ['💬 Ton coach', [
    'L’icône 💬 en haut ouvre tes messages. Une question, un empêchement, une course ajoutée : écris-lui.',
    'Réglages (⚙️) : ton profil, tes disponibilités, tes notifications.',
  ]],
]

export function ModeEmploi() {
  return (
    <>
      {SECTIONS.map(([titre, points]) => (
        <Carte key={titre} titre={titre}>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-texte-2">
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Carte>
      ))}
    </>
  )
}
