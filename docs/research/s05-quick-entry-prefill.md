# Research — Story s05-quick-entry-prefill

> Tout ce qui suit a été vérifié en ouvrant les fichiers cités. Les chemins sont relatifs à `multitool/morpho/` sauf mention contraire. Ce qui n'a pas pu être vérifié est en « Open questions », pas déguisé en fait.

## Target story

**s05-quick-entry-prefill — Saisie en moins de 20 secondes**
*As a* utilisateur debout dans ma salle de bain *I want* retrouver mes dernières valeurs déjà en place *so that* je n'aie qu'à corriger ce qui a changé. — Complexité 2.

Critères d'acceptation, repris verbatim de `docs/stories.md` (lignes 132-139) :

- [ ] À l'ouverture du formulaire de saisie, chaque champ est pré-rempli avec la dernière valeur connue pour cette mesure, indépendamment de la session d'où elle provient.
- [ ] Une mesure jamais renseignée reste vide, sans valeur inventée.
- [ ] Un champ non encore touché porte un marqueur observable dans le DOM (par exemple `data-prefilled="true"`), retiré dès la première modification du champ ; ce marqueur pilote la distinction visuelle et rend le critère testable sans jugement à l'œil.
- [ ] Soumettre le formulaire sans rien modifier enregistre une nouvelle session avec ces valeurs — le pré-remplissage n'empêche pas d'enregistrer un plateau.
- [ ] Depuis l'écran d'accueil courant, atteindre le formulaire de saisie prend **au plus un tap**. (Re-vérifié en s06, qui remplace cet écran d'accueil.)
- [ ] Toucher un champ pré-rempli sélectionne son contenu, pour qu'une nouvelle valeur remplace l'ancienne sans effacement manuel.
- [ ] La saisie complète des dix mesures est chronométrée sous **20 secondes** sur téléphone, app déjà ouverte, formulaire affiché. La review consigne le protocole : appareil, point de départ, point d'arrivée, valeurs saisies.

Dépendances déclarées : s03 (le formulaire existe et persiste), s02 (l'historique lu est celui de l'utilisateur connecté).

## Current state of the code

**Aucune story n'est implémentée.** `git branch -a` ne montre que `main` (plus une branche distante sans rapport, `claude/deploy-leasing-km-tracker-coolify-fbsfpm`). Les quatre derniers commits sont `docs: design system`, `docs: architecture`, `docs: stories review — pass 2`, `docs: stories`. Il n'existe aucune branche `feature/s01…s04`.

Contenu réel de `src/` (`find src tests drizzle -type f`) :

```
src/app/favicon.ico
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/lib/utils.ts
```

C'est tout. Concrètement, **rien de ce dont s05 dépend n'existe** :

| Attendu par s05 | État réel |
|---|---|
| Formulaire de saisie (s03) | n'existe pas — pas de `src/app/**` métier |
| `src/lib/db/schema.ts`, tables `measurement_sessions` / `measurements` | n'existe pas ; `drizzle/` n'existe pas non plus |
| `src/lib/auth.ts` (`createNeonAuth`) | n'existe pas |
| `src/proxy.ts` (protection des routes) | n'existe pas |
| `src/components/` et `src/components/ui/` | **les deux répertoires n'existent pas** (aucun composant shadcn installé) |
| Écran d'accueil authentifié (s02) d'où part le « un seul tap » | n'existe pas |
| `tests/e2e/` | répertoire présent mais **vide** |

Fichiers existants, dans le détail :

- `src/app/layout.tsx` — encore celui de `create-next-app` : `metadata = { title: "Create Next App" }`, `<html lang="en">`, polices `Geist` / `Geist_Mono` exposées sous `--font-geist-sans` et `--font-geist-mono`. **Aucun script de thème** : la classe `dark` n'est jamais posée sur `<html>`, alors que `docs/design-system.md` (§ Thème) l'exige et l'attribue au shell de s01.
- `src/app/page.tsx` — la landing `create-next-app`, avec des couleurs en dur (`bg-zinc-50`, `hover:bg-[#383838]`, `dark:hover:bg-[#ccc]`) qui violent frontalement la règle « aucune couleur en dur ». À remplacer en s02/s06 ; s05 n'a pas à la faire vivre.
- `src/app/globals.css` — **conforme au design system, vérifié ligne à ligne**. `--progress-favorable` (l. 84, `.dark` l. 113), `--progress-adverse: var(--destructive)` (l. 85 / 114), `--label-min-size: 0.75rem` (l. 86), et le mapping `@theme inline` correspondant (l. 34-37). Une seule dérive de doc : le design system annonce `--input` en sombre à `oklch(1 0 0 / 10%)`, le fichier dit `oklch(1 0 0 / 15%)` (l. 116).
- `src/lib/utils.ts` — `cn()` de shadcn, seul module `lib` présent.
- `vitest.config.ts` — `environment: "jsdom"`, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@` → `./src`.
- `playwright.config.ts` — `testDir: "./tests/e2e"`, projets `mobile` (iPhone 13) et `desktop`, `webServer` lançant `npm run dev` sauf si `E2E_BASE_URL` est posé.
- `next.config.ts` — **vide** (`const nextConfig: NextConfig = {}`). Donc `cacheComponents` est désactivé.
- `.env.example` — attend `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `E2E_BASE_URL`. Aucune valeur disponible dans cet environnement.

Note de cohérence : `docs/stories.md` s01 parle encore d'« une app Vite + React ». `docs/architecture.md` et le scaffolding réel disent Next.js 16.2.12 / React 19.2.4. C'est l'architecture qui fait foi ; la story n'a pas été remise à jour.

## Anchor points

Comme rien n'existe, ce sont des points d'ancrage **à créer par s03 puis à consommer par s05**, pas des fichiers à ouvrir aujourd'hui. Le plan devra confirmer les chemins réels une fois s03 livrée.

1. **La requête de pré-remplissage** — nouveau module de lecture sous `src/lib/db/` (nommage kebab-case imposé par `AGENTS.md`), par ex. `src/lib/db/queries.ts`, exposant une fonction du type `getLatestValueByKind(userId: string)`. C'est le cœur de la story, et la requête est déjà dictée par [ADR 004](../decisions/004-measurements-as-rows.md) : `DISTINCT ON (kind) … ORDER BY kind, measured_on DESC`. Elle ne prend **jamais** un `user_id` venant du client (`AGENTS.md`, règle « Identity comes from `auth.getSession()` »).
2. **L'identité** — `src/lib/auth.ts`, instance `createNeonAuth` ; `auth.getSession()` appelé côté serveur dans le Server Component qui rend l'écran de saisie.
3. **Le composant de formulaire** — livré par s03 dans `src/components/` (PascalCase). s05 y ajoute : les valeurs initiales, le marqueur `data-prefilled`, la sélection au focus. Il est déjà `"use client"` (saisie interactive) d'après `docs/architecture.md` § Composants.
4. **La page de saisie** — Server Component sous `src/app/`, route décidée par s03. C'est là que se pose la frontière Suspense entre « formulaire peint tout de suite » et « valeurs injectées à l'arrivée » (note agentique s05 : *« Prévoir un affichage immédiat du formulaire, valeurs injectées à l'arrivée — jamais un écran d'attente bloquant »*).
5. **L'écran d'accueil** — `src/app/page.tsx` aujourd'hui, remplacé par le placeholder authentifié de s02. Le critère « au plus un tap » se matérialise par un `<Link>` unique vers la route de saisie. Rien à ancrer tant que s02 n'existe pas.
6. **Composants shadcn à installer** (aucun n'est présent) : `input`, `label`, `field`, `button`, `skeleton`. Ils sont générés par la CLI dans `src/components/ui/` et ne s'éditent pas à la main.

## Verified APIs / functions

### Drizzle ORM 0.45.2 — lecture des `numeric`

`node_modules/drizzle-orm/pg-core/columns/numeric.d.ts` :

```ts
export type PgNumericConfig<T extends 'string' | 'number' | 'bigint'> =
  { precision: number; scale?: number; mode?: T } | { precision?: number; scale: number; mode?: T } | { precision?: number; scale?: number; mode: T };

export declare function numeric<TName extends string, TMode extends 'string' | 'number' | 'bigint'>(
  name: TName, config?: PgNumericConfig<TMode>
): /* mode 'number' → */ PgNumericNumberBuilderInitial<TName> | /* défaut → */ PgNumericBuilderInitial<TName>;
```

Vérifié dans le même fichier :
- sans `mode`, la colonne est `PgNumeric` avec `mapFromDriverValue(value: unknown): string` → la valeur arrive en **chaîne** (`"72.40"`), exactement le piège consigné dans [ADR 004](../decisions/004-measurements-as-rows.md) ;
- avec `mode: "number"`, c'est `PgNumericNumber`, `mapFromDriverValue(value: unknown): number` et `mapToDriverValue: StringConstructor`. C'est la forme à utiliser : `numeric("value", { mode: "number" })`.
- `decimal` est un simple alias : `export declare const decimal: typeof numeric;`

### Drizzle ORM — `DISTINCT ON`

`node_modules/drizzle-orm/pg-core/db.d.ts`, lignes 198-199 :

```ts
selectDistinctOn(on: (PgColumn | SQLWrapper)[]): PgSelectBuilder<undefined>;
selectDistinctOn<TSelection extends SelectedFields>(on: (PgColumn | SQLWrapper)[], fields: TSelection): PgSelectBuilder<TSelection>;
```

Exemple donné dans la doc du fichier (l. 188-193) : `await db.selectDistinctOn([cars.brand], { brand: cars.brand, color: cars.color })`. `asc` et `desc` existent bien (`node_modules/drizzle-orm/sql/expressions/select.d.ts`, l. 21 et 38), `eq` / `inArray` dans `conditions.d.ts`. La requête de s05 est donc exprimable en Drizzle sans `sql` brut.

Adaptateurs présents : `drizzle-orm/neon-http` et `drizzle-orm/neon-serverless`. `@neondatabase/serverless` est en 1.1.0, `drizzle-kit` en 0.31.10.

### Neon Auth 0.4.2-beta — surface réelle

Lu dans `node_modules/@neondatabase/auth/dist/next/server/index.d.mts` et `dist/adapter-core-BiYHR4I-.d.mts`.

- `declare function createNeonAuth(config: NeonAuthConfig): NeonAuth;` exporté par `@neondatabase/auth/next/server` (confirmé par `exports` du `package.json`).
- `type NeonAuth = NeonAuthServer & { handler: () => …; middleware: (cfg?: Pick<NeonAuthMiddlewareConfig,'loginUrl'>) => … }`.
- `NeonAuthConfig = { baseUrl: string; cookies: { secret: string /* ≥ 32 car. */; sessionDataTtl?: number; domain?: string; sameSite?: 'strict'|'lax'|'none' } } & { logger?, logLevel? }`. `sameSite` vaut `'strict'` par défaut.
- **Forme de la session** — le SDK est un wrapper Better Auth. Le type relevé (`adapter-core-BiYHR4I-.d.mts`, l. ~744-778) :
  ```ts
  session: { id: string; createdAt: Date; updatedAt: Date; userId: string; expiresAt: Date; token: string; ipAddress?: string|null; userAgent?: string|null }
  user:    { id: string; createdAt: Date; updatedAt: Date; email: string; emailVerified: boolean; name: string; image?: string|null } & Record<string, any>
  ```
  L'identifiant utilisateur est donc **`session.user.id`, de type `string`**. C'est la valeur à passer à la requête de pré-remplissage.
- Usage documenté dans le docstring de `createNeonAuth` : `const { data: session } = await auth.getSession(); if (!session?.user) …` — `getSession()` renvoie une enveloppe `{ data, error }`, pas la session directement.
- **Contrainte explicite du SDK, citée telle quelle dans son propre docstring** : *« Server components using `auth` methods must be rendered dynamically »*, avec `export const dynamic = 'force-dynamic'` dans l'exemple.
- Le flux magic link existe côté endpoints : `API_ENDPOINTS.signIn.magicLink = { path: "sign-in/magic-link", method: "POST" }`.
- **Ce que je n'ai PAS trouvé** : aucune occurrence du nom de la table de synchronisation. Une recherche de `neon_auth` sur tout `dist/` + `README.md` ne remonte qu'une seule chaîne, `neon_auth_session_verifier` (`dist/better-auth-helpers-Bkezghej.mjs:19`) — c'est un nom de cookie/vérifieur, pas une table. `users_sync` : zéro occurrence. Le point 1 des « Points ouverts » de l'architecture reste ouvert ; il appartient à s02.

### shadcn / registre radix-nova — vérifié en ligne (HTTP 200 sur chaque item)

`components.json` confirme `style: "radix-nova"`, `baseColor: "neutral"`, `rsc: true`, alias `@/components/ui`.

| Item | `dependencies` | `registryDependencies` | Fichier |
|---|---|---|---|
| `input` | — | — | `ui/input.tsx` |
| `label` | — | — | `ui/label.tsx` |
| `field` | — | `["label","separator"]` | `ui/field.tsx` |
| `button` | — | — | `ui/button.tsx` |
| `skeleton` | — | — | `ui/skeleton.tsx` |
| `sonner` | `["sonner","next-themes"]` | — | `ui/sonner.tsx` |
| `form` | — | — | **aucun fichier** |

Deux constats de première importance :

1. **`Input` étale ses props sur l'`<input>` natif** — source récupérée du registre :
   ```tsx
   function Input({ className, type, ...props }: React.ComponentProps<"input">) {
     return <input type={type} data-slot="input" className={cn("h-8 w-full … text-base … md:text-sm", className)} {...props} />
   }
   ```
   Donc `inputMode="decimal"`, `defaultValue`, `data-prefilled`, `onFocus`, `onInput` passent sans wrapper. Le `text-base … md:text-sm` est un bon signe : 16 px sous 768 px, ce qui évite le zoom automatique d'iOS Safari au focus.

2. **`form` est un item vide dans ce preset** : le JSON du registre est littéralement `{ "$schema": …, "name": "form", "type": "registry:ui" }`, sans clé `files` ni `dependencies`. `npx shadcn@latest add form` n'installera rien. La ligne « `form` | Formulaire de saisie, avec erreurs par champ | s03 » de `docs/design-system.md` est donc **inexacte pour radix-nova** : la composition passe par `field`. Ce n'est pas un blocage — `FieldError` couvre le besoin sans `react-hook-form` :
   ```tsx
   function FieldError({ className, children, errors, ...props }:
     React.ComponentProps<"div"> & { errors?: Array<{ message?: string } | undefined> })
   ```
   Exports vérifiés de `ui/field.tsx` : `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLegend`, `FieldSeparator`, `FieldSet`, `FieldContent`, `FieldTitle`.

### Next.js 16.2.12 — ce qui concerne cette story

Docs lues dans `node_modules/next/dist/docs/01-app/`.

- **Formulaires + Server Actions** (`02-guides/forms.md`) : `<form action={serverAction}>`, la fonction reçoit `FormData`. Pour les erreurs par champ, le composant qui porte le `<form>` devient Client Component et utilise `useActionState(action, initialState)` → `[state, formAction, pending]` ; la signature de l'action gagne alors un premier paramètre `prevState`. `useActionState` est bien typé dans `node_modules/@types/react/index.d.ts` (l. 1975 et 1980). `useFormStatus` (`react-dom`) est l'alternative pour un bouton de soumission isolé.
- **Streaming** (`02-guides/streaming.md`) : chaque `<Suspense>` est un point de streaming indépendant ; `loading.tsx` enveloppe automatiquement la page. Le « shell statique » est tout ce qui rend avant la première résolution asynchrone. C'est le mécanisme qui permet « formulaire tout de suite, valeurs après » — à condition que le formulaire soit **hors** de la frontière Suspense et les valeurs **dedans**.
- **Cache** : `cacheComponents` n'est pas activé (`next.config.ts` vide) → modèle documenté par `02-guides/caching-without-cache-components.md` (`fetch` non caché par défaut, `unstable_cache` pour les requêtes non-`fetch`). Corollaire : `export const unstable_instant = { prefetch: 'static' }` **n'est pas utilisable** — `03-api-reference/03-file-conventions/02-route-segment-config/instant.md` dit explicitement : *« The `unstable_instant` export only works when `cacheComponents` is enabled »* et *« cannot be used in Client Components »*.
- Rappels Next 16 confirmés par `AGENTS.md` du projet : `proxy.ts` (ex-`middleware.ts`), Request APIs async, Turbopack par défaut, `next lint` supprimé (`package.json` appelle bien `eslint` directement).

### Zod 4.4.3 — écart avec les exemples de la doc Next

- `node_modules/zod/v4/classic/errors.d.cts` : `flatten()` et `format()` sur `ZodError` sont annotés `@deprecated Use the z.treeifyError(err) function instead`. `addIssue` / `addIssues` / `isEmpty` idem.
- `node_modules/zod/v4/core/errors.d.cts` : `export declare function flattenError<T>(error: $ZodError<T>): _FlattenedError<T>;` (l. 153) et `treeifyError` (l. 185).

Le guide `02-guides/forms.md` de Next montre du **Zod 3** (`z.string({ invalid_type_error: … })`, `validatedFields.error.flatten().fieldErrors`). Le copier tel quel produira au mieux un avertissement de dépréciation, au pire un typage faux. Utiliser `z.flattenError(result.error)` ou parcourir `result.error.issues`.

## Traps & constraints

1. **s05 n'a aucun code d'accroche.** Les quatre stories dont elle dépend (s01→s04) ne sont pas implémentées, aucune branche n'existe. Toute planification qui suppose « le formulaire de s03 existe, on l'enrichit » est fausse aujourd'hui. C'est la contrainte n°1.

2. **« Dernière valeur connue par mesure » ≠ « valeurs de la dernière session ».** C'est le piège désigné par la story elle-même (`docs/stories.md` l. 146). La requête est un `selectDistinctOn([measurements.kind], …)` joint sur `measurement_sessions`, filtré sur `user_id`, ordonné `kind, measured_on DESC`.

3. **Départage manquant en cas d'égalité de date.** `DISTINCT ON (kind) ORDER BY kind, measured_on DESC` est **non déterministe** si deux sessions du même utilisateur partagent le même `measured_on` (cas banal : deux pesées le même jour, ou une correction en s09). Il faut un critère secondaire explicite (`created_at DESC`, puis `id DESC`). Ni l'ADR 004 ni l'architecture ne le tranchent. À décider au plan, sinon le pré-remplissage devient aléatoire d'un rechargement à l'autre.

4. **Cold start Neon vs. `defaultValue` React.** La note agentique impose de peindre le formulaire immédiatement et d'injecter les valeurs à l'arrivée. Mais un `<input defaultValue={…}>` **non contrôlé ignore tout changement de `defaultValue` après le montage** : si le formulaire se monte vide puis les valeurs arrivent, les champs restent vides. Trois issues possibles (à trancher au plan, pas ici) : (a) rendre les champs à l'intérieur de la frontière Suspense, avec un `skeleton` à la forme du formulaire au-dessus ; (b) remonter le sous-arbre via une `key` dérivée des valeurs ; (c) champs contrôlés initialisés à l'arrivée des données. Chacune a un coût sur les critères 3 et 6 (marqueur `data-prefilled`, sélection au focus).

5. **Vide ≠ zéro, aggravé par le pré-remplissage.** Critère 4 : soumettre sans rien toucher doit persister les valeurs pré-remplies (donc créer les lignes). Critère 2 : une mesure jamais renseignée reste vide, donc **aucune ligne**. Le trajet formulaire → action → base doit distinguer trois états : pré-rempli non modifié (à écrire), pré-rempli modifié (à écrire), vide (à ne pas écrire). Un `Number("")` qui devient `0` casse tout — piège central du PRD.

6. **Le marqueur `data-prefilled`.** Il doit être écrit en kebab-case (`data-prefilled`) pour que React l'émette réellement dans le DOM. « Retiré dès la première modification » : `onChange` de React sur un `<input>` est déclenché à chaque frappe, mais un collage ou une autofill passent mieux par `onInput`. Non vérifié empiriquement ici — à couvrir par un test Vitest + Testing Library (`user-event` est installé : `@testing-library/user-event@^14.6.1`).

7. **La sélection au focus est le critère le plus fragile.** `onFocus={(e) => e.currentTarget.select()}` est notoirement instable sur iOS Safari, où le focus déclenché par un toucher repositionne le curseur après le handler. **Je ne peux pas le vérifier dans cet environnement** : pas d'appareil iOS, et le projet Playwright `mobile` n'est qu'une émulation `devices["iPhone 13"]`, pas un vrai Safari iOS. À traiter comme un risque ouvert, avec repli connu (`setSelectionRange` différé) à valider sur appareil pendant la review.

8. **Virgule décimale et aller-retour d'affichage.** s03 impose que la virgule française soit acceptée à la saisie. s05 réinjecte des valeurs venues de Postgres (`72.4` en `mode: "number"`). Quel format s'affiche dans le champ pré-rempli — `72.4` ou `72,4` ? Et le parseur doit accepter les deux au retour. Aucun document du projet ne le tranche. Conséquence technique liée : `type="number"` rejette la virgule dans la plupart des moteurs et `select()` y est mal supporté ; la combinaison sûre est `type="text"` + `inputMode="decimal"`. Le composant `Input` accepte les deux (il étale `type`), mais je n'ai testé aucun navigateur.

9. **Cible de touche.** `Input` de radix-nova fait `h-8` (32 px). Sur un formulaire de dix champs à saisir en 20 secondes au doigt, c'est sous le repère iOS de 44 px. `docs/design-system.md` ne définit **aucun token ni règle de taille de cible tactile** : c'est un *design system gap* à signaler (et à remonter dans le document), pas à combler à la volée par un `h-11` arbitraire.

10. **Le thème sombre n'est pas branché.** `src/app/layout.tsx` ne pose jamais la classe `dark`, alors que `globals.css` fonctionne par `@custom-variant dark (&:is(.dark *))` et que le design system exige de vérifier chaque écran dans les deux modes. Le script inline est attribué à s01, non livrée. Vérifier s05 en sombre est impossible en l'état.

11. **`form` shadcn est vide dans radix-nova** (voir « Verified APIs »). Ne pas planifier `npx shadcn@latest add form` en croyant obtenir un wrapper `react-hook-form` : composer `field` + `<form action={…}>`.

12. **Auth = rendu dynamique.** Lire la session dans un Server Component force `dynamic = 'force-dynamic'` d'après le SDK lui-même. Combiné au point 4, cela veut dire qu'il n'y a pas de shell prérendu gratuit : le « formulaire immédiat » vient de la structure Suspense, pas d'un cache.

13. **Harnais de test.** `vitest.config.ts` restreint `include` à `src/**/*.test.{ts,tsx}` — le test du marqueur et de la sélection va à côté du composant. jsdom implémente `HTMLInputElement.select()`, donc la logique est unit-testable ; le comportement iOS réel ne l'est pas. `tests/e2e/` est vide et les navigateurs Playwright ne sont pas installés (`npx playwright install` était une tâche de s01, non faite). **`@vitejs/plugin-react` est interdit** ([ADR 005](../decisions/005-testing-stack.md)) : il tire `@babel/core@8.0.0-rc` et casse `shadcn`.

14. **Le critère des 20 secondes n'est pas automatisable.** C'est un protocole chronométré manuel sur téléphone réel, consigné dans la review (appareil, point de départ, point d'arrivée, valeurs saisies). Il ne peut pas être coché par un test.

15. **Le critère « un seul tap » vise l'écran d'accueil provisoire de s02**, qui n'existe pas. La story elle-même prévient que s06 le reprend en non-régression : ne pas considérer le sujet clos à la livraison.

16. **Aucune vérification base possible ici.** Pas de `DATABASE_URL`, pas de CLI Neon, pas de CLI Vercel, aucune credential. `npm run db:generate` / `db:migrate` échoueront (`drizzle.config.ts` lit `process.env.DATABASE_URL!`). La requête de pré-remplissage n'a pas pu être exécutée contre un vrai Postgres, ni son plan inspecté, ni le cold start mesuré.

17. **Base de test toujours non tranchée.** [ADR 005](../decisions/005-testing-stack.md) renvoie le choix (branche Neon éphémère / base dédiée / Postgres local) à `/ks-research s03`, qui n'a pas encore eu lieu. Le test d'isolation inter-utilisateurs de la requête de pré-remplissage en dépend directement.

## Open questions

1. **Départage du `DISTINCT ON`** quand deux sessions partagent la même `measured_on` : `created_at DESC` puis `id DESC` ? À arrêter au plan et à couvrir par un test — c'est un choix de comportement produit, pas un détail SQL.
2. **Stratégie d'injection des valeurs** : champs rendus dans la frontière Suspense (skeleton au-dessus) vs. remontage par `key` vs. champs contrôlés. Dépend de la forme réelle du composant livré par s03 ; indécidable avant.
3. **Format d'affichage du pré-remplissage** : `72.4` ou `72,4` ? Et la fonction de parsing correspondante. Aucun document du projet ne le fixe ; à trancher avec l'utilisateur ou en s03.
4. **`type="text" + inputMode="decimal"` vs `type="number"`** : je n'ai pas pu tester le comportement de `select()` et de la virgule sur un navigateur réel.
5. **Sélection au focus sur iOS Safari** : la variante qui tient réellement (handler direct, `requestAnimationFrame`, `onClick` + `setSelectionRange`) est invérifiable ici. À valider sur appareil pendant la review, en même temps que le chrono des 20 s.
6. **Où vit la route de saisie** et quel est le nom exact du composant de formulaire : décidé par s03.
7. **Table de synchronisation `neon_auth`** : nom et clé primaire toujours inconnus — rien dans le package (voir « Verified APIs »). Seul acquis : l'identifiant côté session est `session.user.id`, de type `string`. Reste à s02.
8. **Gap design system — cible tactile** : faut-il un token de hauteur minimale de champ (44 px) ? À remonter dans `docs/design-system.md` plutôt qu'à improviser.
9. **Correction de `docs/design-system.md`** : la ligne `form` du tableau des composants ne correspond pas au registre radix-nova. À corriger dans le document, pas à contourner en silence.
10. **Base de test** pour vérifier que le pré-remplissage d'un utilisateur A n'expose jamais une valeur de B — héritée de l'ADR 005, toujours ouverte.
11. **`sonner` est-il nécessaire à s05 ?** Il tire deux dépendances npm (`sonner`, `next-themes`) et le design system l'attribue à s03 (confirmation d'enregistrement). Si s03 ne l'a pas installé, s05 ne devrait pas l'introduire pour ce seul besoin.
