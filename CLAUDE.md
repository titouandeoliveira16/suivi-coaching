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
- `src/modules/eleve/` : Aujourd'hui · Semaine · Saison · Progrès (barre du bas), 💬 Messages et ⚙️ Réglages
  (profil, notifications, mode d'emploi) en haut ; `src/modules/coach/` (Élèves, À valider, fiche élève).
- Deux semaines à l'avance : la suivante est préparée pendant la semaine en cours (`anticipee`, comme si elle était
  réussie), puis réajustée à la baisse seulement quand elle commence (`moteur/reajustement.ts`, RPC `reajuster_semaine`).
- Intervertir deux séances (élève ou coach) : garde-fous dans `moteur/echange.ts`, RPC `intervertir_seances` (le coach
  est prévenu quand c'est l'élève).
- Le moteur allège seul (feu orange/rouge, maladie, douleur) et prévient le coach ; toute hausse de charge et chaque
  semaine attendent la validation du coach ; sans validation le lundi, la semaine précédente est reconduite.
- Serveur : projet Supabase **séparé** de celui de Coach ; SQL dans `supabase/sql/` (01 comptes, 02 programme, 03 objectifs, 04 notifications, 05 deux semaines, 06 intervals, 07 modules), exécuté
  à la main dans le SQL Editor. Toute nouvelle table reçoit ses droits et ses règles RLS explicitement. Les scripts
  se testent sur un PostgreSQL local (schéma `auth` et rôles `anon`/`authenticated` imités).
- Notifications : fonction serveur `supabase/functions/notifications` (Web Push, clés VAPID créées par elle-même,
  « Verify JWT » désactivé), collée à la main dans le tableau de bord. Messages, alertes et semaine validée passent
  par une file (`notifications_a_envoyer`) remplie par des déclencheurs ; rappels du matin, du soir et du dimanche
  (règles pures entre les marqueurs `debut regles` / `fin regles`, testées dans `src/core/rappels.test.ts`).
- Montre : tuto obligatoire après le questionnaire d'arrivée (`eleve/LierMontre.tsx`, ou « pas de montre connectée »,
  colonne `liaison`). Fonction serveur `supabase/functions/intervals` (clé API chiffrée, import toutes les heures par
  pg_cron) : sorties dans `activites`, rattachées à la séance du jour (règles testées dans `src/core/intervals.test.ts`),
  séance marquée faite le surlendemain si l'élève ne l'a pas saisie ; VFC de la nuit dans `bien_etre`.
- Modules (table `modules`) : l'élève demande dans Réglages, le coach accepte / active / retire dans la fiche.
  Renfo (poids du corps), Muscu (`moteur/muscu.ts` : force lourde Rønnestad 2010, 10/6RM → 8/5RM → 6/4RM puis entretien,
  jamais la veille d'une séance dure ni 4 j avant une course), Nutrition (`moteur/nutrition.ts`, repris de Coach,
  affichée sous chaque séance). Sans module renfo, plus de renfo dans le plan (la question du questionnaire est retirée).
