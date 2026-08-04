# Research — Story s04-profile-height-bmi

> Phase Research du pipeline killer-saas. Contexte vérifié uniquement : aucun code écrit, aucun plan.
> Tous les chemins sont relatifs à `/Users/olivier/www/multitool/` sauf mention contraire.
> Date de la recherche : 2026-08-02. Commit de tête : `8a3f73b docs: design system` sur `main`.

## Target story

**s04-profile-height-bmi — Taille de référence et IMC calculé**
*As a* utilisateur *I want* renseigner ma taille une fois *so that* mon IMC se calcule tout seul à chaque pesée.
Complexity : 2. Dépendance déclarée : s03-log-measurement-session.

Critères d'acceptation, repris mot pour mot de `morpho/docs/stories.md` (lignes 106-112) :

- [ ] Un écran de profil permet de saisir et de modifier une taille en centimètres, persistée et rattachée à l'utilisateur.
- [ ] Tant que la taille n'est pas renseignée, l'IMC n'est affiché nulle part, et l'app invite à la renseigner au lieu d'afficher une valeur vide ou fausse.
- [ ] Une fois la taille renseignée, chaque session comportant un poids affiche un IMC calculé (`poids_kg / taille_m²`), arrondi à une décimale.
- [ ] L'IMC n'est jamais saisissable : aucun champ IMC dans le formulaire de s03.
- [ ] L'IMC n'est pas stocké en base : modifier la taille de référence met à jour l'IMC de toutes les sessions passées, vérifié sur au moins deux sessions antérieures.
- [ ] Une session sans poids n'affiche pas d'IMC.

Contraintes produit rattachées (notes agentiques de la story + PRD ligne 61 et 114) : l'IMC est **dérivé à la lecture, jamais persisté** ; la taille vit sur le **profil**, pas sur la session ; le stockage de profil créé ici sera **réutilisé par le poids cible (s08)** sans devenir un système de préférences générique ; **aucune classification** (« surpoids », « obésité »), morpho affiche un nombre.

## Current state of the code

**Constat majeur, à lire avant tout le reste : `morpho/` est encore le scaffold brut de `create-next-app`. Aucune story n'est implémentée, s01, s02 et s03 comprises.**

`git branch -a` ne montre que `main` et une branche distante sans rapport (`claude/deploy-leasing-km-tracker-coolify-fbsfpm`). Aucune branche `feature/s0*`. `morpho/docs/plans/`, `morpho/docs/designs/`, `morpho/docs/research/` sont vides ; `morpho/docs/reviews/` ne contient que `stories.md` (revue du découpage, doc de cadrage).

Arborescence réelle de `morpho/src` et `morpho/tests` (sortie de `find`) :

```
morpho/src/app/favicon.ico
morpho/src/app/globals.css
morpho/src/app/layout.tsx
morpho/src/app/page.tsx
morpho/src/lib/utils.ts
morpho/tests/e2e/            (dossier vide)
```

Ce qui **n'existe pas** et que la story suppose pourtant livré :

| Attendu par l'architecture | État réel |
|---|---|
| `src/lib/db/` (client Neon + `schema.ts`) | **absent** — `drizzle.config.ts` pointe pourtant sur `./src/lib/db/schema.ts` |
| `drizzle/` (migrations) | **absent** |
| `src/lib/auth.ts` (instance Neon Auth) | **absent** |
| `src/proxy.ts` (protection des routes) | **absent** |
| `src/app/api/` | **absent** |
| `src/components/` et `src/components/ui/` | **absents** — pas même créés ; aucun composant shadcn installé |
| tables `profiles`, `measurement_sessions`, `measurements` | **inexistantes** |
| tout test Vitest | **aucun** |

État des fichiers présents :

- `morpho/src/app/layout.tsx` — layout `create-next-app` intact : `lang="en"`, `metadata.title = "Create Next App"`, polices `Geist` / `Geist_Mono` exposées en `--font-geist-sans` / `--font-geist-mono`. **Aucun script de pose de la classe `dark`** sur `<html>`, alors que `docs/design-system.md` (ligne 51) l'exige et l'attribue à s01.
- `morpho/src/app/page.tsx` — page d'accueil de démo `create-next-app`, avec des couleurs en dur (`bg-zinc-50`, `hover:bg-[#383838]`) qui violent la règle « aucune couleur en dur » ; à remplacer, pas à étendre.
- `morpho/src/lib/utils.ts` — uniquement `cn()` (clsx + tailwind-merge).
- `morpho/src/app/globals.css` — **conforme au design system, vérifié ligne à ligne.** Les tokens ajoutés par morpho sont bien là : `--progress-favorable` (`oklch(0.55 0.12 152)` clair / `oklch(0.7 0.14 152)` sombre), `--progress-adverse: var(--destructive)`, `--label-min-size: 0.75rem`, mappés en `@theme inline` sur `--color-progress-favorable`, `--color-progress-adverse` et `--text-label-min`. Les jeux `:root` / `.dark` sont complets.

État des commandes (exécutées) :

- `npm run typecheck` → OK.
- `npm run lint` → `ESLint: No issues found`.
- `npm test` → **échoue, code 1** : `No test files found`. Donc `npm run check`, la commande de la review, **est rouge aujourd'hui**. Elle passera dès qu'un premier fichier `src/**/*.test.ts(x)` existera.
- `npm test` émet aussi un avertissement Vite : `vitest.config.ts` utilise de l'ESM dans un fichier chargé en CJS (`morpho/package.json` n'a pas `"type": "module"`). Avertissement seulement, pas une erreur.

Environnement : **aucun `DATABASE_URL`, aucune variable `NEON_*` dans l'environnement** ; `vercel`, `neonctl` et `neon` sont introuvables dans le `PATH`. `morpho/.env.example` déclare `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `E2E_BASE_URL`, tous vides. Le réseau sortant HTTPS, lui, fonctionne (registre shadcn interrogé avec succès, HTTP 200).

## Anchor points

Aucun point d'ancrage n'existe encore dans le code. Ce que s04 devra créer ou brancher, aux emplacements imposés par `morpho/docs/architecture.md` et `morpho/AGENTS.md` :

| Point | Emplacement imposé | État |
|---|---|---|
| Table `profiles` (`user_id` PK/FK, `height_cm` numeric nullable) | `morpho/src/lib/db/schema.ts` | à créer — probablement par s03, qui pose le mécanisme de migration |
| Migration SQL correspondante | `morpho/drizzle/` via `npm run db:generate` puis `db:migrate` | à créer |
| Client base | `morpho/src/lib/db/` | à créer (s01/s03) |
| Identité serveur | `auth.getSession()` depuis `morpho/src/lib/auth.ts` | à créer (s02) |
| Écran de profil | `morpho/src/app/…/page.tsx` — **route non décidée**, aucune convention posée | à créer |
| Écriture de la taille | Server Action ou route handler sous `morpho/src/app/api/` | à trancher (voir Open questions) |
| Calcul de l'IMC (fonction pure) | `morpho/src/lib/` — module kebab-case, ex. `bmi.ts` | à créer |
| Test de la fonction pure | co-localisé, `morpho/src/lib/*.test.ts` | à créer |
| Affichage de l'IMC | liste d'historique de s03 aujourd'hui ; l'accueil silhouette de s06 plus tard | dépend de s03 |
| Primitives shadcn | `morpho/src/components/ui/` (généré, jamais édité à la main) | dossier inexistant |
| Composants applicatifs | `morpho/src/components/` | dossier inexistant |

Ancrage de non-régression : le critère « L'IMC n'est jamais saisissable : aucun champ IMC dans le formulaire de s03 » se vérifie sur le formulaire livré par s03 — il n'existe pas encore. C'est un critère de **non-ajout**, testable par une assertion d'absence sur le formulaire de saisie.

## Verified APIs / functions

Tout ce qui suit a été ouvert dans `morpho/node_modules/`, pas récupéré de mémoire.

### Drizzle ORM 0.45.2 — `numeric`, le piège chaîne/nombre

`morpho/node_modules/drizzle-orm/pg-core/columns/numeric.d.ts` :

```ts
export type PgNumericConfig<T extends 'string' | 'number' | 'bigint' = …> =
  | { precision: number; scale?: number; mode?: T }
  | { precision?: number; scale: number; mode?: T }
  | { precision?: number; scale?: number; mode: T };

export declare function numeric<TName extends string, TMode extends 'string' | 'number' | 'bigint'>(
  name: TName, config?: PgNumericConfig<TMode>
): … PgNumericNumberBuilderInitial<TName> … | PgNumericBuilderInitial<TName>;
```

- Par défaut (`mode` absent) → `PgNumeric`, dont `mapFromDriverValue(value: unknown): string`. **La valeur revient en chaîne**, exactement le risque signalé par [ADR 004](../decisions/004-measurements-as-rows.md).
- Avec `mode: "number"` → `PgNumericNumber`, dont `mapFromDriverValue(value: unknown): number` et `mapToDriverValue: StringConstructor`. C'est la forme à retenir pour `height_cm` **et** pour `measurements.value`.
- `decimal` est un alias exporté de `numeric`.

Autres API Drizzle confirmées présentes :

- `pgTable(name, columns, extraConfig?)` — `morpho/node_modules/drizzle-orm/pg-core/table.d.ts` ligne 25 : le 3ᵉ paramètre est un callback qui doit renvoyer **un tableau** (`PgTableExtraConfigValue[]`). La forme « objet » est explicitement marquée `@deprecated` ligne 38.
- `pgEnum(enumName, values)` — `pg-core/columns/enum.d.ts` ligne 82, surcharge tableau et surcharge objet.
- `pgSchema(name)` — `pg-core/schema.d.ts` ligne 22, renvoie un `PgSchema` porteur de `.table()` / `.enum()`. C'est le seul moyen de **déclarer** une table du schéma `neon_auth` côté Drizzle si une vraie contrainte de clé étrangère est souhaitée.
- Upsert — `pg-core/query-builders/insert.d.ts` ligne 171 : `onConflictDoUpdate({ target, set, targetWhere?, setWhere? })`. `where` est déprécié au profit de `targetWhere` / `setWhere`. C'est le mécanisme naturel pour « créer ou mettre à jour la ligne `profiles` de l'utilisateur ».
- Adaptateurs Neon présents : `drizzle-orm/neon-http` et `drizzle-orm/neon-serverless`, tous deux exportant `drizzle(client | connectionString, config?)`.

### `@neondatabase/serverless` 1.1.0

`neon(connectionString, options?)` exporté depuis `morpho/node_modules/@neondatabase/serverless/index.d.ts` ligne 575.

### `@neondatabase/auth` 0.4.2-beta — ce qui est réellement dans le paquet

Le paquet contient `package.json`, `README.md`, `llms.txt` et `dist/`. **`NEXT-JS.md`, référencé en fin de `llms.txt` (« See NEXT-JS.md for complete guide »), n'est pas livré** : le champ `files` du `package.json` ne liste que `codemods/`, `dist/`, `llms.txt`, `sbom.cdx.json`. Le guide Next.js n'est donc pas consultable hors ligne.

Surface vérifiée dans `dist/next/server/index.d.mts` :

```ts
declare function createNeonAuth(config: NeonAuthConfig): NeonAuth;   // ligne 643

type NeonAuth = NeonAuthServer & {                                    // ligne 648
  handler: () => ReturnType<typeof authApiHandler>;
  middleware: (middlewareConfig?: Pick<NeonAuthMiddlewareConfig, 'loginUrl'>) => ReturnType<typeof neonAuthMiddleware>;
};

type NeonAuthServer = Pick<VanillaBetterAuthClient, ServerAuthMethods>; // ligne 546
```

`ServerAuthMethods` est dérivé des clés de premier niveau de `API_ENDPOINTS` (lignes 218-300) : `getSession`, `getAccessToken`, `listSessions`, `revokeSession`, `revokeSessions`, `revokeOtherSessions`, `refreshToken`, `signIn` (`.email`, `.social`, `.emailOtp`, **`.magicLink` → `sign-in/magic-link`**), `signUp.email`, `signOut`, `listAccounts`, `accountInfo`, `updateUser`, `deleteUser`, `changePassword`, `sendVerificationEmail`, `verifyEmail`…

Forme de la session, remontée jusqu'au schéma source. `dist/adapter-core-BiYHR4I-.d.mts` lignes 1-21 réexporte `Session` et `User` depuis `better-auth/types`, qui les fait venir de `@better-auth/core/db`. Les schémas Zod réels, lus dans `morpho/node_modules/@better-auth/core/dist/db/schema/` :

```js
// shared.mjs
const coreSchema = z.object({ id: z.string(), createdAt: z.date()…, updatedAt: z.date()… });
// user.mjs
const userSchema = coreSchema.extend({ email: …lowercased string, emailVerified: boolean, name: string, image: string|null|undefined });
// session.mjs
const sessionSchema = coreSchema.extend({ userId: z.coerce.string(), expiresAt: z.date(), token: string, ipAddress: …, userAgent: … });
```

**Conclusion vérifiée : `session.user.id` est une `string`.** La colonne `profiles.user_id` doit donc être `text` (ou `varchar`), pas un `uuid` ni un entier — sauf si s02 établit le contraire en interrogeant la vraie base.

Usage côté serveur, d'après `llms.txt` lignes 254-291 (seule source livrée avec le paquet) :

```ts
// lib/auth.ts
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET!, sessionDataTtl: 300 },
});
// Server Component / Server Action / Route Handler
const { data: session } = await auth.getSession();   // note le destructuring { data }
```

⚠️ `getSession()` renvoie `{ data: session }`, pas la session directement — les deux formes cohabitent dans `llms.txt` (ligne 52 sans destructuring, lignes 108 / 286 avec). Les exemples Next.js, eux, utilisent tous `{ data: session }`. La `secret` des cookies doit faire **au moins 32 caractères** (`@throws` documenté ligne ~576 du `.d.mts`).

**Ce que je n'ai PAS trouvé** : aucune occurrence de `neon_auth`, `users_sync` ou d'un quelconque nom de table de synchronisation dans `node_modules/@neondatabase/`, `node_modules/better-auth/` ou `node_modules/@better-auth/`. Seule occurrence approchante : la constante `NEON_AUTH_SESSION_VERIFIER_PARAM_NAME = "neon_auth_session_verifier"` dans `dist/better-auth-helpers-Bkezghej.mjs`, qui est un nom de paramètre d'URL, pas une table. **Le point ouvert n°1 de l'architecture reste donc entier**, et il n'est pas résoluble sans une vraie base (voir Blockers).

### Zod 4.4.3 — le piège `coerce` reproduit

API confirmée par exécution : `z.treeifyError`, `z.flattenError`, `z.prettifyError` existent (nouveautés Zod 4 ; `error.format()` / `error.flatten()` de Zod 3 ne sont plus la voie recommandée).

Comportement mesuré, pas supposé :

```
z.coerce.number().safeParse("")       → { success: true, data: 0 }      ⚠️
z.coerce.number().min(80).max(260).safeParse("")   → success: false, issue "too_small"
z.coerce.number().min(80).max(260).safeParse("175") → { success: true, data: 175 }
```

C'est **la** variante Zod du piège « vide ≠ zéro » du PRD : `z.coerce.number()` transforme la chaîne vide en `0` sans broncher. Ici, les bornes physiologiques sauvent la mise par accident ; il ne faut pas s'y fier. Le refus de la chaîne vide doit être explicite dans le schéma, avant la coercition.

### Next.js 16.2.12 — vérifié dans `node_modules/next/dist/docs/`

- **`proxy.ts`** (`01-app/01-getting-started/16-proxy.md`) : « Starting with Next.js 16, Middleware is now called Proxy ». Fichier à la racine de `src/`, export par défaut **ou** export nommé `proxy`, plus un `export const config = { matcher: … }`. À noter : la méthode du SDK Neon Auth s'appelle toujours `auth.middleware(...)` et ses exemples parlent de `middleware.ts` — **le nom du fichier doit être `proxy.ts`, le nom de la méthode reste `middleware`**.
- **Server Actions** (`01-app/01-getting-started/07-mutating-data.md`) : directive `"use server"` en tête de fichier ou de fonction async ; invocation via `<form action={…}>` ; la fonction reçoit un `FormData`. Avertissement explicite du doc, ligne 32 : *« Server Functions are reachable via direct POST requests, not just through your application's UI. Always verify authentication and authorization inside every Server Function. »* — cohérent avec la règle d'identité du dépôt.
- **`refresh()`** depuis `next/cache` (`03-api-reference/04-functions/refresh.md`) : nouveauté Next 16, signature `refresh(): void`, **appelable uniquement depuis une Server Action** ; lève une erreur dans un route handler ou un composant client. C'est l'outil qui rafraîchit le routeur client après l'enregistrement de la taille.
- `revalidatePath()` / `revalidateTag()` depuis `next/cache` existent toujours (`04-functions/revalidatePath.md`, `revalidateTag.md`).
- `redirect()` depuis `next/navigation` lève une exception de contrôle de flux : rien ne s'exécute après.
- `cookies()` est asynchrone : `const cookieStore = await cookies()`.
- `export const dynamic = 'force-dynamic'` existe toujours (référencé dans `02-guides/caching-without-cache-components.md` et `migrating-to-cache-components.md`), mais `04-functions/use-search-params.md` ligne 262 précise que Next 16 **préfère `connection()`** pour forcer le rendu dynamique. `llms.txt` de Neon Auth, lui, recommande `export const dynamic = 'force-dynamic'` sur tout Server Component utilisant `auth`. Les deux fonctionnent ; le choix est à acter, pas à improviser.
- `useActionState(action, initialState)` (React 19) renvoie `[state, action, pending]` — c'est le mécanisme documenté pour l'état de soumission et les erreurs de champ.

### Registre shadcn — vérifié par requête HTTP sur le style `radix-nova`

CLI disponible en local : `morpho/node_modules/.bin/shadcn` → `shadcn@4.16.1`. `morpho/components.json` est correctement configuré (`style: "radix-nova"`, `rsc: true`, `baseColor: "neutral"`, alias `@/components/ui`, `@/lib/utils`).

Réponses de `https://ui.shadcn.com/r/styles/radix-nova/<nom>.json` :

| Composant | npm deps | registry deps | Fichier |
|---|---|---|---|
| `field` | — | `label`, `separator` | `ui/field.tsx` |
| `input` | — | — | `ui/input.tsx` |
| `label` | — | — | `ui/label.tsx` |
| `button` | — | — | `ui/button.tsx` |
| `card` | — | — | `ui/card.tsx` |
| `empty` | — | — | `ui/empty.tsx` |
| `skeleton` | — | — | `ui/skeleton.tsx` |
| `item` | — | `separator` | `ui/item.tsx` |
| `sonner` | **`sonner`, `next-themes`** | — | `ui/sonner.tsx` |
| `form` | — | — | **aucun fichier** |

**`form` est un stub vide dans le style `radix-nova`.** La réponse complète est littéralement `{"$schema":…,"name":"form","type":"registry:ui"}` : ni `files`, ni `dependencies`. Le tableau de `docs/design-system.md` liste pourtant `form` comme composant à installer (s03). Le vrai bloc de construction des formulaires dans ce preset est **`field`**, qui exporte : `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLegend`, `FieldSeparator`, `FieldSet`, `FieldContent`, `FieldTitle`.

`FieldError` accepte `errors?: Array<{ message?: string } | undefined>`, déduplique par message, rend une `<ul>` au-delà d'une erreur, et porte `role="alert"` avec `text-destructive`. Il s'aligne exactement sur le pattern imposé « erreurs par champ, sous le champ ». `field.tsx` porte `"use client"`.

Bonne nouvelle pour l'installation : `sonner@2.0.7`, `next-themes@0.4.6` et `react-hook-form@7.84.0` sont **déjà** dans `node_modules`. `@hookform/resolvers` et `recharts` sont **absents**.

## Traps & constraints

1. **La story est bloquée en amont, pas en elle-même.** s04 dépend de s03, qui dépend de s02, qui dépend de s01 — et aucune des trois n'existe. Concrètement : pas de table `measurement_sessions`, pas de `measurements`, pas de poids à diviser, pas d'écran d'historique où afficher un IMC, pas d'`auth.getSession()`. La complexité 2 annoncée suppose ce socle présent.

2. **Le mode de lecture `numeric` est le piège numéro un.** `numeric("height_cm")` sans `mode` renvoie `"175.00"`. `175.00 / (1.75 ** 2)` fonctionne par coercition JS, mais `"175.00" / 100` aussi — et ce sont les opérations voisines (comparaison, formatage, delta) qui cassent silencieusement. `mode: "number"` sur `height_cm` **et** sur `measurements.value` est non négociable, et [ADR 004](../decisions/004-measurements-as-rows.md) demande explicitement un test qui le couvre.

3. **`z.coerce.number()` avale la chaîne vide et rend `0`** (mesuré, cf. supra). Sur un formulaire de profil où la taille est le seul champ, une soumission vide qui produirait `height_cm = 0` donnerait un IMC infini sur tout l'historique. Le refus du vide doit précéder la coercition.

4. **L'arrondi à une décimale doit être testé, pas supposé.** `toFixed(1)` opère sur la représentation flottante : le résultat de `72.4 / (1.75 ** 2)` n'est pas un décimal exact, et le comportement aux demi-valeurs (`x.x5`) dépend de la représentation binaire. Le critère dit « arrondi à une décimale » sans préciser la règle de départage — à fixer et à couvrir par un test avec des valeurs limites choisies.

5. **Format français.** L'UI est en français (règle du dépôt), et s06 affiche déjà des deltas en `-4,2 cm`. L'IMC doit donc s'afficher `24,3` et non `24.3`. Aucun utilitaire de formatage n'existe dans `src/lib/` — il n'y a que `cn()`. Corollaire pour les tests Playwright/Testing Library : chercher `24,3` dans le DOM, pas `24.3`.

6. **Deux calculs, une seule source.** L'IMC s'affiche à au moins deux endroits (historique de s03 aujourd'hui, silhouette de s06 demain, graphes de s07 comme série sélectionnable). Une duplication du calcul est le chemin le plus court vers deux arrondis divergents. La fonction pure dans `src/lib/` est la contre-mesure, et c'est aussi ce qui rend le critère « modifier la taille recalcule tout l'historique » vrai par construction plutôt que par discipline.

7. **`profiles` doit accueillir `target_weight_kg` (s08) sans refonte.** L'architecture le dessine déjà : `user_id` PK/FK, `height_cm` nullable, `target_weight_kg` nullable. La note de la story interdit d'aller plus loin (« sans construire un système de préférences générique »). Une table clé/valeur serait une sur-ingénierie contraire à la story.

8. **`npm run check` est rouge aujourd'hui** parce que `vitest` sort en code 1 sans fichier de test. C'est la commande que `/ks-review` invoque. Elle redeviendra verte au premier `src/**/*.test.ts`.

9. **Ne jamais réintroduire `@vitejs/plugin-react`** ([ADR 005](../decisions/005-testing-stack.md) et `morpho/AGENTS.md`) : il tire `@babel/core@8.0.0-rc` et casse `shadcn`. Vitest transpile le JSX par esbuild grâce à `jsx: "react-jsx"` du `tsconfig.json`. Vérifié : le paquet est bien absent de `node_modules`.

10. **`src/components/ui/` est généré.** Il n'existe même pas encore. Les composants s'ajoutent par la CLI (`npx shadcn@latest add …`) et ne s'éditent jamais à la main. La CLI a besoin du réseau — disponible ici, mais à ne pas supposer acquis en CI.

11. **Le layout n'est pas prêt pour le design system.** `src/app/layout.tsx` est encore celui de `create-next-app` : pas de classe `dark`, `lang="en"`, titre « Create Next App ». Le design system exige la vérification de chaque écran en clair **et** en sombre — impossible tant que la classe `dark` n'est jamais posée. C'est une tâche de s01 que s04 hérite si elle n'est pas faite d'ici là. Point mineur associé : `@theme inline` mappe `--font-sans: var(--font-sans)` alors que le layout expose `--font-geist-sans` ; `--font-sans` doit donc venir de `@import "shadcn/tailwind.css"`, à confirmer visuellement.

12. **Les tests d'isolation inter-utilisateurs n'ont pas de base.** [ADR 005](../decisions/005-testing-stack.md) laisse le sujet à `/ks-research s03`, et il n'est toujours pas tranché. s04 écrit dans `profiles` avec une identité de session : le critère « rattachée à l'utilisateur » mérite un test d'accès croisé, qui suppose ce mécanisme.

13. **Un écran de profil est un quatrième écran.** `docs/architecture.md` (section Design / UX) n'en décrit que trois : silhouette, saisie, graphes. `docs/design-system.md` n'assigne aucun composant à s04 dans son tableau. Il n'y a donc **aucune convention de navigation** pour l'atteindre — et le critère de s05 « au plus un tap depuis l'accueil vers la saisie » ne doit pas régresser à cause d'une entrée « Profil » ajoutée à la volée.

14. **`redirect()` lève.** Si l'action d'enregistrement de la taille redirige, tout code placé après ne s'exécute pas — y compris un `revalidatePath()` ou un `refresh()`. L'ordre est imposé par le doc Next 16 : revalider **puis** rediriger.

## Open questions

À trancher en `/ks-plan` (ou plus tôt), pas à deviner en exécution :

1. **s04 peut-elle seulement être planifiée avant s01/s02/s03 ?** L'ordre de livraison déclaré est s01 → s10 et chaque story suppose les précédentes livrées. Aucune n'est livrée. Question à l'humain : le pipeline reprend-il à s01, ou s04 doit-elle porter elle-même une partie du socle ? Rien dans le code ne permet de trancher.

2. **Nom réel de la table `neon_auth` et type de sa clé primaire.** Introuvable dans le paquet (recherche exhaustive sur `neon_auth` / `users_sync` dans `node_modules/@neondatabase/`, `better-auth/`, `@better-auth/`). J'ai seulement établi que `session.user.id` est une `string`. Sans base joignable, impossible d'aller plus loin. Question dérivée, spécifique à s04 : `profiles.user_id` porte-t-il une **vraie contrainte de clé étrangère** vers `neon_auth.<table>` — ce qui obligerait à déclarer cette table via `pgSchema("neon_auth")` côté Drizzle et entrerait en tension avec `schemaFilter: ["public"]` — ou reste-t-il une simple colonne `text` sans FK, l'intégrité étant portée par le code serveur ? L'architecture écrit « PK/FK » sans lever l'ambiguïté.

3. **Server Action ou route handler pour écrire la taille ?** `morpho/docs/architecture.md` ligne 58 dit « Toute donnée transite par un Server Component ou un route handler » — la Server Action n'est nommée nulle part, alors que c'est le chemin idiomatique de Next 16 pour un formulaire, et que la doc bundlée en fait le cas principal. Les deux respectent la frontière serveur. Le choix conditionne la forme des tests (appel direct du handler vs test de composant) et mérite peut-être un ADR.

4. **Route de l'écran de profil et chemin d'accès.** `/profil` (français, cohérent avec l'UI) ou `/profile` (anglais, cohérent avec la règle « code en anglais ») ? Et par où y accède-t-on sans consommer le tap unique de s05 ? Aucune convention de routage ni de navigation n'existe dans le dépôt.

5. **Précision et échelle de `height_cm`.** `numeric` sans précision, `numeric(5,1)`, `numeric(4,1)` ? La taille est saisie en centimètres et l'IMC en dépend au carré. Non spécifié par l'architecture.

6. **Plage physiologique de la taille.** L'architecture dit « Les plages physiologiques sont déclarées par `kind` de mesure, au même endroit » — mais la taille n'est **pas** un `kind` (elle vit sur le profil). Où vivent ses bornes, et quelles sont-elles ? Rien ne les fixe dans les docs.

7. **Effacer la taille est-il autorisé ?** Le critère parle de « saisir et modifier ». Un champ vidé doit-il repasser `height_cm` à `NULL` (et donc faire disparaître l'IMC partout, ce que le 2ᵉ critère décrit) ou être refusé ? Non spécifié. Le rapprochement avec le critère de s09 « vider un champ en édition supprime cette mesure » suggère `NULL`, mais c'est une inférence, pas une décision.

8. **Règle d'arrondi.** « Arrondi à une décimale » : arrondi au plus proche avec demi vers le haut, `toFixed`, `Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })` ? Les trois divergent sur les demi-valeurs. À fixer avant d'écrire le test.

9. **Où l'IMC s'affiche-t-il aujourd'hui ?** Le critère dit « chaque session comportant un poids affiche un IMC ». Tant que s06 n'existe pas, la seule surface est la liste d'historique de s03 — qui n'existe pas non plus. La surface d'affichage est à confirmer une fois s03 livrée.

10. **Formulation de l'invite « renseignez votre taille ».** Le 2ᵉ critère impose une invitation, pas une valeur vide. Le design system prescrit le composant `empty` pour les états vides, mais aucun texte n'est arrêté, et `empty` n'est pour l'instant assigné qu'à s03/s06/s07 dans le tableau. À produire en `/ks-design`.

11. **`form` absent du registre `radix-nova`.** `docs/design-system.md` le liste comme installable ; le registre renvoie un stub sans fichier. Est-ce un *design system gap* à consigner (remplacer `form` par `field` dans le tableau), ou le tableau vise-t-il un autre registre ? À remonter au design system plutôt qu'à contourner.

12. **`getSession()` : `session` ou `{ data: session }` ?** Les deux formes coexistent dans `llms.txt`. Les exemples Next.js utilisent `{ data: session }` ; c'est ce que je retiens, mais la seule preuve définitive est une exécution contre une vraie instance Neon Auth.

## Blockers

- **Aucune donnée d'accès.** Pas de `DATABASE_URL`, pas de `NEON_AUTH_BASE_URL`, pas de `NEON_AUTH_COOKIE_SECRET` dans l'environnement ; `neonctl` et `vercel` ne sont pas installés. Conséquences directes : impossible de lancer `npm run db:migrate`, impossible d'inspecter le schéma `neon_auth` pour lever la question 2, impossible d'exécuter un test d'intégration qui écrit réellement dans `profiles`, impossible de vérifier de bout en bout le critère « modifier la taille recalcule l'IMC de deux sessions antérieures ».
- **Aucune dépendance amont livrée.** s01 (socle déployé), s02 (identité) et s03 (sessions et poids) sont à l'état de scaffold. Sans elles, s04 n'a ni utilisateur, ni poids, ni écran d'historique : quatre de ses six critères sont invérifiables. La story est implémentable en isolation uniquement pour sa fonction pure de calcul et son test.
- **Base de test non tranchée** ([ADR 005](../decisions/005-testing-stack.md), point ouvert n°2 de l'architecture) : branche Neon éphémère, base dédiée ou Postgres local. Le critère « persistée et rattachée à l'utilisateur » et le test d'accès croisé en dépendent.

## Méthode d'exploration suivie

Pour rendre ce document réfutable : `morpho/docs/stories.md`, `architecture.md`, `design-system.md` et les sept ADR lus intégralement ; `AGENTS.md` racine et `morpho/AGENTS.md` lus ; arborescence `src/`, `tests/`, `drizzle/` relevée par `find` ; `package.json`, `components.json`, `drizzle.config.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `.env.example` et `globals.css` lus en entier ; `npm run typecheck`, `npm run lint`, `npm test` exécutés ; `git branch -a` et `git log` consultés ; `.d.ts` / `.d.mts` ouverts dans `node_modules/drizzle-orm/`, `@neondatabase/auth/`, `@better-auth/core/`, `@neondatabase/serverless/` ; comportement de Zod 4 **exécuté** dans Node plutôt que supposé ; docs Next.js lues dans `node_modules/next/dist/docs/` (`16-proxy.md`, `07-mutating-data.md`, `refresh.md`, `15-route-handlers.md`, guide d'upgrade v16) ; registre shadcn interrogé par HTTP sur le style `radix-nova` réellement configuré.
