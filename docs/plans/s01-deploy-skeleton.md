---
validated: yes
---
# Plan — Story s01-deploy-skeleton

Branch: `feature/s01-deploy-skeleton`

## Target story

**As a** propriétaire de morpho **I want** une app déployée dont l'API refuse les requêtes non authentifiées **so that** la base ne soit jamais joignable depuis le navigateur. — Complexity 3.

Critères d'acceptation (verbatim `docs/stories.md`) :

1. `morpho/` contient une app qui démarre en local (`npm run dev`) et produit un build (`npm run build`).
2. L'app est déployée et accessible à une URL publique ; le déploiement se déclenche depuis le dépôt.
3. Une route API serverless existe et répond 401 à toute requête sans session valide, sans exécuter la moindre requête base.
4. Une route API de santé, non protégée, atteint la base Neon et retourne un succès.
5. Une recherche de la connection string Neon dans les fichiers produits par `npm run build` ne retourne aucun résultat.
6. Une recherche d'analytics ou de traceurs tiers dans le build ne retourne aucun résultat, et l'app ne contient aucun écran premium ni emplacement publicitaire.
7. Les secrets sont fournis par variables d'environnement, jamais commités ; `.env` est ignoré par git.
8. `compoundSimulator/` continue de builder à l'identique.

### Écart de rédaction assumé (critère 1)

Le critère dit « app **Vite + React** ». [ADR 001](../decisions/001-nextjs-app-router-base.md) l'a remplacé par Next.js 16 App Router, décision prise **après** la rédaction des stories. Les ADR priment. Le critère reste littéralement satisfaisable : `npm run dev` et `npm run build` existent et fonctionnent. Noté ici pour qu'un reviewer en contexte frais ne le lise pas comme une dérive.

## Décisions de plan

Les questions ouvertes de `docs/research/s01-deploy-skeleton.md` sont tranchées ici. Aucune ne reste au jugement de l'implémenteur.

| # | Question | Décision |
|---|---|---|
| 3 | Comment matérialiser le déploiement Vercel ? | **Aucun artefact versionné.** Root Directory `morpho/` réglée au tableau de bord, intégration Git native. La preuve est l'URL publique et l'identifiant de déploiement, consignés dans la review. Pas de `vercel.json` : il n'aurait rien à déclarer ici. |
| 4 | Requête et timeout de la route de santé ? | `select 1`. Réponse `{ ok: true }` / 200, ou `{ ok: false }` / 503. **Timeout par requête, jamais à la construction du client.** ⚠️ *Première rédaction : « `AbortSignal.timeout(5000)` passé en `fetchOptions` de `neon()` ». C'était faux et la review l'a reproduit avec le vrai driver : le signal est créé une fois, figé dans le client mémoïsé, et son minuteur démarre à la construction. Cinq secondes plus tard, toute requête échoue avant de partir — soit, sur une instance Vercel tiède, 200 au cold start puis 503 pour toujours.* Le signal se crée **à chaque appel**, via les `fetchOptions` du troisième argument de `sql(query, params, opts)`, ou en renonçant à mémoïser le client (`neon()` est un constructeur HTTP, il n'amortit aucun pool). |
| 5 | `src/proxy.ts` en s01 ou s02 ? | **s02.** Le critère 3 n'exige un 401 que sur une route API, faisable entièrement dans le handler. Et `auth.middleware()` **redirige (307)**, il ne renvoie pas 401 — il ne satisferait pas le critère. Le proxy naît en s02, où l'échange de session en a besoin. |
| 6 | 401 ou 503 si le serveur d'auth est injoignable ? | **Distinguer.** Session absente → 401. `getSession()` renvoie une erreur réseau/serveur → **503**. Un 401 pour une panne d'infra ment au client et masque l'incident. Testé explicitement. |
| 7 | Playwright `mobile` : 390 px ou 375 px ? | **Forcer 375 × 812**, en conservant webkit et le tactile d'`iPhone 13`. `devices["iPhone 13"]` fait 390 px, or les critères de s06 et s07 sont écrits à 375 px. Sans ce correctif ils ne testeraient pas ce qu'ils annoncent. |
| 8 | Nettoyage du boilerplate et script de thème sombre dans s01 ? | **Oui, dans s01.** `docs/design-system.md` §Thème attribue explicitement le script `dark` au shell de s01. Le `page.tsx` de create-next-app viole les Do/Don't du design system (couleurs en dur, valeurs arbitraires) et `layout.tsx` porte `lang="en"` et `title: "Create Next App"` dans une app française. Le laisser, c'est léguer la dette à toutes les stories suivantes, qui hériteront d'un shell non conforme. |
| 9 | Sur quel build vérifier le critère 5 ? | Sur un build local lancé avec un `.env.local` **réellement peuplé**, précédé de `rm -rf .next`. Un build sans secret ne peut rien trouver : c'est un faux pass. Protocole détaillé en §Stratégie de test. |
| 1, 2, 10 | Projet Neon, table `neon_auth`, base de test | Hors périmètre de s01. Voir §Préalables externes. |

## Préalables externes — bloquants

Trois critères (2, 4, 5) sont **invérifiables sans services réels**, et rien dans le dépôt ne peut les débloquer :

- `DATABASE_URL` — projet Neon, pas de CLI installée, variable absente.
- `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` — Neon Auth non provisionné. **Conséquence dure** : `createNeonAuth()` lève si `cookies.secret` fait moins de 32 caractères. Sans secret, l'ajout de `src/lib/auth.ts` casse `npm run build` en local, pas seulement la requête (research, Trap 5).
- Projet Vercel lié au dépôt, Root Directory `morpho/`.

Les tâches 1 à 9 ci-dessous s'exécutent **sans** ces accès. La tâche 10 les exige.

## Tasks (ordered)

1. [x] **Playwright utilisable sur la cible principale.** `npx playwright install webkit` (absent : le cache ne contient que chromium). Dans `playwright.config.ts`, surcharger le viewport du projet `mobile` à `{ width: 375, height: 812 }` en gardant `...devices["iPhone 13"]` pour webkit et le tactile. Vérifiable : `src/playwright-config.test.ts` couvre les deux projets sans erreur.
2. [x] **Shell conforme.** `src/app/layout.tsx` : `lang="fr"`, `metadata` de morpho, script inline posant la classe `dark` sur `<html>` d'après `prefers-color-scheme` **avant la peinture** (le design system fonctionne par classe, pas par media query). **Réparer aussi la chaîne typographique** : `globals.css` déclare `--font-sans: var(--font-sans)`, une auto-référence indéfinie, alors que `layout.tsx` expose `--font-geist-sans` — aucune police du design system n'est réellement appliquée aujourd'hui. Test Vitest : le rendu du layout porte `lang="fr"` et le titre attendu ; `--font-sans` ne se référence plus lui-même.
3. [x] **Purge du boilerplate.** Remplacer `src/app/page.tsx` par une page minimale sans couleur en dur ni valeur arbitraire. Supprimer les assets create-next-app inutilisés de `public/`. Test Vitest : la page ne contient aucune classe de couleur littérale (`bg-zinc-*`, `text-black`, `dark:bg-black`) ni de valeur arbitraire `[...]`.
4. [x] **Client base.** `src/lib/db/index.ts` : `neon(process.env.DATABASE_URL!)` plus le `drizzle()` de `drizzle-orm/neon-http`. Le module ne doit **pas** lever à l'import quand la variable manque — l'évaluation paresseuse est ce qui garde le build vert sans secret. **Le timeout se crée à chaque requête**, jamais à la construction du client : voir la décision 4 corrigée, et le finding 1 de la review qui a reproduit le bug avec le vrai driver. Tests Vitest : importer le module sans `DATABASE_URL` ne lève pas ; deux requêtes successives ne partagent jamais le même `AbortSignal`.
5. [x] **Route de santé.** `src/app/api/health/route.ts`, non protégée, `export const dynamic = "force-dynamic"`. Exécute `select 1`. 200 `{ ok: true }` ; en échec 503 `{ ok: false }`, sans jamais exposer le message d'erreur brut ni l'hôte. Test Vitest : succès simulé → 200 ; échec simulé → 503 et le corps ne contient ni `postgres://` ni le nom d'hôte.
6. [x] **Instance d'auth tolérante au build.** `src/lib/auth.ts` : `createNeonAuth` appelé **paresseusement** (fonction `getAuth()` mémoïsée), jamais au niveau module. C'est ce qui empêche `npm run build` de casser quand `NEON_AUTH_COOKIE_SECRET` est absent (research, Trap 5). Test Vitest : importer le module sans secret ne lève pas ; appeler `getAuth()` sans secret lève une erreur explicite.
7. [x] **Route protégée.** `src/app/api/session/route.ts` : lit la session via `getAuth().getSession()`. Pas de session → **401**. `getSession()` en erreur réseau/serveur → **503**. Session valide → 200 avec l'identité issue du token, **jamais** un identifiant lu dans la requête. Aucun accès base sur le chemin 401. Tests Vitest : les trois cas, plus l'assertion qu'aucun appel au client base n'a lieu en 401.
8. [x] **Étanchéité du build — le test qui compte.** Test Vitest lisant les fichiers produits : aucune occurrence de `postgres://`, du mot de passe, ni de l'hôte Neon dans `.next/static/**`, `.next/server/app/**/*.html` et `**/*.rsc`. Le périmètre est celui-là et pas seulement `static/` : la research a prouvé par sentinelles qu'un secret non-`NEXT_PUBLIC_` fuit dans le **HTML prérendu**, pas dans les chunks JS. Même test pour les traceurs tiers (`google-analytics`, `googletagmanager`, `segment`, `plausible`, `sentry`, `hotjar`, `@vercel/analytics`, `@vercel/speed-insights`).
9. [x] **Non-régression du monorepo.** Vérifié : `npm run build` dans `compoundSimulator/` produit `vite v5.4.21`, 828 modules transformés, `dist/assets/index-_RLzQ0Ae.js` 545,02 kB / gzip 157,32 kB — identique à la baseline research. Le hash de contenu dans le nom de fichier est la preuve. `git status --short compoundSimulator/` ne montre aucun changement : aucun fichier de `compoundSimulator/` n'a été touché par cette story. Consigné dans la review, pas automatisé : `compoundSimulator/` n'a pas de harnais de test et [ADR 006](../decisions/006-vercel-project-per-app.md) interdit d'y toucher.
10. [ ] **Déploiement et vérification sur services réels.** *(exige les préalables externes)* Projet Vercel lié, Root Directory `morpho/`, variables d'environnement peuplées. Puis : `/api/health` répond 200 sur l'URL publique, `/api/session` répond 401 sans session, et le protocole du critère 5 est rejoué sur un build peuplé. Identifiant de déploiement et URL consignés dans la review.

## Files touched

```
morpho/playwright.config.ts          modifié — webkit + viewport 375
morpho/src/app/layout.tsx            modifié — lang fr, metadata, script de thème
morpho/src/app/page.tsx              réécrit — purge du boilerplate
morpho/public/*.svg                  supprimés — assets create-next-app
morpho/src/lib/db/index.ts           créé — client Neon + Drizzle
morpho/src/lib/auth.ts               créé — getAuth() paresseux
morpho/src/app/api/health/route.ts   créé — route de santé
morpho/src/app/api/session/route.ts  créé — route protégée 401/503/200
morpho/src/**/*.test.ts(x)           créés — tests Vitest co-localisés
morpho/.env.local                    créé, NON commité (ignoré par .gitignore)
morpho/vitest.config.mts             modifié — server.deps.inline: ["@neondatabase/auth"], car ce paquet
                                      importe next/headers à la portée module et Vite doit le router par
                                      son propre résolveur pour que le mock de vitest.setup.ts s'applique
                                      (revue s01, finding 7 — dérive documentaire corrigée ici)
morpho/vitest.setup.ts               créé — mock GLOBAL de next/headers (cookies()/headers()), nécessaire
                                      pour que @neondatabase/auth se charge en test. ⚠️ s02 : ce mock est
                                      global (setupFiles), donc tout test qui croira exercer la vraie
                                      lecture de cookies recevra un stub muet — à traiter explicitement à
                                      la research de s02, pas découvert en cours d'implémentation.
```

Ajoutés en mode fix (revue s01, finding 3) :
```
morpho/src/build-connection-leak.check.ts  créé — critère 5, extrait de src/build-leak.test.ts,
                                            exécuté uniquement par npm run check:leak
morpho/vitest.leak.config.mts              créé — config Vitest dédiée à check:leak
```

Ajoutés/modifiés en mode fix, second passage (revue s01, finding B) :
```
morpho/src/lib/build-output.ts             créé — collectBuildOutputFiles() partagé entre les deux
                                            checks (critères 5 et 6) ; lève si .next/ n'existe pas
                                            OU s'il ne contient rien à scanner (.next/cache/ seul,
                                            laissé par `next dev` ou un build interrompu) — plus jamais
                                            de passage silencieux à vide.
morpho/src/lib/build-output.test.ts        créé — reproduit le passage à vide (finding B) puis vérifie
                                            que collectBuildOutputFiles() lève désormais.
morpho/src/build-connection-leak.check.ts  modifié — utilise collectBuildOutputFiles() au lieu de sa
                                            propre copie de la logique de scan.
morpho/src/build-leak.test.ts              modifié — idem, et rebuild systématiquement (rm -rf .next
                                            && next build) au lieu de ne builder que si .next/ est
                                            absent, pour ne jamais scanner un .next/ périmé (finding B).
morpho/docs/decisions/005-testing-stack.md modifié — ajout d'une phrase reconnaissant l'amendement en
                                            place plutôt qu'un nouvel ADR (finding G).
morpho/src/lib/db/index.ts                 modifié — commentaire sur getDb() documentant l'invariant
                                            « jamais mémoïsé au niveau module » (finding D).
morpho/src/lib/db/index.test.ts            modifié — test de fraîcheur de getDb(), même profil que
                                            celui de getSql() (finding D), et environnement node
                                            (finding H).
morpho/src/app/api/health/route.ts         modifié — console.error sur le chemin 503 (finding E).
morpho/src/app/api/session/route.ts        modifié — console.error sur les chemins 503, et
                                            isTransportOrServerFailure() couvre aussi 408/429
                                            (findings E, F).
```

`compoundSimulator/` : **aucun fichier touché.**

## Test strategy

**Vitest** porte l'essentiel. Chaque tâche 2 à 8 commence par un test rouge.
- Routes : le handler est appelé directement avec une `Request`, la session et le client base sont mockés. Trois assertions non négociables sur `/api/session` — 401 sans session, 503 sur erreur d'auth, aucun appel base sur le chemin 401.
- Étanchéité : un test lit l'arborescence de build. Il ne prouve quelque chose que si le build a tourné avec un environnement peuplé — le test **échoue explicitement** si les variables sont absentes, plutôt que de passer à vide. Un test vert sans secret serait le pire résultat possible.

**Protocole du critère 5** (à rejouer et consigner en review) :
```
rm -rf .next && npm run build     # avec .env.local peuplé
npm run check:leak                # scan automatisé — remplace le grep manuel (ADR 005, complément 2026-08-02)
```
Le `rm -rf .next` n'est pas décoratif : la research a obtenu deux fois des résultats contradictoires sur un `.next/` sale. `check:leak` échoue durement si `DATABASE_URL` ou un `.next/` est absent — jamais un passage silencieux à vide (revue s01, finding 3).

**Playwright** : aucune spec en s01. Il n'y a pas encore d'écran à vérifier ; la tâche 1 ne fait que rendre le harnais exécutable pour s02 et au-delà.

## Definition of Done

- `npm run check` vert (typecheck + lint + test), avec de vrais tests — plus le `--passWithNoTests` à vide. **Vert sans aucun secret**, dans n'importe quel environnement (CI, dépôt fraîchement cloné) : c'est la condition que la review vérifie en premier (revue s01, finding 3). Le test du critère 5 (connection string absente du build) exige `DATABASE_URL` et un `.next/` frais ; il vit à part dans `npm run check:leak` (ADR 005, complément 2026-08-02), rejoué par la review sur un build peuplé au protocole du critère 5 — jamais dans `check`.
- Les 8 critères d'acceptation vérifiés, chacun avec sa preuve consignée. Les critères 2, 4 et 10 exigent les services réels : sans eux, ils sont **explicitement marqués non vérifiés**, jamais cochés par optimisme. Le critère 5 se vérifie via `npm run check:leak`, pas `npm run check`.
- `compoundSimulator/` builde à l'identique, hash de bundle inchangé.
- Aucun secret dans le diff. `.env.local` absent du commit.
- PR unique sur `feature/s01-deploy-skeleton`, review passée sans critique ouverte.
