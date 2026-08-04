# Review — s02-connect-magic-link

Branche : `feature/s02-connect-magic-link` (empilée sur `feature/s01-deploy-skeleton`, non mergée).
Diff jugé : `git diff feature/s01-deploy-skeleton...feature/s02-connect-magic-link`, hors documents de plan s03..s10.

## Ce que le reviewer a exécuté lui-même

| Commande | Résultat |
|---|---|
| `npm --prefix morpho run check` | **vert** — typecheck + eslint + 13 fichiers de test, **47 tests passés**. Inclut un `rm -rf .next && next build` réel (`src/build-leak.test.ts`). |
| `npm --prefix morpho run check:leak` | **vert** — scan du build peuplé par `.env.local`, aucune occurrence de `postgres://`, de la connection string, de l'hôte ni du mot de passe. |
| Scan manuel de `.next/` pour `NEON_AUTH_COOKIE_SECRET` | **0 occurrence** sur 260 fichiers. |
| `next build` sans secrets, dans un worktree isolé | **code actuel : build OK.** |
| Même build, avec le code d'exemple du plan | **échec reproduit** (voir déviation 1). |

Le worktree d'expérimentation a été supprimé, `git status` propre, aucun fichier du dépôt modifié.

## Les deux déviations déclarées — vérifiées, justifiées

**Déviation 1 (`getAuth()` hors du scope module) : fondée, le plan avait tort.** Reproduction exacte, sans secrets :

```
  Collecting page data using 7 workers ...
Error: Missing required config: cookies.secret. You must provide the cookie secret in the config object.
    at Object.<anonymous> (.next/server/app/api/auth/[...path]/route.js:6:3)
> Build error occurred
Error: Failed to collect page data for /api/auth/[...path]
```

Le code d'exemple du plan (tâche 4, `export const { GET, POST } = getAuth().handler()`) — qui est aussi celui de la doc du SDK (`index.mjs:1774`) — casse `next build` dès que `NEON_AUTH_COOKIE_SECRET` n'est pas peuplé, parce que `createNeonAuth()` appelle `validateCookieConfig()` de façon synchrone (`index.mjs:1037-1041`) et que « Collecting page data » importe tous les modules de route. Le code livré passe. Même invariant que `getSql()`/`getDb()` de s01.

**Déviation 2 (idem dans `src/proxy.ts`)** : même cause, même remède, cohérent.

## Le matcher du proxy — les deux directions tiennent

`"/((?!_next/static|_next/image|favicon.ico|api/(?!auth)).*)"`, vérifié contre `SKIP_ROUTES` du SDK (`index.mjs:1572-1580`) :

- **Ne casse pas l'AC 6** : `/api/health` et `/api/session` sont hors matcher — le proxy ne s'exécute pas, le handler de s01 produit son 401 lui-même. `neonAuthMiddleware` ne renvoie jamais 401, seulement `NextResponse.redirect` (`index.mjs:1640-1648`).
- **Pose bien les cookies** : `/`, `/auth/callback` et `/api/auth/**` sont dans le matcher. L'échange de session (`index.mjs:1392-1438`) s'exécute **avant** le filtre `skipRoutes`, donc il fonctionne aussi sur les routes exemptées.
- `src/proxy.test.ts` n'affirme pas le matcher à la main : il l'évalue avec `unstable_doesMiddlewareMatch` de Next (l'export réellement présent en 16.2.12 — le nom `unstable_doesProxyMatch` de la doc embarquée n'existe pas), et discrimine (`true` **et** `false`).
- Écart mineur assumé : le plan demandait d'exclure `public/`, absent du matcher. `morpho/public/` n'existe pas — vérifié. Le commentaire pose la consigne pour la story qui en créera un.

## Pas d'API hallucinée

Chaque symbole du diff ouvert dans le paquet installé : `authApiHandler` et sa signature à `params` awaité (`index.mjs:1358-1381`), `middleware({ loginUrl })` (`:1802-1806`), `createAuthClient()` sans argument, `signIn.magicLink` (`:1235`), `signOut`, `cookies.sameSite` avec son défaut `'strict'` (`:1614`) — ADR 008 tient.

**`errorCallbackURL` / paramètre `error` : la lecture de better-auth est juste**, ce n'était pas une inférence heureuse. `better-auth/dist/plugins/magic-link/index.mjs:112-115` :

```js
function redirectWithError(error) {
    errorCallbackURL.searchParams.set("error", error);
    throw ctx.redirect(errorCallbackURL.toString());
}
```

appelé avec `INVALID_TOKEN` (`:120`) et `EXPIRED_TOKEN` (`:123`).

**`afterEach(cleanup)` : la justification est vraie.** `@testing-library/react/dist/index.js:26` fait `if (typeof afterEach === 'function')` et `vitest.config.mts` ne pose pas `test.globals: true` — l'auto-cleanup ne s'enregistrait jamais.

## Sécurité — rien à redire

Aucun `NEXT_PUBLIC_` dans le diff. `authClient` ne touche à aucun secret et retombe sur `/api/auth`. L'identité serveur vient exclusivement de `getAuth().getSession()` ; `/api/session` n'accepte **aucun** paramètre. Aucun `input[type=password]` — pinné par un test qui interroge le DOM. Aucun import de `@neondatabase/auth/react/ui`. `.env*` gitignoré, aucun secret dans le diff.

## Design system — conforme

`src/components/ui/` n'apparaît que dans le commit d'installation CLI et n'a jamais été retouché. `h-11` sur le champ email et les trois boutons du parcours de capture. Aucune couleur littérale. L'état « lien envoyé » est un **remplacement d'écran** composé avec `empty`, pas un toast — et le test le prouve en assertant la **disparition du champ**, pas seulement l'apparition du titre.

## Findings

### 1 — major — La story n'est pas vérifiée de bout en bout

Tâches 8 et 9 décochées, à raison. Conséquence à consigner sans l'adoucir : **les AC 2, 3, 5 et 7 ne sont vérifiés par rien** — ni test, ni exécution. L'AC 6 ne l'est que sur sa moitié 401. L'AC 8 est structurellement acquis par lecture mais le test de forgery de la tâche 9 n'existe pas. **La boucle magic link → clic → cookies → session n'a jamais tourné une seule fois**, et c'est le cœur de la story.

La qualité du reporting est bonne — cases non cochées, commentaires marquant ce qui reste non confirmé, aucune sur-affirmation. Ce qui est périmé, c'est la DoD du plan, écrite comme si tout était fait. Le merge ne rend pas ces critères vrais.

### 2 — minor — Le plan n'a pas été corrigé là où il s'est révélé faux

Le plan prescrit toujours `export const { GET, POST } = getAuth().handler()`, forme dont le build cassé a été reproduit, et la case est cochée. La review de s01 a établi le précédent inverse : « c'est la décision qui était fausse, et elle a été corrigée avec le code ». Ici le code l'a été, le plan non. Un futur lecteur réintroduira le bug.

### 3 — minor — Dérive documentaire résiduelle sur `users_sync`

La décision 1 du plan est corrigée, mais **dans le même fichier** la Test strategy et la DoD réclament toujours « la confirmation de `neon_auth.users_sync` » — une table dont le plan affirme trois paragraphes plus haut qu'elle n'existe pas. La DoD conditionne la fin de la story à un fait faux.

*Note de procédure :* l'ADR 003 a été modifié en place alors qu'`AGENTS.md` déclare les ADR immuables. Correction d'un fait erroné et non d'une décision, tracée par un ⚠️ : défendable, signalé pour que le choix soit conscient. Même remarque pour l'ADR 011, de scope `framing`, commité sur une branche de story.

### 4 — minor — Le contrôle anti-fuite ne couvre pas le secret introduit par cette story

`src/build-connection-leak.check.ts` ne cherche que `DATABASE_URL` et ses composants. s02 introduit un second secret serveur (`NEON_AUTH_COOKIE_SECRET`) **et** une première page prérendue statiquement (`/auth/sign-in`, `○` dans la sortie de build) embarquant un composant `"use client"` — exactement la forme du Trap 3 que ce fichier documente en commentaire. Vérifié à la main : 0 occurrence sur 260 fichiers, donc **aucun problème réel aujourd'hui**. Ce qui manque, c'est l'aiguille dans le jeu de tests, sans quoi la prochaine story ne verra pas la régression.

### 5 — minor — La Test strategy promet du Playwright, le diff n'en livre pas

`tests/` ne contient aucun fichier suivi : `npm run test:e2e` n'exécute rien pour cette story. Impact réel faible — les mêmes états sont couverts en jsdom, et [ADR 011](../decisions/011-e2e-session-via-verification-table.md) met en place le mécanisme de session Playwright pour la suite — mais c'est un écart au plan, à décider et non à subir.

### 6 — minor — `LogoutButton` ignore l'échec de `signOut()`

Le retour `{ data, error }` n'est pas lu et `isSigningOut` n'est jamais remis à `false`. Si `signOut()` échoue, l'utilisateur est envoyé sur l'écran de connexion **avec sa session toujours vivante** : la déconnexion a l'air d'avoir réussi, et l'AC 5 serait faux dans ce cas. Le chemin nominal est correct ; c'est la branche d'erreur qui ment. `SignInScreen` traite bien la sienne — l'asymétrie se voit.

### 7 — minor — `trusted_origins: []` vs `callbackURL` absolu : le piège qui attend la tâche 8

Le plugin magic link applique `originCheck` aux trois URL (`better-auth/dist/plugins/magic-link/index.mjs:2,84-90`), et l'ADR 003 relève en base `trusted_origins: []` avec `allow_localhost: true`. En local ça passera ; sur l'origine déployée, non — et le symptôme sera « le lien ne fait rien », le pire à diagnostiquer. À ajouter au protocole de la tâche 8 : déclarer l'origine de production dans la console Neon **avant** de conclure quoi que ce soit d'un échec.

*Observation annexe :* l'état « lien envoyé » ne vit qu'en state React. Il survit à l'aller-retour vers le client mail dans le même onglet — ce que demande le design — mais pas à une éviction d'onglet par iOS, qui ramènerait un formulaire vide sans explication. À constater lors du test réel plutôt qu'à corriger à l'aveugle.

## Verdict

Aucun finding critical : rien dans ce diff n'invente une API, n'introduit de faille, ni ne casse le comportement existant. Les deux affirmations les plus à risque — le build sans secrets et le mécanisme `error` — ont été vérifiées contre les paquets installés et par exécution, et les deux tiennent. Le major porte sur ce qui n'a **pas pu** être vérifié, pas sur ce qui a été écrit.

Max severity: major
Ship allowed: yes
