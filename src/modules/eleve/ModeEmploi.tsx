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
    'Tu vois toujours la semaine en cours et la suivante (flèche ›), préparées par ton coach.',
    'Un empêchement ? Dans Semaine, touche la séance, puis choisis celle avec laquelle l’échanger. L’appli grise ce qui serait mauvais pour toi (deux jours durs d’affilée, un jour trop court…), avec la raison, et ton coach est prévenu.',
    'Si ta semaine a été plus dure que prévu, la suivante est allégée automatiquement. Elle n’est jamais alourdie sans ton coach.',
  ]],
  ['📈 Ta saison et tes progrès', [
    'Saison : les blocs de ton année (base, développement, spécifique, affûtage) et où tu en es.',
    'Une semaine sur 4 est plus légère : c’est là que le corps assimile le travail.',
    'Des tests réguliers (CP en vélo) mettent tes cibles à jour : fais-les à fond, ils servent à tout le reste.',
  ]],
  ['🧩 Modules', [
    'Renfo, Muscu, Nutrition : demande-les dans Réglages. Ton coach valide et les intègre à ton programme dès la semaine suivante.',
    'Muscu : 2 séances par semaine en préparation, puis 1 pour entretenir ; toujours après ta sortie, jamais la veille d’une séance dure.',
    'Nutrition : sous chaque séance (« Voir le déroulé »), quoi manger avant, pendant et après.',
  ]],
  ['🩹 Douleur ou maladie', [
    'Signale toute douleur, même petite. Au-delà de 3/10, ou si tu boites, ton coach est prévenu et tes séances sont adaptées.',
    'Malade avec de la fièvre : repos complet, l’appli le gère pour toi.',
  ]],
  ['💬 Ton coach', [
    'Messages, en bas de l’écran : une question, un empêchement, une course ajoutée, écris-lui.',
    'Réglages, en bas : ton profil, tes disponibilités, ta montre, les modules, tes notifications.',
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
