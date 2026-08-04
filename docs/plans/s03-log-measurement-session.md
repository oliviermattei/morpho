---
validated: yes
---
# Plan — Story s03-log-measurement-session

Branch: `feature/s03-log-measurement-session`, **branchée sur `feature/s02-connect-magic-link`** (voir décision 16).

## Target story

**As a** utilisateur connecté **I want** enregistrer mes mesures du jour **so that** mon historique se construise. — Complexity 3. Dépendance : s02-connect-magic-link.

Critères d'acceptation (verbatim `docs/stories.md:76-84`) :

1. Un écran de saisie propose une date (par défaut aujourd'hui) et un champ par mesure : poids, tour de poitrine, biceps, tour de taille, hanches, cuisse, mollet, épaules, % masse grasse, % masse musculaire.
2. Soumettre une session complète la persiste en base et affiche une confirmation.
3. Soumettre une session partielle — le poids seul — est accepté : la session est persistée, et les mesures non renseignées sont absentes en base, pas stockées à zéro ni à une valeur héritée.
4. Soumettre un formulaire entièrement vide est refusé avec un message ; rien n'est persisté.
5. Une valeur hors plage physiologique (poids négatif, tour de taille à 500 cm, pourcentage > 100) est refusée côté serveur avec une erreur de champ, même si le client l'a laissée passer.
6. Les sessions enregistrées apparaissent dans une liste triée de la plus récente à la plus ancienne, avec leur date et les mesures renseignées.
7. Un utilisateur A authentifié ne voit et ne modifie aucune session appartenant à un utilisateur B : le filtrage se fait côté serveur sur l'identité du token, vérifié par un test qui tente explicitement l'accès croisé.
8. Se connecter depuis un appareil vierge — autre navigateur, stockage local vide — restaure l'intégralité de l'historique après le magic link (critère de succès #12 du PRD).
9. Toutes les valeurs sont en unités métriques (kg, cm) — aucun sélecteur d'unité nulle part.

Écrans imposés par `docs/designs/s03-log-measurement-session.md` : `/saisie` (client, interactif) et `/historique` (serveur, `Suspense` + `skeleton`). L'accueil de s02 reçoit **deux contrôles** et rien d'autre.

---

## Décisions de plan

Les questions ouvertes de la Research et les *design system gaps* du Design sont tranchés ici. Rien n'est laissé au jugement de l'implémenteur.

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| 1 | Table utilisateurs de `neon_auth` (Research Q1) | **`neon_auth."user"`, PK `id` de type `uuid`.** Vérifié par requête sur la base réelle pendant ce plan : `information_schema` renvoie 9 tables dans `neon_auth` (`account`, `invitation`, `jwks`, `member`, `organization`, `project_config`, `session`, `user`, `verification`) et `user.id` en `uuid NOT NULL`. `select version()` → **PostgreSQL 18.4**, base `neondb`, rôle `neondb_owner`, schéma `public` **vide** (aucune table métier, aucun journal de migration). | La Research concluait `neon_auth.users_sync` / `id text` d'après `drizzle-orm/neon/neon-auth.js`. **Cette table n'existe pas ici** — ce helper décrit l'ancien Neon Auth. Ne pas importer `usersSync` : la FK serait typée `text` et la migration échouerait. Voir [ADR 003](../decisions/003-neon-auth.md). |
| 1 bis | Comment déclarer `neon_auth."user"` sans que la migration la crée ? | **`const authUser = pgSchema("neon_auth").table("user", …)` — déclaré, jamais `export`é.** La cible de la FK reste un détail interne de `schema.ts` ; si s04/s05 ont besoin de joindre la table utilisateurs, elles rouvriront la question par une décision, pas par un `export` ajouté au passage. | ⚠️ *Première rédaction : « `schemaFilter: ["public"]` empêche la migration de toucher `neon_auth` ». **C'était faux.** Vérifié par spike avec le `drizzle-kit@0.31.10` du dépôt, `schemaFilter: ["public"]` en place, sur exactement le schéma de la tâche 1 : avec `export const authUser = …`, `drizzle-kit generate` annonce « 3 tables » et émet* `CREATE TABLE "neon_auth"."user" ("id" uuid PRIMARY KEY NOT NULL);`. *Le même schéma sans le `export` annonce « 2 tables » et produit le SQL attendu, FK `REFERENCES "neon_auth"."user"("id")` comprise, sans une ligne `neon_auth`. Ce que `drizzle-kit` sérialise, ce sont les **exports** du fichier de schéma — `schemaFilter` ne filtre pas ça. Le spike de la Research (§ 4) ne voyait rien parce qu'il **importait** `usersSync` sans le ré-exporter.* Conséquence si on se trompe : sur Neon, `db:migrate` échoue en `relation "user" already exists` ; sur une base neuve, la migration **crée** une `neon_auth."user"` fantôme qui masque celle de Neon Auth — violation directe de la règle absolue d'`AGENTS.md`. |
| 2 | Server Action ou Route Handler pour l'écriture ? (Research Q2) | **Route Handler `POST /api/sessions`**, appelé par `fetch` depuis le formulaire client. Le succès **navigue** vers `/historique`. → **ADR 010** sur la branche. | (a) Le motif de test existe déjà : s01 appelle ses handlers directement avec une `Request`, sans harnais React. (b) `<form action={serverAction}>` + `useActionState` en jsdom repose sur la machinerie d'actions de React DOM, plus fragile que `onSubmit` + `fetch`. (c) `refresh()` de `next/cache` n'apporte rien ici : le succès change de route. (d) Une Server Function **est** un endpoint POST public (avertissement explicite de `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`) : le route handler rend cette surface visible au lieu de la masquer, ce qui sert le critère 7. |
| 3 | `type="number"` ou `type="text" inputMode="decimal"` ? (Research Q3) | **`type="text"` + `inputMode="decimal"`**, tranché par le Design (`docs/designs/s03…md:60`). Le plan l'enregistre, ne le rediscute pas. | `type="number"` rejette la virgule française et renvoie `""` sur valeur invalide — ce qui ramène au piège vide → zéro. |
| 4 | Plages physiologiques par `kind` (Research Q4) | Table ci-dessous, déclarée **en un seul endroit** (`src/lib/measurements.ts`). | `docs/architecture.md:62` impose « déclarées par `kind`, au même endroit ». Les bornes sont larges à dessein : elles attrapent la faute de frappe (500 cm, 101 %, −5 kg), pas la morphologie atypique. |
| 5 | Base de test pour l'isolation (Research Q5, [ADR 005](../decisions/005-testing-stack.md), `architecture.md:143`) | **PGlite** (`@electric-sql/pglite`, driver `drizzle-orm/pglite` déjà livré), en process, sans secret. → **ADR 009** sur la branche, avec repli explicite. | Constaté sur cette machine : `docker`, `psql`, `initdb`, `neonctl`, `vercel` **absents**. Surtout : le complément d'ADR 005 impose que `npm run check` reste vert **sans aucun secret** — un test qui exige `DATABASE_URL` ne peut pas vivre dans la gate, donc l'isolation ne serait plus jouée à chaque boucle TDD. PGlite est la seule option qui garde le test dans `check`. |
| 6 | Précision et échelle des colonnes `numeric` (Research Q6, Design gap 7) | **`numeric(5, 1)`, `mode: "number"`.** L'arrondi à une décimale est fait **par l'app**, à la frontière serveur (`Math.round(v * 10) / 10`), pas subi de Postgres. Plus une contrainte **`CHECK (value > 0)`**. | Une décimale = exactement le format d'affichage du design system (`82,4 kg`, pas `82,40 kg`) : stocker deux décimales et en afficher une créerait un écart entre la valeur saisie et la valeur relue. Arrondir dans l'app rend l'opération testable et visible ; laisser Postgres tronquer la rendrait muette. `CHECK (value > 0)` : aucune des dix mesures ne peut valoir 0 — la contrainte rend le piège « vide → zéro » impossible **au niveau du stockage**, en plus de l'être au niveau du modèle ([ADR 004](../decisions/004-measurements-as-rows.md)). |
| 7 | Le `form` du design system (Research Q7, Design gap 1) | **Ligne `form` retirée de `docs/design-system.md`.** `react-hook-form` et `@hookform/resolvers` restent hors stack. | Le registre `radix-nova` renvoie un item littéralement sans fichier : `npx shadcn add form` n'installe rien. Le besoin (libellé + contrôle + message) est couvert par `field`, listé à la ligne précédente. Redondance de rédaction, pas trou fonctionnel. |
| 8 | Routes et navigation (Research Q8) | **`/saisie` et `/historique`**, tranché par le Design. Côté serveur : **un seul endpoint, `POST /api/sessions`**. **Pas de `GET /api/sessions`** : la lecture passe par le Server Component de `/historique` et la fonction `listMeasurementSessions()`. | Un GET JSON que l'UI n'appelle pas serait du code mort avec une surface d'attaque en plus. La frontière serveur est respectée dans les deux cas (`AGENTS.md` : « Server Component **ou** route handler »). Note : la note de cadrage de l'orchestrateur parlait de « deux endpoints » — ce sont ici les deux **voies serveur** (écriture par handler, lecture par Server Component), pas deux routes HTTP. |
| 9 | Fuseau horaire de « aujourd'hui » (Research Q9) | **Défaut calculé sur l'appareil**, côté client, par `todayIsoDate()` construite depuis `getFullYear/getMonth/getDate` — **jamais** `toISOString().slice(0,10)`. Le serveur **n'écrase jamais** la date reçue ; il la valide dans une fenêtre `2000-01-01 … (jour UTC + 1)`. | Un « aujourd'hui » calculé sur Vercel (UTC) date une pesée matinale française de la veille. Le `+1 jour` de tolérance côté serveur couvre les fuseaux en avance sur UTC (jusqu'à +14 h) sans ouvrir la saisie de dates futures arbitraires. |
| 10 | Atomicité de l'écriture (session + N lignes) | **`db.batch([insertSession, insertMeasurements])`**, avec l'`id` de session **généré par l'app** (`crypto.randomUUID()`). | Vérifié dans le paquet installé : `drizzle-orm/neon-http/session.js:151` → `db.transaction()` **lève** `No transactions support in neon-http driver`. La ligne 131 montre que `batch()` passe par `client.transaction(builtQueries)` : c'est une vraie transaction Postgres en un aller-retour HTTP. Corollaire : `batch` ne chaîne pas un `RETURNING` dans la requête suivante, d'où l'UUID généré côté app. |
| 11 | Où loger l'erreur de formulaire non rattachée à un champ ? (Design gap 3) | **Composant `alert`** (déjà installé en s02), placé **juste au-dessus du bouton d'envoi**. | Concilie les deux documents : le composant est celui que `design-system.md:121` nomme pour une « erreur d'opération » ; la position est celle que le Design argumente. « En tête de formulaire » a été écrit pour l'écran de connexion de s02 (un champ) ; sur `/saisie` à 375 px, la tête du formulaire est hors écran au moment où l'on tape « Enregistrer ». **Écart assumé avec la maquette**, qui montre un `FieldError` à cet endroit : c'est le gap 3 tranché, pas une dérive. À consigner dans `design-system.md` (tâche 9). |
| 12 | Point de montage du `<Toaster />` (Design gap 5, gap connu n°4 du design system) | **`src/app/layout.tsx`, une seule fois, à la racine.** | Aucun layout authentifié n'existe (s02 pose l'écran authentifié sur `src/app/page.tsx`) et en créer un segment juste pour héberger un toast ajouterait une structure que s06 refera. Conséquence exploitée par la décision 13. Constat assumé et consigné : `sonner` tire `next-themes`, dont le projet n'a pas besoin (thème posé par le script inline de s01) ; `useTheme()` hors provider ne lève pas et retombe sur `"system"`. |
| 13 | Comment le toast de succès survit à la navigation vers `/historique` ? | `toast.success("Session enregistrée")` **puis** `router.push("/historique")`. Aucun query param, aucun `sessionStorage`. | Le `<Toaster />` est monté au layout racine (décision 12) et `router.push` est une navigation **client** : le composant n'est pas démonté, le toast survit. C'est la solution la plus simple qui satisfait le Design, et elle ne met rien dans l'URL. |
| 14 | Deux sessions le même jour pour le même utilisateur ? | **Autorisé. Aucune contrainte d'unicité sur `(user_id, measured_on)`.** | Rien dans les stories ne l'interdit (pesée matin/soir), et une contrainte ferait échouer le POST par une erreur base cryptique là où aucun critère ne le demande. Conséquence à retenir pour s05/s06 : l'ordre de lecture doit être `measured_on DESC, created_at DESC` pour être déterministe — c'est pourquoi `created_at` existe. |
| 15 | Périmètre du schéma créé ici | **Uniquement** l'enum `measurement_kind`, `measurement_sessions` et `measurements`. **Pas de table `profiles`** (s04). | `docs/architecture.md` décrit `profiles`, mais s04 la livre avec sa story. Une table vide et non utilisée serait de la dette invérifiable. |
| 16 | Sur quelle branche s03 démarre ? | **`feature/s03-log-measurement-session` créée depuis `feature/s02-connect-magic-link`** (branches empilées). La PR de s03 vise `feature/s02-…` tant qu'elle est ouverte, et est rebasée sur la branche par défaut dès que s02 est mergée. | `main` ne contient ni `src/lib/db/`, ni `src/lib/auth.ts`, ni `src/proxy.ts`, ni `src/components/ui/`. Partir de `main` reviendrait à réimplémenter s01 et s02 par accident (Research, piège 11). L'écart avec `AGENTS.md` (« branchée depuis la branche par défaut ») est assumé et consigné ici pour qu'un reviewer ne le lise pas comme une dérive. |
| 17 | `npm run db:migrate` ne voit pas les secrets | **Corriger `drizzle.config.ts`** : il fait `import "dotenv/config"`, qui lit `.env` — or il n'existe pas, seul `.env.local` est peuplé. Remplacer par `config({ path: [".env.local", ".env"] })` (dotenv ^17 accepte un tableau). | Sans ce correctif, `dbCredentials.url` est `undefined` et la migration échoue sur un message qui n'a rien à voir avec sa cause. `db:generate` ne le révèle pas : il ne se connecte pas (vérifié en Research). |
| 18 | Contrainte croisée `body_fat_pct + muscle_pct ≤ 100` ? | **Non appliquée.** Chaque pourcentage est validé indépendamment sur sa plage. | Les deux valeurs viennent de mesures d'impédancemétrie distinctes, dont la somme n'a pas de sens physiologique strict. Aucun critère ne le demande ; l'ajouter refuserait des saisies légitimes. Décision consignée pour qu'elle ne soit pas rouverte en revue. |
| 19 | Le sens « favorable » par mesure est-il déclaré ici ? | **Non.** `src/lib/measurements.ts` est structuré pour l'accueillir (un champ de plus par `kind`), mais s03 ne l'écrit pas. | s03 n'affiche aucun delta et aucune couleur de progression (Design, « Ce que ce design ne fait pas »). Le déclarer ici serait du code mort. La table de référence existe déjà dans `docs/design-system.md:140-152` ; s06 la transcrit. |
| 20 | `/saisie` est-elle rendue dynamiquement ? | **Oui : `export const dynamic = "force-dynamic"` sur `src/app/saisie/page.tsx`**, exactement comme `/historique` (tâche 6) et comme `src/app/page.tsx` livré par s02. Toute page qui appelle `getAuth()` le porte, sans exception. | ⚠️ *Première rédaction : la tâche 7 décrivait `/saisie` comme « Server Component, garde de session » **sans** `force-dynamic`, là où la tâche 6 le déclarait pour `/historique`. L'asymétrie était une omission, pas une décision, et elle cassait `npm run check`.* **Reproduit pendant cette révision**, page identique à celle de la tâche 7, `npx next build` avec `NEON_AUTH_COOKIE_SECRET` vidé : `Error occurred prerendering page "/saisie"` → `Error: Missing required config: cookies.secret` → `exiting the build`, build en échec. La même page avec `force-dynamic` : build vert, route classée `ƒ (Dynamic)`. Cause : `createNeonAuth()` appelle `validateCookieConfig()` **synchronement** (`@neondatabase/auth/dist/next/server/index.mjs:1037-1038`), donc `getAuth()` lève un `Error` ordinaire **avant** que le SDK n'atteigne `cookies()` — pas de `DynamicServerError`, pas de bascule automatique en dynamique. Or `src/build-leak.test.ts` lance `rm -rf .next && npx next build` à chaque `npm run test`, et le complément d'[ADR 005](../decisions/005-testing-stack.md) exige `npm run check` vert **sans aucun secret**. Le symptôme est **invisible sur cette machine** (`.env.local` est peuplé) : il n'apparaît qu'au premier clone ou à la première CI. |
| 21 | Quel type porte le paramètre `db` des fonctions de lecture ? | **`PgDatabase<PgQueryResultHKT>` de `drizzle-orm/pg-core`**, exporté sous l'alias `AppDatabase` depuis `src/lib/db/index.ts`. Ni `any`, ni une union de drivers, ni un générique par appelant. | Les deux drivers du projet sont incompatibles entre eux (`NeonHttpDatabase` en production, `PgliteDatabase` dans les tests de la tâche 8) mais **héritent tous deux de `PgDatabase`** (`neon-http/driver.d.ts:24`, `pglite/driver.d.ts` — `NeonHttpQueryResultHKT` et `PgliteQueryResultHKT` étendent l'un et l'autre `PgQueryResultHKT`, `pg-core/session.d.ts:66`). Vérifié par typecheck pendant ce plan : une fonction `(db: PgDatabase<PgQueryResultHKT>, userId: string)` accepte les deux sans cast et sans `any`. Contrainte pour s04-s09 : toute fonction de lecture prend ce type. Le **chemin d'écriture** garde le type concret `NeonHttpDatabase` — `batch()` n'existe que là (décision 10), et il ne doit pas être exposé aux tests PGlite. |
| 22 | La garde de session de `/historique` est-elle dans le `Suspense` ? | **Non — elle reste avant le boundary. Constat assumé, consigné ici.** | Le gain du `Suspense` (tâche 6) est de ne pas faire attendre le `h1` et le bouton derrière la base ; la garde n'est pas la base. Vérifié dans le paquet installé : `getSession()` essaie **d'abord** le cookie de session signé (`@neondatabase/auth/.../index.mjs:892-913` — `validateSessionData(sessionDataCookie, cookieSecret)`, retour immédiat si valide) et ne tombe sur l'appel HTTP au serveur d'auth qu'en cas de miss. Avec `sessionDataTtl: 300` (`src/lib/auth.ts`), le chemin courant est une vérification HMAC locale, pas un aller-retour réseau. Déplacer la garde **dans** le boundary coûterait plus qu'elle ne rapporte : le `h1` « Historique » se peindrait pour un visiteur déconnecté avant de le rediriger. Et le proxy (`src/proxy.ts`) a déjà redirigé l'anonyme en amont ; la garde de page est la défense en profondeur que la doc du SDK réclame, pas le premier rempart. |
| 23 | Sur quels contrôles la cible tactile de 44 px s'applique-t-elle ? | **Sur tous ceux du parcours, pas seulement les champs.** Liste close ci-dessous (« Les contrôles à 44 px »), et **chaque tâche qui en pose un l'assert**. | ⚠️ *Première rédaction : `h-11` n'était prescrit qu'à la tâche 7, « composé par `className` au-dessus de l'`Input` généré ». Les boutons et les liens de navigation restaient aux défauts du preset — soit 32 à 36 px — alors que la Definition of Done affirmait « `h-11` sur tout contrôle du parcours de saisie ». Une DoD que rien ne porte ne peut que se cocher à vue.* `docs/design-system.md:52` est explicite et fait foi : « tout contrôle qu'on touche dans un parcours de saisie — **champ, bouton d'action, entrée de navigation** — fait au minimum `h-11` (44 px) », et `:48` relève que le preset livre `Input` en `h-8`, `Button` en `h-8` (`h-9` en `size="lg"`). |
| 24 | `/saisie` et `/historique` portent-elles un en-tête (retour + titre) ? | **Oui, les deux.** `/saisie` : lien texte `‹ Retour` (→ `/`) puis `Nouvelle session` en `h1`. `/historique` : lien texte `‹ Retour` (→ `/`) puis `Historique` en `h1`. Aucune icône (gap n°4 du design system : s03 ne l'ouvre pas). | ⚠️ *Première rédaction : la tâche 7 passait de `page.tsx` au `FieldSet` sans en-tête, et sa ligne* Vérifiable *ne mentionnait ni titre ni sortie. `/saisie` aurait été livré sans titre et sans issue : en mode standalone iOS — la cible primaire du PRD — il n'y a pas de retour navigateur.* La structure est imposée par `docs/designs/s03-…md:26-27` (`‹ Retour` puis `Nouvelle session` en `h1`) et par `docs/design-system.md:188` (« Les écrans secondaires portent un retour en tête, à gauche »). **Écart assumé avec la maquette pour `/historique`** : le croquis du Design n'y dessine pas de retour, mais `design-system.md` est la seule source visuelle du projet et sa règle ne fait pas d'exception ; sans retour, `/historique` est un cul-de-sac en standalone, exactement le défaut qu'on corrige sur `/saisie`. |
| 25 | Où l'implémenteur consigne-t-il le protocole manuel de la tâche 10 ? | **Dans ce fichier**, section « Journal de vérification manuelle (tâche 10) » en fin de plan. **Pas dans `docs/reviews/s03-….md`.** | `AGENTS.md` fait de `docs/reviews/<id>.md` la sortie du **reviewer** en contexte neuf, le support des lignes `Max severity:` / `Ship allowed:`, et confie son commit à `/ks-ship`. Faire pré-remplir par l'implémenteur le document sur lequel il sera jugé mélange les deux rôles. Le plan, lui, est déjà le tracker vivant de la story (`AGENTS.md`, « Task progress ») : c'est sa place. Le reviewer lit ce journal, rejoue ce qu'il veut, et écrit **son** rapport. |

### Plages physiologiques et libellés — la source unique

Ordre de saisie du Design : le poids seul, puis le corps de haut en bas, puis les pourcentages.

| `kind` | Libellé FR | Groupe | Unité | min | max |
|---|---|---|---|---|---|
| `weight_kg` | Poids | poids | kg | 20 | 400 |
| `shoulders_cm` | Épaules | mensurations | cm | 60 | 200 |
| `chest_cm` | Poitrine | mensurations | cm | 50 | 200 |
| `biceps_cm` | Biceps | mensurations | cm | 15 | 80 |
| `waist_cm` | Tour de taille | mensurations | cm | 40 | 200 |
| `hips_cm` | Hanches | mensurations | cm | 50 | 200 |
| `thigh_cm` | Cuisse | mensurations | cm | 25 | 120 |
| `calf_cm` | Mollet | mensurations | cm | 15 | 80 |
| `body_fat_pct` | Masse grasse | composition | % | 1 | 70 |
| `muscle_pct` | Masse musculaire | composition | % | 10 | 90 |

L'unité vit dans la légende du groupe (`Mensurations (cm)`, `Composition (%)`), sauf le poids (`Poids (kg)`) — décision du Design, gardée telle quelle. « **Tour de taille** », jamais « Taille » : `Taille` désigne la taille de référence de s04.

### Les contrôles à 44 px — la liste close (décision 23)

Chaque ligne est posée par une tâche **et** assertée par cette tâche. Aucune n'est laissée à la Definition of Done.

| Contrôle | Écran | Tâche | Classe composée |
|---|---|---|---|
| Champ de date + 10 champs de mesure | `/saisie` | 7 | `h-11` sur l'`Input` (défaut du preset : `h-8`) |
| Bouton « Enregistrer la session » | `/saisie` | 7 | `h-11` sur le `Button` (défaut : `h-8`) |
| Lien `‹ Retour` | `/saisie`, `/historique` | 6, 7 | `min-h-11` + `inline-flex items-center` — c'est un lien texte, sa hauteur ne vient pas d'un composant |
| Bouton « Nouvelle session » | `/historique` | 6 | `h-11` |
| Bouton « Saisir mes mesures » de l'état vide | `/historique` | 6 | `h-11` |
| Bouton « Réessayer » | `/historique/error.tsx` | 6 | `h-11` |
| Bouton « Saisir mes mesures » | accueil | 9 | `h-11` — c'est lui qui porte le critère « au plus un tap » de s05 |
| Lien « Historique » | accueil | 9 | `min-h-11` + `inline-flex items-center` |

**Comment c'est asserté** : chaque test de rendu concerné vérifie que l'élément porte `h-11` **ou** `min-h-11` dans son `className`. C'est une assertion sur la classe, pas sur une hauteur calculée : jsdom ne fait pas de mise en page, et la valeur de vérité utile ici est « la classe du design system est bien composée », pas « le navigateur a rendu 44 px » — ce dernier point est vérifié à l'œil à la tâche 10, à 375 px.

### Ce que ce plan escalade — décision hors de sa portée

**L'en-tête collant de `docs/design-system.md:185-189` n'est construit par aucune story.** Le design system prescrit, pour « chaque écran authentifié », un en-tête collant (mot-symbole `morpho` à gauche, action principale à droite) et un menu portant les entrées secondaires (profil, graphes, historique, déconnexion). s02 a livré ses écrans avec un simple `<div>morpho</div>` non collant et sans menu ; `docs/designs/s03-…md` ne le dessine pas davantage ; s03 s'aligne sur son Design et pose des liens de retour (décision 24) plutôt qu'un shell de navigation.

C'est cohérent story par story et **incohérent avec le design system**. Le trancher ici reviendrait soit à réécrire les écrans de s02, soit à figer une convention de navigation que s06 (qui remplace l'accueil) et s04 (quatrième écran) devront honorer. **Décision demandée au-dessus de ce plan** : soit l'en-tête collant est bâti dans une story dédiée et `design-system.md` le date, soit la règle est amendée en « retour en tête sur les écrans secondaires » et l'en-tête collant retiré. s03 n'invente ni l'un ni l'autre.

### Ce que ce plan ne tranche pas

Deux points restent ouverts, faute de pouvoir être tranchés depuis le dépôt :

1. **Playwright ne peut pas atteindre un écran authentifié.** Le cookie de session est signé par le SDK avec `NEON_AUTH_COOKIE_SECRET` ; le forger reviendrait à réimplémenter le schéma de signature d'un paquet en beta, et s02 a déjà décidé de ne pas automatiser le magic link. s03 couvre donc en Playwright **uniquement** ce qui ne demande pas de session (redirections de `/saisie` et `/historique`), et consigne le reste en vérification manuelle. **Ce qui trancherait** : un helper de connexion programmatique côté SDK, ou un utilisateur de test dont la session est créée par une route de test protégée par un secret d'environnement. À instruire en **s06**, dont plusieurs critères navigateur (375 px, absence de défilement horizontal) portent sur un écran authentifié.
2. **Fidélité de PGlite vis-à-vis de la base réelle.** PGlite embarque son propre build Postgres ; la base Neon est en **18.4** (relevé). La tâche 2 fait tourner la **vraie** migration générée sur PGlite : si une DDL ne passe pas, le repli de l'ADR 009 s'applique — on ne modifie pas le schéma pour plaire à PGlite.

---

## Préalables

- **s02 doit avoir livré ses tâches 3 à 7** : `src/proxy.ts`, `src/app/api/auth/[...path]/route.ts`, l'écran de connexion et l'écran authentifié. Au moment de l'écriture de ce plan, ces fichiers **n'existent pas** sur `feature/s02-connect-magic-link` (seul `src/lib/auth.ts` est complété). Les tâches 1 à 6 et 8 de s03 s'exécutent sans ; les tâches 7, 9 et 10 supposent une session réelle et le proxy.
- **Credentials** : `morpho/.env.local` est peuplé (`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`) et la base répond. La tâche 10 en dépend ; aucune autre.
- **Playwright** : webkit installé en s01, projet `mobile` épinglé à 375 × 812.

---

## Tasks (ordered)

1. [x] **Schéma Drizzle et migration générée.** `src/lib/db/schema.ts` :
   - `const authUser = pgSchema("neon_auth").table("user", { id: uuid("id").primaryKey() })` — **`const`, sans `export`, et ce n'est pas un détail de style** : `drizzle-kit` sérialise les **exports** du fichier de schéma, donc un `export` ici fait émettre `CREATE TABLE "neon_auth"."user"` malgré `schemaFilter: ["public"]` (décision 1 bis, reproduit par spike). Ne pas importer `usersSync` de `drizzle-orm/neon` non plus — cette table n'existe pas sur cette base.
   - `pgEnum("measurement_kind", …)` avec les 10 valeurs, dans l'ordre de la table ci-dessus.
   - `measurement_sessions` : `id` uuid PK, `user_id` uuid NOT NULL → `authUser.id` `onDelete: "cascade"`, `measured_on` `date({ mode: "string" })` NOT NULL, `created_at` timestamptz NOT NULL `defaultNow()`.
   - `measurements` : `id` uuid PK, `session_id` uuid NOT NULL → cascade, `kind` enum NOT NULL, `value` **`numeric("value", { precision: 5, scale: 1, mode: "number" })`** NOT NULL. ⚠️ *Première rédaction : `numeric(5, 1, { mode: "number" })`. Cette signature n'existe pas : `drizzle-orm/pg-core/columns/numeric.d.ts:97-98` ne déclare que `numeric(config?)` et `numeric(name, config?)`, la précision et l'échelle vivant dans `PgNumericConfig`. La forme objet est vérifiée : elle produit `"value" numeric(5, 1) NOT NULL`.* Plus `unique("measurements_session_kind_unique").on(t.sessionId, t.kind)` et `check("measurements_value_positive", sql\`${t.value} > 0\`)`. Le 3ᵉ argument de `pgTable` renvoie **un tableau** (la forme objet est `@deprecated`).
   - Exporter aussi `type AppDatabase = PgDatabase<PgQueryResultHKT>` depuis `src/lib/db/index.ts` (décision 21) — c'est le type que prendront toutes les fonctions de lecture.

   Corriger `drizzle.config.ts` (décision 17), puis `npm run db:generate` et **commiter** `drizzle/`. La contrainte `CHECK` **est bien émise** par le `drizzle-kit@0.31.10` du dépôt — vérifié pendant ce plan, la migration contient littéralement `CONSTRAINT "measurements_value_positive" CHECK ("measurements"."value" > 0)`. Il n'y a donc aucune migration additionnelle à prévoir, et **aucune raison d'ouvrir un `drizzle-kit generate --custom`** : le fichier de migration ne s'écrit ni ne se retouche à la main (`AGENTS.md`).
   *Vérifiable* : tests Vitest (environnement `node`) — (a) le SQL généré contient `REFERENCES "neon_auth"."user"("id")` et **ni `CREATE SCHEMA`, ni `CREATE TABLE "neon_auth"`** — c'est ce test, et lui seul, qui verrouille le point de la décision 1 bis, `schemaFilter` ne le garantissant pas ; (b) la colonne `value` se lit en **nombre** : `mapFromDriverValue("72.40") === 72.4` — le piège d'[ADR 004](../decisions/004-measurements-as-rows.md) ; (c) l'enum expose exactement les 10 `kind` attendus, dans l'ordre ; (d) le SQL généré contient la contrainte `CHECK` et la contrainte `UNIQUE`.

2. [x] **Harnais de base de test PGlite + ADR 009.** `npm i -D @electric-sql/pglite`. `src/lib/db/test-database.ts` : `createTestDatabase()` instancie PGlite, crée la **fixture** `CREATE SCHEMA neon_auth` + `neon_auth."user"(id uuid primary key, email text not null)`, applique la **vraie** migration (`migrate()` de `drizzle-orm/pglite/migrator`, `migrationsFolder: "drizzle"`) et expose `{ db, seedUser() }`. C'est une fixture de test, **pas une migration** : `schemaFilter: ["public"]` reste intact et aucune migration ne touche `neon_auth`.
   *Vérifiable* : un test (environnement `node`) prouve que le harnais tient — la migration s'applique ; deux lignes du même `kind` sur la même session violent l'unicité ; `value = 0` viole le `CHECK` ; un `user_id` inconnu viole la FK. Le test consigne aussi `select version()` de PGlite (comparaison avec les 18.4 de Neon).
   *ADR 009* sur la branche, format MADR : branche Neon éphémère (rejetée — aucun CLI ni clé d'API, et un test à secret sort de `npm run check` par le complément d'ADR 005), base dédiée sur le projet Neon (rejetée — même raison, plus la latence réseau dans la boucle TDD), Postgres local/Docker (rejeté — absent de la machine), PGlite (retenu). **Repli explicite** si la migration ne s'applique pas : basculer sur la base dédiée derrière un `npm run check:db` séparé (précédent `check:leak`), et l'écrire dans l'ADR — jamais tordre le schéma pour PGlite.
   *Conséquence de la décision 21* : `createTestDatabase()` renvoie un `db` que les fonctions de lecture acceptent parce qu'elles prennent `AppDatabase = PgDatabase<PgQueryResultHKT>`. Le harnais **n'expose pas** `batch()` : c'est une méthode de `NeonHttpDatabase` seule, réservée au chemin d'écriture.

3. [x] **Catalogue des mesures et normalisation d'entrée.** `src/lib/measurements.ts` : les 10 `kind` dans l'ordre de saisie, avec libellé FR, groupe, unité et plage (table ci-dessus), le type dérivé de l'enum Drizzle et **jamais redéclaré**. `parseMeasurementInput(raw)` → `{ status: "empty" } | { status: "invalid" } | { status: "value", value }` : `trim`, `""` → `empty`, `,` → `.`, refus de tout ce qui ne correspond pas à `^\d+([.,]\d+)?$`, arrondi à une décimale. `formatMeasurementValue(value, unit)` : virgule française, une décimale, sans zéro de queue, espace insécable avant `%`.
   *Vérifiable* : `""` → `empty` (**jamais** `0`) ; `"0"` → `value 0` (refusé plus tard par la plage, pas ici) ; `"72,4"` et `"72.4"` → `72.4` ; `" 72,4 "` → `72.4` ; `"82,45"` → `82.5` ; `"abc"`, `"-5"`, `"1e3"`, `"7,2,1"` → `invalid` ; formatage : `82.4 → "82,4 kg"`, `118 → "118 cm"`, `82 → "82 kg"`, `18.5 → "18,5 %"`.
   *Piège nommé* : `z.coerce.number().safeParse("")` renvoie `{ success: true, data: 0 }` (vérifié en Research). Cette fonction est là précisément pour que `z.coerce.number()` ne touche jamais une chaîne vide.

4. [x] **Validation serveur de la session.** `src/lib/measurement-session-input.ts` : `parseMeasurementSessionInput(payload: unknown)` → `{ ok: true, value: { measuredOn, measurements: [{ kind, value }] } } | { ok: false, fieldErrors, formErrors }`. Date : `z.iso.date()` plus fenêtre `2000-01-01 … (jour UTC + 1)`. Champs vides **écartés avant toute coercition** ; au moins une mesure requise ; plages par `kind` avec messages FR sans jargon. Agrégation via `z.flattenError()` (forme `{ formErrors, fieldErrors }`, vérifiée).
   *Piège nommé* : en Zod 4, `invalid_type_error` est **silencieusement ignoré** — l'exemple de `next/dist/docs/01-app/02-guides/forms.md` est écrit en Zod 3. Utiliser `{ error: "…" }`.
   *Vérifiable* : tout vide → `formErrors` = « Renseignez au moins une mesure… » et **aucun** `fieldErrors` ; poids seul → exactement 1 mesure ; `waist_cm: "500"` → `fieldErrors.waist_cm` ; `body_fat_pct: "101"` → idem ; `weight_kg: "-5"` → idem ; `weight_kg: ""` + `waist_cm: "80"` → 1 mesure et aucune valeur à 0 ; date `"02/08/2026"` → `fieldErrors.measuredOn` ; date à J+2 UTC → refusée ; date à J+1 UTC → acceptée.

5. [x] **`POST /api/sessions` + ADR 010.** `src/app/api/sessions/route.ts`, `export const dynamic = "force-dynamic"`. Identité **exclusivement** par `getAuth().getSession()` → `data.user.id` ; un `user_id` présent dans le corps est ignoré. Pas de session → **401**, sans le moindre accès base (même assertion qu'en s01). `getSession()` en panne réseau/serveur → **503** (réutiliser la taxonomie de `src/app/api/session/route.ts`). Payload invalide → **400** `{ fieldErrors, formErrors }`. Succès → **201** `{ id }`. Écriture par `db.batch([...])` avec l'`id` de session généré par `crypto.randomUUID()` (décision 10) ; **ne jamais appeler `db.transaction()`** — le driver `neon-http` lève. `getDb()` appelé **dans le handler**, jamais à la portée module (revue s01, finding D). Échec base → 503 + `console.error` côté serveur, aucun détail au client.
   *ADR 010* sur la branche : Route Handler retenu, Server Action + `useActionState` rejetée (raisons en décision 2).
   *Vérifiable* : 401 sans session **et** aucun appel au client base ; 503 sur panne d'auth ; **400 sur formulaire vide _et_ aucun appel au client base sur ce chemin** — c'est la seconde moitié du critère 4 (« rien n'est persisté »), qui se prouve exactement comme celle du 401 et non par relecture ; 400 sur valeur hors plage, même assertion d'absence d'accès base ; 201 sur poids seul avec exactement une ligne `measurements` insérée ; **forgery** : session B + `user_id: A` dans le corps → la session créée porte B ; 503 sur échec base.

6. [x] **Lecture de l'historique et écran `/historique`.** Quatre unités, séparées pour être testables une par une :
   - `src/lib/measurement-sessions.ts` : `listMeasurementSessions(db: AppDatabase, userId: string)` — sessions de cet utilisateur, `ORDER BY measured_on DESC, created_at DESC`, chacune avec ses mesures renseignées. `userId` est **obligatoire, sans valeur par défaut** : aucune signature ne doit permettre d'oublier le filtre. Le type `AppDatabase` vient de la décision 21 : c'est ce qui rend la fonction exécutable à la fois sur `getDb()` et sur le harnais PGlite de la tâche 8, sans `any` et sans surcharge.
   - `src/components/SessionHistory.tsx` : Server Component **asynchrone**, `export`é nommément, signature `SessionHistory({ userId }: { userId: string })`. Il appelle `getDb()` puis `listMeasurementSessions(db, userId)` et délègue le rendu à `SessionHistoryList`. C'est **le seul** endroit du chemin de lecture qui touche la base, et il est isolé dans son fichier précisément pour qu'un test puisse l'appeler directement — `await SessionHistory({ userId })`, comme `src/app/page.test.tsx` appelle déjà `await Home()`.
   - `src/app/historique/page.tsx` (Server Component, `force-dynamic`) : garde de session (redirection si absente — voir décision 22 sur sa position), `‹ Retour` + `h1` « Historique » + `Button` « Nouvelle session » rendus **immédiatement**, puis `<Suspense fallback={<SessionHistorySkeleton />}><SessionHistory userId={data.user.id} /></Suspense>` — le cold start Neon (~500 ms) ne doit jamais retarder le bouton.
   - `src/app/historique/error.tsx` (client) : `Empty` + bouton « Réessayer » câblé sur **`unstable_retry()`**, message en clair sans code HTTP.

   ⚠️ *Première rédaction : « `Empty` + “Réessayer” sur `reset()` ». **C'était faux et le bouton aurait été un no-op.** Vérifié dans le runtime installé, `node_modules/next/dist/client/components/error-boundary.js:39-48` : `reset` ne fait que `this.setState({ error: null })`, tandis que `unstable_retry` fait `startTransition(() => { this.context?.refresh(); this.reset(); })`. La doc livrée (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md:121`) le dit mot pour mot : `unstable_retry()` « will try to re-fetch and re-render the error boundary's children ». Or l'erreur traitée ici vient du Server Component qui lit Neon : sans nouvelle lecture, `reset()` re-rend le sous-arbre qui vient de lever, l'erreur est immédiatement re-capturée, et l'utilisateur tape « Réessayer » indéfiniment sans rien changer.* Les deux props (`reset` et `unstable_retry`) sont bien passées au composant d'erreur (`error-boundary.js:107-110`). Le préfixe `unstable_` est assumé : c'est l'API que la doc **de cette version** prescrit ; s'il disparaît, le repli est un composant client qui appelle `useRouter().refresh()` puis `reset()` — ce que `unstable_retry` fait en interne.

   Rendu : `ItemGroup` / `Item variant="outline"` (jamais `default` : bordure transparente, invisible dans les deux thèmes), `ItemTitle` = date en toutes lettres `fr-FR`, une colonne, `tabular-nums`, valeurs via `formatMeasurementValue`. État vide : `Empty` + « Saisir mes mesures ». **Pas de ligne cliquable, pas de delta, pas de couleur de progression** (s06/s09). Les quatre contrôles de l'écran (`‹ Retour`, « Nouvelle session », « Saisir mes mesures », « Réessayer ») portent la classe de la décision 23.
   *Piège nommé* : `new Date("2026-08-02")` est interprété **UTC** ; formaté dans un fuseau négatif il affiche le 1ᵉʳ août. `formatSessionDate(iso, timeZone)` prend le fuseau en paramètre explicite.
   *Vérifiable* : la liste rend N sessions dans l'ordre décroissant ; une session au poids seul rend **une seule** ligne ; l'état vide rend `Empty` et son action ; `formatSessionDate("2026-08-02", tz)` rend « dimanche 2 août 2026 » pour `"UTC"` **et** pour `"America/Los_Angeles"` ; `error.tsx` — un clic sur « Réessayer » appelle le spy `unstable_retry` **et** le test échoue si le handler est `reset` (les deux spies sont distincts, `reset` n'est pas appelé seul) ; les quatre contrôles portent `h-11` ou `min-h-11` ; la page rend son `h1` et son lien de retour **sans** attendre la base (le `fallback` du `Suspense` est présent au même rendu).

7. [x] **Écran `/saisie`.** `npx shadcn@latest add item skeleton sonner` (`button`, `input`, `label`, `field`, `spinner`, `empty`, `separator`, `alert` sont déjà là depuis s02 ; `sonner` tire les paquets `sonner` et `next-themes`). Ne jamais éditer `src/components/ui/` à la main.

   `src/app/saisie/page.tsx` — Server Component, **`export const dynamic = "force-dynamic"` (décision 20, non négociable)**, garde de session, puis, dans cet ordre vertical (décision 24) : lien texte `‹ Retour` vers `/`, `h1` « Nouvelle session », et le formulaire.

   `src/components/MeasurementSessionForm.tsx` (`"use client"`), construit d'après le Design : `FieldSet`/`FieldLegend`/`FieldSeparator`, grille 2 colonnes pour les 9 champs courts, date et poids en pleine largeur, `type="text"` + `inputMode="decimal"` + `autoComplete="off"`, **aucun placeholder**, `h-11` composé par `className` au-dessus de l'`Input` généré (qui est en `h-8`) **et au-dessus du `Button` d'envoi** (qui est en `h-8`), texte à 1 rem (en dessous de 16 px, iOS zoome au focus). Date par défaut = **jour de l'appareil**, posée après le montage (`useState("")` + `useEffect`) : un défaut calculé au rendu figerait le fuseau du serveur et produirait un écart d'hydratation. Soumission : `fetch("/api/sessions")` avec les **chaînes brutes** — aucune normalisation côté client, le serveur est l'autorité (critère 5). Pendant l'envoi : bouton désactivé, `Spinner` + « Enregistrement… », champs non désactivés. 400 → `FieldError` sous chaque champ fautif + `aria-invalid` sur l'`Input`, valeurs conservées ; `formErrors` → `Alert` juste au-dessus du bouton (décision 11). 201 → `toast.success("Session enregistrée")` puis `router.push("/historique")`.
   *Vérifiable* : les 11 champs sont présents avec les libellés de la table ; **aucun** `input[type="number"]`, aucun `input[type="password"]`, aucun sélecteur d'unité ; l'écran porte un `h1` « Nouvelle session » **et** un lien de retour vers `/` ; soumission vide → l'`Alert` porte le message du serveur ; 400 → le message apparaît **sous le champ concerné** et les valeurs saisies sont intactes ; 201 → `toast` appelé puis `push("/historique")` ; pendant la requête, le bouton est désactivé (pas de double soumission) ; la date se remplit après montage avec le jour de l'appareil (horloge figée dans le test) ; les 11 champs, le bouton d'envoi et le lien de retour portent `h-11` ou `min-h-11` ; **`src/app/saisie/page.tsx` exporte `dynamic === "force-dynamic"`** — assertion sur le module, la seule qui attrape la régression sans secret (le build, lui, ne la révèle que sur une machine sans `.env.local`).

8. [x] **Isolation inter-utilisateurs — critère 7.** Tests dédiés, à trois niveaux — chacun avec son point d'entrée nommé, pour qu'aucun ne soit « à trouver » à l'exécution.
   - **PGlite** (`src/lib/measurement-sessions.test.ts`) : semer A et B dans la fixture `neon_auth."user"`, 2 sessions pour A et 1 pour B, puis `listMeasurementSessions(db, B.id)` ne renvoie **que** celle de B, et `listMeasurementSessions(db, A.id)` n'en voit aucune de B — la tentative d'accès croisé est explicite, pas déduite.
   - **Handler** (`src/app/api/sessions/route.test.ts`) : le test de forgery de la tâche 5 — aucun paramètre client (`?user_id=`, corps, en-tête) n'influence l'identité retenue.
   - **Page → composant** : en deux assertions, parce qu'un Server Component asynchrone enveloppé de `<Suspense>` n'est **pas** exécuté par un `render()` de Testing Library (React ne résout pas un enfant async côté client). (a) `src/app/historique/page.test.tsx` : `vi.mock("@/components/SessionHistory")` par un stub **synchrone**, `render(await HistoriquePage())` avec une session B mockée, puis assertion que le stub a reçu `{ userId: B.id }` et rien d'autre. (b) `src/components/SessionHistory.test.tsx` : `await SessionHistory({ userId: B.id })` avec `listMeasurementSessions` espionné → il reçoit exactement cet id.
   *Note de méthode* : appeler un Server Component asynchrone directement est déjà le motif du dépôt — `src/app/page.test.tsx` fait `const element = await Home(); render(element);` sur un `export default async function Home()`. Ce qui manquait n'était pas le motif, c'était **un point d'appel** : tant que la lecture vivait dans une fonction anonyme au milieu du `<Suspense>` de `page.tsx`, il n'y avait rien à appeler. D'où l'extraction de `src/components/SessionHistory.tsx` en tâche 6.
   *Règle consignée pour la revue* : aucune fonction de lecture ou d'écriture n'expose un `userId` optionnel ou à valeur par défaut.

9. [x] **Navigation, `Toaster`, et consignation des gaps du design system.** `src/app/page.tsx` : ajouter le `Button` primaire « Saisir mes mesures » (→ `/saisie`) et le lien secondaire « Historique » (→ `/historique`). **Rien d'autre sur cet écran** — s06 le remplace intégralement. `<Toaster />` monté **une seule fois** dans `src/app/layout.tsx`. Puis mettre à jour `docs/design-system.md` : acter `alert` pour l'erreur d'opération **et sa position adjacente à l'action** (gap 3) ; acter le point de montage du `Toaster` et le constat `next-themes` (gap 5 / gap connu n°4) ; acter le format d'affichage des valeurs numériques, aligné sur `numeric(5,1)` (gap 7) ; corriger l'attribution d'`alert` dans la table des composants (installé dès s02, pas ici).
   ⚠️ *Première rédaction : cette tâche revendiquait aussi « retirer la ligne `form` (gap 1) » et « ajouter `item`, `skeleton`, `sonner` à la table des composants ». **Revue (finding 4) : les deux étaient déjà faits sur `feature/s02-connect-magic-link`** avant même que ce plan ne s'écrive — vérifié sur cette branche : la ligne `form` n'existe pas dans la table de `docs/design-system.md`, et `item`, `skeleton`, `sonner` y figurent déjà. s03 n'a donc réalisé que les gaps 3, 5, 7 et la ré-attribution d'`alert`, ce que le texte ci-dessus reflète maintenant. Aucune conséquence technique — le fichier était déjà correct — seule la revendication de la tâche était erronée.*
   *Vérifiable* : la page d'accueil expose un lien vers `/saisie` et un vers `/historique` (le critère « au plus un tap » de s05 devient atteignable) ; les deux portent `h-11` ou `min-h-11` (décision 23) ; le layout monte exactement un `Toaster`.

10. [ ] **Migration appliquée et vérification sur services réels.** *(exige `.env.local` peuplé et s02 terminée)* `npm run db:migrate` sur la base Neon, puis introspection de contrôle : `public` contient les deux tables et l'enum, `neon_auth` est **inchangée** (9 tables, `user` intacte). Parcours réel : magic link → `/saisie` → session complète → toast → `/historique` ; session partielle (poids seul) → une seule ligne affichée et une seule ligne en base ; formulaire vide → refus, rien de persisté ; valeur hors plage forcée par un `POST` direct (hors UI) → 400 avec erreur de champ. Rendu vérifié à **375 px**, en clair **et** en sombre, sans défilement horizontal. **Critère 8 — appareil vierge** : autre navigateur, profil neuf, stockage vide → magic link → l'historique complet réapparaît. Playwright (`tests/e2e/saisie.spec.ts`, projet `mobile`) : non authentifié, `/saisie` et `/historique` redirigent vers l'écran de connexion.
    **Où ça se consigne** : dans la section « Journal de vérification manuelle (tâche 10) » **de ce plan**, pas dans `docs/reviews/s03-log-measurement-session.md` (décision 25). Le fichier de review est la sortie du reviewer en contexte neuf et le support de la gate ; l'implémenteur n'y écrit pas.

---

## Files touched

```
morpho/drizzle.config.ts                      modifié — charge .env.local (décision 17)
morpho/drizzle/0000_*.sql + meta/             créés — migration générée, commitée, jamais éditée
morpho/src/lib/db/schema.ts                   créé — enum + 2 tables + FK uuid vers neon_auth."user"
                                                 (authUser = const NON exporté — décision 1 bis)
morpho/src/lib/db/index.ts                    modifié — export type AppDatabase (décision 21)
morpho/src/lib/db/schema.test.ts              créé — SQL généré (pas de CREATE TABLE neon_auth,
                                                 CHECK + UNIQUE présents), mode number, valeurs d'enum
morpho/src/lib/db/test-database.ts            créé — harnais PGlite (fixture neon_auth + migrate)
morpho/src/lib/db/test-database.test.ts       créé — unique, CHECK, FK réellement appliqués
morpho/src/lib/measurements.ts                créé — catalogue, plages, parse, format
morpho/src/lib/measurements.test.ts           créé — table du piège vide/virgule/arrondi
morpho/src/lib/measurement-session-input.ts   créé — Zod du payload
morpho/src/lib/measurement-session-input.test.ts  créé
morpho/src/lib/measurement-sessions.ts        créé — listMeasurementSessions(db, userId)
morpho/src/lib/measurement-sessions.test.ts   créé — isolation A/B sur PGlite
morpho/src/lib/date.ts                        créé — todayIsoDate(), formatSessionDate()
morpho/src/lib/date.test.ts                   créé
morpho/src/app/api/sessions/route.ts          créé — POST 201/400/401/503
morpho/src/app/api/sessions/route.test.ts     créé — dont le test de forgery
morpho/src/app/saisie/page.tsx                créé — force-dynamic + garde + en-tête + formulaire
morpho/src/app/historique/page.tsx            créé — force-dynamic + en-tête + Suspense + skeleton
morpho/src/app/historique/page.test.tsx       créé — SessionHistory reçoit l'id de la session, et lui seul
morpho/src/app/historique/error.tsx           créé — Empty + Réessayer sur unstable_retry()
morpho/src/app/historique/error.test.tsx      créé — le clic appelle unstable_retry, pas reset
morpho/src/components/MeasurementSessionForm.tsx      créé — "use client"
morpho/src/components/MeasurementSessionForm.test.tsx créé
morpho/src/components/SessionHistory.tsx              créé — Server Component async, seul point de
                                                         lecture base ; extrait pour être appelable
morpho/src/components/SessionHistory.test.tsx         créé — await SessionHistory({ userId })
morpho/src/components/SessionHistoryList.tsx          créé — présentationnel pur (testable)
morpho/src/components/SessionHistoryList.test.tsx     créé
morpho/src/components/SessionHistorySkeleton.tsx      créé
morpho/src/components/ui/{item,skeleton,sonner}.tsx   générés par la CLI shadcn
morpho/src/app/layout.tsx                     modifié — <Toaster /> monté une fois
morpho/src/app/page.tsx                       modifié — 2 contrôles de navigation, rien d'autre
morpho/tests/e2e/saisie.spec.ts               créé — redirections sans session
morpho/package.json                           modifié — @electric-sql/pglite (dev), sonner, next-themes
morpho/docs/decisions/009-test-database-pglite.md   créé
morpho/docs/decisions/010-write-path-route-handler.md créé
morpho/docs/design-system.md                  modifié — gaps 3, 5, 7 actés + attribution d'alert corrigée
                                                 dans la table des composants (gap 1 déjà fermé sur s02)
```

`compoundSimulator/` : **aucun fichier touché.** `src/components/ui/` : généré, jamais édité à la main.

---

## Test strategy

**Vitest — l'essentiel.** Chaque tâche 1 à 9 commence par un test rouge.
- *Logique pure* (tâches 3, 4, et `date.ts`) : c'est là que vit le piège central. La table `""` / `"0"` / `"72,4"` / `"82,45"` / `"abc"` est écrite **avant** l'implémentation.
- *Handler* (tâche 5) : appelé directement avec une `Request`, `getAuth()` et `getDb()` mockés — le motif déjà en place en s01. Trois assertions non négociables : 401 sans session, aucun accès base sur ce chemin, et l'identité jamais lue dans la requête.
- *Composants* (tâches 6, 7, 9) : Testing Library + `userEvent`, `fetch` et `next/navigation` mockés. `SessionHistoryList` est présentationnel pur pour rester testable sans base.
- *Server Components asynchrones* : on les **appelle**, on ne les `render()` pas — `const element = await Page(); render(element);`, le motif déjà en place dans `src/app/page.test.tsx`. Corollaire structurel (tâche 8) : un composant async **enveloppé de `<Suspense>`** n'est jamais exécuté par le `render()` du parent ; pour l'exercer il faut qu'il soit un module exporté qu'on peut appeler — d'où `src/components/SessionHistory.tsx`.
- *Rendu statique* : un test assert que `src/app/saisie/page.tsx` et `src/app/historique/page.tsx` exportent `dynamic === "force-dynamic"`. Sans ça, la régression n'apparaît qu'à `next build` **sur une machine sans `.env.local`** — c'est-à-dire après la revue.
- ⚠️ **`vitest.setup.ts` mocke `next/headers` globalement.** Un test qui croirait exercer une vraie lecture de cookies reçoit un stub muet. Toute assertion d'authentification passe par le mock de `@/lib/auth`, jamais par les cookies.
- ⚠️ Les tests qui touchent un driver base tournent en `// @vitest-environment node` (revue s01, finding H : sous jsdom, `window` existe et le driver Neon bascule en mode navigateur).

**PGlite — ce que seul du vrai SQL prouve** (tâches 2, 6, 8) : que la migration générée s'applique, que l'unicité `(session_id, kind)`, le `CHECK (value > 0)` et la FK **rejettent réellement**, et que la requête d'historique filtre sur `user_id`. Sans secret, donc **dans `npm run check`**. Contrainte de coût : mutualiser une instance PGlite par fichier (`beforeAll` + nettoyage entre tests) plutôt qu'une par test — la revue de s01 a sanctionné un `check` passé à 122 s (finding A). La durée de `npm run check` est mesurée et consignée dans la review ; si PGlite la fait dériver, on partage l'instance, **on ne retire pas les tests**.

**Playwright** (tâche 10, projet `mobile`, 375 × 812, webkit) : uniquement ce qui ne demande pas de session — `/saisie` et `/historique` redirigent vers la connexion. Le reste du parcours navigateur est hors de portée tant qu'aucun mécanisme d'injection de session n'existe (voir « Ce que ce plan ne tranche pas »).

**Manuel, consigné dans la review** : l'application de la migration sur Neon et l'introspection de contrôle ; le parcours complet magic link → saisie → historique ; le rendu à 375 px dans les deux thèmes ; le refus serveur d'une valeur hors plage envoyée hors UI ; et le **critère 8** (appareil vierge, profil de navigateur neuf) — qui ne se simule pas par un vidage de cache.

---

## Definition of Done

- `npm run check` **vert sans aucun secret** (typecheck + lint + test), durée mesurée et consignée. `npm run check:leak` inchangé. Rappel du mécanisme : `src/build-leak.test.ts` lance `rm -rf .next && npx next build` — **toute page appelant `getAuth()` sans `force-dynamic` rend cette commande rouge**, et le symptôme est masqué sur une machine dont le `.env.local` est peuplé (décision 20). Vérification recommandée avant la PR : `NEON_AUTH_COOKIE_SECRET="" NEON_AUTH_BASE_URL="" npx next build` doit passer.
- Les 9 critères d'acceptation vérifiés, chacun avec sa preuve. Les critères 2, 6 et 8 exigent les services réels : sans eux ils sont **explicitement marqués non vérifiés**, jamais cochés par optimisme.
- **Critère 3 prouvé au niveau base, pas seulement à l'écran** : une session au poids seul produit exactement une ligne `measurements`, et aucune ligne à `0` n'est stockable (contrainte `CHECK` exercée par un test).
- **Critère 4 prouvé en entier** : le refus est un 400 avec message **et** aucun appel au client base sur ce chemin, asserté comme l'est celui du 401.
- **Critère 7 prouvé par une tentative d'accès croisé explicite**, sur du vrai SQL et sur le handler — pas par relecture de code.
- La migration est **générée, versionnée et appliquée** ; aucune table créée à la main dans la console Neon ; `neon_auth` intacte après application (introspection consignée). Le SQL généré ne contient **ni `CREATE SCHEMA`, ni `CREATE TABLE "neon_auth"`** — asserté par test, pas déduit de `schemaFilter`.
- Le bouton « Réessayer » de `/historique` **refait réellement la lecture** (`unstable_retry`), et un test le prouve.
- ADR 009 (base de test) et ADR 010 (voie d'écriture) commités sur la branche.
- `docs/design-system.md` à jour : gaps 3, 5 et 7 actés (le gap 1 était déjà fermé sur `feature/s02-connect-magic-link` — revue, finding 4 ; s03 ne le revendique plus). Aucun composant ni token inventé hors du système ; aucune couleur en dur ; **les 8 lignes de la table « Les contrôles à 44 px » sont posées et assertées** — cette ligne ne se coche pas à vue, elle se coche sur des tests.
- `/saisie` et `/historique` portent chacune un `h1` et un lien de retour vers `/` (décision 24).
- Aucun `input[type="number"]`, aucun sélecteur d'unité, aucun champ IMC, aucun pré-remplissage, aucun delta — le périmètre des stories voisines n'est pas entamé.
- Aucun secret dans le diff. `compoundSimulator/` intact. PR unique sur `feature/s03-log-measurement-session`, review passée sans critique ouverte.

---

## Journal de vérification manuelle (tâche 10)

Consigné par l'implémenteur (décision 25) — le reviewer rejoue ce qu'il veut de ce qui suit et écrit son propre rapport dans `docs/reviews/s03-log-measurement-session.md`.

Contraintes de cette exécution : `.env.local` peuplé, base Neon réelle joignable. **Aucun email envoyé** — la jambe magic link exige un humain et n'a pas été déclenchée.

### Introspection avant migration

```
public : []  (vide, confirmé avant toute migration)
neon_auth : account, invitation, jwks, member, organization, project_config, session, user, verification (9 tables)
neon_auth."user" : id uuid, name text, email text, emailVerified boolean, image text,
                    createdAt timestamptz, updatedAt timestamptz, role text,
                    banned boolean, banReason text, banExpires timestamptz
select version() : PostgreSQL 18.4, base neondb, rôle neondb_owner
```

### `npm run db:migrate`

Exécuté contre la base Neon réelle : `[✓] migrations applied successfully!`.

### Introspection après migration

```
public : measurement_sessions, measurements  (+ enum measurement_kind)
neon_auth : account, invitation, jwks, member, organization, project_config, session, user, verification (9 tables — inchangé)
neon_auth."user" : colonnes identiques à l'introspection d'avant migration, au caractère près
```

Contraintes relevées sur `measurements` : `measurements_session_kind_unique UNIQUE (session_id, kind)`, `measurements_value_positive CHECK ((value > (0)::numeric))`. FK `measurement_sessions.user_id → neon_auth."user"(id) ON DELETE CASCADE`, FK `measurements.session_id → measurement_sessions(id) ON DELETE CASCADE`. Aucune table créée à la main : uniquement `db:migrate` sur le SQL versionné dans `drizzle/`.

**Critère de la Definition of Done sur la migration : vérifié.**

### `npm run check` / `npm run check:leak`, contre la base réellement migrée

- `npm run check` : **vert, 27 fichiers de test, 136 tests, ~11 s.**
- `npm run check:leak` : **vert** (1 test), `.env.local` peuplé.
- `NEON_AUTH_COOKIE_SECRET="" NEON_AUTH_BASE_URL="" DATABASE_URL="" npx next build` (worktree non isolé, secrets vidés uniquement dans l'environnement de la commande, `.env.local` déplacé puis restauré) : **build vert**, `/saisie` et `/historique` classées `ƒ (Dynamic)` — vérifie décision 20 sur les deux pages de cette story, en plus de la vérification déjà faite par `src/build-leak.test.ts` dans `npm run check`.

### Parcours réel, sans session (`npm run dev`, port 3001, base Neon réelle)

Serveur de développement réel, requêtes non mockées :

```
GET  /api/health           → 200 {"ok":true}                     (la connexion Postgres réelle répond)
GET  /                      → 307 → /auth/sign-in
GET  /saisie                → 307 → /auth/sign-in
GET  /historique             → 307 → /auth/sign-in
POST /api/sessions (sans session) → 401
```

Playwright, projet `mobile` (webkit, 375×812), contre ce même serveur (`E2E_BASE_URL=http://localhost:3001`) : `tests/e2e/saisie.spec.ts`, **2/2 verts** — `/saisie` et `/historique` redirigent bien vers l'écran de connexion pour un visiteur non authentifié, en navigateur réel.

**Critère 6 (fonctionnement UI de la validation serveur, redirections non authentifiées) : partiellement vérifié — la partie qui ne demande pas de session l'est réellement, en navigateur.**

### Ce qui n'a pas pu être vérifié ici — nécessite un humain

Conformément à la limite posée pour cette exécution (aucun email envoyé) et à « Ce que ce plan ne tranche pas » (aucun mécanisme d'injection de session programmatique disponible avant ADR 011/s06) :

1. **Critère 2** (session complète → persistance → confirmation) : NON VÉRIFIÉ en conditions réelles. Prouvé uniquement par les tests (PGlite + handler mocké).
2. **Critère 3** (session partielle, poids seul) : prouvé au niveau base par un test PGlite (une ligne `measurements`, `CHECK` empêchant le zéro) — **NON rejoué à l'écran, en session réelle**.
3. **Critère 8** (appareil vierge, magic link, restauration de l'historique) : NON VÉRIFIÉ — exige l'envoi et la réception d'un email, explicitement hors périmètre de cette exécution.
4. **Valeur hors plage forcée par un `POST` direct, hors UI, en session authentifiée réelle** : NON VÉRIFIÉ (le 401 sans session l'est ; le 400 sur une session réelle ne l'est pas, faute de session).
5. **Rendu à 375 px, clair et sombre, dans un vrai navigateur** : NON VÉRIFIÉ visuellement — seules les assertions de classe (`h-11` / `min-h-11`) sont couvertes par test.

**Protocole pour la suite, à jouer par un humain** : ouvrir `/auth/sign-in` sur le déploiement ou en local, recevoir et cliquer le magic link, puis dérouler `/saisie` → session complète → toast → `/historique` ; une session poids seul ; un formulaire vide ; un `POST` direct hors plage (`curl` ou devtools, avec le cookie de session du navigateur) ; le rendu à 375 px en clair et en sombre ; puis, depuis un second navigateur/profil vierge, le critère 8.

---

