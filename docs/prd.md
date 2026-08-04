# PRD — morpho

## Target SaaS
Aucune cible existante. Décision assumée : on part de zéro à partir du besoin, pas d'une spec à répliquer.

Les apps du marché servent de repères de comparaison, pas de spécification :
- **Renpho Health** (https://renpho.com) — poids + composition corporelle, lié à leur matériel
- **MyFitnessPal** (https://myfitnesspal.com) — le module *Progress / Measurements* noyé sous la nutrition
- **Withings Health Mate** (https://withings.com) — écosystème fermé sur leur balance

Conséquence pour la suite du pipeline : il n'y a pas de parité à atteindre. Le périmètre ci-dessous **est** la spec. Toute question « comment la cible fait-elle ça ? » se répond par une décision explicite, à consigner en ADR.

## Kill mode
**Internal replacement** — outil personnel, un seul utilisateur réel (Olivier), code écrit proprement pour pouvoir être ouvert plus tard (« perso + partageable »).

Ce que ça implique pour le scope :
- Pas de rôles, pas d'équipes, pas d'onboarding, pas de facturation, pas d'écran d'admin.
- L'auth existe **uniquement** pour rattacher les données à une identité côté serveur, pas pour gérer une population d'utilisateurs.
- Pas de contrainte de compatibilité navigateur large : cible = le téléphone du propriétaire (iOS Safari récent) + desktop pour le dev.
- « Partageable » ne veut pas dire multi-tenant au v1. Ça veut dire : pas de valeurs en dur, pas de données perso dans le code, schéma déjà scopé par `user_id`.

## Why kill it
Il n'y a rien à cesser de payer. Le coût évité est ailleurs :

- **Le poids est le seul chiffre que les apps existantes mettent en avant.** Les mensurations — celles qui bougent quand la balance stagne — sont enterrées dans un sous-menu. C'est exactement l'inverse du besoin.
- **Comptes, pubs, écrans premium, tracking** pour saisir dix nombres par semaine.
- **Les données sont chez l'éditeur**, dans un format qu'on ne contrôle pas, exportable au mieux en CSV appauvri.
- **Dépendance matérielle** (Renpho, Withings) pour des mesures prises au mètre ruban.

Ce dont on n'a besoin d'aucune manière : le journal alimentaire, la base de données d'aliments, le scan de code-barres, le réseau social, les défis, les badges, le coaching.

## Problem
Suivre une perte de poids et une transformation morphologique dans le temps, avec une saisie assez rapide pour être tenue sur des mois, et une restitution qui montre **où** le corps change — pas seulement combien pèse la balance.

Pourquoi maintenant : la perte de poids est en cours. Sans historique structuré, la progression est invisible entre deux paliers, et c'est précisément là qu'on abandonne.

## Target users
Utilisateur unique : Olivier, propriétaire de l'outil.

Contexte d'usage, qui contraint tout le reste :
- **Debout, dans une salle de bain, téléphone à une main, mètre ruban dans l'autre.** Pas assis devant un écran.
- Session de saisie courte et irrégulière : parfois le poids seul, parfois toutes les mesures.
- Consultation à froid, plus tard, pour voir la tendance.
- Connexion réseau non garantie au moment de la saisie.

## Perimeter — the 20% that matters

### Replicated (core loop)

La boucle de valeur : **je saisis mes mesures → je vois où mon corps a changé → je vois la tendance dans le temps.**

| Feature | Complexity (1-5) | Why this score |
|---|---|---|
| Saisie d'une session de mesures | 2 | Formulaire mono-écran, tous champs optionnels, pré-remplis avec la dernière valeur connue. Inputs numériques adaptés au mobile. Objectif : moins de 20 s. Pas de logique métier au-delà de la validation de plages. |
| Modèle de données + persistance Neon | 3 | Schéma Postgres (`users`, `measurement_sessions`, `measurements`), migrations, scoping par `user_id`. Une session = une date + N mesures optionnelles. Pas de temps réel, pas de migration de données existantes. |
| API serverless (Vercel Functions) | 3 | CRUD sessions, lecture de l'historique, validation serveur. Neon n'a pas de SDK client : la couche API n'est pas un choix d'architecture, c'est la condition pour que la base ne soit pas publique en écriture. |
| Auth magic link (Neon Auth) | 3 | Intégration d'un service existant (Stack Auth), pas d'auth maison. Ce qui coûte : la gestion de session côté PWA et la protection des routes API. Serait un 5 si on l'écrivait nous-mêmes. |
| Vue schéma corporel (silhouette SVG) | 3 | Silhouette dessinée, chaque zone porte sa valeur actuelle et son delta depuis la première mesure. Coloration selon le sens de la progression. C'est l'écran d'accueil. Complexité = le SVG lisible et responsive, pas la logique. |
| Vue graphes d'évolution (line chart) | 3 | Une courbe par mesure, sélection de la mesure affichée, gestion des trous (toutes les mesures ne sont pas saisies à chaque session), axe temporel irrégulier. |
| Poids cible | 1 | Une valeur stockée, une ligne horizontale de référence sur le graphe du poids, un écart affiché. Cible unique — pas de cibles par mensuration. |
| IMC + % masse grasse / muscle | 2 | IMC calculé (taille de référence stockée une fois). Masse grasse et masse musculaire saisies manuellement — traitées comme des mesures ordinaires, aucun calcul d'estimation. |
| Shell PWA installable + offline de lecture | 3 | Manifest, icônes, service worker. L'app doit s'ouvrir et afficher le dernier état connu sans réseau. **Installation sur l'écran d'accueil obligatoire** : iOS purge le stockage d'un site non installé après 7 jours sans visite. |

**Mesures suivies au v1** : poids, tour de poitrine, biceps, tour de taille, hanches, cuisse, mollet, épaules, % masse grasse, % masse musculaire, IMC (calculé).

### Explicitly NOT replicated (graveyard)

- **Nutrition** — journal alimentaire, calories, macros, base d'aliments, scan de code-barres. Le cœur de MyFitnessPal, hors sujet ici, et un gouffre à lui seul.
- **Suivi d'entraînement** — séances, séries, répétitions, charges, exercices. Le brief initial disait « performances sportives », le besoin réel décrit ne parle que de mensurations. Tué au v1, assumé.
- **Photos de progression** — selfies avant/après datés. Coûteux en stockage et en UX (cadrage, lumière, confidentialité). Candidat v2.
- **Intégrations** — balances Bluetooth, Apple Health, Google Fit, Health Connect. Saisie manuelle uniquement. Chaque intégration est un projet à part entière.
- **Notifications push / rappels de pesée** — la saisie est libre, quand l'envie vient. Le push sur iOS PWA est un coût disproportionné pour un rappel.
- **Cibles par mensuration** — seul le poids a une cible au v1.
- **Multi-utilisateur réel** — pas d'invitation, pas de partage, pas de coach, pas de comparaison entre utilisateurs.
- **Social** — flux, amis, défis, badges, classements.
- **Rapports & export** — PDF, CSV, tableau de bord de synthèse. Les données sont en base Postgres, accessibles en SQL si besoin.
- **Multi-unités** — métrique uniquement (kg, cm). Pas de livres, pas de pouces.
- **Écriture offline** — l'app lit hors ligne, mais une saisie nécessite le réseau. La file d'attente offline avec résolution de conflits est un problème dur ; le contexte d'usage (salle de bain, wifi domestique) ne le justifie pas. À revoir si ça se révèle pénible à l'usage.

### The angle (done differently / better)

1. **Le corps est l'écran d'accueil.** Pas un onglet, pas un sous-menu : on ouvre l'app, on voit une silhouette annotée des deltas depuis le départ. Les apps existantes ouvrent sur un chiffre de balance ou un journal alimentaire.
2. **Saisie sous 20 secondes.** Un écran, zéro navigation, champs pré-remplis avec la dernière valeur — la plupart du temps il n'y a qu'un chiffre à corriger. C'est la condition pour que l'outil soit encore utilisé dans six mois.
3. **Zéro compte au sens habituel, zéro pub, zéro upsell.** Un magic link par email, pas de mot de passe, pas d'écran premium, pas d'analytics tiers. Les données vivent dans une base Postgres qui appartient au propriétaire.
4. **Les mensurations au même rang que le poids.** Quand la balance stagne, le tour de taille bouge. L'app doit rendre ça visible sans avoir à le chercher.

## Constraints

**Techniques**
- PWA installable sur mobile, en React + Vite, dans le monorepo `multitool/` — nouveau sous-dossier `multitool/morpho/`, aligné sur la structure de `compoundSimulator/`.
- Base : **Neon** (Postgres serverless). Retenu contre Supabase parce que le tier gratuit Supabase suspend un projet après 7 jours d'inactivité, là où Neon ne fait que scale-to-zero (cold start ~500 ms, projet jamais suspendu). L'usage sera irrégulier : c'est le critère décisif.
- **Conséquence directe** : Neon n'expose pas de SDK client sécurisé. Une couche API serverless (Vercel Functions, dans le même dépôt) est obligatoire — la connection string ne doit jamais atteindre le bundle. Retenu : Vercel Functions + **Neon Auth** (Stack Auth intégré, users synchronisés dans la base).
- **Ça introduit un backend dans `multitool/`**, qui n'héberge aujourd'hui que des apps Vite statiques. Le déploiement de `morpho` n'est pas celui de `compoundSimulator` — à trancher en phase Architecture.
- Cold start Neon + latence Vercel : l'UI doit rester utilisable pendant le chargement (état optimiste à la saisie, squelettes à l'affichage).
- Cible : iOS Safari récent en priorité (mode standalone), desktop en secondaire.

**Temps & dépendances**
- Projet personnel, pas de deadline. Le vrai risque n'est pas le retard, c'est l'abandon : chaque story doit livrer quelque chose d'utilisable.
- Dépendances externes : Neon (base + auth), Vercel (hébergement + functions), un fournisseur d'email pour le magic link (fourni par Neon Auth).
- Le service worker doit être versionné correctement : une PWA installée qui sert un shell obsolète est un bug difficile à diagnostiquer sur mobile.

**Données**
- Volume attendu : ~10 mesures × ~1 session/semaine, soit quelques milliers de lignes sur plusieurs années. Aucune contrainte de performance.
- Métrique uniquement. Une mesure absente est une donnée normale, pas une erreur — le modèle et les graphes doivent traiter les trous comme le cas courant.

## Success criteria

Pas de cible à égaler : les critères sont ceux du périmètre et de l'angle, tous vérifiables.

**Boucle de base**
1. Une session de mesures se saisit et se persiste en base Neon, rattachée à l'utilisateur authentifié.
2. Une session partielle (poids seul) est acceptée sans erreur, et n'invente aucune valeur pour les mesures absentes.
3. Une session existante peut être corrigée et supprimée.
4. Les 10 mesures du périmètre sont saisissables ; l'IMC est calculé, jamais saisi.

**Restitution**
5. L'écran d'accueil est la silhouette, annotée pour chaque zone de la valeur la plus récente et du delta depuis la première mesure.
6. La silhouette est lisible sur un écran de téléphone en portrait, sans zoom ni défilement horizontal.
7. Le graphe affiche l'évolution de n'importe quelle mesure sélectionnée, avec un axe temporel correct sur des intervalles irréguliers.
8. Le poids cible apparaît comme référence sur le graphe du poids, avec l'écart restant.

**L'angle, mesuré**
9. Saisie complète des 10 mesures en **moins de 20 secondes**, chronométrée sur téléphone, à partir de l'app déjà ouverte. Le pré-remplissage avec la dernière valeur est ce qui rend le chiffre atteignable — sans lui, le critère tombe.
10. De l'ouverture de l'app à l'écran de saisie : **au plus un tap**.
11. Connexion par magic link, sans mot de passe. Aucune pub, aucun écran premium, aucun analytics tiers dans le bundle.

    **Précision apportée en cours de route.** Ce critère vise le tracking réel : **aucune dépendance d'analytics ou de marketing n'est ajoutée au projet, et aucune requête ne part vers un domaine tiers** — vérifié au réseau, pas au grep. Le motif : `serwist` (couche PWA, s10) embarque un support Google Analytics hors ligne que le tree-shaking ne retire pas, donc `/serwist/sw.js` contiendra les chaînes `google-analytics.com` et `googletagmanager.com`. Rien n'est initialisé, aucune route n'est enregistrée, aucune requête n'est émise. Rouvrir le choix de la couche PWA pour du texte inerte coûterait plus que ça ne protège, sur un outil personnel. Le critère se vérifie donc par l'absence de requête sortante — ce qu'un grep raterait de toute façon si un traceur était chargé dynamiquement.

**Résilience — la raison d'être du backend**
12. Depuis un appareil neuf, une connexion par magic link restaure l'intégralité de l'historique. C'est le critère qui justifie Neon plutôt qu'un stockage local : téléphone perdu ≠ données perdues.
13. L'app s'installe sur l'écran d'accueil iOS et s'ouvre en mode standalone.
14. Ouverte sans réseau, l'app affiche le dernier état connu au lieu d'une page d'erreur.

**Qualité**
15. La connection string Neon n'apparaît nulle part dans le bundle client — vérifiable par recherche dans les fichiers de build.
16. Un utilisateur authentifié ne peut lire ou écrire que ses propres données, vérifié côté serveur et non côté client.
