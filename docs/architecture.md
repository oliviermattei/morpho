# Architecture — morpho

> Décisions structurantes : [ADR 001](decisions/001-nextjs-app-router-base.md) à [ADR 007](decisions/007-pwa-serwist-turbopack.md). Ce document décrit l'état ; les ADR expliquent pourquoi.

## Stack

Versions relevées dans `morpho/package.json` après scaffolding, pas estimées.

| Rôle | Choix | Version |
|---|---|---|
| Framework | Next.js, App Router, Turbopack | 16.2.12 |
| UI | React | 19.2.4 |
| Langage | TypeScript (`strict: true`) | ^5 |
| Style | Tailwind CSS v4 (`@import "tailwindcss"`, tokens CSS) | ^4 |
| Composants | shadcn/ui — base `radix`, preset `radix-nova`, icônes `lucide` | radix-ui ^1.6.7 |
| Base | Neon Postgres via `@neondatabase/serverless` | ^1.1.0 |
| ORM / migrations | Drizzle ORM + drizzle-kit | ^0.45.2 / ^0.31.10 |
| Auth | Neon Auth, email + mot de passe — **beta** | ^0.4.2-beta |
| Validation | Zod | ^4.4.3 |
| Tests logique | Vitest + Testing Library (jsdom) | ^4.1.10 |
| Tests navigateur | Playwright | ^1.62.1 |
| Graphes (s07) | Recharts — **pas encore installé** | — |
| PWA (s10) | `@serwist/turbopack` — **pas encore installé** | — |

Recharts et Serwist sont décidés mais volontairement non installés : ils entrent avec la story qui les utilise.

**Next 16 n'est pas le Next.js en mémoire du modèle.** `morpho/AGENTS.md`, écrit par `create-next-app`, impose de lire `node_modules/next/dist/docs/` avant d'écrire du code. Les écarts qui mordent ici : `middleware.ts` est renommé **`proxy.ts`**, les Request APIs (`cookies()`, `headers()`, `params`) sont **asynchrones**, Turbopack est le bundler par défaut, `next lint` est supprimé au profit d'`eslint` direct.

## Repo structure

```
multitool/
  compoundSimulator/     app Vite indépendante — ne pas y toucher
  morpho/
    docs/                pipeline killer-saas (prd, stories, decisions, plans, reviews…)
    drizzle/             migrations SQL générées — versionnées, jamais éditées à la main
    public/              assets statiques, icônes PWA (s10)
    src/
      app/               App Router : routes, layouts, route handlers
        api/             endpoints JSON (voir « Frontière serveur »)
      components/        composants applicatifs (silhouette, formulaire, graphes)
        ui/              primitives shadcn — générées, non éditées à la main
      lib/
        db/              client Neon + schema.ts Drizzle
        auth.ts          instance Neon Auth partagée
        utils.ts         cn() de shadcn
    tests/e2e/           specs Playwright
    .env.example         clés attendues, jamais de valeurs
    drizzle.config.ts    schemaFilter: ["public"] — neon_auth appartient à Neon
    playwright.config.ts projets « mobile » (iPhone 13) et « desktop »
    vitest.config.ts     include restreint à src/** pour ne pas happer les e2e
```

Une app = un projet Vercel avec sa Root Directory ([ADR 006](decisions/006-vercel-project-per-app.md)). Pas de workspaces, pas de package partagé.

## Patterns & conventions

**Frontière serveur — la règle qui prime sur toutes les autres.** Le navigateur ne parle jamais à Postgres. Toute donnée transite par un Server Component ou un route handler. `DATABASE_URL` et les secrets Neon Auth ne sont jamais préfixés `NEXT_PUBLIC_`. Il n'y a pas de RLS pour rattraper une erreur : l'isolation repose entièrement sur ce code.

**Identité.** Elle vient de `auth.getSession()`, jamais d'un `user_id` transmis par le client. Tout handler qui lit ou écrit filtre sur l'identifiant issu de la session. Un handler qui accepterait un identifiant en paramètre est un bug de sécurité, pas un raccourci.

**Validation.** Un schéma Zod par payload, appliqué côté serveur avant tout accès base — y compris quand le client a déjà validé. Les plages physiologiques sont déclarées par `kind` de mesure, au même endroit.

**Vide ≠ zéro.** Le piège central du projet. Un champ non renseigné ne produit pas de ligne `measurements` ; il ne devient jamais `0`. Corollaire côté lecture : les colonnes `numeric` de Drizzle se lisent en nombre, pas en chaîne — à fixer dans `schema.ts` et à couvrir par un test ([ADR 004](decisions/004-measurements-as-rows.md)).

**Composants.** `src/components/ui/` est généré par la CLI shadcn et ne s'édite pas à la main ; on compose au-dessus dans `src/components/`. Server Components par défaut, `"use client"` seulement là où l'interactivité l'impose — les formulaires de saisie et les graphes.

**Style.** Tailwind v4 avec tokens CSS dans `src/app/globals.css`. Aucune couleur en dur dans les composants : les valeurs viennent des tokens. Le design system (`docs/design-system.md`, phase suivante) est la seule source des tokens et des composants ; inventer hors de lui est interdit par les règles du dépôt.

**Tests.** TDD imposé par le pipeline. `src/**/*.test.ts(x)` co-localisés pour la logique et les composants ; `tests/e2e/` pour ce qui exige un vrai navigateur. `npm run check` = `typecheck` + `lint` + `test` : c'est la commande de la review.

**Nommage.** Fichiers de composants en PascalCase, modules `lib` en kebab-case, tables et colonnes en `snake_case`, types TypeScript dérivés du schéma Drizzle plutôt que redéclarés.

**Langue.** UI et messages en français (précédent de `compoundSimulator/`). Code, noms de tables, commentaires et messages de commit en anglais.

## Data model

Schéma `public`, géré par Drizzle. Le schéma `neon_auth` appartient à Neon Auth — `drizzle.config.ts` l'exclut explicitement, aucune migration ne doit le toucher.

```
neon_auth."user"                 ← géré par Neon Auth · PK id (UUID)
    │                              schéma Better Auth complet dans neon_auth :
    │                              user · session · account · verification · jwks
    │                              project_config · organization/member/invitation (inutilisés)
    │                              « user » est un mot réservé SQL : toujours cité
    ├─< profiles                   1-1 avec l'utilisateur
    │     user_id        PK/FK
    │     height_cm      numeric, nullable   (s04 — sans elle, pas d'IMC)
    │     target_weight_kg numeric, nullable (s08 — pas de cible par défaut)
    │
    └─< measurement_sessions       N par utilisateur
          id             PK
          user_id        FK
          measured_on    date
          created_at     timestamptz
              │
              └─< measurements     N par session, unicité sur (session_id, kind)
                    id         PK
                    session_id FK
                    kind       enum
                    value      numeric
```

`kind` ∈ { `weight_kg`, `chest_cm`, `biceps_cm`, `waist_cm`, `hips_cm`, `thigh_cm`, `calf_cm`, `shoulders_cm`, `body_fat_pct`, `muscle_pct` }.

**L'IMC n'existe pas en base.** Il est dérivé à la lecture de `height_cm` et du poids de la session ([s04](stories.md)). Modifier la taille recalcule tout l'historique — c'est le critère qui verrouille ce point.

Les deux requêtes qui ont dicté la forme en lignes ([ADR 004](decisions/004-measurements-as-rows.md)) :
- **dernière valeur connue par mesure** (pré-remplissage, s05) — `DISTINCT ON (kind) … ORDER BY kind, measured_on DESC` ;
- **première valeur enregistrée par mesure** (référentiel des deltas de la silhouette, s06) — même requête en `ASC`.

Le sens « favorable » d'une progression (taille qui baisse = progrès, biceps qui monte = progrès) est une propriété **déclarée par `kind`** dans le domaine, jamais un `delta < 0 ? vert : rouge`.

## Integration points

| Point | Mécanisme | Où |
|---|---|---|
| Auth | Neon Auth (email + mot de passe, ADR 019), `createNeonAuth` depuis `@neondatabase/auth/next/server`, session via `auth.getSession()` | `src/lib/auth.ts` |
| Protection des routes | `proxy.ts` à la racine de `src/` (ex-`middleware.ts`, renommé en Next 16) | `src/proxy.ts` |
| Base | `@neondatabase/serverless` + Drizzle | `src/lib/db/` |
| Migrations | `npm run db:generate` puis `npm run db:migrate` | `drizzle/` |
| Email | fourni par Neon Auth — aucun fournisseur tiers à brancher | — |
| Hébergement | Vercel, un projet par app, Root Directory `morpho/` | réglages Vercel |
| Paiements, analytics, tracking | **aucun, par décision produit** — s01 en fait un critère vérifiable par recherche dans le build | — |

## Design / UX

Trois écrans portent le produit :

1. **La silhouette** (s06) — écran d'accueil de l'app authentifiée. SVG en `viewBox`, coordonnées relatives. Chaque zone porte sa dernière valeur et son delta depuis la première mesure. Poids, IMC et pourcentages, qui ne correspondent à aucune zone, sont sur le même écran mais distincts de la silhouette. Un tap de là mène à la saisie.
2. **La saisie** (s03, s05) — écran unique, dix champs optionnels pré-remplis avec la dernière valeur connue, `inputmode="decimal"` pour le pavé numérique iOS, virgule décimale acceptée. Budget : moins de 20 secondes.
3. **Les graphes** (s07, s08) — une courbe à la fois, axe temporel réel (pas catégoriel), trous non interpolés en silence. Ligne de référence du poids cible sur la seule courbe du poids.

Cible : iOS Safari en mode standalone, portrait, 375 px de large. Le desktop est secondaire. Plusieurs critères d'acceptation sont exprimés à cette largeur, d'où le projet Playwright `mobile`.

Le design system global — tokens, composants, taille de police minimale des étiquettes de la silhouette — est capturé à l'étape suivante dans `docs/design-system.md`. Rien ne s'invente en dehors.

## Points ouverts

Points connus, à trancher en Research plutôt qu'à deviner en exécution :

1. ~~**Neon Auth est en beta**~~ — **résolu sur la base réelle.** La table est `neon_auth."user"`, PK `id` en **`uuid`**. La réponse intermédiaire tirée de `drizzle-orm/neon/neon-auth.js` (`users_sync`, PK `text`) était **fausse** : ce helper décrit l'ancien Neon Auth, pas la beta utilisée ici, qui pose le schéma Better Auth complet dans `neon_auth`. Détail dans [ADR 003](decisions/003-neon-auth.md). Leçon retenue : ce point était explicitement marqué « ne pas deviner, ça se lit en une requête » — la requête aurait dû venir avant la supposition.
2. **Base de test** pour les tests d'isolation inter-utilisateurs ([ADR 005](decisions/005-testing-stack.md)) : branche Neon éphémère, base dédiée ou Postgres local. À trancher en `/ks-research s03`.
3. **Branchement Serwist sur Turbopack** ([ADR 007](decisions/007-pwa-serwist-turbopack.md)) : support récent, à valider en `/ks-research s10`.
4. **Root Directory Vercel** : réglage d'interface invisible dans le dépôt, à confirmer dans la review de s01.
5. `npm audit` remonte 3 vulnérabilités « high » **transitives à Next.js lui-même** (postcss, sharp). Le correctif proposé rétrograderait Next à la v9 — inacceptable. Constat enregistré, pas d'action ; à revoir aux montées de version de Next.
