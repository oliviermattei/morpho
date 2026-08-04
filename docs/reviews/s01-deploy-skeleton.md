# Review — Story s01-deploy-skeleton

> Deux passes de revue anti-hallucination en contexte frais, read-only, suivies chacune d'un cycle de correctifs.
> **Passe 1** : `Max severity: critical` — un bug de production livré, causé par une décision de plan fausse. Rapport archivé en fin de document.
> **Passe 2** (ci-dessous) : les 7 findings vérifiés un par un dans le code, puis relecture à neuf du diff complet.

---

# Passe 2 — après le mode fix

Diff jugé : `git diff main...feature/s01-deploy-skeleton` (16 commits, 29 fichiers à l'heure de la revue).

## Ce que le reviewer a exécuté lui-même

| Commande | Résultat constaté |
|---|---|
| `npm --prefix morpho run check` | ✅ **VERT** — `Test Files 8 passed (8)`, `Tests 21 passed (21)`. **Mais `Duration 121.85s`** (finding A). |
| `npm --prefix morpho run check:leak` | ❌ **ROUGE, par conception** — `DATABASE_URL is not set…`. Comportement attendu et convenu. Pas un défaut. |
| `rm -rf .next && npx vitest run src/build-leak.test.ts` | ✅ Le `beforeAll` a réellement lancé `next build` sans aucun secret. La paresse `getSql()`/`getAuth()` tient. |
| `.next/` réduit à `cache/` puis relance des deux scans | ⚠️ **1 passed, 0 fichier scanné** dans les deux cas (finding B). |
| `compoundSimulator/ → npm run build` | ✅ `vite v5.4.21`, 828 modules, `index-_RLzQ0Ae.js` **545.02 kB / gzip 157.32 kB** — hash identique à la baseline. |
| Chronométrage par fichier | `playwright-config.test.ts` **121,06 s** (import 120,55 s) ; tous les autres < 1,3 s. Le même en `--environment node` : **0,46 s**. |

## APIs vérifiées contre les paquets installés

- `neon(url, { fetchOptions })` : `@neondatabase/serverless/index.mjs:1269` capture `fetchOptions` **à la construction**, puis les spread dans chaque `fetch` (l. 1283, 1292). Le signal d'un client mémoïsé serait donc bien réutilisé — **le bug de la passe 1 était réel**, et le correctif vise le bon levier.
- `NEON_AUTH_NETWORK_ERROR_CODES` : export runtime réel (`@neondatabase/auth/dist/next/server/index.mjs:634`, export l. 1811). Pas un type-only import.
- Taxonomie d'erreur : échec transport → `status: 502` + code transport (`index.mjs:783-803`) ; `!response.ok` → **statut amont** (l. 866-882). La discrimination écrite dans la route correspond à ce que le paquet produit.
- `export const dynamic = "force-dynamic"` : documenté dans `next/dist/docs/01-app/02-guides/caching-without-cache-components.md:88-97`, et `cacheComponents` n'est pas activé — c'est bien le modèle applicable.
- `new URL(databaseUrl).password` sur schéma non-spécial : Node **ne décode pas** — testé, `npg_S3cr%40t` reste tel quel. L'aiguille correspond à la forme réellement présente.

Aucun import, aucune fonction, aucune clé de config hallucinés dans le diff.

## Vérification des 7 findings de la passe 1

| # | Finding | Verdict |
|---|---|---|
| 1 | `AbortSignal.timeout` mémoïsé (**critical**) | **Corrigé.** `getSql()` ne mémoïse plus ; signal neuf par appel. Le test exerce le **vrai driver** (seul `fetch` est stubbé) et ses deux assertions tombent sur l'ancien code. Vérifié non tautologique : si le driver cessait de transmettre le signal, `not.toBe` échouerait aussi. |
| 2 | 4xx amont mappé en 503 (**major**) | **Corrigé.** `status >= 500` ou code transport → 503, le reste → 401, avec son test. |
| 3 | `check` rouge par construction (**major**) | **Corrigé.** Split réel en `check:leak`. `check` vert sans secret, `check:leak` rouge dur avec un message actionnable. |
| 4 | Erreurs jetées hors taxonomie | **Corrigé.** `try/catch` → 503, deux tests. |
| 5 | Assertion tautologique | **Traité** — commentaire explicite « non-regression guard, not proof ». |
| 6 | Aiguille « mot de passe » | **Corrigé**, sémantique Node vérifiée. |
| 7 | Dérive documentaire | **Corrigé à 80 %** — ADR 005 restait non listé (finding G). |

**Les 7 findings sont effectivement traités dans le code, pas seulement dans les messages de commit.** Aucun critical ne subsiste.

## Findings de la passe 2

### A. major — `npm run check` prend 122 s, dont 120,5 s pour un seul import

Mesuré, reproductible sur 3 exécutions. Le coût vient de l'import de `@playwright/test` (13 Mo de `playwright-core`) traité par Vite sous l'environnement `jsdom` imposé globalement. `npm run check` est **la** commande de la gate, rejouée à chaque story et à chaque boucle TDD : elle passe de ~3 s à ~2 min à cause d'un test qui vérifie deux propriétés d'un objet de configuration. Régression mesurable, permanente, héritée par toutes les stories suivantes.

### B. major — les deux scans de build passent au vert en n'ayant rien scanné

Démontré empiriquement. Avec un `.next/` qui existe mais ne contient que `cache/` — ce que laisse un `next dev` ou un build interrompu — les deux scans répondent `1 passed` sans lire un seul fichier. `buildOutputFiles()` ne testait que l'existence de `.next/`, et `expect(offenders).toEqual([])` est vrai sur l'ensemble vide.

Or le docstring de la fonction affirme le contraire, et l'amendement d'ADR 005 le répète : « jamais un passage silencieux à vide ». **C'est la garantie même que le fix du finding 3 était censé apporter**, sur le scan qui certifie un critère de sécurité.

Second volet : `build-leak.test.ts` ne construisait que si `.next/` était **absent**. Un `.next/` périmé était donc scanné comme frais — précisément le Trap 4 de la research, cité trois lignes plus haut dans le même fichier.

### C. minor — `next build` dans un `beforeAll`

Sain sur le principe (le critère 6 devient auto-suffisant sur un clone frais), mais `npm run test` écrit désormais dans l'arbre de travail, `test:watch` peut déclencher un build de production, et le timeout de 60 s est une marge courte sur une CI froide.

### D. minor — `getDb()` sans test ni garde-fou, rouvre la porte au finding 1

L'idiome naturel en s03 — `const db = getDb()` à la portée module — recrée exactement le bug critical d'origine, avec le même profil.

### E. minor — aucun journal sur les chemins 503

Ne rien renvoyer au client est correct ; ne rien écrire côté serveur rend une panne d'infra en production totalement muette.

### F. minor — 408/429 amont deviennent 401

Même classe d'hypothèse que le finding 2, dans l'autre sens.

### G. minor — ADR 005 amendé sur place alors que les ADR sont déclarés immuables

Amendement daté, attribué, purement additif, explicitement demandé par la passe 1 — mais la règle du dépôt dit le contraire.

### H. minor — bruit « Running SQL directly from the browser » dans `check`

### I. note de périmètre — `/api/health` est un point d'entrée non authentifié qui frappe la base

C'est ce que le critère 4 demande ; requête constante (`select 1`), aucune surface d'injection. À rediscuter une fois le déploiement prouvé.

## Verdict de la passe 2

Le critical est réellement mort — vérifié contre la source du driver, couvert par un test qui échouerait sur l'ancien code. Le plan et l'ADR ont été corrigés là où c'est la décision qui était fausse, ce qui est le bon réflexe.

Restent trois choses nées de la passe de fix : une gate qui prend deux minutes pour une raison stupide (A), et surtout deux scans qui peuvent affirmer « rien trouvé » sans avoir rien lu (B). Aucune ne livre de bug au produit ni de trou de sécurité.

**Max severity (passe 2) : major — Ship autorisé, corrections attendues, et le finding B avant de jouer le protocole du critère 5.**

---

# Suite donnée — second cycle de correctifs

Les findings A à H ont été corrigés avant le ship plutôt qu'après, parce que A pénalise toutes les stories suivantes et que B invalide une garantie de sécurité écrite dans le code, dans le plan et dans un ADR.

| Finding | Correctif | Vérifié |
|---|---|---|
| A | `// @vitest-environment node` sur `src/playwright-config.test.ts` | `npm run check` : **122 s → 8,4 s**, mesuré indépendamment |
| B | `collectBuildOutputFiles()` extrait dans `src/lib/build-output.ts`, **lève quand la liste de fichiers est vide** et pas seulement quand le dossier manque. `build-leak.test.ts` reconstruit systématiquement (`rm -rf .next && next build`) au lieu de faire confiance à un `.next/` présent | Bug reproduit en retirant le `throw`, test rouge, puis correctif restauré |
| C | Conservé, risque documenté | — |
| D | Docstring de l'invariant sur `getDb()` + test de fraîcheur | Vérifié contre un `getDb()` délibérément mémoïsé |
| E | `console.error` sur tous les chemins 503, sans jamais la connection string ni le token | — |
| F | 408/429 classés en 503 | — |
| G | ADR 005 : phrase reconnaissant l'amendement sur place et pourquoi ; ajouté aux « Files touched » | — |
| H | `// @vitest-environment node` sur `src/lib/db/index.test.ts` | Avertissements éteints |

Commits : `4c93a2e`, `9dff6d0`, `7853169`, `72ebd60`, `9ac6336`, `0adb0c0`, `b001607`.

État final mesuré indépendamment : `npm run check` **vert, 29/29 tests, 8,4 s**. `npm run check:leak` échoue explicitement faute de `DATABASE_URL` — comportement conçu et convenu.

## État des 8 critères d'acceptation

| # | Critère | État |
|---|---|---|
| 1 | démarre en local / produit un build | ✅ **vérifié** — build propre relancé sans secrets. Écart Vite→Next couvert par ADR 001. |
| 2 | déployé, URL publique | ⛔ **NON VÉRIFIÉ** — hors périmètre convenu, ni projet Vercel ni CLI. Tâche 10. |
| 3 | route API 401 sans session, sans requête base | ✅ **vérifié au niveau du code** — 401 sans session, 401 sur 4xx amont, 503 sur transport/5xx/408/429 et sur exception, aucun accès base. Non éprouvé contre une instance réelle. |
| 4 | route de santé atteint Neon | ⛔ **NON VÉRIFIÉ** — hors périmètre. Le blocage du finding 1 est levé : plus rien de connu ne s'y oppose une fois branchée. |
| 5 | pas de connection string dans le build | ✅ **VÉRIFIÉ** — voir « Fermeture du critère 5 » ci-dessous. |
| 6 | pas d'analytics/traceurs, pas de premium/pub | ✅ **vérifié** — scan réel sur un build systématiquement reconstruit, zéro occurrence, aucune dépendance traceur. |
| 7 | secrets en variables d'environnement, `.env` ignoré | ✅ **vérifié**. |
| 8 | `compoundSimulator/` builde à l'identique | ✅ **vérifié** indépendamment (828 modules, hash de bundle inchangé). |

## Fermeture du critère 5 — protocole joué

Les variables d'environnement réelles ayant été fournies après la revue, le protocole du critère 5 a été exécuté :

```
rm -rf .next && npm run build     # avec .env.local peuplé (DATABASE_URL réel)
npm run check:leak                # 1 passed
```

Le `rm -rf .next` n'est pas décoratif : la research avait obtenu deux fois des résultats contradictoires sur un `.next/` sale. Le scan couvre `.next/static/**`, `.next/server/app/**/*.html` et `**/*.rsc`, cherche `postgres://`, l'URL complète, l'hôte **et** le mot de passe isolé, et — depuis le finding B — **lève si la liste de fichiers scannés est vide**. Un vert ici signifie donc réellement « lu et rien trouvé ».

Correctif appliqué au passage : `npm run check:leak` ne chargeait pas `.env.local`, contrairement à `next build` qui le fait tout seul. La commande documentée comme « celle que la review rejoue » était donc injouable telle quelle. Elle passe désormais par `node --env-file-if-exists=.env.local`.

**Critère 5 : vérifié.**

## Ce qui reste ouvert

La story **n'est pas terminée**. La tâche 10 du plan reste décochée :

- **Critère 2** (URL publique, déploiement depuis le dépôt) — il n'existe toujours pas de projet Vercel. C'est le seul critère qu'aucune vérification locale ne peut fermer.
- **Critère 4** (la route de santé atteint Neon) — la connexion elle-même est prouvée : `select 1` répond `[{"ok":1}]` via `@neondatabase/serverless` avec la vraie `DATABASE_URL`, sur `ep-wild-tooth-asszpzui-pooler.c-4.eu-central-1.aws.neon.tech/neondb`. Reste à exercer **la route** `/api/health` elle-même, pas seulement le driver qu'elle appelle.

---

# Passe 1 — archive

Rapport initial, conservé parce qu'il contient la reproduction empirique du bug critical.

## Finding 1 — critical — `AbortSignal.timeout(5000)` mémoïsé

`morpho/src/lib/db/index.ts` créait le signal **une seule fois**, au premier `getSql()`, puis le figeait dans le client mémoïsé. Son minuteur démarre à la construction, pas à la requête. Reproduit avec le vrai driver et un signal à 1 s :

```
t=0ms     -> NeonDbError | password authentication failed for user 'u'   ← la requête est bien partie
t=1500ms  -> NeonDbError | Error connecting to database: TimeoutError: The operation was aborted due to timeout
```

Conséquence en production : sur une instance Vercel tiède, `/api/health` répond 200 au cold start puis **503 pour toujours**. Invisible en dev, intermittent en préproduction, permanent en production. Aucun test ne pouvait l'attraper — la route mocke intégralement `@/lib/db`.

**Le plan lui-même prescrivait ce code** (décision 4). L'implémenteur l'a suivi à la lettre ; c'est la décision qui était fausse, et elle a été corrigée avec le code.

Les six autres findings de la passe 1 (mapping 503, `check` rouge par construction, erreurs jetées, assertion tautologique, aiguille mot de passe, dérive documentaire) sont détaillés dans le tableau de vérification de la passe 2 ci-dessus.

---

Max severity: major
Ship allowed: yes
