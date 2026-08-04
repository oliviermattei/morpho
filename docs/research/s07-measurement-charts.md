# Research — Story s07-measurement-charts

> Tout ce qui suit a été vérifié en ouvrant les fichiers cités, en interrogeant le registre shadcn, ou en exécutant Recharts 3.8.0 sous jsdom dans un bac à sable isolé. Les chemins sont relatifs à `multitool/morpho/` sauf mention contraire. Ce qui n'a pas pu être vérifié est en « Open questions », pas déguisé en fait.

## Target story

**s07-measurement-charts — Courbes d'évolution**
*As a* utilisateur *I want* voir l'évolution d'une mesure dans le temps *so that* je distingue une tendance d'une fluctuation. — Complexité 3.

Critères d'acceptation, repris verbatim de `docs/stories.md` (lignes 189-195) :

- [ ] Un écran de graphes affiche une courbe temporelle pour la mesure sélectionnée, sélectionnable parmi les dix mesures suivies plus l'IMC.
- [ ] L'axe temporel respecte les intervalles réels entre sessions : deux sessions espacées d'un mois ne sont pas affichées à la même distance que deux sessions espacées d'un jour.
- [ ] Une mesure absente d'une session ne produit ni point, ni valeur à zéro, ni interpolation silencieuse traitée comme une donnée réelle.
- [ ] Une mesure ne comportant aucune donnée affiche un état vide explicite, pas un graphe aux axes nus.
- [ ] Une mesure ne comportant qu'un seul point affiche ce point sans planter le rendu.
- [ ] Chaque point est survolable ou tapotable pour révéler sa date et sa valeur exactes.
- [ ] Sur une fenêtre de 375 px de large, le graphe ne produit aucun défilement horizontal et ne déborde pas du viewport.

Dépendances déclarées (`docs/stories.md` l. 198) : s03 (l'historique existe), s04 (l'IMC est une série affichable).

Périmètre explicitement fermé par les notes agentiques (l. 200-205) : **une seule courbe à la fois** (les échelles kg/cm/% ne sont pas comparables), **pas de lissage par moyenne mobile**. s08 posera plus tard une `ReferenceLine` de poids cible sur la seule courbe du poids — ce n'est pas cette story, mais c'est le seul consommateur aval connu du composant livré ici.

## Current state of the code

**Aucune story n'est implémentée.** `git branch -a` ne montre que `main` (plus une branche distante sans rapport, `claude/deploy-leasing-km-tracker-coolify-fbsfpm`). Les derniers commits sont `docs: design system`, `docs: architecture`, `docs: stories review — pass 2`, `docs: stories`, `adding morpho`. Il n'existe aucune branche `feature/s01…s06`.

Contenu réel de `src/` (`find src tests -type f`) :

```
src/app/favicon.ico
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/lib/utils.ts
```

C'est tout. `drizzle/` n'existe pas. `tests/e2e/` est un répertoire vide. Concrètement, **rien de ce dont s07 dépend n'existe** :

| Attendu par s07 | État réel |
|---|---|
| Historique des sessions (s03) | n'existe pas |
| `src/lib/db/schema.ts`, tables `measurement_sessions` / `measurements`, enum `kind` | n'existe pas ; `drizzle/` non plus |
| `profiles.height_cm` et le calcul d'IMC (s04) | n'existe pas — la série IMC n'a donc aucune source |
| `src/lib/auth.ts` (`createNeonAuth`) | n'existe pas |
| `src/proxy.ts` (protection des routes) | n'existe pas |
| `src/components/` et `src/components/ui/` | **les deux répertoires n'existent pas** |
| Recharts | **non installé** — absent de `package.json` et de `node_modules/` |
| Une quelconque route `/charts` ou navigation vers elle | n'existe pas |

Fichiers existants, dans le détail :

- `src/app/layout.tsx` — encore celui de `create-next-app` : `metadata = { title: "Create Next App" }`, `<html lang="en">`, polices `Geist` / `Geist_Mono`. **Aucun script de thème** : la classe `dark` n'est jamais posée sur `<html>`, alors que `docs/design-system.md` (§ Thème) l'exige et l'attribue au shell de s01. Vérifier le graphe en sombre est donc impossible en l'état.
- `src/app/page.tsx` — la landing `create-next-app`, couleurs en dur.
- `src/app/globals.css` — conforme au design system. Points utiles à s07, vérifiés ligne à ligne : `--chart-1` à `--chart-5` sont présents et **achromatiques** dans les deux thèmes (`oklch(0.87 0 0)`, `0.556`, `0.439`, `0.371`, `0.269` — identiques en clair et en sombre, l. 76-80 et 117-121) ; le mapping `@theme inline` expose `--color-chart-1..5` (l. 26-30) ; `--muted-foreground` existe (utile à la ligne de cible de s08) ; `--label-min-size: 0.75rem` est mappé sur l'utilitaire `text-label-min`.
- `next.config.ts` — **vide** (`const nextConfig: NextConfig = {}`) → `cacheComponents` désactivé, donc `export const dynamic = 'force-dynamic'` reste disponible (cf. « Verified APIs »).
- `components.json` — `style: "radix-nova"`, `baseColor: "neutral"`, `rsc: true`, `iconLibrary: "lucide"`, alias `@/components/ui`.
- `vitest.config.ts` — `environment: "jsdom"`, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@` → `./src`, `setupFiles: ["./vitest.setup.ts"]` (qui n'importe que `@testing-library/jest-dom/vitest`).
- `playwright.config.ts` — `testDir: "./tests/e2e"`, projets `mobile` (`devices["iPhone 13"]`) et `desktop`.
- `.env.example` — attend `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `E2E_BASE_URL`. **Aucune valeur disponible dans cet environnement.**

**Constat de baseline à connaître avant de planifier** : `npm run check` **échoue aujourd'hui**. `typecheck` passe, `lint` passe, puis `vitest run` sort en code 1 avec `No test files found`. C'est la commande que la review exécute ; elle repassera au vert dès qu'un premier test existe, mais il ne faut pas prendre un `check` vert comme acquis de départ.

Note de cohérence, déjà relevée en s05 : `docs/stories.md` s01 parle encore d'« une app Vite + React », alors que le scaffolding réel et `docs/architecture.md` disent Next.js 16.2.12 / React 19.2.4. C'est l'architecture qui fait foi.

## Anchor points

Comme rien n'existe, ce sont des points d'ancrage **à créer par s03/s04 puis à consommer par s07**, pas des fichiers à ouvrir aujourd'hui. Le plan devra confirmer les chemins réels une fois s03 et s04 livrées.

1. **La requête de série** — nouveau module de lecture sous `src/lib/db/` (kebab-case imposé par `AGENTS.md`), par ex. une fonction `getSeriesForKind(userId: string, kind: MeasurementKind)` renvoyant les couples `(measured_on, value)` triés par date croissante. Jointure `measurements` × `measurement_sessions`, filtre sur `user_id` **issu de la session** — jamais d'identifiant reçu du client (`AGENTS.md`, règle « Identity comes from `auth.getSession()` »). L'absence de ligne est déjà l'absence de point : c'est exactement l'effet recherché par [ADR 004](../decisions/004-measurements-as-rows.md), et c'est ce qui rend le critère 3 structurellement facile.
2. **La série IMC** — cas à part : elle n'est pas un `kind` en base ([ADR 004](../decisions/004-measurements-as-rows.md) et `docs/architecture.md` § Data model : « L'IMC n'existe pas en base »). Elle se dérive à la lecture depuis `profiles.height_cm` (s04) et les points `weight_kg`. Sans taille renseignée, la série IMC ne doit pas exister du tout — ce qui recoupe le critère 4 (état vide explicite) plutôt qu'un graphe faux.
3. **Le sélecteur de mesure** — 11 entrées : les dix `kind` de `docs/architecture.md` (`weight_kg`, `chest_cm`, `biceps_cm`, `waist_cm`, `hips_cm`, `thigh_cm`, `calf_cm`, `shoulders_cm`, `body_fat_pct`, `muscle_pct`) plus l'IMC. `docs/design-system.md` (tableau des composants) attribue `select` à s07. Composant `"use client"`.
4. **Le composant de graphe** — `src/components/` (PascalCase), `"use client"` obligatoire (Recharts manipule le DOM et les événements). Il consomme `ChartContainer` / `ChartTooltip` / `ChartTooltipContent` de `src/components/ui/chart.tsx`, généré par la CLI shadcn.
5. **La page des graphes** — Server Component sous `src/app/` : il lit la session, charge les données, et passe la série au composant client. Route à décider au plan ; la navigation depuis la silhouette (s06) n'existe pas encore et n'est pas un critère de cette story.
6. **Composants shadcn à installer** (aucun n'est présent) : `chart`, `select`, `empty`. `card` et `skeleton` sont probables selon la maquette `/ks-design`. Ils sont générés par la CLI dans `src/components/ui/` et **ne s'éditent pas à la main** (`AGENTS.md`).
7. **Point d'extension pour s08** — la `ReferenceLine` du poids cible se posera sur ce même composant. Ne pas généraliser le mécanisme (les cibles par mensuration sont au graveyard du PRD), mais ne pas non plus enfermer la courbe dans un composant qui n'accepte aucun enfant supplémentaire.

## Verified APIs / functions

### Recharts — version réellement imposée par shadcn : **3.8.0**, pas la 2.x du monorepo

La note agentique de la story dit « Recharts est déjà utilisé dans `compoundSimulator/` — même monorepo, même famille d'outils ». **C'est trompeur** : `compoundSimulator/package.json` déclare `"recharts": "^2.12.7"` et a `2.15.4` installé, sous React 18. morpho est en React 19.2.4, et l'item `chart` du registre shadcn épingle une autre majeure.

Relevé par `curl https://ui.shadcn.com/r/styles/radix-nova/chart.json` (HTTP 200) :

```json
{ "name": "chart", "type": "registry:ui",
  "dependencies": ["recharts@3.8.0"],
  "files": [{ "path": "registry/radix-nova/ui/chart.tsx", "type": "registry:ui" }] }
```

La version est **épinglée à l'exact** (`recharts@3.8.0`, sans accolade de plage). `npm view recharts version` donne `3.10.1` en `latest` : la CLI installera bien 3.8.0, pas la dernière. Recharts 3 n'est pas Recharts 2 : le paquet tire 11 dépendances runtime supplémentaires — `@reduxjs/toolkit`, `react-redux`, `immer`, `reselect`, `es-toolkit`, `use-sync-external-store`, `victory-vendor`, `decimal.js-light`, `eventemitter3`, `tiny-invariant`, `react-is` — et son UMD de production pèse **544 Ko non gzippés** (`node_modules/recharts/umd/Recharts.js`). L'`import` ESM depuis `es6/` sera tree-shaké par Turbopack, mais le cœur Redux, lui, reste.

`peerDependencies` de recharts 3.8.0 : `react: ^16.8 || ^17 || ^18 || ^19`, `react-dom` idem, **et `react-is`** (qui n'est pas une dépendance déclarée de morpho aujourd'hui ; npm l'installe automatiquement comme peer).

### Recharts 3.8.0 — API vérifiée dans les `.d.ts` publiés

Lu dans `types/index.d.ts`, `types/cartesian/XAxis.d.ts`, `types/cartesian/Line.d.ts`, `types/component/Tooltip.d.ts`, `types/component/ResponsiveContainer.d.ts`, `types/util/types.d.ts` (paquet installé dans un bac à sable, hors du projet).

- **`ScaleType`** (`util/types.d.ts`) : `'auto' | 'linear' | 'pow' | 'sqrt' | 'log' | 'symlog' | 'identity' | 'time' | 'band' | 'point' | 'ordinal' | 'quantile' | 'quantize' | 'utc' | 'sequential' | 'threshold'`. **`'time'` et `'utc'` existent bien.**
- **`XAxis`** : `type?: 'category' | 'number' | 'auto'`, **`@defaultValue category`**. Le défaut est donc exactement le piège décrit par la story. `scale?: ScaleType | CustomScaleDefinition`, `@defaultValue auto`. `domain?: AxisDomain` (accepte `['dataMin','dataMax']`). `tickFormatter` disponible via `RenderableAxisProps`. Depuis 3.8 : `niceTicks?: 'none' | 'auto' | 'adaptive' | 'snap125'`.
- **`Line`** : **`connectNulls?: boolean`, `@defaultValue false`**. Autres défauts relevés : `dot` `true`, `activeDot` `true`, `isAnimationActive` `'auto'`, `animationDuration` `1500`, `type` `'linear'`, **`stroke` `'#3182bd'`** (bleu en dur — à écraser systématiquement, sinon violation de la règle « aucune couleur en dur »).
- **`Tooltip`** : `trigger?: TooltipTrigger`, `@defaultValue hover`, avec `type TooltipTrigger = 'hover' | 'click'` (`types/chart/types.d.ts`). `filterNull?: boolean`, `@defaultValue true` — les valeurs nulles sont déjà exclues du payload. `labelFormatter?: (label, payload) => ReactNode`, `formatter?: (value, name, item, index, payload) => …`, `defaultIndex?: number | TooltipIndex`.
- **`BaseChartProps`** : **`accessibilityLayer?: boolean`, `@defaultValue true`** (c'était `false` en Recharts 2). Le SVG rendu porte donc `role="application" tabindex="0"` — vérifié empiriquement, voir plus bas. `margin` par défaut `{top:5,right:5,bottom:5,left:5}`. Nouveau en v3 : `responsive?: boolean` (`@default false`), alternative à `ResponsiveContainer` « sans wrapper », basée sur les règles CSS standard.
- **`YAxis.width`** : `@defaultValue 60` (px), avec `'auto'` accepté. Sur 375 px, 60 px d'axe Y mangent 16 % de la largeur.
- **`ResponsiveContainer`** : `width`/`height` par défaut `'100%'`, `initialDimension` par défaut `{width:-1,height:-1}`. Son docstring dit explicitement qu'il **utilise `ResizeObserver`**.

### Recharts 3.8.0 sous jsdom — mesuré, pas supposé

Exécuté dans un bac à sable (`react@19.2.4`, `react-dom@19.2.4`, `vitest@4.1.10`, `jsdom@29.1.1`, `@testing-library/react@16.3.2` — les versions exactes de morpho), avec un jeu de trois points dont un `null`. Résultats bruts :

| Cas | Résultat observé |
|---|---|
| `<LineChart width={375} height={200}>` | SVG rendu. Racine : `<svg role="application" tabindex="0" class="recharts-surface" width="375" height="200">` |
| `<ResponsiveContainer width="100%" height={200}>` **sans `initialDimension`** | **Aucun SVG.** Aucune erreur levée. HTML produit : `<div class="recharts-responsive-container" …><div style="width: 0px; overflow-x: visible;"></div></div>` — 153 caractères, rien dedans |
| `<ResponsiveContainer initialDimension={{width:320,height:200}}>` (**la configuration exacte de shadcn**) | SVG rendu à 320×200, 2 points |
| `ResizeObserver` stubbé globalement | SVG rendu |
| `<LineChart responsive …>` | SVG rendu |

`jsdom@29.1.1` n'implémente **ni `ResizeObserver`, ni `window.matchMedia`, ni `SVGElement.prototype.getBBox`** (vérifié par introspection directe). Conclusion opérationnelle : le `ChartContainer` de shadcn est testable sous Vitest **parce qu'il passe `initialDimension = {width:320, height:200}`** ; un `ResponsiveContainer` nu ne l'est pas et échoue **silencieusement**.

Comportements liés aux critères, mesurés sur le même harnais :

- **Critère 2 (axe temporel réel)** — jeu de dates 1ᵉʳ janv. / 2 janv. / 1ᵉʳ mars. Avec `<XAxis type="number" scale="time" domain={['dataMin','dataMax']}>`, les `cx` des points sont `65`, `70.17`, `370`. Avec `<XAxis dataKey="t" />` (défaut catégoriel), ils sont `65`, `217.5`, `370`. **Le critère se teste mécaniquement sur les `cx` des `.recharts-line-dot`** — c'est le test le plus direct de toute la story.
- **Critère 3 (trous)** — avec le `null` et `connectNulls` au défaut (`false`), l'attribut `d` de `.recharts-line-curve` vaut `M65,20.2ZM370,24.8Z` : **deux sous-chemins disjoints**, et **2 points** seulement (le `null` ne produit pas de `dot`). Avec `connectNulls`, le même jeu donne `M65,20.2L370,24.8` — un seul segment qui enjambe le trou. Le défaut est donc le bon comportement, mais il doit être **assumé et testé**, pas subi.
- **Critère 5 (point unique)** — avec un seul point : SVG rendu, 1 `dot`, et `.recharts-line-curve` **sans attribut `d`**. Aucun crash, aucun avertissement. Un test qui assert sur `d` doit tolérer `null`.
- **Axe temporel et libellés** — les `tick` de l'axe X affichent l'epoch brut (`"1767225600000"`). **Un `tickFormatter` est obligatoire**, sinon l'écran montre des nombres à 13 chiffres.

### shadcn — item `chart`, source réelle

Contenu récupéré depuis le registre. Exports du fichier généré `src/components/ui/chart.tsx` :

```ts
export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle }
export type ChartConfig = Record<string, { label?: React.ReactNode; icon?: React.ComponentType }
  & ({ color?: string; theme?: never } | { color?: never; theme: Record<'light'|'dark', string> })>
```

Faits vérifiés dans le source :

- `ChartContainer` exige la prop `config: ChartConfig` et n'accepte comme enfant que ce que `ResponsiveContainer` accepte. Il pose `data-slot="chart"`, `data-chart={chartId}`, et la classe **`flex aspect-video justify-center text-xs`** — donc un rapport 16:9 par défaut et une taille de texte de `0.75rem` sur les ticks.
- `const INITIAL_DIMENSION = { width: 320, height: 200 }` est passé en `initialDimension` (c'est ce qui rend le composant testable sous jsdom, voir plus haut).
- `ChartStyle` injecte une balise `<style>` qui déclare `--color-<clé>` par entrée du `config`, dupliquée pour `:root` et `.dark`. C'est le canal légitime pour donner à la courbe une couleur de token : `config = { value: { label: "Poids", color: "var(--foreground)" } }` puis `<Line stroke="var(--color-value)" />`. Aucune couleur en dur nécessaire.
- `ChartTooltip` est un **alias direct** de `RechartsPrimitive.Tooltip` ; `ChartTooltipContent` est le rendu à passer en `content`.
- **`ChartTooltipContent` formate les valeurs numériques par `item.value.toLocaleString()`**, sans locale explicite (l. 258 du fichier généré), et applique `font-mono … tabular-nums`. Sans `formatter`, la sortie dépend de la locale du runtime — donc potentiellement `72.4` côté serveur et `72,4` côté navigateur, avec risque d'écart d'hydratation. Le libellé passe par `labelFormatter(value, payload)` : c'est là que l'epoch redevient une date française.
- L'item `chart` ne déclare **ni `registryDependencies`, ni `cssVars`, ni `css`** : il n'ajoute aucun token. Les `--chart-1..5` déjà présents dans `globals.css` sont ceux du preset, et `docs/design-system.md` prévient qu'ils sont « cinq gris » pensés pour des aires empilées, `--chart-1` étant « quasi invisible en trait sur fond clair ». La consigne du design system est donc `--foreground` pour le trait.

### shadcn — `select`, `empty` et le piège `IconPlaceholder`

Items vérifiés présents dans le registre `radix-nova` (HTTP 200 sur chacun) :

| Item | `dependencies` | `registryDependencies` | Exports |
|---|---|---|---|
| `chart` | `["recharts@3.8.0"]` | — | voir ci-dessus |
| `select` | — | — | `Select`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator`, `SelectTrigger`, `SelectValue` |
| `empty` | — | — | `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`, `EmptyMedia` |
| `card`, `skeleton`, `button` | — | — | présents, sans dépendance |

`select.tsx` commence par `"use client"` et importe `{ Select as SelectPrimitive } from "radix-ui"` — le paquet `radix-ui@1.6.7` est déjà installé, aucune dépendance npm supplémentaire. `empty.tsx` n'est **pas** un composant client (pas de directive) : utilisable dans un Server Component.

**Piège vérifié et démenti.** Le JSON brut de `select` contient `import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder"` — un chemin interne au site shadcn, non résolvable dans morpho. Même chose pour `native-select`, `dropdown-menu` et `combobox` ; `tabs`, `toggle-group`, `button-group`, `card`, `button`, `skeleton`, `empty` et `chart` en sont exempts. **Ce n'est pas un bug du registre** : la CLI shadcn transforme ces balises. Vérifié dans `node_modules/shadcn/dist/chunk-7SBJAAAY.js` — une passe `ts-morph` parcourt les `JsxSelfClosingElement` nommés `IconPlaceholder`, lit l'attribut portant le nom de la librairie configurée (`config.iconLibrary`, ici `"lucide"`), remplace la balise par le composant d'icône correspondant, **supprime l'import `icon-placeholder`** puis ajoute l'import réel. Conséquence pratique : **passer par `npx shadcn@latest add select`, jamais par une copie manuelle du JSON du registre** — un agent qui écrirait le fichier à la main produirait un import mort. La transformation est conditionnée à `iconLibrary` : `components.json` le pose bien à `"lucide"`.

### Neon Auth 0.4.2-beta — ce qui concerne cette story

Lu dans `node_modules/@neondatabase/auth/dist/next/server/index.d.mts`, `package.json`, et les types Better Auth sous-jacents.

- `declare function createNeonAuth(config: NeonAuthConfig): NeonAuth;`, exporté par `@neondatabase/auth/next/server` (confirmé par le champ `exports`).
- `getSession()` renvoie une enveloppe : le docstring du SDK montre `const { data: session } = await auth.getSession(); if (!session?.user) …`.
- **Forme de l'identité**, remontée jusqu'à `node_modules/@better-auth/core/dist/db/schema/user.d.mts` et `session.d.mts` (le SDK Neon réexporte `BetterAuthUser`/`BetterAuthSession`) :
  ```ts
  userSchema    = { id: string; createdAt: Date; updatedAt: Date; email: string;
                    emailVerified: boolean; name: string; image?: string | null }
  sessionSchema = { id: string; createdAt: Date; updatedAt: Date; userId: string;
                    expiresAt: Date; token: string; ipAddress?: string|null; userAgent?: string|null }
  ```
  L'identifiant est donc **`session.user.id`, de type `string`** — la valeur à passer à la requête de série.
- **Contrainte citée telle quelle dans le docstring de `createNeonAuth`** : *« Server components using `auth` methods must be rendered dynamically »*, avec `export const dynamic = 'force-dynamic'` dans l'exemple. La page des graphes sera donc rendue dynamiquement, sans shell prérendu gratuit.
- **Ce que je n'ai PAS trouvé** : le nom de la table de synchronisation dans `neon_auth`. Recherche sur tout `dist/` : `users_sync` → zéro occurrence ; `neon_auth` → une seule chaîne, `neon_auth_session_verifier`, qui est un nom de cookie/vérifieur, pas une table. Le point 1 des « Points ouverts » de `docs/architecture.md` reste entier ; il appartient à s02 et bloque s03, donc indirectement s07.

### Drizzle ORM 0.45.2 — lecture des `numeric`

`node_modules/drizzle-orm/pg-core/columns/numeric.d.ts` :

```ts
export declare function numeric<TName extends string, TMode extends 'string' | 'number' | 'bigint'>(
  name: TName, config?: PgNumericConfig<TMode>
): /* mode 'number' → */ PgNumericNumberBuilderInitial<TName> | /* défaut → */ PgNumericBuilderInitial<TName>;
```

- Sans `mode`, la colonne est `PgNumeric` avec `mapFromDriverValue(value: unknown): string` → la valeur arrive en **chaîne** (`"72.40"`).
- Avec `mode: "number"`, c'est `PgNumericNumber`, `mapFromDriverValue(value: unknown): number`.

C'est le point qui décide du sort du graphe : une chaîne passée en `dataKey` numérique à Recharts produit un axe et une courbe faux, silencieusement. `AGENTS.md` l'écrit noir sur blanc (« a value arriving as `"72.40"` silently breaks deltas and chart axes »). s07 est la story où l'erreur **se voit** ; le correctif appartient au `schema.ts` de s03.

### Next.js 16.2.12 — ce qui concerne cette story

Docs lues dans `node_modules/next/dist/docs/01-app/`.

- **Frontière client** (`01-getting-started/05-server-and-client-components.md`) : `"use client"` déclare une **frontière de graphe de modules** — « once a file is marked with `"use client"`, all of its imports and the components it directly renders are included in the client bundle ». Placer la directive sur le composant de graphe et non plus haut est donc ce qui empêche Recharts d'entrer dans le bundle de toutes les pages.
- **`searchParams`** (`03-api-reference/03-file-conventions/page.md`) : c'est **une `Promise`** (`searchParams: Promise<{ [key: string]: string | string[] | undefined }>`), à `await` dans un Server Component ou à lire via `use()` dans un Client Component. C'est le mécanisme si la mesure sélectionnée doit vivre dans l'URL. La doc précise que `searchParams` est une **Request-time API** qui bascule la page en rendu dynamique — sans conséquence ici, `auth.getSession()` l'imposant déjà.
- **`useSearchParams`** (`03-api-reference/04-functions/use-search-params.md`) : hook **Client Component uniquement**, non supporté en Server Component. La doc recommande d'envelopper le composant qui l'utilise dans `<Suspense>`.
- **Route Segment Config** (`03-api-reference/03-file-conventions/02-route-segment-config/index.md`) : en **v16.0.0**, `dynamic`, `dynamicParams`, `revalidate` et `fetchCache` sont **supprimés lorsque Cache Components est activé**. `next.config.ts` étant vide, `cacheComponents` est désactivé et `export const dynamic = 'force-dynamic'` reste valide — confirmé dans `02-guides/caching-without-cache-components.md`, qui documente `'auto' | 'force-dynamic' | 'error' | 'force-static'`.
- Rappels Next 16 confirmés : `proxy.ts` (ex-`middleware.ts`), Request APIs asynchrones, Turbopack par défaut, `next lint` supprimé (`package.json` appelle bien `eslint` directement).

### Vitest 4.1.10 — précision sur le transpileur

[ADR 005](../decisions/005-testing-stack.md) écrit « Vitest transpile le JSX via esbuild ». Message émis par Vitest 4 lors des essais : *« Both esbuild and oxc options were set. oxc options will be used and esbuild options will be ignored. »* — **Vitest 4 transpile via oxc**, pas esbuild. Sans conséquence sur l'interdiction de `@vitejs/plugin-react` (qui reste valable et vérifiée : rien de tel dans `package.json`), mais l'ADR est inexact sur ce point.

## Traps & constraints

1. **s07 n'a aucun code d'accroche.** Les six stories dont elle dépend directement ou transitivement (s01→s06) ne sont pas implémentées ; aucune branche n'existe ; `src/components/ui/` n'existe même pas comme répertoire. Toute planification qui suppose « on ajoute un écran de graphes à l'app » est fausse aujourd'hui. C'est la contrainte n°1.

2. **La note agentique sur Recharts est périmée.** « Recharts est déjà utilisé dans `compoundSimulator/` — même monorepo, même famille d'outils » : `compoundSimulator/` est en Recharts 2.15.4 sous React 18, sans TypeScript, sans test. shadcn impose **Recharts 3.8.0**, dont l'API et le modèle interne (Redux) diffèrent. Le précédent du monorepo ne prouve rien sur la 3.x, et [ADR 006](../decisions/006-vercel-project-per-app.md) interdit de toute façon tout partage de code entre apps.

3. **Le défaut de `XAxis` est `type="category"`.** C'est très exactement le piège que le critère 2 est écrit pour attraper, et c'est le comportement qu'on obtient en ne faisant rien. La forme correcte est `<XAxis dataKey={…} type="number" scale="time" domain={['dataMin','dataMax']} tickFormatter={…} />`. Le test doit assert sur les positions (`cx` des `.recharts-line-dot`), pas sur la présence de l'axe — un axe catégoriel existe et a l'air correct.

4. **Le test du graphe peut passer en n'ayant rien rendu.** `ResponsiveContainer` sans `ResizeObserver` renvoie un div vide **sans lever d'erreur**. `expect(container.querySelector('.recharts-line-curve')).toBeNull()` passerait alors pour de mauvaises raisons. Deux garde-fous à poser au plan : (a) toujours passer par `ChartContainer` (qui fournit `initialDimension`), (b) faire assert **positivement** au moins un test sur la présence du SVG et le nombre de points avant d'affirmer quoi que ce soit sur les trous. Ne pas ajouter de polyfill `ResizeObserver` dans `vitest.setup.ts` sans nécessité démontrée — la configuration shadcn suffit, vérifié.

5. **`connectNulls` : le bon défaut, mais à verrouiller.** `false` est le défaut et produit la rupture de ligne attendue. Il suffit qu'un agent l'active « pour faire joli » pour violer le critère 3 sans que rien ne casse. Le test doit assert sur la forme du `d` (présence de deux sous-chemins, ou nombre de `dot` égal au nombre de valeurs non nulles), pas sur la seule absence de plantage.

6. **Le vrai risque du critère 3 est en amont du graphe.** Recharts se comporte bien face à un `null`. Le danger est qu'une couche de préparation « comble » les trous : un `map` sur toutes les dates de sessions qui écrit `0` pour les mesures absentes, un `?? 0`, un `Number(undefined)`. La forme en lignes d'[ADR 004](../decisions/004-measurements-as-rows.md) rend l'absence naturelle **en base** ; c'est la transformation vers le tableau de points qui peut la détruire. Le test le plus utile porte sur cette fonction pure, pas sur le rendu.

7. **`numeric` en mode chaîne.** Si s03 déclare `numeric("value")` sans `mode: "number"`, la valeur arrive en `"72.40"`. Recharts trie et échelonne alors des chaînes : l'axe Y devient faux et le bug ne se voit qu'ici. Vérifier la définition réelle dans `schema.ts` **avant** d'écrire le composant, et couvrir par un test.

8. **L'IMC n'est pas un `kind`.** Le sélecteur a 11 entrées mais la base en connaît 10. La série IMC se calcule à la lecture (`poids_kg / taille_m²`, arrondi à une décimale selon s04) et n'existe pas sans `profiles.height_cm`. Deux conséquences : le typage du sélecteur ne peut pas être `MeasurementKind` tel quel, et l'état vide de l'IMC a une cause supplémentaire (taille non renseignée) que le critère 4 ne distingue pas explicitement.

9. **Deux sessions le même jour.** Rien dans les documents ne dit ce que le graphe affiche si un utilisateur enregistre deux fois la même mesure à la même date (cas banal après une correction en s09). Deux points superposés ? Le dernier ? La moyenne ? Le même angle mort avait été relevé en s05 pour le départage du `DISTINCT ON`. À trancher au plan.

10. **Sur un axe temporel, deux points proches se chevauchent.** C'est la contrepartie assumée du critère 2, vérifiée : deux sessions à un jour d'écart sur trois mois d'historique donnent `cx = 65` et `cx = 70.17`, soit des points qui se touchent. Ce n'est pas un bug, mais ça rend le critère 6 (« chaque point est survolable ou tapotable ») difficile à satisfaire au doigt sur ces points-là.

11. **Le critère 6 n'est pas vérifiable sous jsdom.** Le `hover` par défaut de Recharts repose sur des événements pointeur réels ; `throttledEvents` inclut par défaut `mousemove`, `touchmove`, `pointermove`. Un vrai *tap* (touch sans déplacement) n'est pas garanti par le mode `hover` — d'où l'existence de `trigger="click"`. Ce critère appartient à Playwright, projet `mobile`, pas à Vitest. **Rappel** : le projet `mobile` est une émulation `devices["iPhone 13"]` sous Chromium, pas un vrai Safari iOS — le comportement tactile réel reste non prouvé avant un test sur appareil.

12. **Format des nombres et des dates.** `ChartTooltipContent` appelle `toLocaleString()` sans locale, dans un composant rendu côté serveur puis hydraté. L'UI doit être en français (`AGENTS.md`), et `layout.tsx` déclare aujourd'hui `<html lang="en">`. Sans `formatter` et `labelFormatter` explicites, on risque à la fois un affichage anglais et un écart d'hydratation. À traiter comme une décision, pas comme un défaut à subir.

13. **Le `tickFormatter` de l'axe X n'est pas optionnel.** Sans lui, les ticks affichent l'epoch (`1767225600000`), vérifié. Et le format retenu doit tenir dans les 375 px : `docs/design-system.md` fixe un plancher de `0.75rem` pour les étiquettes de la **silhouette** ; `ChartContainer` impose déjà `text-xs` (= 0.75rem) aux ticks, donc le plancher est respecté par construction, mais la longueur des libellés reste un choix.

14. **375 px : le point sensible n'est pas Recharts.** Le conteneur responsive pose lui-même `min-width: 0px` (vérifié dans le HTML produit), ce qui neutralise le piège classique du dépassement en flex. Les vrais risques sont ailleurs : `YAxis` à 60 px par défaut, le `SelectContent` de Radix (portail, largeur, position sur petit écran), et un parent qui imposerait une largeur minimale. `ChartContainer` impose `aspect-video` (16:9) → environ 190 px de haut pour 340 px de large : **`docs/design-system.md` ne définit aucun token de hauteur ni de ratio pour les graphes**. C'est un *design system gap* à signaler, pas à combler par un `h-[220px]` arbitraire (les valeurs arbitraires sont interdites).

15. **Ne pas éditer `src/components/ui/chart.tsx` à la main.** Il est généré. Toute personnalisation (couleur du trait, formateurs, hauteur) se compose au-dessus, dans `src/components/`.

16. **Ne pas recopier le JSON du registre.** Le `select` du preset radix-nova contient un import vers `@/app/(create)/components/icon-placeholder` que **seule la CLI** sait réécrire (vérifié dans le binaire shadcn). Écrire le fichier à la main = import mort et `typecheck` en échec.

17. **Poids du bundle client.** Recharts 3.8.0 + 11 dépendances runtime (dont `@reduxjs/toolkit`) sur une PWA dont le PRD revendique « zéro pub, zéro upsell, zéro tracking » et dont s10 mettra le shell en cache. Le critère anti-analytics de s01 (recherche dans le build) doit rester vert : Recharts n'embarque aucun traceur, mais la taille est réelle (544 Ko d'UMD non gzippé). La frontière `"use client"` sur le seul composant de graphe est ce qui évite de le charger sur la silhouette.

18. **`npm run check` échoue déjà.** `vitest run` sort en 1 tant qu'il n'existe aucun fichier de test. À ne pas confondre avec une régression introduite par la story.

19. **Aucune vérification base ni déploiement possible ici.** Pas de `DATABASE_URL`, pas de CLI Neon, pas de CLI Vercel, aucune credential. `npm run db:generate` / `db:migrate` échoueront (`drizzle.config.ts` lit `process.env.DATABASE_URL!`). Aucune série réelle n'a pu être lue, aucun cold start mesuré, et les navigateurs Playwright ne sont pas installés (`npx playwright install` était une tâche de s01, non faite).

20. **Thème sombre non branché.** `layout.tsx` ne pose jamais la classe `dark`. `ChartStyle` génère pourtant deux jeux de variables (`:root` et `.dark`) : la moitié de son travail est inerte tant que s01 n'a pas livré le script de thème. Le design system exige de vérifier chaque écran dans les deux modes — impossible aujourd'hui.

## Open questions

1. **Sessions multiples à la même date** : deux points superposés, le dernier enregistré, ou une agrégation ? Aucun document ne le tranche, et le cas devient courant après s09. À arrêter au plan et à couvrir par un test.
2. **Format des libellés de l'axe X** en français et sur 375 px (`01/26` ? `janv.` ? jour + mois ?), et densité des ticks (`interval`, `minTickGap`, `niceTicks`). Non fixé par le design system.
3. **`formatter` / `labelFormatter` du tooltip** : quel format de nombre (décimale française, unité affichée : `72,4 kg` ?) et quel format de date. Lié au risque d'écart d'hydratation de `toLocaleString()`.
4. **`trigger="hover"` ou `trigger="click"`** pour satisfaire « survolable ou tapotable » sur iOS Safari. Je n'ai **pas pu tester le comportement tactile réel** : pas d'appareil iOS, pas de navigateur Playwright installé, et le projet `mobile` n'est qu'une émulation Chromium. À valider sur appareil pendant la review.
5. **Gap design system — dimensions du graphe** : faut-il un token de hauteur ou de ratio, plutôt que l'`aspect-video` par défaut de `ChartContainer` ? À remonter dans `docs/design-system.md`.
6. **Sélection de la mesure : URL ou état local ?** `?measure=waist_cm` via `searchParams` (rechargeable, partageable, mais chaque changement est une navigation serveur, avec le cold start Neon en embuscade) vs `useState` côté client (instantané, mais perdu au rechargement). Aucun document ne le fixe.
7. **Une requête par mesure, ou toutes les séries d'un coup ?** Charger les 10 séries au montage évite un aller-retour par changement de sélection (~500 ms de cold start Neon possible), au prix d'une charge initiale plus lourde. Non tranché.
8. **Composant du sélecteur** : `select` est ce que `docs/design-system.md` attribue à s07, mais `tabs` / `toggle-group` (également vérifiés présents et sans piège) seraient plus rapides au doigt. Un changement d'attribution est une modification du design system, pas une décision d'exécution.
9. **État vide de l'IMC** : le critère 4 parle d'« une mesure ne comportant aucune donnée ». Faut-il distinguer « aucun poids enregistré » de « taille non renseignée » (s04 impose déjà d'inviter à renseigner la taille) ? Deux messages différents ou un seul ?
10. **Point d'entrée vers l'écran des graphes.** Aucun critère de s07 ne l'exige, et s06 interdit explicitement les zones cliquables sur la silhouette. Où se trouve le lien ? À décider avec s06, pas à improviser.
11. **Table de synchronisation `neon_auth`** : nom et clé primaire toujours inconnus — rien dans le paquet. Seul acquis : `session.user.id`, de type `string`. Reste à s02, et bloque le schéma de s03 dont s07 lit les données.
12. **Base de test** pour l'isolation inter-utilisateurs de la requête de série — [ADR 005](../decisions/005-testing-stack.md) renvoie le choix (branche Neon éphémère / base dédiée / Postgres local) à `/ks-research s03`, qui n'a pas eu lieu.
13. **Correction d'[ADR 005](../decisions/005-testing-stack.md)** : Vitest 4 transpile via **oxc**, pas esbuild. Détail, mais un ADR est censé être exact.
