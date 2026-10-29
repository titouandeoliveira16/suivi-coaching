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
- `src/app/` : coquille (connexion, invitation, aiguillage coach / élève). Nommage en français (`seance`, `eleve`, `valider`…).
- `src/moteur/` : moteur de règles pur et testé — objectifs (`objectifs.ts` : 25 types, priorités A/B/C, séance clé,
  points d'attention), profil (niveau, unité, PAR-Q+, minutes par jour, lieux, santé), phases (affûtage Bosquet 2007),
  charge (règles de Coach, plafond course Nielsen 2014), construction de la semaine, feu du jour (questionnaire du matin,
  VFC), allègements et douleur (Silbernagel 2007), renfo (OMS 2020), course ≤ 1,1 × la plus longue du mois (Frandsen 2025). Banque de séances : `banque.json`, extraite du catalogue de Coach.
- `src/core/donnees.ts` : accès au serveur (lecture, propositions, validation, allègements via fonctions serveur).
- `src/modules/eleve/` (Aujourd'hui, Programme, Progrès, Messages, questionnaires) et `src/modules/coach/`
  (Élèves, À valider, fiche élève).
- Le moteur allège seul (feu orange/rouge, maladie, douleur) et prévient le coach ; toute hausse de charge et chaque
  semaine attendent la validation du coach ; sans validation le lundi, la semaine précédente est reconduite.
- Serveur : projet Supabase **séparé** de celui de Coach ; SQL dans `supabase/sql/` (01 comptes, 02 programme, 03 objectifs), exécuté
  à la main dans le SQL Editor. Toute nouvelle table reçoit ses droits et ses règles RLS explicitement. Les scripts
  se testent sur un PostgreSQL local (schéma `auth` et rôles `anon`/`authenticated` imités).
