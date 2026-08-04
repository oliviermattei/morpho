# Review — s05 à s10 (revue groupée)

Branche : `feature/s05-s10-remaining`, empilée sur `feature/s04-profile-height-bmi` (→ s03 → s02 → s01).
Diff jugé : `git diff feature/s04-profile-height-bmi...feature/s05-s10-remaining` — **50 commits**, six stories implémentées d'affilée sans revue intermédiaire, à la demande de l'utilisateur pour réduire le coût du pipeline.

## Méthode

Six relecteurs indépendants en contexte frais, un par dimension, puis **chaque finding confié à un vérificateur adverse chargé de le réfuter**, pas de le confirmer.

| Dimension | Objet |
|---|---|
| Sécurité | identité de session uniquement, 401 sans base, isolation inter-utilisateurs sur les mutations de s09, cache SW et données utilisateur, règle `neon_auth` |
| Correction | pré-remplissage par mesure (s05), axe temporel et infobulle (s07), re-calage des deltas sur la première session (s09) |
| Design system | table du sens favorable, glyphe ▲/▼, SVG sans `<text>`, cibles 44 px, tokens |
| Périmètre & honnêteté | graveyard du PRD, écriture hors ligne, exactitude des « NON VÉRIFIÉ » |
| Véracité des APIs | Next 16.2.12, Serwist, Recharts 3, Drizzle, shadcn — contre les paquets installés |
| Qualité des tests | assertions qui mordent, vacuité, skips explicites, durée des gates |

## Résultat

**Aucun critical. Aucun major.** 12 findings, tous levés en `minor`.

| Statut | Nombre |
|---|---|
| Réfutés, preuves à l'appui | 2 |
| **Confirmés** par vérification indépendante | 2 |
| Vérification **inachevée** (limite de session atteinte) | 8 |

### Les deux réfutations valent d'être lues

Elles montrent qu'un critique peut se tromper, et que le second passage sert à quelque chose.

1. *« La preuve réseau du critère 11 du PRD est déléguée à un test qui ne tourne dans aucune commande du dépôt. »* — **Réfuté.** Les trois prémisses factuelles tiennent, mais les deux affirmations porteuses sont fausses : le verrou `E2E_STORAGE_STATE` est **portant**, pas gratuit (reproduit : sans session, `/` renvoie `307` vers `/auth/sign-in`, et le test échoue en timeout), et le contournement proposé **ne compile pas** (`offlineAnalyticsConfig` est une option d'exécution de `serwist`, absente de la surface de `@serwist/turbopack`). Surtout : la substance du critère — aucune dépendance d'analytics, aucune requête sortante — **est** assertée par `build-leak.test.ts`, qui tourne à chaque `npm run check` et lève plutôt que de scanner un corpus vide.
2. *« Le test "vider un champ pré-rempli" asserte sa propre fixture. »* — **Réfuté.** Une des deux assertions restitue effectivement la fixture, mais l'autre (`latest.weight_kg === 82.4`) porte sur le système : la fixture fait que la session **la plus récente** ne contient aucune mesure, donc toute implémentation qui lirait « la dernière session » retourne `{}` et le test rougit. C'est précisément le piège nommé par la story.

### Les deux findings confirmés

Ce sont des **trous de test**, pas des défauts de comportement. Aucun n'a de conséquence pour l'utilisateur aujourd'hui.

1. **`deleteStaleMeasurements` n'est jamais réellement exercé** (`src/lib/db/sessions.ts:161-171`). Sa couverture se réduit à trois `toContain` sur la chaîne SQL, plus quatre exécutions PGlite dont le vérificateur a démontré qu'elles sont toutes des no-ops : sous-requête vide, ou session ne portant que `weight_kg`. Conséquence : le comportement « vider un champ en édition supprime la mesure » (critère 3 de s09) est écrit, plausible, et **non prouvé**.
2. **`routes-scan.test.ts` peut devenir vide en silence.** La fonction de collecte retourne `[]` pour un chemin absent, `it.each` est la seule assertion, et rien ne vérifie que les chemins scannés existent. Vacuité reproduite par spike : renommer un dossier vide le test sans rien signaler. 9 chemins et 11 fichiers sont couverts aujourd'hui — le risque est une régression future indétectable.

### Les huit vérifications inachevées

Les vérificateurs adverses ont été interrompus par la limite de session. Ces findings sont **non vérifiés**, ce qui n'est ni « confirmés » ni « réfutés ». Tous ont été levés en `minor` par leur relecteur :

- `PUT /api/profile` écrit taille et poids cible en deux upserts non atomiques — un échec en cours de route persiste un champ tout en annonçant l'échec.
- Deux sessions à la même date la plus ancienne : le référentiel de la silhouette et le premier point du graphe peuvent diverger.
- `text-label-min` serait absorbé par `twMerge` sur les titres des quatre cartes hors silhouette.
- Le garde `cacheComponents` lit la clé de configuration Next 15, dépréciée — il ne pourrait jamais se déclencher.
- La table §États du design system serait désynchronisée de l'implémentation.
- `LogoutButton` est monté dans le menu sans être un `menuitem`.
- Les largeurs de la géométrie de la silhouette sont en dur plutôt que dérivées.
- Le critère 11 du PRD (second exemplaire du finding réfuté ci-dessus).

**Décision de l'utilisateur, prise en connaissance de cause : ne pas les faire vérifier, ne pas corriger les deux confirmés, et livrer.** Consigné ici pour qu'un lecteur futur sache que ces huit lignes n'ont pas été jugées, et non qu'elles ont été jugées bénignes.

## Gates, exécutées par les relecteurs

| Commande | Résultat |
|---|---|
| `npm run check` | **vert** — 73 fichiers, **994 tests**, 28 s de mur (dont un `rm -rf .next && next build` complet déclenché depuis `build-leak.test.ts`) ; phase vitest seule : 20,4 s |
| `npm run check:leak` | **vert** — 1 test, 0,46 s |
| `npx playwright test` | **22 passés, 40 sautés**, 9,6 s. Les 40 skips portent chacun un message explicite et une raison réelle : pas de session authentifiée. |

Jugement du relecteur « qualité des tests », cité : *« la suite est inhabituellement bonne — les smoke tests existent spécifiquement pour défaire la vacuité, `buildSeries` / `buildBodyMapView` / `target-weight` sont de vrais tests de propriétés »*. Aucune des deux gates n'est lente.

## Ce qui reste non vérifié, et pourquoi

Rien de tout cela n'est contournable par du code, et rien n'est coché par optimisme :

- **Aucune session authentifiée n'existe.** Envoyer un email au nom de l'utilisateur n'est pas une décision d'agent. Le mécanisme d'[ADR 011](../decisions/011-e2e-session-via-verification-table.md) est conçu mais non câblé. Conséquence : 40 specs Playwright se sautent, et les critères « 44 px mesurés en navigateur », « aucun défilement horizontal à 375 px », « rendu clair et sombre » restent ouverts sur tous les écrans.
- **Aucun déploiement.** Pas d'URL publique (critère 2 de s01), et le protocole de mise à jour du service worker de s10 — deux déploiements successifs, lancement à froid — ne peut pas se jouer.
- **Aucun appareil réel.** Installation sur l'écran d'accueil, mode standalone, pavé décimal iOS : non simulables.
- **Piège connu avant le déploiement** : `neon_auth.project_config` porte `trusted_origins: []` avec `allow_localhost: true`, et better-auth applique `originCheck` aux URL de callback. Le magic link fonctionnera en local et **pas** sur l'origine Vercel tant qu'elle n'est pas déclarée dans la console Neon. Le symptôme est « le lien ne fait rien ».

## Verdict

Six stories, 50 commits, aucune revue intermédiaire — et aucun défaut de comportement trouvé sur six dimensions relues indépendamment. Les deux findings qui survivent à la vérification adverse sont des tests qui ne mordent pas, sur un chemin qui fonctionne. Huit findings mineurs restent non jugés, par décision explicite.

Ce qui empêche cette story d'être *terminée* n'est pas le code : c'est qu'un humain n'a pas encore cliqué sur un lien, déployé une URL, ni tenu un téléphone.

Max severity: minor
Ship allowed: yes
