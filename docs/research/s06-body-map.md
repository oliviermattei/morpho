# Research — Story s06-body-map

> Phase `/ks-research`. Contexte vérifié uniquement : aucun code écrit, aucun plan proposé.
> Chemins relatifs à `multitool/morpho/` sauf mention contraire.
> Tout ce qui suit a été ouvert dans le dépôt ou dans `node_modules/`, jamais restitué de mémoire.

## Target story

**s06-body-map — La silhouette comme écran d'accueil**
*As a* utilisateur *I want* ouvrir l'app sur une silhouette annotée *so that* je voie d'un coup d'œil où mon corps a changé.
Complexity : 3. Dépendances déclarées : s03 (les mesures existent), s04 (l'IMC est calculable), s05 (le critère du tap unique est repris en non-régression).

Critères d'acceptation, recopiés de `docs/stories.md` (lignes 158-167) :

1. L'écran d'accueil de l'app authentifiée est la silhouette — elle remplace le placeholder de s02. Ni liste, ni tableau de bord chiffré.
2. Chaque zone corporelle suivie (poitrine, biceps, taille, hanches, cuisse, mollet, épaules) affiche sa valeur la plus récente et son delta depuis la première mesure enregistrée, signe compris (`-4,2 cm`).
3. Le poids, l'IMC et les pourcentages de masse, qui ne correspondent à aucune zone, sont affichés distinctement de la silhouette mais sur le même écran.
4. Une zone sans aucune mesure enregistrée s'affiche dans un état neutre, sans delta et sans couleur de progression.
5. Une zone dont une seule mesure existe affiche sa valeur sans delta : il n'y a rien à comparer.
6. La coloration d'une zone reflète le sens de la progression, et le sens « favorable » est déclaré par mesure : un tour de taille qui baisse et un biceps qui monte sont tous deux des progrès.
7. Sur une fenêtre de 375 px de large, la page ne produit aucun défilement horizontal et aucun élément ne déborde du viewport ; les étiquettes de la silhouette respectent une taille de police minimale définie dans le design system.
8. **Non-régression de s05** : depuis cette silhouette, atteindre le formulaire de saisie prend au plus un tap.
9. Un utilisateur sans aucune session voit un état initial qui l'oriente vers la saisie, jamais une silhouette vide et muette.

Rappels de cadrage attachés à la story (notes agentiques, lignes 172-178) : angle n°1 du PRD ; référentiel du delta = **première mesure enregistrée pour cette mesure**, pas la session précédente ; SVG en `viewBox` et coordonnées relatives ; **pas de zone cliquable** (écarté volontairement, ne pas l'ajouter) ; la taille de police minimale est un token du design system, pas une valeur inventée ici.

## Current state of the code

**Constat central : rien n'est implémenté. s01 à s05 ne sont pas livrés.** `git log` s'arrête à `8a3f73b docs: design system` ; il n'existe qu'une branche `main` et aucune `feature/s0*`. `docs/research/`, `docs/designs/`, `docs/plans/` et `docs/reviews/<id>` sont vides (seul `docs/reviews/stories.md` existe, qui est un doc de cadrage).

Contenu réel de `src/` (`ls -laR src`) — 4 fichiers, aucun code métier :

```
src/app/favicon.ico
src/app/globals.css      tokens shadcn + tokens morpho (voir plus bas)
src/app/layout.tsx       layout create-next-app, non modifié
src/app/page.tsx         page d'accueil create-next-app (logo Next, liens Vercel)
src/lib/utils.ts         cn() de shadcn
src/lib/db/              répertoire VIDE
```

N'existent pas : `src/components/` (donc `src/components/ui/` non plus — shadcn n'a rien installé), `src/lib/db/schema.ts`, `src/lib/db/index.ts`, `src/lib/auth.ts`, `src/proxy.ts`, `src/app/api/`, `drizzle/` (aucune migration), `tests/e2e/` (aucune spec), aucun fichier `*.test.ts(x)`.

Ce qui existe déjà et est exploitable :

- **`src/app/globals.css`** — les tokens de morpho y sont **déjà posés**, contrairement à ce que le mot « phase suivante » de l'architecture laisse croire :
  - `:root` ligne 84-86 : `--progress-favorable: oklch(0.55 0.12 152)`, `--progress-adverse: var(--destructive)`, `--label-min-size: 0.75rem`.
  - `.dark` ligne 113-114 : `--progress-favorable: oklch(0.7 0.14 152)`, `--progress-adverse: var(--destructive)`.
  - `@theme inline` lignes 34-37 : `--color-progress-favorable`, `--color-progress-adverse`, et `--text-label-min: var(--label-min-size)` — c'est ce dernier qui produit l'utilitaire `text-label-min` exigé par le critère 7.
- **`components.json`** — `style: "radix-nova"`, `baseColor: "neutral"`, `rsc: true`, `iconLibrary: "lucide"`, alias `@/components`, `@/components/ui`, `@/lib`.
- **Configs** : `vitest.config.ts` (jsdom, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@`), `playwright.config.ts` (projets `mobile` = iPhone 13 et `desktop`, `webServer` = `npm run dev`), `drizzle.config.ts` (`schema: "./src/lib/db/schema.ts"`, `out: "./drizzle"`, `schemaFilter: ["public"]`), `next.config.ts` **vide** (donc `cacheComponents` non activé — voir Traps), `tsconfig.json` strict avec `jsx: "react-jsx"`.
- **`.env.example`** : `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `E2E_BASE_URL`. Aucune valeur, et aucun `.env` présent.

État des commandes, mesuré :

- `npm run build` : **OK**, 2 s, Next.js 16.2.12 (Turbopack). `/` est aujourd'hui prérendue en statique (`○`).
- `npm run test` : **ÉCHOUE** — `No test files found, exiting with code 1`. Donc `npm run check` (typecheck + lint + test) est **rouge aujourd'hui**, avant toute modification. Le premier test écrit règle ce point.
- Avertissement Vitest au lancement : `Your Vite config uses features that are unsupported by configLoader: 'native'` (ESM dans `vitest.config.ts` chargé en CJS). Bruit, non bloquant.

**Fichiers parasites non versionnés à signaler** : `src/app/zprobe/route.ts` et `src/app/zprobeclient/page.tsx` (créés à 14:20, `git status` les voit en `??`). Ce sont des sondes qui lisent `process.env.DATABASE_URL` / `NEXT_PUBLIC_PROBE`, manifestement produites par une autre session d'agent pour tester le critère « pas de secret dans le build » de s01. Elles apparaissent dans la sortie de `npm run build` (`/zprobe`, `/zprobeclient`). Elles ne font pas partie de s06 ; le plan doit décider explicitement de les ignorer ou de les nettoyer, jamais les embarquer dans le diff par accident.

## Anchor points

| Point de branchement | Fichier | État |
|---|---|---|
| Écran d'accueil authentifié = la silhouette | `src/app/page.tsx` | existe, contenu create-next-app à remplacer intégralement |
| Layout racine (lang, metadata, classe `dark`) | `src/app/layout.tsx` | existe, encore `lang="en"` et `title: "Create Next App"` |
| Squelette d'attente (cold start Neon) | `src/app/loading.tsx` | **à créer** — convention Next vérifiée (voir Verified APIs) |
| Composant SVG silhouette + composants d'affichage | `src/components/` | **répertoire inexistant** |
| Primitives shadcn (`card`, `empty`, `skeleton`, `button`) | `src/components/ui/` | **répertoire inexistant**, à générer par la CLI |
| Schéma Drizzle (`measurements`, `measurement_sessions`, `profiles`, enum `kind`) | `src/lib/db/schema.ts` | **inexistant** — c'est s03 qui le crée |
| Client Neon + instance Drizzle | `src/lib/db/index.ts` | **inexistant** — s01/s03 |
| Session serveur | `src/lib/auth.ts` | **inexistant** — s02 |
| Protection des routes | `src/proxy.ts` | **inexistant** — s02 |
| Déclaration du sens « favorable » par `kind` | aucun fichier | **inexistant**. L'architecture (ligne 110) dit « propriété déclarée par `kind` dans le domaine » sans nommer de fichier. Emplacement à trancher au plan, cohérent avec le nommage kebab-case des modules `lib`. |
| Requête « première valeur par mesure » | aucun fichier | **inexistante**. L'ADR 004 fixe la forme : `DISTINCT ON (kind) … ORDER BY kind, measured_on ASC`. |
| Tokens de progression et plancher d'étiquette | `src/app/globals.css` | **déjà en place** (voir Current state) |
| Tests logique/rendu | `src/**/*.test.tsx` | aucun |
| Tests navigateur (375 px, pas de scroll horizontal) | `tests/e2e/` | répertoire inexistant |

## Verified APIs / functions

### Next.js 16.2.12 — vérifié dans `node_modules/next/dist/docs/`

- **Route Segment Config** (`01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md`) : le tableau des options ne liste plus que `dynamicParams`, `runtime`, `preferredRegion`, `maxDuration`. Le journal de versions précise : « `v16.0.0` — `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` **removed when Cache Components is enabled** ». `next.config.ts` étant vide, `cacheComponents` n'est **pas** activé, donc `export const dynamic = 'force-dynamic'` reste valide et documenté dans `01-app/02-guides/caching-without-cache-components.md` (lignes 87-97 : `'auto' | 'force-dynamic' | 'error' | 'force-static'`).
- **`loading.js`** (`03-file-conventions/loading.md`) : `loading.tsx` enveloppe automatiquement `page.js` dans un `<Suspense>`. Server Component par défaut, n'accepte aucun paramètre. Avertissement explicite : si le **layout** accède à des données non mises en cache (`cookies()`, `headers()`, fetch non caché), `loading.js` n'affiche pas de fallback et la navigation bloque — donc la lecture de session ne doit pas remonter dans `layout.tsx` si l'on veut un squelette.
- **`viewport`** (`04-functions/generate-viewport.md`, ligne 124) : « The `viewport` meta tag is automatically set, and manual configuration is usually unnecessary ». Aucun `export const viewport` n'est requis pour que `width=device-width, initial-scale=1` soit émis. `viewport` / `generateViewport` ne sont supportés **que dans les Server Components**.
- **`proxy.ts`** (`01-getting-started/16-proxy.md`) : « Starting with Next.js 16, Middleware is now called Proxy ». Fichier `proxy.ts` à la racine du projet **ou dans `src/`**, un seul par projet, export par défaut ou export nommé `proxy`, `export const config = { matcher }`.

### Neon Auth 0.4.2-beta — vérifié dans `node_modules/@neondatabase/auth/`

- `package.json` → `exports["./next/server"]` = `./dist/next/server/index.d.mts`. Le sous-chemin annoncé par l'architecture existe bien.
- `dist/next/server/index.d.mts` :
  - `declare function createNeonAuth(config: NeonAuthConfig): NeonAuth`
  - `type NeonAuth = NeonAuthServer & { handler: () => …; middleware: (cfg?: Pick<NeonAuthMiddlewareConfig,'loginUrl'>) => … }`
  - `type NeonAuthServer = Pick<VanillaBetterAuthClient, ServerAuthMethods>` — `getSession` fait partie des clés de `API_ENDPOINTS`, donc `auth.getSession()` existe.
  - `NeonAuthConfig` = `{ baseUrl: string; cookies: { secret: string /* ≥ 32 car. */, sessionDataTtl?: number, domain?: string, sameSite?: 'strict'|'lax'|'none' } } & { logger?, logLevel? }`.
  - **Le JSDoc du package impose, pour un Server Component qui appelle `auth` :** `export const dynamic = 'force-dynamic'` puis `const { data: session } = await auth.getSession(); if (!session?.user) …`. Confirmé à l'identique dans `llms.txt` (lignes 280-288).
  - L'exemple de middleware du package écrit `middleware.ts` : **contradiction avec Next 16**, où le fichier doit s'appeler `proxy.ts`. La fonction retournée (`(request: NextRequest) => Promise<NextResponse>`) reste compatible ; c'est le nom du fichier qui change.
- **Forme de `session.user`**, remontée jusqu'à la source : `dist/adapter-core-BiYHR4I-.d.mts` ligne 6 importe `{ Session, User }` de `better-auth/types` → `better-auth/dist/types/models.d.mts` ligne 5 réexporte depuis `@better-auth/core/db` → `node_modules/@better-auth/core/dist/db/schema/user.d.mts` :
  ```
  userSchema = { id: string; createdAt: Date; updatedAt: Date; email: string;
                 emailVerified: boolean; name: string; image?: string | null }
  sessionSchema = { id: string; createdAt: Date; updatedAt: Date; userId: string;
                    expiresAt: Date; token: string; ipAddress?; userAgent? }
  ```
  Donc **`session.user.id` est une `string`**. C'est la valeur à utiliser comme clé de filtrage côté serveur.
- **Nom de la table de synchronisation dans le schéma `neon_auth` : introuvable.** `grep -rn "neon_auth" dist/ llms.txt` ne remonte qu'une constante sans rapport (`NEON_AUTH_SESSION_VERIFIER_PARAM_NAME = "neon_auth_session_verifier"`). Ni le `.d.mts`, ni `llms.txt`, ni le `package.json` ne nomment de table ni de clé primaire. Point ouvert, à charge de s02 (voir Open questions).

### Drizzle ORM 0.45.2 — vérifié dans `node_modules/drizzle-orm/`

- `pg-core/columns/numeric.d.ts` lignes 97-98 :
  ```ts
  declare function numeric<TName extends string, TMode extends 'string'|'number'|'bigint'>(
    name: TName, config?: PgNumericConfig<TMode>
  ): … Equal<TMode,'number'> extends true ? PgNumericNumberBuilderInitial<TName> : …
  ```
  `PgNumericConfig` (ligne 84) = `{ precision, scale?, mode? } | { precision?, scale, mode? } | { precision?, scale?, mode }`. `decimal` est un alias de `numeric` (ligne 99).
- Comportement d'exécution confirmé dans `pg-core/columns/numeric.js` : `PgNumeric.mapFromDriverValue` renvoie **une chaîne** ; `PgNumericNumber.mapFromDriverValue` fait `Number(value)` et `mapToDriverValue = String`. **Sans `mode: "number"`, les valeurs arrivent en `"72.40"`** — exactement le piège de l'ADR 004.
- `pg-core/columns/enum.d.ts` ligne 82 : `pgEnum<U extends string, T extends Readonly<[U, ...U[]]>>(enumName: string, values: T | Writable<T>): PgEnum<Writable<T>>`.
- `pg-core/table.d.ts` ligne 94 : `declare const pgTable: PgTableFn`. Le 3e paramètre sous forme d'**objet est déprécié** ; la nouvelle API attend un **tableau** : `(t) => [ index(...).on(t.id) ]`.
- `pg-core/db.d.ts` lignes 198-199 : `selectDistinctOn(on: (PgColumn|SQLWrapper)[]): PgSelectBuilder<undefined>` et `selectDistinctOn<TSelection>(on, fields: TSelection)`. **La requête « première valeur par mesure » de l'ADR 004 a donc un équivalent Drizzle natif**, pas besoin de SQL brut.
- `pg-core/unique-constraint.d.ts` ligne 4 : `unique(name?: string): UniqueOnConstraintBuilder` — pour la contrainte `(session_id, kind)`.

### shadcn/ui — registre interrogé réellement (`./node_modules/.bin/shadcn view …`)

Le registre est joignable depuis cet environnement (réseau OK). Exports **relevés dans le contenu réel** des items du preset `radix-nova` :

| Item | Exports | À noter |
|---|---|---|
| `card` | `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardAction`, `CardDescription`, `CardContent` | `Card` accepte `size?: "default" \| "sm"` ; espacement piloté par `--card-spacing` ; `CardTitle` porte la classe `cn-font-heading` |
| `empty` | `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`, `EmptyMedia` | `EmptyMedia` a une variante `icon` ; `Empty` a `border-dashed` **sans classe de largeur de bordure** → aucune bordure visible tant qu'on n'ajoute pas `border` |
| `skeleton` | `Skeleton` | une seule primitive, `animate-pulse rounded-md bg-muted` |
| `button` | `Button`, `buttonVariants` | prop `asChild` (via `Slot` de `radix-ui`) → indispensable pour envelopper un `<Link>`. Tailles : `default` = `h-8`, `sm` = `h-7`, `lg` = `h-9`, `icon` = `size-8` |

Installation : `npx shadcn@latest add card empty skeleton button` (le binaire local `./node_modules/.bin/shadcn` v4.16.1 fonctionne aussi).

`lucide-react` installé en **1.28.0** (vérifié via `require('lucide-react/package.json').version`) — pas la série `0.x` habituelle.

## Traps & constraints

**1. Toutes les dépendances de la story sont manquantes.** s06 suppose s03 (mesures), s04 (IMC), s05 (tap unique) livrés. Aucune ne l'est, et s01/s02 non plus. Il n'y a ni schéma, ni session, ni route protégée, ni formulaire de saisie vers lequel pointer le « tap unique ». C'est le premier fait à trancher au plan : s06 n'est pas implémentable en l'état sans réordonner le pipeline.

**2. Aucun accès base ni credentials.** Pas de `.env`, pas de `DATABASE_URL`, pas de CLI Neon ni Vercel. Impossible de générer/appliquer une migration, de vérifier la table `neon_auth`, ou de faire tourner un e2e authentifié. Toute vérification de bout en bout est hors de portée ici.

**3. Le design de la silhouette n'existe pas.** `docs/design-system.md` § « Gaps connus » point 1 : « Le dessin de la silhouette — proportions, découpe des zones, position des étiquettes. Décidé en `/ks-design s06` ». `docs/designs/` est vide. **`/ks-design` doit passer avant `/ks-plan`**, sinon l'implémenteur improvisera un SVG hors système.

**4. Le référentiel du delta ne se mémorise pas.** Le delta se calcule contre la **première mesure enregistrée pour ce `kind`**, jamais contre la session précédente ni une valeur stockée. s09 (`docs/stories.md` ligne 252) verrouille ce point : « corriger ou supprimer la *première* session change le référentiel de tous les deltas de la silhouette. Une implémentation qui mémorise la première mesure quelque part se désynchronise ici. » La lecture doit donc être une requête (`DISTINCT ON (kind) … ORDER BY kind, measured_on ASC`), pas un champ.

**5. `delta < 0 ? vert : rouge` est interdit.** Design system § Do/Don't : le sens favorable est une propriété déclarée par mesure. Les tokens existent déjà (`--progress-favorable`, `--progress-adverse`), les utilitaires attendus sont `text-progress-favorable`, `fill-progress-favorable`, `stroke-progress-adverse`.

**6. La couleur ne porte jamais l'information seule.** Chaque zone affiche sa valeur **et** son delta signé en texte (`-4,2 cm`, virgule décimale française). ~8 % des hommes ont une déficience rouge-vert : le texte doit suffire sans la couleur.

**7. Trois états de zone distincts, pas deux.** Aucune mesure → `--muted`, pas de delta, pas de couleur (critère 4). Une seule mesure → valeur affichée, pas de delta, pas de couleur (critère 5). Deux mesures ou plus → valeur + delta + couleur. Un test doit couvrir les trois.

**8. 7 zones sur la silhouette, 10 `kind` + IMC au total.** Zones : poitrine, biceps, taille, hanches, cuisse, mollet, épaules. **Hors silhouette** (critère 3, en `card`) : `weight_kg`, `body_fat_pct`, `muscle_pct` et l'IMC. L'IMC est **dérivé à la lecture** de `profiles.height_cm` et du poids de la session — jamais stocké (ADR 004, story s04, architecture ligne 104). Sans taille renseignée, pas d'IMC affiché du tout (s04 critère 2).

**9. `numeric` en chaîne.** Voir Verified APIs : sans `mode: "number"`, les deltas et les couleurs se calculent sur des chaînes. L'ADR 004 exige de le fixer dans `schema.ts` **et** de le couvrir par un test.

**10. Le projet Playwright `mobile` fait 390 px, pas 375.** Vérifié : `devices["iPhone 13"].viewport = { width: 390, height: 664 }`. Le critère 7 est écrit à **375 px**. La spec e2e doit fixer explicitement le viewport (`test.use({ viewport: { width: 375, … } })` ou `page.setViewportSize`), sinon le critère est coché à côté de la cible.

**11. Le navigateur WebKit de Playwright n'est pas installé.** `~/Library/Caches/ms-playwright` ne contient que `chromium-1228`, `chromium_headless_shell-1228`, `ffmpeg-1011`. Or `devices["iPhone 13"].defaultBrowserType === "webkit"`. Il faut `npx playwright install webkit` avant toute exécution du projet `mobile`.

**12. `npm run check` est rouge avant même de commencer** (`vitest run` sort en 1 sans fichier de test). Ce n'est pas une régression introduite par la story ; à mentionner en review pour éviter un faux positif.

**13. jsdom ne mesure aucune mise en page.** Le critère 7 (pas de défilement horizontal, pas de débordement) n'est **pas** vérifiable en Vitest — c'est du Playwright, conformément à l'ADR 005. Un test jsdom qui prétendrait le couvrir serait une hallucination de couverture.

**14. Le plancher d'étiquette passe par la classe, pas par un attribut SVG.** L'utilitaire `text-label-min` vient de `--text-label-min: var(--label-min-size)` dans `@theme inline`. Un `<text font-size="10">` dans le SVG contournerait le token et violerait à la fois le critère 7 et la règle « pas de valeur arbitraire ».

**15. Cible de tap sous le seuil iOS.** Le critère 8 (un tap vers la saisie) se réalise avec `<Button asChild><Link …>`. Or `Button` du preset fait `h-8` (32 px) par défaut et `h-9` (36 px) en `size="lg"` — sous les 44 px recommandés sur iOS. Le design system ne couvre pas la taille de cible tactile : c'est un **design system gap** à remonter, pas à combler par une classe arbitraire.

**16. Le rendu peut rester 100 % Server Component.** Aucun critère de s06 n'exige d'interactivité côté client : SVG statique, valeurs, deltas, un lien. `"use client"` n'est pas justifié ici (architecture : « `"use client"` seulement là où l'interactivité l'impose — les formulaires de saisie et les graphes »). En revanche, lire la session impose `export const dynamic = 'force-dynamic'` sur la page (exigence du package Neon Auth) : la page cesse d'être statique, ce que la sortie de build reflétera.

**17. `loading.tsx` ne joue son rôle que si la session est lue dans la page, pas dans le layout.** Documenté explicitement dans `loading.md` (voir Verified APIs). Le design system interdit le spinner plein écran pendant le cold start Neon (~500 ms) et impose un `skeleton` à la forme du contenu.

**18. Deux anomalies préexistantes du shell, à ne pas prendre pour du travail de s06 :**
   - `@theme inline` déclare `--font-sans: var(--font-sans)` (auto-référence) alors que `layout.tsx` expose la variable sous le nom `--font-geist-sans`. La chaîne n'est pas branchée ; `font-sans` sur `<html>` ne résout rien. `--font-mono: var(--font-geist-mono)` est correct.
   - La classe `cn-font-heading` utilisée par `CardTitle` et `EmptyTitle` n'est définie nulle part dans `node_modules/shadcn/dist/tailwind.css` (629 lignes, vérifiées) : elle est sans effet.
   Ces deux points relèvent du shell (s01) ; les signaler, ne pas les corriger en douce dans le diff de s06.

**19. La classe `dark` n'est posée sur `<html>` par personne.** Le design system (§ Thème) attribue cette tâche au shell s01 via un script inline avant peinture. `layout.tsx` ne la pose pas. Le critère « vérifier en clair **et** en sombre » de s06 n'est donc pas testable tant que ce point n'est pas livré.

**20. Contraintes de dépôt à ne pas enfreindre** : `src/components/ui/` est généré, jamais édité à la main ; aucune couleur en dur ni valeur arbitraire ; **ne jamais installer `@vitejs/plugin-react`** (AGENTS.md et ADR 005 : conflit `@babel/core@8.0.0-rc` avec `shadcn`) ; `neon_auth` hors de portée de Drizzle (`schemaFilter: ["public"]`) ; travail sur `feature/s06-body-map` uniquement, et exécution seulement si `docs/plans/s06-body-map.md` porte `validated: yes`.

**21. Pas de zone cliquable.** Story ligne 178 : « la navigation par le corps a été écartée au profit de la version étiquettes seules. Ne pas l'ajouter spontanément. » Le tap unique passe par un élément dédié, pas par le SVG.

## Open questions

1. **Nom et clé primaire de la table de synchronisation `neon_auth`.** Non trouvés dans `@neondatabase/auth@0.4.2-beta` (dist, `llms.txt`, `package.json`), et sans `DATABASE_URL` on ne peut pas interroger la base. `better-auth` type l'`id` utilisateur en `string`, mais le type SQL réel de la colonne (`text` ? `uuid` ?) reste inconnu — or c'est la clé étrangère de `profiles` et `measurement_sessions`. À trancher en `/ks-research s02`, pas ici.
2. **Où déclarer le sens « favorable » par `kind`.** L'architecture dit « dans le domaine » sans nommer de fichier, et aucun module `lib` n'existe. À fixer au plan (nommage kebab-case imposé).
3. **Sens favorable de `body_fat_pct` et `muscle_pct`.** Jamais écrit noir sur blanc dans le PRD, les stories ou le design system. L'intuition (masse grasse ↓ favorable, masse musculaire ↑ favorable) est plausible mais non sourcée — et le PRD interdit tout avis médical. À confirmer avec l'utilisateur.
4. **Sens favorable du poids.** Le poids a une cible (s08) mais s06 l'affiche hors silhouette. Faut-il le colorer, et selon quoi (direction déclarée ? écart à la cible, qui n'existe qu'en s08 ?) ? Non spécifié.
5. **Traitement du delta nul.** Un delta exactement à 0 est-il neutre, favorable, ou masqué ? Aucun critère ne le dit. Existe-t-il un seuil de bruit sous lequel on n'affiche pas de couleur ? Non spécifié.
6. **Format d'affichage.** Nombre de décimales par unité (cm, kg, %), format du delta signé (`-4,2 cm` est le seul exemple donné), affichage du `+` pour un delta positif, séparateur décimal français. Non fixés.
7. **Géométrie de la silhouette** : proportions, découpe des 7 zones, ancrage des étiquettes, `viewBox`, comportement à 375 px avec 7 étiquettes ≥ 12 px. C'est le gap n°1 du design system → `/ks-design s06`.
8. **Libellé et cible de l'état initial** (critère 9) : texte de l'`Empty`, intitulé du CTA, et si la silhouette est affichée en gris derrière ou totalement remplacée. Non spécifié.
9. **Cible du tap unique** (critère 8) : la route du formulaire de saisie n'existe pas ; son chemin est décidé par s03/s05.
10. **Comment la page obtient l'utilisateur non authentifié** : redirection par `proxy.ts` (s02) ou garde dans la page elle-même ? Les deux mécanismes sont documentés côté Neon Auth ; le choix appartient à s02 et conditionne le comportement de s06.
11. **Base de test** pour les tests d'accès et les e2e authentifiés — trou connu de l'ADR 005, explicitement renvoyé à `/ks-research s03`.
12. **Sort des fichiers `src/app/zprobe*`** non versionnés (voir Current state) : nettoyage, ou propriété d'une autre story en cours ?
