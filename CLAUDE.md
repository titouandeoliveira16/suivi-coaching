# Suivi Coaching — appli de coaching de Titouan pour ses élèves

PWA en français (iPhone d'abord, thème sombre, accent violet) pour le coaching individuel vélo + course.
Un moteur de règles propose les séances de chaque élève, Titouan les valide (ou ajuste) avant envoi,
l'élève fait sa séance et saisit ses résultats. Indépendante de l'appli perso `coach`.
En ligne : https://titouandeoliveira16.github.io/suivi-coaching/ (GitHub Pages, déployé à chaque push sur `main`).

Documents de cadrage (PRD, TRD, App Flow, Brief UX/UI, Schéma back-end, Plan d'implémentation) :
https://claude.ai/artifact/VADvDEMvyjDpPsEMoT14fE — les lire avant toute nouvelle phase.

## Façon de travailler avec Titouan
- Toujours répondre **en français**, simplement, en le tutoyant ; pas de jargon sans l'expliquer.
- **Ne rien changer sans son accord** quand il s'agit d'un choix : proposer d'abord, coder ensuite.
  Quand il dit « go » / « fais-le », enchaîner jusqu'au déploiement.
- Les règles du moteur doivent être **appuyées sur la littérature scientifique** (sous-agent
  `relecteur-scientifique`) ; le moteur **propose**, il n'envoie jamais rien à un élève sans validation du coach.
- Pas de service d'IA en ligne : le moteur est un ensemble de fonctions pures et testées.
- **Le dépôt est public : aucune donnée personnelle dans le code, les tests ou les docs** (noms d'élèves,
  emails, poids, FC, résultats…). Les données vivent uniquement dans Supabase, protégées par RLS.
- Ne jamais demander de coller un mot de passe, une clé ou un jeton dans la conversation.

## Commandes
- `npm run dev` · `npm test` (Vitest) · `npx tsc -b` · `npm run lint` (oxlint) · `npm run build`

## Repères
- `src/app/` : coquille de l'appli. Nommage en français dans le code (`seance`, `eleve`, `valider`…).
- Serveur : projet Supabase **séparé** de celui de Coach. Toute nouvelle table reçoit ses droits et ses règles RLS
  explicitement.
