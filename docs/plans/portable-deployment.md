---
validated: no
---
# Plan — déploiement portable, sans fournisseur imposé

Branch: `claude/vercel-deployment-no-neon-aj7emz`

## Objectif

Demande utilisateur, verbatim : « je voudrais me passer de neon », puis
« ce que j'aimerais c'est que ce soit déployable directement sur vercel,
netlify ou autre ».

Ce n'est **pas** une story produit : aucun écran ne change, aucun critère
d'acceptation de `docs/stories.md` n'est touché. C'est un changement de
socle, qui coche quatre des cinq déclencheurs de la voie « branche + PR »
d'`AGENTS.md` : schéma et migrations, surface d'authentification, choix
architectural méritant des ADR, et un diff qui se lit mieux d'un bloc.

### Critère de sortie

Le dépôt cloné à froid se déploie, **sans modification de code**, sur les
trois voies suivantes :

1. **Vercel** — une variable d'environnement de base : `DATABASE_URL`.
2. **Netlify** — la même, zéro configuration spécifique.
3. **N'importe quel hôte Node ou Docker** (Fly, Railway, Render, Coolify,
   VPS, machine locale) — `docker compose up` démarre l'app **et** sa base,
   sans aucun compte tiers.

Et le critère négatif, celui qui donne son sens au reste : **aucun paquet
`@neondatabase/*` dans `package.json`**, aucune variable d'environnement
nommant un fournisseur.

## Ce que « portable » veut dire, et ce qu'il ne veut pas dire

La demande initiale était « sans autre dépendance ». Après la clarification
« vercel, netlify ou autre », l'objectif réel est **l'interchangeabilité**,
pas l'absence. Une app qui persiste des données côté serveur a forcément
une base ; ce qu'on supprime, c'est qu'elle soit *celle-là*.

D'où l'écartement, mesuré, de l'option qui avait été proposée en premier :

> **Vercel Blob est rejeté.** Un store Blob privé aurait donné le zéro
> service tiers demandé par la première formulation. Il est techniquement
> lisible depuis Netlify (le SDK n'a besoin que d'un
> `BLOB_READ_WRITE_TOKEN`), mais le store vit chez Vercel : déployer sur
> Netlify exigerait quand même un compte Vercel actif. C'est du lock-in
> déguisé en portabilité, et ça échoue au critère de sortie 3 de façon
> absolue — il n'existe aucun `docker compose up` qui fournisse un Vercel
> Blob.

Corollaire dans l'autre sens : **le critère #12 du PRD est intact.**
« Depuis un appareil neuf, une connexion restaure l'intégralité de
l'historique » reste vrai — les données restent côté serveur. [ADR
002](../decisions/002-neon-postgres.md) n'est pas contredit sur son fond,
seulement sur le fournisseur qu'il nommait.

## État des lieux — le couplage, mesuré

| Bloc | Fichiers | Volume |
|---|---|---|
| Driver | `src/lib/db/index.ts` | 53 l. |
| Requêtes Drizzle | `db/{sessions,latest-measurements,measurement-series,body-map,account}.ts` | 571 l. + ~1 250 l. de tests |
| Schéma + migrations | `db/schema.ts`, `drizzle/*.sql` | 170 l. + 5 migrations |
| Auth serveur | `lib/auth.ts`, `api/auth/[...path]/route.ts`, `proxy.ts` | 3 fichiers |
| Auth client | `lib/auth-client.ts`, `lib/auth-errors.ts` + 5 composants | `signIn.email`, `signUp.email`, `signOut`, `requestPasswordReset`, `resetPassword`, `changePassword`, `deleteUser` |
| Lectures de session | 8 appels à `getAuth().getSession()` | pages + route handlers |
| Fixture de test | `db/test-database.ts` crée `neon_auth."user"` en SQL brut | 72 l. |
| Garde anti-fuite | `src/build-connection-leak.check.ts` cherche `NEON_AUTH_COOKIE_SECRET` | jeu d'aiguilles à mettre à jour |

**Le fait qui allège tout le reste :** [ADR
003](../decisions/003-neon-auth.md) a établi, en interrogeant la base
réelle, que Neon Auth **est** Better Auth — le schéma Better Auth complet
(`user`, `session`, `account`, `verification`, `jwks`) posé dans le schéma
`neon_auth`. Passer à Better Auth auto-hébergé n'est donc pas un
changement de bibliothèque d'auth : c'est **la même bibliothèque, sortie
de chez l'hébergeur**. Les méthodes du client sont identiques.

### Faits vérifiés pour ce plan, et le seul qui ne l'est pas

Vérifiés en source ou en documentation courante, pas de mémoire :

- `db.transaction()` existe sur le driver `postgres-js` de Drizzle, avec
  transactions imbriquées et savepoints — donc la décision 2 tient ;
- `prepare: false` est la recommandation explicite de Drizzle pour un
  pooler en mode transaction — donc la décision 4 tient ;
- `getSessionCookie(request)` depuis `better-auth/cookies` est le motif
  documenté pour le middleware Next.js, avec l'avertissement « ceci n'est
  pas sécurisé, faites la vérification dans chaque page » — c'est-à-dire
  exactement la position que ce dépôt tient déjà (décision 7).

**Non vérifié ici, à lever en tâche 2 :** que `PostgresJsDatabase` descende
bien de `PgDatabase<PgQueryResultHKT>`, et donc que `AppDatabase` accepte
le nouveau driver sans cast. C'est vrai par construction chez Drizzle — tous
les drivers PG en descendent, et le docstring de `db/index.ts` l'a déjà
constaté pour deux d'entre eux — mais `node_modules` n'était pas installé
dans l'environnement où ce plan a été écrit, donc le typecheck n'a pas été
rejoué. Si l'hypothèse tombe, c'est la ligne « les 571 lignes ne bougent
pas » qui tombe avec elle, et le coût du plan change d'ordre de grandeur :
à vérifier **en premier**, avant d'écrire quoi que ce soit.

## Ce que ce plan ne fait pas

Listé parce que ce sont exactement les ajouts qu'une exécution fait
spontanément :

- **aucun changement d'écran, de texte ou de comportement visible.** Si un
  screenshot de `docs/screenshots/` devient faux, c'est une régression, pas
  une amélioration ;
- **pas de support multi-dialecte.** La cible est Postgres, un seul
  dialecte Drizzle. Pas de branche SQLite, pas d'abstraction de dialecte ;
- **pas de Cloudflare Workers.** `@opennextjs/cloudflare` fonctionne, mais
  un Postgres TCP y réclame Hyperdrive — une dépendance de plus, c'est-à-dire
  précisément ce qu'on retire. Hors périmètre, à rouvrir par un ADR si le
  besoin apparaît ;
- **pas de fournisseur d'e-mail tiers.** Voir décision 8 ;
- **pas de refonte du modèle de données.** Le schéma `public` est repris à
  l'identique ; seule la cible des deux clés étrangères change ;
- **pas d'écriture hors ligne, pas de synchronisation** — toujours au
  graveyard du PRD ;
- **pas de migration vers l'Adapter API de Next 16.2.** Elle est stable et
  c'est la bonne direction à terme, mais les adaptateurs Netlify et
  Cloudflare sont annoncés pour fin 2026 : Netlify passe aujourd'hui par
  son runtime OpenNext v5, qui déploie Next 16 sans configuration. Rien à
  faire côté dépôt, donc rien à faire ici.

## Décisions de plan

Aucune ne descend à l'implémenteur.

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| 1 | **Quel driver Postgres ?** | `postgres` (postgres.js) + `drizzle-orm/postgres-js`. `AppDatabase` devient `PostgresJsDatabase`, le type union `PgDatabase<PgQueryResultHKT>` de `db/index.ts` est **conservé** tel quel | C'est le protocole wire standard : n'importe quel Postgres répond, y compris un conteneur local. `pg` aurait convenu aussi ; postgres.js expose le réglage de pool en trois options lisibles (`max`, `idle_timeout`, `prepare`), ce qui compte parce que le réglage n'est pas le même en serverless et en conteneur. Le type union reste bon : `PostgresJsDatabase` et `PgliteDatabase` en descendent tous les deux, donc **les 571 lignes de requêtes et leurs 1 250 lignes de tests ne bougent pas** |
| 2 | **`batch()` n'existe pas ailleurs. Que devient-il ?** | `db.transaction()`. Cinq sites : `db/sessions.ts` ×3, `db/account.ts` ×1, `api/sessions/route.ts` ×1. Les annotations `NeonHttpDatabase` de ces fichiers deviennent `PostgresJsDatabase` | `batch()` était un aller-retour unique propre à `neon-http` ; `transaction()` est un `BEGIN`/`COMMIT` réel — **strictement plus fort** en garantie d'atomicité, ce que ces cinq sites cherchaient tous. Les tests existants vérifient le résultat (une écriture partielle est impossible), pas le mécanisme : ils restent valides sans réécriture |
| 3 | ⚠️ **Le client est-il mémorisé ?** | **Oui — et c'est l'inversion d'une règle que le dépôt documente en trente lignes.** Singleton **paresseux** : construit au premier appel de `getDb()`, jamais à l'import. `getSql()` disparaît | La règle « jamais de mémoïsation » de `db/index.ts` est spécifique à Neon-HTTP : `neon()` fige ses `fetchOptions`, donc l'`AbortSignal.timeout` démarrait à la construction — le bug critique qu'avait trouvé la review s01. Un driver TCP a le problème **exactement inverse** : ne pas réutiliser le client ouvre une connexion par requête et épuise le pool en quelques secondes. Ce qui ne change pas, et qui est la vraie raison de la paresse : `next build` doit rester vert sans secrets, ce que le module scope casserait. Le timeout se déplace de l'`AbortSignal` vers `connect_timeout` + un `statement_timeout` côté session |
| 4 | **Comment régler le pool pour trois cibles différentes ?** | Une seule configuration, valable partout : `max: 1`, `idle_timeout: 20`, `connect_timeout: 10`, **`prepare: false`** | `max: 1` est le bon réglage en serverless (chaque instance est déjà isolée) et reste correct en conteneur pour une app à un utilisateur. `prepare: false` est **obligatoire** derrière un PgBouncer en mode transaction — le endpoint `-pooler` de Neon, le port 6543 de Supabase — et sans effet mesurable ailleurs. Un réglage qui marche partout vaut mieux que trois réglages conditionnés par l'hôte, qui ne seraient jamais testés qu'un à la fois |
| 5 | **Quelle auth ?** | `better-auth`, auto-hébergée, `drizzleAdapter(db, { provider: "pg" })`, `emailAndPassword.enabled: true` | C'est déjà la bibliothèque qui tourne, chez Neon (ADR 003, relevé en base). Le repli était nommé noir sur blanc dans les conséquences d'ADR 003 : « si Neon Auth se révèle inutilisable, l'option de repli est Better Auth sur la même base — un nouvel ADR remplaçant celui-ci, pas un contournement silencieux ». C'est ce chemin-là, déclenché par une autre cause |
| 6 | **Où vivent les tables d'auth ?** | Dans `public`, générées par `npx @better-auth/cli generate` vers `src/lib/db/auth-schema.ts`, puis migrées par drizzle-kit comme le reste | Le schéma `neon_auth` disparaît, et avec lui : la règle « le schéma `neon_auth` appartient à Neon Auth » d'`AGENTS.md`, le `const authUser` non exporté de `schema.ts` et son commentaire de 15 lignes, le fixture SQL brut de `test-database.ts`. **Les deux FK pointent vers une table que le dépôt possède et migre**, donc le test de PGlite applique enfin *exactement* les migrations de production au lieu d'une reconstitution à la main. `schemaFilter: ["public"]` peut rester : il ne filtre plus rien, mais il ne coûte rien non plus |
| 7 | **Que devient `proxy.ts` ?** | Better Auth n'a pas d'équivalent à `auth.middleware()`. Remplacé par ~15 lignes : `getSessionCookie(request)` puis `NextResponse.redirect(LOGIN_URL)`. **Le `matcher` négatif existant est repris caractère pour caractère** | C'est un contrôle *optimiste* du cookie, pas une vérification de session — et c'est exactement ce que faisait déjà `auth.middleware()`, dont ADR 003 avait relevé qu'il redirige en 307 et n'authentifie pas. La vérification réelle est, et reste, dans les route handlers. Le matcher porte huit exclusions durement acquises (`/serwist`, `/silhouettes`, `/manifest.webmanifest`, `/~offline`, `/auth/reset-password`…), chacune ayant causé un vrai bug : le réécrire de mémoire, c'est en perdre une |
| 8 | **Le reset de mot de passe a besoin d'envoyer un mail.** | `nodemailer` + une variable `SMTP_URL`. **Si elle est absente, la fonctionnalité s'éteint** : le lien « mot de passe oublié » est masqué et `sendResetPassword` refuse | Un fournisseur d'e-mail (Resend, Postmark) serait une dépendance tierce de plus, dans un plan qui existe pour en retirer. SMTP est un protocole standard : n'importe quelle boîte, y compris la sienne, fait l'affaire — et l'app ne connaît qu'une URL. La dégradation silencieuse-mais-visible reprend le motif déjà en place pour `SIGNUP_ENABLED` : le déploiement zéro-config reste vrai, la fonctionnalité s'ajoute en posant une variable. Refuser **côté serveur aussi**, pas seulement masquer le lien : `/api/auth/**` est joignable au curl |
| 9 | **`sameSite: 'lax'` était une décision explicite (ADR 008). Elle survit ?** | Oui, et **elle doit être réécrite explicitement** : `advanced.defaultCookieAttributes.sameSite = "lax"` dans la configuration Better Auth | ADR 008 existe parce que le défaut `strict` cassait le retour de navigation cross-site. La cause d'origine (le magic link) a disparu avec ADR 019, mais le lien de réinitialisation de mot de passe est arrivé à sa place, avec exactement la même forme : un clic depuis un client mail. Hériter d'un défaut ici, c'est reprendre le bug par la porte de derrière |
| 10 | **Comment le « ou autre » est-il vérifiable ?** | `output: "standalone"` dans `next.config.ts`, plus un `Dockerfile` multi-étages et un `compose.yaml` (app + `postgres:18-alpine`) à la racine de `morpho/` | C'est la seule des trois voies qui atteint le zéro-dépendance littéral de la demande initiale. Vercel et Netlify ignorent le Dockerfile — il ne coûte rien à ceux qui ne s'en servent pas. `standalone` est aussi ce qui rend l'image petite, donc ce qui rend la voie réellement utilisable plutôt que théorique |
| 11 | **Comment empêcher la voie 3 de pourrir en silence ?** | Un job CI `docker build` + `docker compose up` + un `curl` sur `/api/health` | Une voie de déploiement que personne n'exécute est cassée dans les six mois, et on ne l'apprend que le jour où on en a besoin. C'est aussi la seule vérification des trois qui soit automatisable : Vercel et Netlify se vérifient à la main, une fois, en tâche 12 |
| 12 | **Que fait-on des données déjà dans Neon ?** | Un script `scripts/migrate-from-neon.ts`, à exécuter une fois, qui lit l'ancienne base et écrit la nouvelle en **conservant les UUID** | Les `user_id` sont les clés étrangères de `profiles` et `measurement_sessions`. Régénérer les identifiants orpheline tout l'historique. Le script est jetable et il est versionné quand même : c'est la seule trace de ce qui a été transféré, et le seul moyen de rejouer si le premier passage échoue à mi-course |

## Tâches

TDD : chaque tâche livre ses tests avec son code. `npm run check` doit être
vert à la fin de chacune, sur un clone sans secrets.

1. **Les trois ADR.** 023 — Postgres standard remplace le driver Neon
   (remplace ADR 002 sur le fournisseur, pas sur le fond). 024 — Better
   Auth auto-hébergée remplace Neon Auth (remplace ADR 003, amende 019 et
   011). 025 — build portable : `standalone`, Docker, aucune API spécifique
   à un hôte (amende ADR 006, qui reste vrai pour Vercel).
2. **Driver.** `npm rm @neondatabase/serverless`, `npm i postgres`.
   Réécriture de `db/index.ts` selon les décisions 1, 3 et 4. Le test
   existant `db/index.test.ts` (145 l.) vérifiait la non-mémoïsation :
   il est **inversé**, et doit désormais échouer si le client est
   reconstruit à chaque appel *ou* s'il est construit à l'import.
3. **`batch()` → `transaction()`** sur les cinq sites de la décision 2.
   Les tests d'isolation et d'atomicité existants doivent passer sans être
   modifiés — s'ils demandent une retouche, c'est qu'ils testaient le
   mécanisme et non la garantie : le noter dans la review.
4. **Better Auth, serveur.** `npm rm @neondatabase/auth`,
   `npm i better-auth`. `lib/auth.ts` réécrit : `betterAuth()` derrière le
   même accesseur paresseux qu'aujourd'hui (`betterAuth()` lève sans
   `BETTER_AUTH_SECRET`, exactement comme `createNeonAuth()` levait sans
   `cookies.secret` — l'invariant « jamais au module scope » est le même,
   pour la même raison). Génération du schéma (décision 6),
   `npm run db:generate`. Route `api/auth/[...all]/route.ts` via
   `toNextJsHandler(auth)`, **en conservant la garde `SIGNUP_ENABLED`
   côté serveur**. Les 8 `getAuth().getSession()` deviennent
   `auth.api.getSession({ headers: await headers() })`.
5. **Better Auth, client.** `lib/auth-client.ts` pointe sur
   `better-auth/react`. Vérifier `lib/auth-errors.ts` : les codes d'erreur
   sont ceux de Better Auth, donc a priori inchangés — le vérifier plutôt
   que le supposer. Les 5 composants ne devraient pas bouger ; tout écart
   constaté est à consigner.
6. **`proxy.ts`** selon la décision 7. `proxy.test.ts` existe et teste le
   matcher : il ne doit pas être réécrit.
7. **Fixture de test.** `db/test-database.ts` perd sa création manuelle de
   `neon_auth."user"` ; `seedUser()` insère dans la table d'auth réelle,
   via les migrations. `db/schema.test.ts` verrouillait l'absence de
   `neon_auth` dans le SQL généré : la garde change d'objet, elle ne
   disparaît pas.
8. **Anti-fuite.** `src/build-connection-leak.check.ts` cherche
   `NEON_AUTH_COOKIE_SECRET` dans le build. Remplacer par
   `BETTER_AUTH_SECRET`. ⚠️ Ne pas juste retirer l'ancienne aiguille : le
   fichier refuse de tourner à vide *par construction* (une aiguille non
   peuplée fait échouer le check plutôt que passer vainement), et c'est ce
   qui lui donne sa valeur.
9. **Build portable.** `output: "standalone"`, `Dockerfile`,
   `compose.yaml`. ⚠️ Vérifier que `withSerwist` compose avec `standalone`
   — c'est la composition la moins probable de tout ce plan, et un échec
   ici se voit au build, pas en production.
10. **Documentation.** `.env.example` (retirer `NEON_AUTH_*`, ajouter
    `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SMTP_URL`, documenter
    `prepare=false` derrière un pooler), `README.md` (section déploiement,
    trois voies ; le badge Neon saute), `AGENTS.md` (la règle `neon_auth`
    disparaît, la stack change), `docs/architecture.md` (tableau de stack,
    modèle de données, points d'intégration).
11. **Script de migration** (décision 12).
12. **Vérification sur les trois voies.** Vercel : déploiement de preview.
    Netlify : déploiement réel — c'est la seule des trois qui n'a jamais
    tourné, et deux points sont à contrôler nommément parce qu'ils cassent
    en silence : le `headers()` de `next.config.ts` sur `/serwist/:path*`
    (sans `Service-Worker-Allowed`, l'enregistrement du service worker
    échoue sans bruit — ADR 018, critère 6 de s10) et `proxy.ts` sur
    l'App Router. Docker : `compose up` sur une machine nue. Consigner les
    trois dans `docs/reviews/`.

## Fichiers touchés

```
supprimés   src/lib/auth.ts (réécrit), src/app/api/auth/[...path]/
créés       src/lib/db/auth-schema.ts, scripts/migrate-from-neon.ts,
            Dockerfile, compose.yaml, .dockerignore,
            src/app/api/auth/[...all]/route.ts,
            docs/decisions/023, 024, 025
modifiés    src/lib/db/{index,schema,sessions,account,test-database}.ts
            src/lib/{auth-client,auth-errors}.ts, src/proxy.ts
            src/app/api/{account,profile,session,sessions}/route.ts
            src/app/api/sessions/[id]/route.ts
            src/app/{(home),graphes,profil,onboarding,historique/[id]}/page.tsx
            src/lib/onboarding-gate.ts, src/build-connection-leak.check.ts
            next.config.ts, drizzle.config.ts, package.json, .env.example
            .github/workflows/ci.yml, README.md, AGENTS.md
            docs/architecture.md, docs/decisions/{002,003,006,019}.md (statut)
            drizzle/ (une nouvelle migration)
inchangés   tout src/components/ hors auth/, tout src/lib/*.ts hors db/ et auth*,
            les 571 l. de requêtes Drizzle et leurs 1 250 l. de tests
```

## Risques

| Risque | Signal | Parade |
|---|---|---|
| `next build` cesse de passer sans secrets | CI job `build` rouge | Décision 3 et tâche 4 : accesseurs paresseux des deux côtés. C'est le piège qui a déjà mordu deux fois dans ce dépôt |
| Connexions épuisées en serverless | Erreurs `too many connections` sous charge — donc jamais en développement | Décision 4. Un utilisateur unique ne le déclenchera probablement jamais ; le réglage est là pour ne pas dépendre de cette chance |
| La PWA casse sur Netlify | Enregistrement du service worker en échec, **silencieux** | Tâche 12, contrôle nommé du header `Service-Worker-Allowed` |
| `withSerwist` incompatible avec `standalone` | Build en échec | Tâche 9, à lever avant d'écrire le Dockerfile |
| Perte de données à la bascule | FK orphelines après migration | Décision 12 : UUID conservés, script rejouable, ancienne base gardée en lecture jusqu'à validation |
| Les codes d'erreur d'auth divergent | Messages français remplacés par de l'anglais brut à l'écran | Tâche 5 : vérifier `auth-errors.ts` contre Better Auth, ne pas le supposer identique |

## Ce qui reste vrai après

Les règles d'`AGENTS.md` qui ne bougent pas, listées parce qu'un
changement de socle est le moment où on les perd par distraction : le
navigateur ne parle jamais à Postgres ; l'identité vient de la session
vérifiée, jamais d'un `user_id` client ; tout payload est validé en Zod
côté serveur ; vide n'est jamais zéro ; `src/components/ui/` reste généré ;
aucune couleur en dur.

Une seule disparaît : « le schéma `neon_auth` appartient à Neon Auth ».
