# ADR 003 — Neon Auth (magic link) pour l'authentification

- Status: accepted
- Date: 2026-08-02
- Scope: framing

## Context

Une identité serveur est nécessaire pour rattacher les données à un utilisateur et satisfaire le critère de succès #16 (« un utilisateur ne peut lire ou écrire que ses propres données, vérifié côté serveur »). Neon n'ayant pas de RLS exploitable depuis le client ([ADR 002](002-neon-postgres.md)), l'isolation repose entièrement sur du code serveur.

L'angle n°3 du PRD impose l'absence de friction : pas de mot de passe, pas d'écran premium, pas de tracking.

## Decision

Neon Auth (`@neondatabase/auth`), en flux magic link. Instance créée via `createNeonAuth` depuis `@neondatabase/auth/next/server`, session lue par `auth.getSession()` dans les route handlers et les Server Components. Les utilisateurs sont synchronisés par Neon dans le schéma `neon_auth` de la même base.

**Règle non négociable** : l'identité utilisée côté serveur provient toujours de la session vérifiée, jamais d'un identifiant transmis par le client. Aucun handler ne lit un `user_id` depuis un payload ou un query param.

## Considered options

- **Auth magic link maison** (table `users`, JWT signé, envoi via Resend) — rejeté : c'est le domaine où les bugs coûtent le plus cher, pour un outil personnel. Complexité 4-5 estimée au PRD.
- **Better Auth** — rejeté : bon produit, mais il faudrait le brancher à Neon et gérer soi-même la synchronisation des utilisateurs, alors que Neon Auth la fournit dans la base cible.
- **Clerk / Auth0** — rejeté : dépendance tierce facturée et embarquant de l'analytics, en contradiction directe avec l'angle « zéro tracking ».
- **Aucune auth, un secret partagé en variable d'environnement** — rejeté : ne survit pas à un changement d'appareil et rend le critère #12 invérifiable.

## Consequences

Plus facile : zéro code d'auth à maintenir ; les utilisateurs sont dans la même base que les données métier, donc joignables par une clé étrangère sans synchronisation applicative.

Plus dur : **`@neondatabase/auth` est en version `0.4.2-beta`.** C'est le point le plus fragile de la stack — API susceptible de bouger, documentation incomplète. Les deux éléments dont ce projet avait besoin ont été établis en Research, depuis le code installé et non depuis la documentation :

1. **Schéma utilisateurs** — ⚠️ *établi sur la base réelle, après une erreur.* Une première rédaction annonçait `neon_auth.users_sync`, PK `id` de type `text`, sur la foi de `drizzle-orm/neon/neon-auth.js` qui déclare cette table. **Cette table n'existe pas dans ce projet.** Le helper Drizzle décrit l'ancien Neon Auth ; la version beta utilisée ici pose directement le schéma **Better Auth** dans `neon_auth` :

   | Table | Rôle |
   |---|---|
   | `neon_auth."user"` | **la table utilisateurs — PK `id` de type `uuid`**, plus `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`, `role`, `banned`, `banReason`, `banExpires` |
   | `neon_auth.session` | sessions actives (`token`, `expiresAt`, `userId` uuid) |
   | `neon_auth.account` | comptes liés par fournisseur |
   | `neon_auth.verification` | jetons de vérification, dont les magic links |
   | `neon_auth.jwks` | clés de signature |
   | `neon_auth.project_config` | configuration du projet (origines de confiance, fournisseurs, plugins) |
   | `neon_auth.organization` / `member` / `invitation` | multi-tenant, **non utilisé** ici |

   Deux conséquences pour s03 : la clé étrangère vise `neon_auth."user"(id)` en **`uuid`**, pas en `text` ; et `user` étant un mot réservé en SQL, il se cite systématiquement. Il n'y a **pas** de colonne `deleted_at` : la suppression n'est pas logique, contrairement à ce que la première rédaction annonçait.

2. **Forme de la session** : `auth.getSession()` retourne `{ data, error }`, avec `data.user.id` typé `string` côté SDK — mais la valeur est un **UUID**, et c'est en `uuid` qu'elle doit être stockée. C'est la clé étrangère de `profiles.user_id` et `measurement_sessions.user_id`.

3. **Configuration du projet, relevée en base** (`neon_auth.project_config`) : projet `morpho`, plugin `magicLink` **activé** avec `expiresIn: 5`, fournisseur email configuré, `allow_localhost: true`, `trusted_origins: []`. Le provider social Google est présent en partagé mais hors périmètre.

Deux comportements vérifiés dans le code de la lib, qui ont des conséquences directes sur les stories :
- `createNeonAuth()` **lève une exception si `cookies.secret` fait moins de 32 caractères**. Sans secret peuplé, l'ajout de `src/lib/auth.ts` casse jusqu'au build local.
- `auth.middleware()` **redirige (307) vers l'écran de connexion ; il ne renvoie pas 401**. Le critère 3 de s01 (« la route API répond 401 ») doit donc être porté par le route handler lui-même, pas par le proxy.

À surveiller : si Neon Auth se révèle inutilisable en Research, l'option de repli est Better Auth sur la même base Neon — un nouvel ADR remplaçant celui-ci, pas un contournement silencieux.
