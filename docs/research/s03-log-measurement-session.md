# Research — Story s03-log-measurement-session

> Phase Research. Ce document ne contient **aucun plan et aucun code à écrire** : uniquement du contexte vérifié.
> Toutes les affirmations techniques ci-dessous ont été établies en ouvrant le fichier cité. Ce qui n'a pas pu être vérifié est en « Open questions » ou en « blockers », jamais deviné.
> Chemins relatifs à `multitool/morpho/` sauf mention contraire.

---

## Target story

**s03-log-measurement-session — Saisir une session de mesures**
*As a* utilisateur connecté *I want* enregistrer mes mesures du jour *so that* mon historique se construise.
Complexity : 3. Dépendance : s02-connect-magic-link.

### Critères d'acceptation (verbatim, `docs/stories.md:75-84`)

- [ ] Un écran de saisie propose une date (par défaut aujourd'hui) et un champ par mesure : poids, tour de poitrine, biceps, tour de taille, hanches, cuisse, mollet, épaules, % masse grasse, % masse musculaire.
- [ ] Soumettre une session complète la persiste en base et affiche une confirmation.
- [ ] Soumettre une session partielle — le poids seul — est accepté : la session est persistée, et les mesures non renseignées sont absentes en base, pas stockées à zéro ni à une valeur héritée.
- [ ] Soumettre un formulaire entièrement vide est refusé avec un message ; rien n'est persisté.
- [ ] Une valeur hors plage physiologique (poids négatif, tour de taille à 500 cm, pourcentage > 100) est refusée côté serveur avec une erreur de champ, même si le client l'a laissée passer.
- [ ] Les sessions enregistrées apparaissent dans une liste triée de la plus récente à la plus ancienne, avec leur date et les mesures renseignées.
- [ ] Un utilisateur A authentifié ne voit et ne modifie aucune session appartenant à un utilisateur B : le filtrage se fait côté serveur sur l'identité du token, vérifié par un test qui tente explicitement l'accès croisé.
- [ ] Se connecter depuis un appareil vierge — autre navigateur, stockage local vide — restaure l'intégralité de l'historique après le magic link. C'est le critère de succès #12 du PRD, celui qui justifie Neon contre un stockage local.
- [ ] Toutes les valeurs sont en unités métriques (kg, cm) — aucun sélecteur d'unité nulle part.

### Ce que la story impose en plus (notes agentiques, `docs/stories.md:89-96`)

- Le mécanisme de **migrations** est mis en place ici (premier schéma métier réel) — schéma versionné dans le dépôt, jamais créé à la main dans la console Neon.
- **Pas d'IMC** dans les champs saisis (s04). **Pas de pré-remplissage** (s05).
- `inputmode="decimal"` sur les champs numériques ; la **virgule décimale française** doit être acceptée.
- Piège central : champ vide ≠ zéro sur tout le trajet formulaire → API → base.

Story **avec UI** : elle passe donc par `/ks-design`, et son écran doit sortir de `docs/design-system.md`.

---

## Current state of the code

**Rien de la story s01 ni de la story s02 n'est encore dans `main`.** Le dernier commit est `8a3f73b docs: design system`. `git branch -a` ne montre aucune branche `feature/s01-*` ni `feature/s02-*` en local. L'arbre `src/` est celui de `create-next-app`, non modifié :

```
src/app/favicon.ico
src/app/globals.css      ← seul fichier réellement travaillé (tokens du design system)
src/app/layout.tsx       ← layout create-next-app, lang="en", metadata "Create Next App"
src/app/page.tsx         ← page d'accueil create-next-app (logos Vercel/Next)
src/lib/utils.ts         ← cn() de shadcn, 6 lignes
src/lib/db/              ← répertoire VIDE
tests/e2e/               ← répertoire VIDE
```

Ce qui **n'existe pas** et que s03 suppose livré :

| Attendu par `docs/architecture.md` | État réel |
|---|---|
| `src/lib/db/index.ts` (client Neon) | absent |
| `src/lib/db/schema.ts` | absent — `drizzle.config.ts:5` pointe pourtant dessus |
| `src/lib/auth.ts` (instance Neon Auth) | absent |
| `src/proxy.ts` | absent |
| `src/app/api/**` | absent |
| `src/components/` | le répertoire **n'existe pas du tout** |
| `src/components/ui/` (primitives shadcn) | n'existe pas — aucun composant installé |
| `drizzle/` (migrations générées) | le répertoire **n'existe pas** |
| `.env` / `.env.local` | absent (seul `.env.example` est présent) |

Conséquence directe : **s03 ne peut pas démarrer sur un `main` où s01 et s02 ne sont pas mergées.** Le plan doit soit partir de `feature/s02-...` mergée, soit constater le blocage.

### État de l'outillage, mesuré

`npm run check` (= `typecheck && lint && test`) a été exécuté : **`typecheck` passe, `lint` passe, `test` échoue** avec `No test files found, exiting with code 1` (aucun `src/**/*.test.ts(x)` n'existe). Vitest émet aussi un avertissement non bloquant : `vitest.config.ts` est chargé en CJS alors qu'il utilise la syntaxe ESM (`package.json` n'a pas `"type": "module"`). Le premier test écrit par s01/s02/s03 fait passer la commande.

Navigateurs Playwright : `~/Library/Caches/ms-playwright` contient `chromium-1228` et `chromium_headless_shell-1228` **mais pas `webkit`**. Or `playwright.config.ts:18` déclare le projet `mobile` avec `devices["iPhone 13"]`, dont `defaultBrowserType` vaut `"webkit"` (vérifié en important `devices` depuis `@playwright/test`). Le projet `mobile` ne peut pas s'exécuter en l'état : `npx playwright install webkit` est un préalable.

Autre constat sur le même objet : `devices["iPhone 13"].viewport` vaut **`{ width: 390, height: 664 }`**, pas 375. Les critères exprimés « à 375 px » (design system, s06, s07) ne sont donc **pas** couverts par le projet `mobile` tel quel — il faut un `page.setViewportSize({ width: 375, … })` explicite dans le test concerné.

### Configuration existante, relevée

- `drizzle.config.ts` : `dialect: "postgresql"`, `schema: "./src/lib/db/schema.ts"`, `out: "./drizzle"`, `dbCredentials.url = process.env.DATABASE_URL!`, `schemaFilter: ["public"]`.
- `vitest.config.ts` : `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@` → `./src`. Pas de `@vitejs/plugin-react` (interdit par `AGENTS.md` et l'[ADR 005](../decisions/005-testing-stack.md)) : le JSX passe par esbuild via `jsx: "react-jsx"` du `tsconfig.json`.
- `.env.example` : `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `E2E_BASE_URL`.
- `components.json` : `style: "radix-nova"`, `rsc: true`, `baseColor: "neutral"`, `iconLibrary: "lucide"`, alias `ui` → `@/components/ui`, `utils` → `@/lib/utils`.
- `next.config.ts` est **vide** : `cacheComponents` n'est pas activé (option opt-in, `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md:10-16`). Le modèle de cache est donc celui par défaut de Next 16.
- `src/app/globals.css` contient déjà tous les tokens du design system, y compris les deux ajouts morpho `--progress-favorable` / `--progress-adverse` (`:84-85`, `:113-114`) et `--label-min-size: 0.75rem` (`:86`), mappés en utilitaires dans `@theme inline` (`:34-37`).

---

## Anchor points

Là où la story se branche. Les chemins sont ceux imposés par `docs/architecture.md` (§ Repo structure) et `AGENTS.md`.

| Point d'ancrage | Fichier | État |
|---|---|---|
| Schéma Drizzle (enum + 2 tables) | `src/lib/db/schema.ts` | à créer — déjà référencé par `drizzle.config.ts:5` |
| Client base | `src/lib/db/index.ts` | à créer (s01 selon l'architecture) |
| Migrations SQL générées | `drizzle/` | répertoire à créer par `npm run db:generate` |
| Identité serveur | `src/lib/auth.ts` → `auth.getSession()` | à créer (s02) |
| Écran de saisie | `src/app/**` (route à décider en Design/Plan) | à créer |
| Formulaire (interactif) | `src/components/` — `"use client"` | `src/components/` n'existe pas encore |
| Primitives shadcn | `src/components/ui/` | vide ; à peupler par la CLI (voir plus bas) |
| Validation partagée (plages par `kind`) | à placer dans `src/lib/` (kebab-case) | à créer |
| Tests logique/composants | `src/**/*.test.ts(x)` co-localisés | aucun n'existe |
| Tests navigateur | `tests/e2e/*.spec.ts` | répertoire vide |

**Frontière serveur** (`docs/architecture.md:58`, `AGENTS.md`) : le navigateur ne parle jamais à Postgres. Deux voies légitimes en Next 16 pour l'écriture, toutes deux documentées localement :

1. **Server Action** — `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`. C'est le chemin que le design system rend le plus direct pour « erreurs par champ » (voir `useActionState` en « Verified APIs »).
2. **Route Handler** — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, dans `src/app/api/**/route.ts`.

Le choix se tranche en Plan. Un point de vigilance vaut pour les deux : la doc Next avertit explicitement que **les Server Functions sont joignables par un POST direct**, hors de l'UI, et qu'il faut donc vérifier l'authentification *dans* chaque fonction (`07-mutating-data.md`, encadré WARNING). C'est exactement l'exigence du critère d'isolation A/B.

---

## Verified APIs / functions

### 1. La table utilisateur de Neon Auth : `neon_auth.users_sync` — **trouvée**

C'est le point ouvert n°1 de `docs/architecture.md` et de l'[ADR 003](../decisions/003-neon-auth.md). Il n'est **pas** dans `@neondatabase/auth` (le SDK parle HTTP, il ne connaît pas le schéma SQL). Il est en revanche livré, en dur, par **Drizzle** :

`node_modules/drizzle-orm/neon/neon-auth.js` (fichier complet, 12 lignes) :

```js
import { jsonb, pgSchema, text, timestamp } from "../pg-core/index.js";
const neonAuthSchema = pgSchema("neon_auth");
const usersSync = neonAuthSchema.table("users_sync", {
  rawJson: jsonb("raw_json").notNull(),
  id: text().primaryKey().notNull(),
  name: text(),
  email: text(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
});
```

Le JSDoc de `node_modules/drizzle-orm/neon/neon-auth.d.ts:1-6` le dit sans ambiguïté : *« Table schema of the `users_sync` table used by Neon Auth. […] @schema neon_auth @table users_sync »*. L'export est public : `node_modules/drizzle-orm/neon/index.d.ts` = `export * from "./neon-auth.js"`, et `package.json` de `drizzle-orm` déclare l'entrée `"./neon"`. On importe donc `import { usersSync } from "drizzle-orm/neon"`.

**Ce qui est établi** : schéma `neon_auth`, table `users_sync`, clé primaire `id` de type **`text`** (pas `uuid`). C'est cohérent avec la forme du SDK côté session (voir § 2) et avec la conclusion de `docs/research/s02-connect-magic-link.md:189` (`session.data.user.id` est une `string`).
**Ce qui n'est pas établi** : que la base Neon réelle du projet expose bien cette table avec ces colonnes. C'est la déclaration de Drizzle, pas une introspection. Voir « Open questions » n°1.

Colonne notable pour les stories futures : `deleted_at`. Les utilisateurs supprimés restent en ligne dans `users_sync` avec une date de suppression.

### 2. `auth.getSession()` — forme du retour

`node_modules/@neondatabase/auth/dist/next/server/index.d.mts:643` : `declare function createNeonAuth(config: NeonAuthConfig): NeonAuth`, avec `:648` `type NeonAuth = NeonAuthServer & { handler(); middleware(); }` et `NeonAuthServer = Pick<VanillaBetterAuthClient, ServerAuthMethods>`.

Le JSDoc de ce même fichier (exemple « app/page.tsx - Server Component ») donne l'usage canonique :

```ts
const { data: session } = await auth.getSession();
if (!session?.user) return <div>Not logged in</div>;
```

La forme de `user` remonte à Better Auth. `node_modules/@better-auth/core/src/db/schema/shared.ts` :

```ts
export const coreSchema = z.object({ id: z.string(), createdAt: z.date().default(…), updatedAt: z.date().default(…) });
```

et `…/schema/user.ts` étend `coreSchema` avec `email`, `emailVerified`, `name`, `image`. **`user.id` est donc une `string`** — cohérent avec `users_sync.id text`.

Le JSDoc du même fichier signale aussi que les Server Components qui utilisent `auth` doivent être rendus dynamiquement (`export const dynamic = 'force-dynamic'`).

### 3. Drizzle — API réelle des types dont s03 a besoin (drizzle-orm 0.45.2)

| Besoin | Signature vérifiée | Fichier |
|---|---|---|
| Table | `export declare const pgTable: PgTableFn` | `pg-core/table.d.ts:94` |
| Enum Postgres | `pgEnum<U extends string, T extends Readonly<[U, ...U[]]>>(enumName: string, values: T \| Writable<T>): PgEnum<Writable<T>>` | `pg-core/columns/enum.d.ts:82` |
| Numérique **lu en nombre** | `numeric(name, { precision, scale, mode: "number" })` | `pg-core/columns/numeric.d.ts:97-98` |
| Date sans heure | `date(name, { mode: "string" \| "date" })` | `pg-core/columns/date.d.ts:45-47` |
| Horodatage | `timestamp(name, { withTimezone, mode })` | `pg-core/columns/timestamp.d.ts:65-67` |
| Identifiant | `uuid(name)` | `pg-core/columns/uuid.d.ts:25-26` |
| Contrainte d'unicité | `unique(name?): UniqueOnConstraintBuilder` puis `.on(col, col)` | `pg-core/unique-constraint.d.ts:4` |
| `DISTINCT ON` (utile en s05/s06) | `db.selectDistinctOn(on: (PgColumn \| SQLWrapper)[], fields?)` | `pg-core/db.d.ts:198-199` |

**Le mode de lecture des `numeric` est vérifié, pas supposé** — c'est le point « à surveiller » de l'[ADR 004](../decisions/004-measurements-as-rows.md) :

- `numeric()` sans `mode` produit `PgNumeric`, dont `mapFromDriverValue(value: unknown): string` (`numeric.d.ts:29`). C'est le défaut, et c'est le piège.
- `numeric({ mode: "number" })` produit `PgNumericNumber`, dont `mapFromDriverValue(value: unknown): number` (`numeric.d.ts:54`) et `mapToDriverValue: StringConstructor` (`:55`).

Le troisième paramètre de `pgTable` doit renvoyer **un tableau** ; la variante « objet » est marquée `@deprecated` dans `pg-core/table.d.ts:39-58`.

### 4. `drizzle-kit generate` fonctionne **sans base** — vérifié par exécution

Spike jetable exécuté puis supprimé (aucun fichier laissé dans le dépôt ; `git status` revérifié après coup). Un schéma d'essai reproduisant le modèle de `docs/architecture.md` — `measurement_kind` en `pgEnum`, `measurement_sessions.user_id` en `text` avec `.references(() => usersSync.id)`, `measurements` avec `unique().on(sessionId, kind)` — a été passé à `npx drizzle-kit generate` avec `schemaFilter: ["public"]` et **sans `DATABASE_URL`**. Résultat : succès, et SQL produit :

```sql
CREATE TYPE "public"."measurement_kind" AS ENUM('weight_kg', 'chest_cm', …);
CREATE TABLE "measurement_sessions" (…);
CREATE TABLE "measurements" (… CONSTRAINT "measurements_session_kind_unique" UNIQUE("session_id","kind"));
ALTER TABLE "measurement_sessions" ADD CONSTRAINT "measurement_sessions_user_id_users_sync_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE cascade ON UPDATE no action;
```

Trois faits établis par cette exécution :

1. **`db:generate` ne demande aucune connexion.** Seul `db:migrate` en a besoin. Le schéma et sa migration sont donc produisibles et relisibles dans cet environnement ; leur *application* ne l'est pas.
2. **`schemaFilter: ["public"]` n'empêche pas une clé étrangère vers `neon_auth.users_sync`**, et surtout n'émet **ni `CREATE SCHEMA "neon_auth"` ni `CREATE TABLE "users_sync"`**. La règle « aucune migration ne touche `neon_auth` » est respectée telle quelle, sans contournement.
3. Le `numeric(6, 2)` du spike est un exemple, pas une recommandation : la précision réelle est une décision du Plan.

### 5. Zod 4.4.3 — comportements vérifiés par exécution

Exécutés avec le Zod réellement installé (`node_modules/zod` → version `4.4.3`) :

| Expression | Résultat observé |
|---|---|
| `z.coerce.number().safeParse("")` | **`{ success: true, data: 0 }`** |
| `z.coerce.number().safeParse("72,4")` | `success: false` — `invalid_type`, `received: "NaN"` |
| `z.coerce.number().safeParse("72.4")` | `success: true, data: 72.4` |
| `z.iso.date().safeParse("2026-08-02")` | `success: true, data: "2026-08-02"` |
| `z.iso.date().safeParse("02/08/2026")` | `success: false` |
| `error.flatten()` | `{ formErrors: [], fieldErrors: { w: ["Too small: expected number to be >=20"] } }` |
| `z.flattenError(error)` | identique |
| `z.string({ invalid_type_error: "Mon message" })` | message **ignoré** → `"Invalid input: expected string, received number"` |
| `z.string({ error: "Mon message" })` | `"Mon message"` |

Signatures : `flatten(): core.$ZodFlattenedError<T>` (`zod/v4/classic/errors.d.cts:11`), `flattenError<T>(error)` (`zod/v4/core/errors.d.cts:153`), forme `{ formErrors: U[]; fieldErrors: { [P in keyof T]?: U[] } }` (`errors.d.cts:147-152`). `z.iso.date(params?)` : `zod/v4/classic/iso.d.cts:12`.

### 6. Next 16 — APIs pertinentes, relues dans `node_modules/next/dist/docs/`

- **Server Action + erreurs par champ** : `01-app/02-guides/forms.md:190-250`. Avec `useActionState`, la signature de la fonction serveur **change** : elle reçoit `prevState` en **premier** argument et `FormData` en second — `export async function createUser(initialState: any, formData: FormData)`. Côté client : `const [state, formAction, pending] = useActionState(createUser, initialState)` puis `<form action={formAction}>`. `pending` est fourni par le hook (`forms.md:278`).
- ⚠️ L'exemple Zod de cette page de doc est écrit en **Zod 3** (`invalid_type_error`). Sur le Zod 4 installé, ce paramètre est silencieusement ignoré (§ 5). Ne pas le recopier.
- **Rafraîchir l'UI après mutation** : `refresh()` importé de `next/cache`, **appelable uniquement depuis une Server Action** — pas depuis un Route Handler, où il lève (`01-app/03-api-reference/04-functions/refresh.md`). Exports réels de `node_modules/next/cache.d.ts` : `revalidatePath`, `revalidateTag`, `updateTag`, `refresh`, `unstable_cache`, `unstable_noStore`, `cacheTag`.
- **`proxy.ts`** (ex-`middleware.ts`) : convention confirmée dans `01-app/01-getting-started/16-proxy.md` — fichier à la racine du projet **ou dans `src/`**, un seul par projet, export nommé `proxy` ou export par défaut, plus `export const config = { matcher: … }`. La même page prévient que le proxy *« n'est pas destiné à une solution complète de gestion de session ou d'autorisation »*. L'autorisation reste dans chaque handler.
- **Route Handlers** : `GET/HEAD/POST/PUT/DELETE/PATCH/OPTIONS` exportés depuis `src/app/**/route.ts` (`03-file-conventions/route.md:24-40`).
- `cacheComponents` est opt-in et **n'est pas activé** ici.

### 7. shadcn — ce que le registre `radix-nova` livre réellement

Réseau disponible depuis cet environnement : `https://ui.shadcn.com/r/styles/radix-nova/<item>.json` répond 200. Contenus effectivement récupérés et lus :

| Item | `dependencies` npm | `registryDependencies` | Exports du fichier |
|---|---|---|---|
| `button` | — | — | `Button` (+ `buttonVariants`) |
| `input` | — | — | `Input` |
| `label` | — | — | `Label` |
| `field` | — | `label`, `separator` | `Field, FieldLabel, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet, FieldContent, FieldTitle` |
| `item` | — | `separator` | `Item, ItemMedia, ItemContent, ItemActions, ItemGroup, ItemSeparator, ItemTitle, ItemDescription, ItemHeader, ItemFooter` |
| `empty` | — | — | `Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia` |
| `skeleton` | — | — | `Skeleton` |
| `sonner` | **`sonner`, `next-themes`** | — | `Toaster` |
| `separator` | — | — | `Separator` |
| **`form`** | — | — | **aucun fichier** |

**`form` est une coquille vide dans ce style.** Le JSON complet renvoyé par le registre est littéralement :

```json
{ "$schema": "https://ui.shadcn.com/schema/registry-item.json", "name": "form", "type": "registry:ui" }
```

Pas de `files`, pas de `dependencies`. `npx shadcn add form` n'installera rien. C'est un **design system gap** : `docs/design-system.md:71` attribue `form` à s03. Le remplaçant naturel est `field`, qui couvre exactement le besoin (§ « Traps »).

`FieldError` (lu dans le contenu du registre) : `React.ComponentProps<"div"> & { errors?: Array<{ message?: string } | undefined> }`, rend `role="alert"`, affiche `children` si fourni, sinon dédoublonne `errors` par `message` et rend une `<ul>` au-delà d'un. **Il ne dépend pas de react-hook-form** — il consomme n'importe quel tableau `{ message }`, donc directement le `fieldErrors` d'un `state` de `useActionState`.

`Input` est un `<input>` nu, `{...props}` en fin de spread : `inputMode`, `name`, `defaultValue`, `data-*` passent tous. Classes de base : `h-8 w-full … text-base … md:text-sm`, plus une variante `aria-invalid:` déjà câblée sur `--destructive`.

`label` et `button` importent depuis le paquet unifié **`radix-ui`** (`import { Label as LabelPrimitive } from "radix-ui"`), qui est bien la dépendance installée (`radix-ui: ^1.6.7`). Pas de `@radix-ui/react-*` séparé à ajouter.

Le fichier `sonner.tsx` du registre contient `import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder"`. Ce n'est **pas** un import réel : la CLI (`node_modules/shadcn/dist/chunk-7SBJAAAY.js`) le transforme via ts-morph — elle remplace chaque `<IconPlaceholder lucide="…" />` par l'icône correspondante et supprime l'import `icon-placeholder`, en se basant sur `iconLibrary` de `components.json`. Vérifié dans le bundle de la CLI ; à re-constater après la première installation réelle.

---

## Traps & constraints

### 1. Vide → zéro : le piège est reproductible, aujourd'hui, avec la stack installée

C'est le piège central du PRD et il n'est pas théorique. Trois marches successives le produisent, chacune vérifiée :

1. Un `<input>` vide soumis donne `formData.get("weight_kg") === ""` (chaîne vide, pas `null` — l'entrée existe dans le `FormData` dès que l'input porte un `name`).
2. `Number("") === 0`.
3. **`z.coerce.number().safeParse("")` renvoie `{ success: true, data: 0 }`** — la validation ne rattrape rien, elle valide un zéro fabriqué.

Corollaire : `z.coerce.number()` est à proscrire tel quel sur ces champs. Il faut écarter la chaîne vide **avant** toute coercition, et l'absence doit se propager jusqu'à « pas de ligne `measurements` », conformément à l'[ADR 004](../decisions/004-measurements-as-rows.md).

Le même piège a une variante lecture : un `numeric` Drizzle sans `mode` renvoie `"72.40"`, une chaîne. Les deux occurrences sont couvertes par le § 3 des APIs vérifiées.

### 2. La virgule décimale française casse la validation

`z.coerce.number().safeParse("72,4")` **échoue** (`NaN`). Le critère « la virgule décimale française doit être acceptée » impose donc une normalisation `,` → `.` explicite, et elle doit vivre **côté serveur** aussi : le critère de validation serveur exige que le refus fonctionne « même si le client l'a laissée passer », donc symétriquement, l'acceptation de la virgule ne peut pas reposer sur le seul client.

Attention à l'interaction avec `inputMode="decimal"` : ce n'est qu'une indication de clavier, pas une contrainte de format. Sur un `<input type="number">`, une valeur contenant une virgule est rejetée par le navigateur et `.value` renvoie `""` — ce qui **ramène au piège n°1**. Le type de l'input (`text` + `inputMode` vs `number`) est une décision de Design/Plan aux conséquences directes sur ce critère.

### 3. « Date par défaut aujourd'hui » et le décalage UTC

`<input type="date">` a toujours une valeur `YYYY-MM-DD`, ce qui s'aligne exactement sur `z.iso.date()` (vérifié) et sur `date(name, { mode: "string" })` de Drizzle. Le piège est ailleurs : calculer « aujourd'hui » avec `new Date().toISOString().slice(0,10)` donne la date **UTC**. En France l'été (UTC+2), une pesée saisie avant 02 h 00 locale est enregistrée la veille. Une session de mesure du matin n'y tombe pas, mais le bug est silencieux et permanent une fois écrit.

Second effet : si la date par défaut est calculée dans un Server Component, c'est le fuseau du serveur Vercel (UTC) qui décide, pas celui du téléphone.

### 4. Le formulaire est interactif, donc client — et l'identité reste serveur

Le design system impose des erreurs **par champ, sous le champ** (`design-system.md:93`) et une confirmation par toast `sonner` (`:107`). Cela force un composant `"use client"` pour le formulaire. La règle non négociable reste : l'identité vient de `auth.getSession()` côté serveur, jamais d'un `user_id` transmis (`architecture.md:60`, `AGENTS.md`). Aucun champ caché `user_id`, aucun query param.

La doc Next insiste sur le même point pour une raison précise : une Server Action est un **endpoint POST public**. Le test d'accès croisé A/B du critère 7 doit donc viser la fonction serveur elle-même, pas seulement l'UI.

### 5. `docs/design-system.md` prescrit `form`, qui n'existe pas

`design-system.md:71` liste `form` pour s03. Le registre `radix-nova` renvoie un item **sans fichier** (§ 7 des APIs vérifiées). Deux conséquences :

- C'est un **design system gap** à signaler et à consigner dans `docs/design-system.md`, pas à combler à la volée (règle du dépôt).
- Le besoin réel — libellé + contrôle + message d'erreur — est couvert par `field` + `FieldError`, qui est justement ce que la ligne suivante du design system (`:70`) décrit. Le gap est probablement une redondance d'écriture, pas un trou fonctionnel. À trancher au Design.

Accessoirement, `form` de shadcn est historiquement un wrapper react-hook-form ; ni `react-hook-form` ni `@hookform/resolvers` ne sont installés, et le chemin Next 16 documenté localement est `useActionState`. Les introduire serait un choix d'architecture, pas une conséquence du design system.

### 6. `sonner` tire `next-themes`, alors que le thème du projet est géré à la main

`design-system.md:51` : le thème suit le réglage système via un script inline posant la classe `dark` sur `<html>` — **pas** de `ThemeProvider`. Or l'item `sonner` du registre déclare `next-themes` en dépendance npm et appelle `useTheme()`.

Vérifié dans `next-themes@0.4.6` (source `dist/index.js`) : `useTheme` est `const B = () => useContext(L) ?? { setTheme: () => {}, themes: [] }`. **Hors provider, il ne lève pas** ; `theme` est `undefined`, donc le `const { theme = "system" }` du composant shadcn retombe sur `"system"`, et Sonner utilise `prefers-color-scheme`. Le comportement est correct, mais le projet embarque une dépendance dont la seule fonction est de retourner `undefined`. Constat à consigner ; pas un blocage.

### 7. La FK vers `neon_auth` fixe l'ordre des opérations

`measurement_sessions.user_id` référence `neon_auth.users_sync.id`. Postgres refuse une FK vers une table inexistante : la migration s03 **ne s'applique que sur une base où Neon Auth a déjà créé `neon_auth.users_sync`**. Cela vaut pour la base Neon (où c'est Neon qui la crée) **et pour toute base de test** (§ 8), où il faudra la créer à la main dans le harnais. Le type doit être `text`, pas `uuid` : un `uuid` ferait échouer la contrainte.

### 8. Base de test pour l'isolation A/B — la question que l'architecture assigne à cette Research

`docs/architecture.md:141` et l'[ADR 005](../decisions/005-testing-stack.md) renvoient explicitement le choix ici. État vérifié de l'environnement :

- `docker` : **absent** (`which docker` → introuvable, `docker info` échoue).
- `psql`, `postgres`, `pg_ctl` : **absents**.
- `DATABASE_URL` : **absent** (aucun `.env`, seulement `.env.example`).
- Aucun CLI Neon, aucun CLI Vercel.

Les deux options « conteneur Postgres local » et « branche Neon éphémère » sont donc **inexploitables telles quelles dans cet environnement**.

La troisième piste, elle, est disponible : `drizzle-orm` livre un driver **PGlite** (`node_modules/drizzle-orm/pglite/`, avec `migrator.d.ts:3` → `migrate(db, config)`), et `@electric-sql/pglite` figure dans ses `peerDependencies` (`>=0.2.0`). PGlite est un Postgres compilé en WASM, en process, sans réseau ni credential — compatible avec un test Vitest. Il faudrait l'installer et créer `neon_auth.users_sync` dans le harnais (§ 7). **Le paquet n'est pas installé** : cette voie est identifiée et outillée côté Drizzle, mais non validée par exécution. C'est une décision de Plan, pas un fait acquis.

Quelle que soit l'option, l'isolation A/B est aussi testable **sans base** en appelant la fonction serveur avec un `getSession()` mocké — ce qui prouve le filtrage mais pas la contrainte SQL.

### 9. Cold start Neon (~500 ms) et budget de saisie

`docs/design-system.md:101` : « jamais d'écran d'attente bloquant », `skeleton` à la forme du contenu. La liste d'historique de s03 est le premier écran de l'app qui lit vraiment la base. Le formulaire ne doit pas attendre la base pour s'afficher — contrainte reprise et durcie en s05.

### 10. Ce que s03 ne doit pas faire

- Pas de champ IMC, pas de calcul d'IMC (s04).
- Pas de pré-remplissage, pas de `data-prefilled` (s05).
- Pas d'édition ni de suppression de session (s09).
- Pas de sélecteur d'unité, nulle part.
- Ne pas installer Recharts ni Serwist (`AGENTS.md` : ils arrivent avec s07 et s10).
- Ne pas éditer `src/components/ui/` à la main.
- Ne pas réintroduire `@vitejs/plugin-react` ([ADR 005](../decisions/005-testing-stack.md) : conflit de peer dependency avec `shadcn`).

### 11. État de dépendance vis-à-vis de s01/s02

Toute l'infrastructure sur laquelle s03 se branche (`src/lib/db/`, `src/lib/auth.ts`, `src/proxy.ts`, `src/components/`, `drizzle/`) est **absente de `main`**. Le plan de s03 doit expliciter sur quoi il branche `feature/s03-log-measurement-session`, faute de quoi il réimplémentera s01 et s02 par accident.

---

## Open questions

À trancher au Plan (ou à lever par un accès base), pas à deviner à l'exécution.

1. **`neon_auth.users_sync` : déclaration Drizzle vs réalité de la base.** La table, son schéma et sa clé primaire `id text` sont établis d'après `node_modules/drizzle-orm/neon/neon-auth.js` — une source de première main, mais indirecte. Je n'ai **pas** pu introspecter la base Neon du projet (pas de `DATABASE_URL`). La vérification tient en une requête, dès que la base est joignable :
   `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='neon_auth' AND table_name='users_sync';`
   Tant qu'elle n'est pas faite, la FK repose sur une déclaration de bibliothèque, pas sur une observation. (Note : `docs/research/s02-connect-magic-link.md:349` conclut que le nom est introuvable — c'est exact pour `@neondatabase/**`, mais la réponse est dans `drizzle-orm/neon`.)

2. **Server Action ou Route Handler pour l'écriture ?** Les deux sont documentés localement et respectent la frontière serveur. La Server Action donne `useActionState` (erreurs par champ, `pending`) et `refresh()` ; le Route Handler donne un endpoint testable au sens HTTP et cohérent avec `src/app/api/` de l'architecture. Le critère « refusé côté serveur avec une erreur de champ » pousse vers la Server Action ; le critère d'accès croisé se teste dans les deux cas. **Non tranché.**

3. **`<input type="number">` ou `type="text" inputMode="decimal"` ?** Le premier donne la validation native mais rejette la virgule et renvoie `""` sur valeur invalide (piège n°1). Le second accepte la virgule mais n'apporte aucune validation navigateur. Le critère « virgule française acceptée » et le critère « champ vide ≠ zéro » tirent tous deux vers le second, mais cela se constate sur un vrai iPhone, pas dans jsdom. **Non tranché — à valider au Design.**

4. **Les plages physiologiques par `kind`.** Ni le PRD ni les stories ne les chiffrent : la story ne donne que des exemples de refus (poids négatif, taille 500 cm, pourcentage > 100). Les bornes exactes (min/max par mesure) sont une décision produit à prendre au Plan, en un seul endroit (`architecture.md:62`).

5. **Base de test : PGlite ?** Piste identifiée et outillée (`drizzle-orm/pglite`), mais `@electric-sql/pglite` n'est pas installé et je ne l'ai pas exécuté. Reste à valider : que les migrations générées s'y appliquent, et comment y créer `neon_auth.users_sync` proprement pour satisfaire la FK. **Non validé.**

6. **Précision et échelle des colonnes `numeric`.** `numeric(6,2)` du spike est arbitraire. Un poids à 0,01 kg près et des mensurations à 0,1 cm près n'ont pas les mêmes besoins ; le format d'affichage du design system (`-4,2 cm`, une décimale) suggère une échelle de 1 ou 2. **À décider.**

7. **Le `form` du design system.** Redondance d'écriture avec `field`, ou intention réelle d'un wrapper de formulaire ? La réponse conditionne l'introduction (ou non) de `react-hook-form`. À remonter dans `docs/design-system.md` dans les deux cas.

8. **Route et navigation de l'écran de saisie.** Aucune arborescence de routes n'existe (la seule page est celle de `create-next-app`). Le chemin de l'écran de saisie et celui de la liste d'historique — même page ou deux pages — ne sont fixés nulle part. s05 imposera « au plus un tap » depuis l'accueil : le choix fait ici a une conséquence directe là-bas. **À trancher au Design.**

9. **Fuseau horaire de « aujourd'hui ».** Décision explicite à prendre : date calculée côté client (fuseau de l'appareil) ou côté serveur (UTC sur Vercel). Voir piège n°3.

---

## Blockers

Constatés, pas supposés.

1. **Aucun credential dans cet environnement** : pas de `DATABASE_URL`, pas de `.env`, pas de CLI Neon, pas de CLI Vercel. Conséquence : `npm run db:migrate` ne peut pas s'exécuter, la base ne peut pas être introspectée, et les critères qui exigent une persistance réelle (session persistée, liste d'historique, restauration depuis un appareil vierge) ne sont pas vérifiables ici. `npm run db:generate` fonctionne, lui — vérifié.
2. **`neon_auth.users_sync` n'est pas confirmée sur la base réelle.** La FK de tout le modèle en dépend (Open question n°1).
3. **s01 et s02 ne sont pas dans `main`.** `src/lib/db/`, `src/lib/auth.ts`, `src/proxy.ts`, `src/components/`, `drizzle/` sont absents. s03 n'a rien sur quoi se brancher tant que ce n'est pas mergé.
4. **WebKit n'est pas installé pour Playwright.** Le projet `mobile` (`devices["iPhone 13"]` → `defaultBrowserType: "webkit"`) ne peut pas s'exécuter. `npx playwright install webkit` est un préalable à tout critère navigateur.
5. **Le critère « appareil vierge »** suppose un déploiement joignable et un magic link réellement reçu par email. Ni l'un ni l'autre n'est atteignable depuis cet environnement ; c'est une vérification de review, sur preview, avec protocole consigné.
