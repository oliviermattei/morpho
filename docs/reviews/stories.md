# Stories Review — morpho (passe 2)

> Fresh-context review of `morpho/docs/stories.md` against `morpho/docs/prd.md`. Each issue classified: critical / major / minor.
> Deuxième passe : le rapport précédent (8 findings, `Max severity: major`) a été vérifié ligne à ligne dans le texte révisé, puis une revue complète a été refaite à zéro sur la version renumérotée s01→s10.

## Reprise du rapport précédent — vérification des 8 findings

| # | Finding v1 | Statut | Preuve dans le texte actuel |
|---|---|---|---|
| 1 | major — référence avant sur l'« au plus un tap » (ancien s04 vs s05) | **résolu** | s05 : « Depuis l'écran d'accueil **courant** […] (Re-vérifié en s06, qui remplace cet écran d'accueil.) » + s06 critère 8 : « **Non-régression de s05** : depuis cette silhouette […] au plus un tap » + s06 déclare s05 en dépendance à ce titre. |
| 2 | major — ancien s01 sur-agrégé, découpage différé au Plan | **résolu** | Découpé exactement comme prescrit : s01-deploy-skeleton (squelette + déploiement + route 401 + non-fuite de la connection string) et s02-connect-magic-link (magic link, session, déconnexion, utilisateur en base). Aucune mitigation conditionnelle ne subsiste ; les deux stories sont cotées 3. |
| 3 | minor — critère PRD #12 (appareil neuf) non asserté | **résolu** | s03, critère 8 : « Se connecter depuis un appareil vierge — autre navigateur, stockage local vide — restaure l'intégralité de l'historique après le magic link », + note « avec un profil de navigateur neuf, pas un simple vidage de cache ». |
| 4 | minor — moitié négative du critère #11 (pub / premium / analytics) absente | **résolu** | s01, critère 6 : recherche d'analytics/traceurs tiers dans le build + absence d'écran premium et d'emplacement publicitaire, adossée à l'angle n°3 dans les notes. (Réserve mineure, finding 6 ci-dessous.) |
| 5 | minor — critère de mise à jour du service worker vérifiable seulement après ship | **résolu** | s10, critère 6 : « **Avant merge** : sur un déploiement de preview installé sur l'appareil, deux déploiements successifs […] » + ligne « Post-ship (confirmation, hors gate) » sortie de la liste à cocher. |
| 6 | minor — « visuellement distinguables » non observable | **résolu** | s05, critère 3 : marqueur DOM (`data-prefilled="true"`) retiré à la première modification, explicitement posé comme ce qui rend le critère testable. |
| 7 | minor — « redirige vers l'écran d'accueil » désignait un écran inexistant | **résolu** | s02, critère 3 : « écran authentifié provisoire — écran d'accueil de cette story, remplacé par la silhouette en s06 — portant au minimum l'email connecté et le bouton de déconnexion ». |
| 8 | minor — « lisible sans zoom » subjectif | **résolu** | s06, critère 7 : « aucun défilement horizontal et aucun élément ne déborde du viewport ; les étiquettes […] respectent une taille de police minimale définie dans le design system ». (Réserve mineure, finding 3 ci-dessous.) |

8/8 traités, aucune correction de façade : les critères ont été réécrits, pas juste annotés.

**Contrôle de renumérotation** — toutes les références croisées ont été relues une par une. Toutes pointent sur la bonne story après le décalage +1 : `s03 référencera` (schéma FK, ex-s02 ✅), `traitée en s04` (IMC ✅), `c'est s05` (pré-remplissage ✅), `graphes en s07` ✅, `poids cible (s08)` ✅, `silhouette (s06)` ✅, `placeholder de s02` ✅. **Aucune référence orpheline ou périmée.** Aucun autre fichier du pipeline ne cite d'ancien id (seuls `prd.md`, `stories.md`, `reviews/stories.md` existent sous `morpho/docs/`).

## Perimeter coverage

| PRD feature (core loop) | Covered by | OK? |
|---|---|---|
| Saisie d'une session de mesures | s03-log-measurement-session (écran, 10 champs nommés, plages serveur, session partielle), s05-quick-entry-prefill (pré-remplissage, < 20 s, un tap) | ✅ |
| Modèle de données + persistance Neon (`users`, `measurement_sessions`, `measurements`, migrations, scoping `user_id`) | s01 (connexion Postgres prouvée côté serveur), s02 (utilisateur en base avec identifiant stable réutilisable en FK), s03 (schéma métier + mécanisme de migration versionné + filtrage serveur par identité) | ✅ |
| API serverless (Vercel Functions) — CRUD sessions, lecture historique, validation serveur | s01 (couche API + 401 sans session valide), s03 (create + read + liste + validation serveur), s09 (update + delete) | ✅ |
| Auth magic link (Neon Auth) | s02-connect-magic-link | ✅ |
| Vue schéma corporel (silhouette SVG) | s06-body-map | ✅ |
| Vue graphes d'évolution (line chart) | s07-measurement-charts | ✅ |
| Poids cible | s08-target-weight | ✅ |
| IMC + % masse grasse / muscle | s04-profile-height-bmi (taille de référence, IMC dérivé, jamais stocké), s03 (% masse grasse / musculaire saisis comme mesures ordinaires) | ✅ |
| Shell PWA installable + offline de lecture | s10-pwa-install-offline | ✅ |

Les 10 mesures du v1 sont énumérées nommément au critère 1 de s03 ; l'IMC est explicitement exclu de la saisie (s04, critère 4) et présent comme série sélectionnable en s07 (critère 1 : « les dix mesures suivies plus l'IMC »). Aucun trou.

Contrôle croisé des 16 critères de succès du PRD : #1 s03 · #2 s03 · #3 s09 · #4 s03+s04 · #5 s06 · #6 s06 · #7 s07 · #8 s08 · #9 s05 · #10 s05+s06 · #11 s02+s01 · #12 s03 · #13 s10 · #14 s10 · #15 s01 · #16 s02+s03+s09. Les 16 sont assertés par au moins un critère d'acceptation — c'était le trou de la passe 1 (#11 et #12), il est comblé.

- [x] Every feature of the PRD "Replicated (core loop)" table is delivered by at least one story

## Scope

- [x] No story reintroduces an item from the PRD graveyard ("Explicitly NOT replicated")
- [x] No story goes beyond the perimeter

Le graveyard reste activement défendu, story par story : s03 interdit tout sélecteur d'unité et l'estimation de masse grasse, s07 interdit le multi-séries et la moyenne mobile, s08 interdit la généralisation des cibles par mensuration et les projections de date, s10 exige un **refus explicite** de la saisie hors ligne (pas de file d'attente, pas de résolution de conflits), s06 interdit la navigation par zones cliquables. Le rappel final reprend le graveyard point par point. Le découpage n'a introduit aucune fuite.

Les critères d'accès croisé (s02, s03, s09) ne sont pas du multi-utilisateur réintroduit : ce sont les tests d'isolation exigés par le critère de succès #16, sans invitation ni partage.

## Story quality

- [x] Each story is an end-to-end shippable slice, not a technical layer
- [x] Every acceptance criterion can become a test — avec deux réserves mineures (findings 1 et 3)
- [x] Agentic notes present and useful (files, constraints, traps)
- [x] Complexity scored; no unsplit 5; every 4 states its risk — aucun 5, aucun 4 (scores : 3,3,3,2,2,3,3,2,2,3). Voir finding 2 sur la justesse du 3 de s03.

**Point examiné et accepté : s01 est-elle une couche technique déguisée ?** C'est la question centrale de cette passe, puisque s01 est née du correctif de la passe 1. Elle est à la limite — l'app livrée est quasi vide et sa valeur est l'étanchéité, pas un écran. Elle passe malgré tout, pour trois raisons : elle est déployable et shippable seule (URL publique fonctionnelle), chacun de ses huit critères est objectivement vérifiable sans autre story (401, route de santé, grep dans le build, non-régression de `compoundSimulator/`), et elle porte le risque réel du projet — l'introduction d'un backend dans un monorepo qui n'hébergeait que des apps Vite statiques. Ce n'est pas « créer la couche API » sans consommateur : c'est un walking skeleton dont la valeur testable est la sécurité du périmètre. **Pas de finding**, mais c'est le seul endroit du document où la règle est effleurée.

Le schéma Postgres et les migrations naissent dans s03, la story qui en a besoin — pas dans une story « mettre en place la base ». Le profil naît dans s04 et est réutilisé par s08, sans détour par un « système de préférences ». Les notes agentiques nomment le piège dominant de chaque story (`Number("") === 0`, « dernière valeur connue **par mesure** » ≠ « dernière session », `delta < 0 ? vert : rouge`, axe catégoriel qui ment sur la vitesse, collision des deux pré-remplissages, service worker mal versionné). Ce niveau est au-dessus de la moyenne.

## The list as a whole

- [x] Dependency order executable: no cycle, no forward reference
- [x] Ids well-formed (`s<number>-<slug>`), unique and stable
- [x] No overlap or duplication between stories

Graphe déclaré : s01 ← s02 ← s03 ← {s04, s05} ; s06 ← {s03, s04, s05} ; s07 ← {s03, s04} ; s08 ← {s07, s04} ; s09 ← {s03, s06, s07} ; s10 ← tout. Acyclique, et l'ordre annoncé s01→s10 en est un tri topologique valide. La seule référence avant de la passe 1 (le « un tap ») est devenue une non-régression explicitement portée par la story d'aval. Ids : s01→s10, continus, uniques, slugs courts et stables.

Recouvrement le plus probable — les deux pré-remplissages du même formulaire (s05 « dernière valeur connue » vs s09 « valeurs réellement enregistrées ») — reste arbitré noir sur blanc dans les notes de s09. Le second recouvrement possible, la liste d'historique (créée en s03, consommée en s09), est propre : création d'un côté, édition de l'autre.

## Findings

1. **minor — s02-connect-magic-link** — Le critère 8 (« une requête forgeant un autre identifiant n'accède pas aux données d'autrui ») porte sur des données métier qui n'existent pas encore à la livraison de s02 : à ce stade, seule l'entrée utilisateur est en base. La moitié testable ici est « l'identité serveur vient du token vérifié, jamais d'un identifiant envoyé par le client » ; formuler le critère contre la route protégée (elle ignore tout `user_id` du payload et répond avec l'identité dérivée du token) et laisser s03 (critère 7, déjà écrit) porter la version sur données réelles.

2. **minor — s03-log-measurement-session** — Score probablement sous-évalué. La story porte le premier schéma métier, le mécanisme de migration versionné, les deux premiers endpoints, la validation de plages serveur, l'isolation inter-utilisateurs, la liste d'historique et le critère de restauration depuis appareil vierge — soit la ligne PRD « Saisie » (2) plus des parts substantielles de « Modèle de données » (3) et « API serverless » (3), le tout coté 3. La **forme** est juste (le schéma naît dans la story qui en a besoin, c'est la règle), donc pas de découpage à exiger ; mais un 4 assumé, dont les notes énoncent déjà les risques, serait plus honnête qu'un 3 — et ferait exister le risque au moment du Plan.

3. **minor — s06-body-map** — Le critère 7 délègue son seuil chiffré à `docs/design-system.md`, qui n'existe pas encore. C'est acceptable puisque `/ks-design-system` précède l'exécution, mais si le token « taille de police minimale des étiquettes » n'y est pas défini, le critère redevient invérifiable. Poser le token du design system comme préalable nommé de la story, ou fixer un plancher de repli dans le critère.

4. **minor — coverage (contraintes)** — La contrainte PRD « Cold start Neon + latence Vercel : l'UI doit rester utilisable pendant le chargement (état optimiste à la saisie, squelettes à l'affichage) » n'est assertée par aucun critère d'acceptation ; elle n'apparaît qu'en note agentique de s05, et seulement pour le pré-remplissage. Ce n'est pas un trou du tableau core loop, mais c'est la contrainte qui décide si l'app est utilisable au quotidien. Un critère en s03 (soumission) et un en s06 (premier affichage) suffiraient.

5. **minor — s09-edit-delete-session** — La liste de dépendances cite s03, s06 et s07 mais omet s05, alors que les notes de la story désignent la coexistence des deux pré-remplissages sur le même formulaire comme « le piège de la story ». L'ordre de livraison couvre le risque ; la liste devrait le dire.

6. **minor — s01-deploy-skeleton** — La partie « l'app ne contient aucun écran premium ni emplacement publicitaire » du critère 6 est trivialement vraie sur une app quasi vide et n'est jamais re-vérifiée là où un upsell pourrait réellement apparaître (s06, s10). La moitié grep-able (analytics/traceurs dans le build) est excellente et bien placée ; la moitié qualitative gagnerait à être posée comme invariant projet repris en non-régression sur les stories d'écran.

Points vérifiés sans réserve : les 9 lignes du tableau core loop couvertes ; les 16 critères de succès du PRD assertés ; aucune fuite du graveyard ; aucun 5, aucun 4 ; ids uniques et bien formés (s01→s10) ; graphe acyclique et ordre de livraison exécutable de haut en bas ; aucune référence croisée périmée après la renumérotation ; aucune story-couche-technique (s01 examinée et acceptée comme walking skeleton) ; aucun recouvrement non arbitré.

## Verdict

Les deux majors de la passe 1 sont réellement corrigés, pas contournés, et le découpage de l'ancien s01 n'a introduit ni référence orpheline ni trou de couverture. Ce qui reste est du polissage de critères, exécutable en une passe d'édition, et rien n'empêche de démarrer s01.

Max severity: minor
Stories ready: yes
