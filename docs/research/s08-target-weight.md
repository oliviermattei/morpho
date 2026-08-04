# Research — Story s08-target-weight

> Phase Research du pipeline killer-saas. Contexte vérifié uniquement : aucun code écrit, aucun plan.
> Tous les chemins sont relatifs à `/Users/olivier/www/multitool/` sauf mention contraire.
> Date de la recherche : 2026-08-02. Commit de tête : `8a3f73b docs: design system` sur `main`.

## Target story

**s08-target-weight — Poids cible**
*As a* utilisateur *I want* fixer un poids cible *so that* je voie ce qu'il me reste à parcourir.
Complexity : 2. Dépendances déclarées : **s07-measurement-charts** (la ligne de référence se pose sur le graphe du poids) et **s04-profile-height-bmi** (le profil existe déjà comme lieu de stockage).

Critères d'acceptation, repris mot pour mot de `morpho/docs/stories.md` (lignes 216-221) :

- [ ] Un poids cible unique se définit et se modifie depuis le profil, et il est persisté.
- [ ] Le graphe du poids affiche la cible comme ligne horizontale de référence, visuellement distincte de la courbe des mesures.
- [ ] L'écart entre le dernier poids enregistré et la cible est affiché en clair, avec son signe.
- [ ] Aucune cible n'est définie par défaut : sans cible, ni ligne ni écart n'apparaissent, et le graphe du poids reste parfaitement fonctionnel.
- [ ] La cible ne s'applique qu'au poids : aucune ligne de référence sur les autres mesures.
- [ ] La cible atteinte ou dépassée s'affiche sans erreur d'arrondi ni écart négatif présenté comme un retard.

Contraintes de périmètre rattachées (notes agentiques de la story, lignes 227-229) : **une seule cible, sur le poids** — les cibles par mensuration sont au graveyard du PRD (`morpho/docs/prd.md` ligne 73 : « Cibles par mensuration — seul le poids a une cible au v1 ») ; **pas de projection de date d'atteinte, pas de courbe de tendance, pas de pourcentage de progression** ; **réutiliser le stockage de profil créé en s04**, pas ouvrir un second mécanisme de préférences.

Ancrage PRD : ligne 60, « Poids cible | 1 | Une valeur stockée, une ligne horizontale de référence sur le graphe du poids, un écart affiché. Cible unique » ; critère de succès #8, ligne 120 : « Le poids cible apparaît comme référence sur le graphe du poids, avec l'écart restant. »

## Current state of the code

**Constat majeur, à lire avant tout le reste : `morpho/` est encore le scaffold brut de `create-next-app`. Aucune des sept stories dont s08 dépend n'est implémentée.**

`git branch -a` ne montre que `main` et une branche distante sans rapport (`claude/deploy-leasing-km-tracker-coolify-fbsfpm`). Aucune branche `feature/s0*`. `morpho/docs/plans/`, `morpho/docs/designs/` sont vides ; `morpho/docs/research/` contient quatre documents (`s02`, `s04`, `s05`, `s06`) — **il n'existe aucun `docs/research/s07-measurement-charts.md`**, alors que s08 se greffe précisément sur le graphe livré par s07.

Arborescence réelle (`find src drizzle tests public -type f`) :

```
morpho/public/{file,globe,next,vercel,window}.svg
morpho/src/app/favicon.ico
morpho/src/app/globals.css
morpho/src/app/layout.tsx
morpho/src/app/page.tsx
morpho/src/lib/utils.ts
morpho/tests/e2e/            (dossier vide)
```

Ce que s08 suppose livré et qui **n'existe pas** :

| Attendu | État réel (vérifié) |
|---|---|
| `src/lib/db/schema.ts` avec `profiles.target_weight_kg` | **absent** — `drizzle.config.ts` pointe pourtant sur `./src/lib/db/schema.ts` |
| `drizzle/` (migrations) | **absent** (`ls: drizzle: No such file or directory`) |
| `src/lib/auth.ts` (`auth.getSession()`) | **absent** |
| `src/app/api/`, `src/proxy.ts` | **absents** |
| Écran de profil (s04) | **absent**, et sa route n'est arrêtée nulle part |
| Écran de graphes (s07) | **absent** — ni code, ni doc de research |
| `src/components/` et `src/components/ui/` | **absents** — le dossier n'existe même pas ; aucun composant shadcn installé |
| `recharts` | **absent** de `morpho/node_modules` (vérifié paquet par paquet) |
| tout test Vitest | **aucun** |

Fichiers présents, état vérifié :

- `morpho/src/app/globals.css` — conforme au design system. Les tokens utiles à s08 sont bien là : `--muted-foreground` (`oklch(0.556 0 0)` clair l. 71 / `oklch(0.708 0 0)` sombre l. 109), `--foreground` (l. 61 / 99), `--chart-1..5` tous achromatiques (l. 78-82, identiques en `.dark` l. 118-122), `--progress-favorable` / `--progress-adverse` (l. 84-85 / 113-114), `--label-min-size` (l. 86).
- `morpho/src/app/layout.tsx` — layout `create-next-app` intact : `lang="en"`, titre « Create Next App », **aucun script posant la classe `dark`** sur `<html>` alors que `docs/design-system.md` ligne 51 l'exige (tâche de s01, non faite). Conséquence directe pour s08 : la vérification « clair **et** sombre » du graphe n'est pas réalisable en l'état.
- `morpho/next.config.ts` — vide (`{}`), donc aucune option de cache activée.
- `morpho/vitest.config.ts` — `environment: "jsdom"`, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@` → `./src`.
- `morpho/playwright.config.ts` — projets `mobile` (iPhone 13) et `desktop`, `webServer: npm run dev`.

Commandes exécutées :

- `npm run typecheck` → OK.
- `npm test` → `No test files found, exiting with code 1`. **`npm run check`, la commande de la review, est donc rouge aujourd'hui.**

Environnement : aucun `DATABASE_URL`, aucune variable `NEON_*` ; ni `neonctl`, ni `vercel` dans le `PATH`. Le réseau sortant HTTPS fonctionne (registre shadcn et registre npm interrogés avec succès).

## Anchor points

Aucun point d'ancrage n'existe encore dans le code. Ce que s08 devra brancher, aux emplacements imposés par `morpho/docs/architecture.md` et `morpho/AGENTS.md` :

| Point | Emplacement imposé | État |
|---|---|---|
| Colonne `profiles.target_weight_kg` (numeric nullable) | `morpho/src/lib/db/schema.ts` | à ajouter — la table `profiles` est créée par s04, qui n'existe pas |
| Migration correspondante | `morpho/drizzle/` via `npm run db:generate` puis `db:migrate` | à créer |
| Écriture de la cible | même mécanisme que la taille en s04 (Server Action **ou** route handler — non tranché) | à créer, **et à aligner sur s04** |
| Écran de profil, champ « poids cible » | route du profil décidée en s04 | **inexistante** |
| Lecture « dernier poids enregistré » | `src/lib/db/` — même requête `DISTINCT ON (kind) … ORDER BY kind, measured_on DESC` que le pré-remplissage de s05 ([ADR 004](../decisions/004-measurements-as-rows.md)), filtrée sur `kind = 'weight_kg'` | inexistante ; s05 doit la poser |
| Calcul de l'écart (fonction pure) | `src/lib/` — module kebab-case | à créer |
| Formatage français signé | aucun utilitaire n'existe dans `src/lib/` (il n'y a que `cn()`) | à créer, **partagé avec les deltas de s06** |
| `ReferenceLine` sur la courbe du poids | composant de graphe livré par s07, dans `src/components/` | **inexistant** |
| `ChartContainer` shadcn | `src/components/ui/chart.tsx` via `npx shadcn@latest add chart` | à installer — normalement par s07 |
| Test unitaire de l'écart et du formatage | co-localisé, `src/lib/*.test.ts` | à créer |
| Test navigateur (375 px, ligne visible) | `tests/e2e/` | répertoire vide |

**Point d'ancrage le plus fragile** : le composant de graphe de s07. Sans lui, quatre des six critères de s08 (ligne de référence, absence de ligne sans cible, cible limitée au poids, graphe fonctionnel sans cible) n'ont aucune surface où se vérifier.

## Verified APIs / functions

Tout ce qui suit a été ouvert dans `morpho/node_modules/`, interrogé sur le registre shadcn, ou **exécuté** — rien n'est repris de mémoire. Les types de Recharts, absent du projet, ont été lus sur `unpkg.com` à la version exacte que shadcn épingle.

### Le composant `chart` de shadcn (style `radix-nova`) — épingle Recharts 3.8.0

`https://ui.shadcn.com/r/styles/radix-nova/chart.json` :

- `dependencies: ["recharts@3.8.0"]`, aucune `registryDependencies`, un seul fichier `ui/chart.tsx` (10 521 caractères), `"use client"`.
- Exports réels : `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`, plus le type `ChartConfig`.
- `ChartContainer` enveloppe `RechartsPrimitive.ResponsiveContainer` en lui passant `initialDimension = { width: 320, height: 200 }` (constante `INITIAL_DIMENSION` du fichier).
- Sa classe contient, entre autres, `flex aspect-video justify-center text-xs`, `[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground` et — point qui concerne directement s08 — **`[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border`**.

Le composant `select` (choix de la mesure, s07) existe bien dans ce style : `registry/radix-nova/ui/select.tsx`, sans dépendance npm.

### Recharts 3.8.0 — `ReferenceLine`

Types lus dans `recharts@3.8.0/types/cartesian/ReferenceLine.d.ts` et `types/util/IfOverflow.d.ts`. Le composant est bien exporté depuis la racine (`types/index.d.ts` : `export { ReferenceLine } from './cartesian/ReferenceLine'`).

Props utiles :

```ts
y?: YValueType;            // ligne horizontale, exprimée dans le domaine des données
x?: XValueType;            // ligne verticale
yAxisId?, xAxisId?;        // requis seulement si plusieurs axes
label?: ImplicitLabelType; // false | string | number | props de LabelList | ReactElement | fonction
zIndex?: number;           // depuis 3.4
strokeWidth?: number | string;
ifOverflow?: 'hidden' | 'visible' | 'discard' | 'extendDomain';
// + Omit<SVGProps<SVGLineElement>, 'viewBox'> : stroke, strokeDasharray, className…
```

Valeurs par défaut, **lues dans `referenceLineDefaultProps`** :

```ts
{ ifOverflow: "discard", xAxisId: 0, yAxisId: 0, fill: "none",
  label: false, stroke: "#ccc", fillOpacity: 1, strokeWidth: 1,
  position: "middle", zIndex: 400 }
```

Sémantique de `ifOverflow`, citée du `.d.ts` : `discard` = « the whole component will not be drawn at all » ; `extendDomain` = « the domain of the overflown axis will be extended such that the whole component fits into the plot area ».

### Recharts 3.8.0 — `ResponsiveContainer` et jsdom

`recharts@3.8.0/es6/component/responsiveContainerUtils.js` :

```js
export var defaultResponsiveContainerProps = {
  width: '100%', height: '100%', debounce: 0, minWidth: 0,
  initialDimension: { width: -1, height: -1 }
};
```

`es6/component/ResponsiveContainer.js` : l'effet de mesure commence par
`if (containerRef.current == null || typeof ResizeObserver === 'undefined') { return noop; }`
et le sous-composant `ResponsiveContainerContextProvider` **retourne `null`** si `isAcceptableSize` est faux (largeur ou hauteur ≤ 0).

Conséquence vérifiée : sans `ResizeObserver`, Recharts 3 **ne plante pas**, mais avec les valeurs par défaut (`-1 × -1`) il ne rend rien. C'est l'`initialDimension` de 320 × 200 imposé par `ChartContainer` de shadcn qui rend le graphe testable en jsdom.

Environnement de test mesuré (`jsdom@29.1.1`, celui installé) :

```
ResizeObserver: undefined
matchMedia:     undefined
```

### Recharts 3.8.0 — poids de la dépendance

`npm view recharts@3.8.0` :

- dependencies : `@reduxjs/toolkit`, `react-redux`, `immer`, `reselect`, `es-toolkit`, `victory-vendor`, `decimal.js-light`, `eventemitter3`, `tiny-invariant`, `use-sync-external-store`, `clsx`.
- peerDependencies : `react ^16.8 || ^17 || ^18 || ^19`, `react-dom`, **`react-is`**.
- `dist-tags.latest = 3.10.1` — shadcn épingle 3.8.0, pas la dernière.

Dans `morpho/node_modules` : `react-is@16.13.1` **présent** (satisfait le peer `^16.8.0`), `sonner@2.0.7`, `next-themes@0.4.6`, `react-hook-form@7.84.0` présents ; `recharts` et `@hookform/resolvers` **absents**.

Point de comparaison interne : `compoundSimulator/` embarque `recharts@2.15.4` et utilise `ReferenceLine` (`compoundSimulator/src/App.jsx` ligne 595, avec `x`, `stroke`, `strokeDasharray="4 4"`, `label`). **C'est du Recharts 2 : ce n'est pas une référence d'API valide pour la v3.**

### Drizzle ORM 0.45.2 — `numeric`

`morpho/node_modules/drizzle-orm/pg-core/columns/numeric.d.ts` :

- classe `PgNumeric` → `mapFromDriverValue(value: unknown): string` ;
- classe `PgNumericNumber` → `mapFromDriverValue(value: unknown): number` et `mapToDriverValue: StringConstructor`.

Sans `mode: "number"`, `target_weight_kg` revient en chaîne (`"70.00"`), exactement le piège signalé par [ADR 004](../decisions/004-measurements-as-rows.md).

`onConflictDoUpdate(config)` existe bien (`pg-core/query-builders/insert.d.ts` ligne 171) — c'est le mécanisme naturel pour « créer ou mettre à jour la ligne `profiles` de l'utilisateur ».

### Zod 4.4.3 — comportements mesurés (exécutés, pas supposés)

```
z.coerce.number().safeParse("")     → { success: true, data: 0 }        ⚠️
z.coerce.number().safeParse("70,5") → success: false, "received: NaN"   ⚠️
```

Deux pièges cumulés pour un champ « poids cible » : la chaîne vide devient `0` (une cible à 0 kg), et la virgule décimale française — exigée à la saisie par le design system § Formulaires — est **rejetée** par la coercition. La normalisation `,` → `.` doit précéder le schéma, et le refus du vide doit être explicite.

### Formatage et arithmétique de l'écart — mesurés dans Node

```
72.4 - 70            = 2.4000000000000057
80.1 - 79.9          = 0.19999999999998863
(72.4 - 70).toFixed(1) = "2.4"

Intl.NumberFormat('fr-FR', { minimumFractionDigits:1, maximumFractionDigits:1, signDisplay:'exceptZero' })
  .format(72.4 - 70) → "+2,4"
  .format(-2.4)      → "-2,4"
  .format(0)         → "0,0"
  .format(-0)        → "0,0"
  .format(0.04)      → "0,0"
  .format(-0.04)     → "0,0"

même formateur sans signDisplay :
  .format(-0)        → "-0,0"      ⚠️
```

Deux faits exploitables directement par le critère 6 : la soustraction flottante produit `2.4000000000000057`, et **seul `signDisplay: 'exceptZero'` empêche l'affichage d'un `-0,0`** quand la cible est atteinte.

### `@neondatabase/auth` 0.4.2-beta — ce qui est réellement livré

Paquet inspecté directement. `package.json` : `version: "0.4.2-beta"`, `files: ["codemods/…", "dist", "llms.txt", "sbom.cdx.json"]`, sous-chemins exportés dont `./next/server` → `dist/next/server/index.d.mts`. **`NEXT-JS.md`, référencé par `llms.txt` (« See NEXT-JS.md for complete guide »), n'est pas livré.**

Sur la forme de retour de `getSession()`, l'état exact de la documentation embarquée — je le rapporte tel quel plutôt que de trancher :

- `llms.txt` ligne 224, section « Default API (Better Auth) » : `getSession()` - Get current session (cached) — **la forme du retour n'y est pas donnée** ;
- ligne 232, section « **SupabaseAuthAdapter API** » : `getSession()` - Returns `{ data: session }` — mais c'est la section de l'adaptateur Supabase, pas du chemin par défaut ;
- lignes 52 et 124 : `const session = await auth.getSession();` (sans destructuring) ;
- ligne 286, **section « Next.js Integration »**, la seule qui décrive notre configuration : `const { data: session } = await auth.getSession();`.

Le même bloc Next.js impose aussi `export const dynamic = 'force-dynamic'` sur tout Server Component utilisant `auth`, et une `NEON_AUTH_COOKIE_SECRET` d'au moins 32 caractères. La forme `{ data: session }` est celle des exemples Next.js ; **elle n'est pas confirmée par une exécution** (voir Blockers).

Recherche exhaustive infructueuse : aucune occurrence de `neon_auth` ni d'un nom de table de synchronisation dans le paquet — le point ouvert n°1 de l'architecture reste entier, comme au terme de la research s04.

### Next.js 16.2.12 — vérifié dans `node_modules/next/dist/docs/`

- `01-app/01-getting-started/07-mutating-data.md` ligne 32, avertissement littéral : *« Server Functions are reachable via direct POST requests, not just through your application's UI. Always verify authentication and authorization inside every Server Function. »* — l'écriture de la cible doit donc revérifier la session, même appelée depuis un formulaire déjà protégé.
- `07-mutating-data.md` ligne 349 : `const [state, action, pending] = useActionState(createPost, false)`.
- `03-api-reference/04-functions/refresh.md` : `refresh(): void`, importé de `next/cache`, *« can **only** be called from within Server Actions. It cannot be used in Route Handlers, Client Components, or any other context. »* Le doc précise que `refresh()` **ne revalide pas** les données taguées (`updateTag` / `revalidateTag` pour cela).
- `01-getting-started/16-proxy.md` existe : en Next 16 le middleware s'appelle **`proxy.ts`**. À noter, la méthode du SDK Neon Auth reste nommée `auth.middleware(...)`.
- `03-api-reference/04-functions/` contient bien `revalidatePath.md`, `revalidateTag.md`, `updateTag.md`, `connection.md`, `redirect.md` — mais **pas** de `use-action-state.md` (c'est une API React, pas Next).

## Traps & constraints

**1. `ifOverflow: "discard"` est le piège central de cette story.** Par défaut, si le poids cible tombe hors du domaine de l'axe Y — cas parfaitement banal : cible à 70 kg alors que l'historique va de 78 à 85 kg, c'est-à-dire *le cas normal au début d'un objectif* — **la ligne de référence n'est pas dessinée du tout**. Le critère 2 serait alors coché sur une capture où la cible est proche des mesures, et faux en production. Deux parades possibles (`ifOverflow="extendDomain"`, ou calcul explicite du `domain` de l'`YAxis` incluant la cible) ; aucune n'est décidée. Un test doit couvrir explicitement le cas « cible très éloignée de toutes les mesures ».

**2. Le `stroke` par défaut est `"#ccc"`, et shadcn le détourne.** `ChartContainer` contient la règle `[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border`. Laisser le défaut donne donc une ligne en `--border`, alors que `docs/design-system.md` (§ Graphes) impose **`--muted-foreground`, en tirets**. Il faut passer `stroke` explicitement — ce qui, au passage, désactive le sélecteur d'attribut de shadcn et évite tout conflit de spécificité. Et « pas de couleur en dur » reste la règle : la valeur vient du token, pas d'un hex.

**3. `label` vaut `false` par défaut.** Le design system interdit qu'une information soit portée par la seule couleur (§ Do/Don't). Une ligne grise en tirets sans étiquette ne dit pas *ce qu'elle est*. Le critère 2 (« visuellement distincte ») est satisfaisable par les tirets, mais la règle du design system pousse vers une étiquette textuelle — dont le contenu n'est arrêté nulle part.

**4. L'arithmétique flottante mord sur le critère 6.** `72.4 - 70 = 2.4000000000000057` (mesuré). Un rendu brut afficherait cette valeur. L'arrondi doit être appliqué **et testé**, avec des valeurs limites choisies — même exigence que l'arrondi de l'IMC en s04, et même absence de règle de départage écrite.

**5. `-0` est un piège d'affichage réel.** Avec un formateur `fr-FR` ordinaire, `-0` s'affiche `-0,0` — soit exactement « un écart négatif présenté comme un retard » que le critère 6 interdit. `signDisplay: 'exceptZero'` le neutralise (mesuré). À poser dans l'utilitaire de formatage, pas dans le composant.

**6. Le sens de l'écart n'est pas défini par le produit.** morpho ne connaît aucune direction d'objectif : rien dans le PRD, les stories ou l'architecture ne dit si la cible est un objectif de perte ou de prise. « La cible atteinte ou dépassée » (critère 6) n'est donc pas calculable sans convention. Le rapprochement avec le sens « favorable » déclaré par `kind` (s06) est tentant, mais s06 n'attribue **aucun** sens favorable au poids — sa research (`s06-body-map.md`, question ouverte 4) renvoie explicitement le sujet à s08.

**7. Recharts n'est pas installé, et sa version est un choix qui n'appartient pas à s08.** `npx shadcn@latest add chart` installera `recharts@3.8.0`. Recharts 3 tire `@reduxjs/toolkit` et `react-redux` : c'est de loin la plus grosse dépendance cliente du projet, pour une app dont l'angle est la sobriété. Le choix relève de s07 ; s08 en hérite. Et l'usage local de `ReferenceLine` dans `compoundSimulator/src/App.jsx` est du **Recharts 2.15.4** : le copier serait une hallucination d'API déguisée en précédent maison.

**8. jsdom ne connaît ni `ResizeObserver` ni `matchMedia`** (mesuré sur `jsdom@29.1.1`). Recharts 3 ne plante pas sans `ResizeObserver`, mais ne rendrait rien avec son `initialDimension` par défaut de `-1 × -1`. Le graphe n'est testable en Vitest **que** parce que `ChartContainer` impose 320 × 200. Si un futur agent contourne `ChartContainer` et utilise `ResponsiveContainer` directement, les tests deviennent silencieusement vides.

**9. La cible ne s'applique qu'au poids (critère 5), sur un écran mono-série.** L'écran de s07 affiche **une** courbe parmi onze séries sélectionnables (dix `kind` + l'IMC). La `ReferenceLine` doit donc être conditionnelle à la série choisie. Le test qui compte est celui qui *sélectionne une autre mesure et vérifie l'absence de ligne* — pas celui qui vérifie sa présence sur le poids.

**10. `numeric` sans `mode: "number"` rend une chaîne.** `target_weight_kg` alimente une soustraction (l'écart) et une coordonnée d'axe (`y` de la `ReferenceLine`). `"70.00"` passerait par coercition JS sur la soustraction et casserait ailleurs. `mode: "number"` est non négociable, et [ADR 004](../decisions/004-measurements-as-rows.md) demande un test qui le couvre.

**11. `z.coerce.number()` avale la chaîne vide (`→ 0`) et refuse la virgule française** (les deux mesurés). Un champ « poids cible » vide validé produirait une cible à 0 kg — et une ligne de référence à 0 sur le graphe, plus un écart absurde. La normalisation de la virgule et le refus explicite du vide précèdent la coercition.

**12. Le design system n'assigne aucun composant à s08.** Son tableau § Composants disponibles couvre s02 à s10 mais **saute s08**. Le champ de saisie de la cible se compose de `field` + `input` + `label` (installés par s03/s04) et l'affichage de l'écart n'a pas de composant désigné — `card` ? texte simple dans l'écran de graphe ? C'est un *design system gap* à consigner, pas à combler à la volée.

**13. `src/components/ui/` est généré et n'existe même pas.** Les composants s'ajoutent par la CLI (`npx shadcn@latest add …`), jamais à la main. La CLI a besoin du réseau — disponible ici, à ne pas supposer acquis en CI.

**14. Le projet Playwright `mobile` fait 390 px, pas 375.** Vérifié : `devices["iPhone 13"].viewport = { width: 390, height: 664 }`. s08 n'a pas de critère à 375 px en propre, mais s07 en a un (« le graphe ne déborde pas à 375 px ») que l'ajout d'une ligne de référence **et de son étiquette** peut faire régresser. Toute spec e2e ajoutée ici doit fixer explicitement le viewport.

**15. `npm run check` est rouge aujourd'hui** (`vitest` sort en code 1 sans fichier de test). C'est la commande que `/ks-review` invoque ; elle redeviendra verte au premier `src/**/*.test.ts`.

**16. Ne jamais réintroduire `@vitejs/plugin-react`** ([ADR 005](../decisions/005-testing-stack.md), `morpho/AGENTS.md`) : il tire `@babel/core@8.0.0-rc` et casse `shadcn`. Vérifié absent de `node_modules`.

**17. `refresh()` ne fonctionne que dans une Server Action.** Si l'écriture de la cible passe par un route handler (choix laissé ouvert en s04), `refresh()` lèvera. Et `redirect()` lève par conception : revalider **puis** rediriger, jamais l'inverse.

**18. La règle d'identité s'applique aussi ici.** L'écriture et la lecture de `target_weight_kg` filtrent sur l'identifiant issu de `auth.getSession()`, jamais sur un `user_id` de payload (`morpho/AGENTS.md`, [ADR 003](../decisions/003-neon-auth.md)). Le doc Next 16 le redit pour les Server Functions, joignables en POST direct.

**19. Le thème sombre n'est pas branché.** `layout.tsx` ne pose jamais la classe `dark`. La vérification « clair et sombre » du contraste de la ligne `--muted-foreground` sur fond `--background`, exigée par le design system, est impossible tant que s01 n'a pas livré le script de thème.

## Open questions

À trancher en `/ks-plan` (ou plus tôt), pas à deviner en exécution :

1. **s08 peut-elle seulement être planifiée avant s01–s07 ?** L'ordre déclaré est s01 → s10 et chaque story suppose les précédentes livrées. Aucune n'est livrée, et **s07 n'a même pas de doc de research**. Question à l'humain : le pipeline reprend-il à s01, ou s08 doit-elle porter une partie du socle (dont le graphe) ?

2. **Direction de la cible et définition de « atteinte ».** Objectif de perte ou de prise ? Rien ne le dit. Sans convention, le critère 6 (« la cible atteinte ou dépassée s'affiche sans […] écart négatif présenté comme un retard ») n'est pas implémentable. Options : signe de l'écart interprété par rapport au dernier poids au moment où la cible est posée ; sens « favorable » déclaré pour `weight_kg` (qui n'existe pas — s06 renvoie ici) ; ou affichage strictement neutre (« écart : +2,4 kg », sans notion de retard). À arbitrer avec l'utilisateur.

3. **Où l'écart s'affiche-t-il ?** Le critère dit « affiché en clair », sans lieu. Sur l'écran de graphes uniquement, sur l'accueil silhouette de s06, ou les deux ? `docs/architecture.md` § Design/UX ne décrit que trois écrans et place la cible dans « Les graphes (s07, s08) », mais s06 affiche déjà le poids hors silhouette.

4. **Règle d'arrondi de l'écart et seuil d'« atteinte ».** `toFixed(1)`, `Math.round(x*10)/10`, ou `Intl.NumberFormat` ? Les trois divergent aux demi-valeurs. Et un écart de 0,04 kg, qui s'affiche `0,0`, compte-t-il comme cible atteinte ? Non spécifié.

5. **Stratégie de débordement de la ligne** : `ifOverflow="extendDomain"` (l'axe s'étire jusqu'à la cible, ce qui écrase visuellement les variations réelles du poids) ou domaine de l'`YAxis` calculé explicitement pour inclure la cible avec une marge ? Choix de rendu produit, à trancher, pas à laisser au défaut `discard` qui fait disparaître la ligne.

6. **Contenu et position de l'étiquette de la ligne.** `label` vaut `false` par défaut. « Cible » ? « Cible 70,0 kg » ? Aucune étiquette et on s'appuie sur les tirets ? *Design system gap* à remonter (§ Gaps connus) — d'autant que l'étiquette est le premier candidat au débordement à 375 px.

7. **Effacer la cible est-il autorisé ?** Le critère parle de « se définit et se modifie ». Un champ vidé repasse-t-il `target_weight_kg` à `NULL` — faisant disparaître ligne et écart, ce que le critère 4 décrit — ou est-il refusé ? Exactement la même question ouverte que la taille en s04 : **les deux doivent être tranchées ensemble**.

8. **Plage physiologique du poids cible.** L'architecture déclare les plages « par `kind` de mesure » — mais la cible vit sur le profil, comme la taille, et n'est pas un `kind`. Réutilise-t-on la plage de `weight_kg` définie en s03, et où vit cette déclaration partagée ? Non spécifié.

9. **Précision et échelle de `target_weight_kg`.** `numeric` nu, `numeric(5,2)`, `numeric(4,1)` ? Doit-il être identique à celui de `measurements.value` pour que la soustraction soit homogène ? Non spécifié.

10. **Server Action ou route handler pour écrire la cible ?** `docs/architecture.md` ligne 58 ne nomme que « Server Component ou route handler » ; le doc Next 16 fait de la Server Action le chemin principal d'un formulaire. Question héritée de s04 (question ouverte 3) : **la réponse doit être la même pour la taille et pour la cible**, sinon le profil aura deux mécanismes d'écriture.

11. **Version de Recharts.** shadcn épingle `3.8.0`, le registre npm publie `3.10.1`. Suit-on l'épingle du composant `chart` ou la dernière ? Décision de s07, à confirmer avant que s08 s'appuie sur `ifOverflow` / `zIndex`.

12. **La cible s'applique-t-elle à la série IMC ?** Le critère 5 dit « la cible ne s'applique qu'au poids ». L'IMC dérive du poids, donc une cible de poids induit mécaniquement une cible d'IMC. Faut-il l'afficher ? Lecture littérale : non. À confirmer, car c'est le genre d'ajout « logique » qu'un agent fait spontanément.

13. **Forme de retour de `auth.getSession()`.** `session` ou `{ data: session }` ? Les deux formes coexistent dans `llms.txt`, et la seule affirmation explicite (`Returns { data: session }`) se trouve dans la section de l'**adaptateur Supabase**, pas du chemin par défaut. Les exemples Next.js utilisent le destructuring. Seule une exécution contre une vraie instance tranche.

14. **Nom et clé primaire de la table `neon_auth`.** Toujours introuvable dans le paquet (recherche exhaustive). Question héritée de s02/s04 ; elle conditionne le type de `profiles.user_id`, donc la ligne que s08 met à jour.

15. **Format d'affichage du champ de saisie.** La cible se saisit-elle `70,5` (virgule française, cohérent avec s03/s05) et se réaffiche-t-elle `70,5` ou `70.5` ? Question jumelle de celle laissée ouverte par s05 (question 8), à résoudre une seule fois pour tous les champs numériques.

## Blockers

- **Aucune donnée d'accès.** Pas de `DATABASE_URL`, pas de `NEON_AUTH_BASE_URL`, pas de `NEON_AUTH_COOKIE_SECRET` ; ni `neonctl` ni `vercel` installés. Conséquences directes : impossible d'exécuter `npm run db:migrate` pour ajouter `target_weight_kg`, impossible de vérifier le critère 1 (« persisté »), impossible de lever les questions 13 et 14, impossible d'exécuter le moindre test d'intégration.
- **s07 n'existe ni en code ni en research.** Quatre des six critères de s08 (2, 4, 5, et une partie du 6) se vérifient sur le graphe du poids, qui n'existe pas et dont la forme des données, la sélection de série et la configuration d'axes ne sont documentées nulle part. La research de s07 est un préalable, pas un détail d'ordonnancement.
- **s01 à s06 non livrées.** Pas d'utilisateur, pas de table `profiles`, pas de poids enregistré, pas d'écran de profil où poser le champ. En isolation, s08 n'est implémentable et testable que pour sa fonction pure « écart + formatage signé » et son test.
- **Recharts absent du projet.** Toutes les vérifications d'API de `ReferenceLine` / `ResponsiveContainer` ci-dessus ont été faites sur les fichiers publiés de `recharts@3.8.0` (types et sources ES6 via unpkg), **pas sur une installation locale exécutée**. Elles sont exactes quant à la surface d'API et aux valeurs par défaut ; elles ne constituent pas une preuve de rendu.
- **Base de test non tranchée** ([ADR 005](../decisions/005-testing-stack.md), point ouvert n°2 de l'architecture) : branche Neon éphémère, base dédiée ou Postgres local. Le critère « persisté » et tout test d'accès croisé sur `profiles` en dépendent.

## Méthode d'exploration suivie

Pour rendre ce document réfutable : `morpho/docs/stories.md`, `architecture.md`, `design-system.md`, `prd.md` (sections cible/graveyard) et les **sept ADR** lus ; `AGENTS.md` racine et `morpho/AGENTS.md` lus ; les research existantes `s04`, `s05`, `s06` relues pour ne pas contredire ni dupliquer leurs constats ; arborescence `src/`, `tests/`, `drizzle/`, `public/` relevée par `find` ; `package.json`, `components.json`, `drizzle.config.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `next.config.ts`, `eslint.config.mjs`, `.env.example`, `globals.css`, `layout.tsx`, `lib/utils.ts` lus ; `npm run typecheck` et `npm test` **exécutés** ; `git log` et `git branch -a` consultés ; `.d.ts` ouverts dans `node_modules/drizzle-orm/` et `@neondatabase/auth/` (+ `llms.txt` intégral de la section serveur) ; présence/version de `recharts`, `react-is`, `sonner`, `next-themes`, `react-hook-form`, `@hookform/resolvers` vérifiée paquet par paquet ; comportements de Zod 4, d'`Intl.NumberFormat('fr-FR')`, de l'arithmétique flottante et de `jsdom` (`ResizeObserver`, `matchMedia`) **exécutés** dans Node ; viewport du device Playwright `iPhone 13` lu à l'exécution ; registre shadcn interrogé en HTTP sur le style `radix-nova` réellement configuré (`chart`, `select`, `card`, `field`, `input`, `label`, `button`, `empty`, `sonner`, `separator`) ; types et sources de `recharts@3.8.0` (`ReferenceLine`, `IfOverflow`, `ResponsiveContainer`, `responsiveContainerUtils`, `index`) lus sur unpkg à la version épinglée par shadcn ; métadonnées npm de `recharts` consultées ; docs Next 16 lues dans `node_modules/next/dist/docs/` (`07-mutating-data.md`, `refresh.md`, `16-proxy.md`, listing de `03-api-reference/04-functions/`) ; usage de `ReferenceLine` dans `compoundSimulator/src/App.jsx` lu pour établir qu'il relève de Recharts 2 et non d'un précédent réutilisable.
