---
validated: yes
---
# Plan — Story s02-connect-magic-link

Branch: `feature/s02-connect-magic-link`

## Target story

**As a** propriétaire de morpho **I want** me connecter par un lien reçu par email **so that** mes données soient rattachées à moi plutôt qu'à mon téléphone. — Complexity 3.

Critères d'acceptation (verbatim `docs/stories.md`) :

1. Un visiteur non authentifié qui ouvre l'app arrive sur un écran de connexion demandant uniquement une adresse email.
2. Soumettre une adresse email valide déclenche l'envoi d'un magic link et affiche un état « lien envoyé » ; aucun mot de passe n'est demandé à aucun moment.
3. Ouvrir le magic link ouvre une session authentifiée et affiche un écran authentifié provisoire portant au minimum l'email connecté et le bouton de déconnexion.
4. Une session active survit à un rechargement complet de la page.
5. Le bouton de déconnexion termine la session ; l'écran suivant est celui de connexion, et un rechargement ne restaure pas la session terminée.
6. La route protégée de s01 répond en succès avec une session valide, et continue de répondre 401 sans session.
7. L'utilisateur authentifié existe en base avec un identifiant stable, réutilisable comme clé étrangère par les stories suivantes.
8. L'identité utilisée côté serveur provient du token vérifié, jamais d'un identifiant envoyé par le client.

## Décisions de plan

Les questions ouvertes de `docs/research/s02-connect-magic-link.md` sont tranchées ici.

| # | Question | Décision |
|---|---|---|
| 1 | Table utilisateurs de `neon_auth` | **Résolue par requête sur la base réelle.** C'est `neon_auth."user"`, **PK `id` en `uuid`**. ⚠️ *Une première rédaction annonçait `neon_auth.users_sync` en `text`, d'après le helper `drizzle-orm/neon/neon-auth.js` — cette table n'existe pas ici. Le helper décrit l'ancien Neon Auth ; la beta pose le schéma Better Auth complet dans `neon_auth` (`user`, `session`, `account`, `verification`, `jwks`, `project_config`, plus l'organisation, inutilisée).* `user` est un mot réservé SQL et se cite toujours. Pas de `deleted_at` : la suppression n'est pas logique. |
| 3 | `sameSite: 'strict'` survit-il au clic depuis un client mail ? | **Non, on ne parie pas dessus : `sameSite: 'lax'` explicite.** Un magic link cliqué depuis une boîte mail est une navigation top-level cross-site ; un cookie `Strict` n'est pas renvoyé, donc le cookie de challenge manque et la session ne se matérialise jamais. `'lax'` est supporté par le SDK et correspond à son comportement historique. **Arbitrage de sécurité → ADR 008**, écrit sur la branche (tâche 2). |
| 4 | `__Secure-` sur `http://localhost:3000` ? | Développer l'auth en HTTPS local : `next dev --experimental-https`. Le préfixe `__Secure-` impose une origine sécurisée ; parier sur la tolérance d'un navigateur est exactement le piège qui fait croire pendant des heures que « la session ne marche pas ». `playwright.config.ts` suit via `E2E_BASE_URL`. |
| 5 | Comment tester le flux de bout en bout ? | **Pas d'automatisation du mail.** Le paquet n'expose aucun mode « retourner le lien dans la réponse ». Vitest couvre la validation d'email, les états d'écran et les gardes de handler avec `getSession()` mocké ; Playwright couvre les états d'écran. Le trajet réel — envoi, clic, session, déconnexion — est **vérifié manuellement et le protocole est consigné dans la review**. Ne pas simuler un flux qu'on ne teste pas : un test vert qui ne prouve rien est pire que pas de test. |
| 6 | s01 avant s02, ou s02 absorbe s01 ? | **s01 d'abord.** L'AC 6 teste explicitement un artefact de s01. Aucune absorption. |
| 2 | Où pointe l'URL de l'email ? | À constater à la tâche 8, avec un vrai email. Le `callbackURL` passé à `signIn.magicLink` est **absolu et pointe vers l'app** (comportement lu dans `MagicLinkForm` du paquet officiel). Le `matcher` du proxy doit couvrir la route de retour, sinon les cookies ne sont jamais posés. |
| 8 | `field`/`label` en s02 ou s03 ? | **s02** — corrigé dans `docs/design-system.md`. Le pattern « jamais un `input` nu » s'applique dès le premier formulaire, qui est celui-ci. |
| 9, 10 | État « lien envoyé », lien expiré, shell | État « lien envoyé » et lien expiré : traités par `docs/designs/s02-connect-magic-link.md`. Shell (`lang="fr"`, script de thème, purge du boilerplate) : **attribué à s01**, pas à s02. |

### Ce que s02 ne fait pas

Les composants UI officiels de Neon Auth (`@neondatabase/auth/react/ui` → `MagicLinkForm`, `AuthView`…) **ne sont pas utilisés**. Ils embarquent leur propre CSS, leurs propres tokens et leurs textes anglais — une seconde source de vérité visuelle, ce que `docs/design-system.md` interdit. Leur code sert de référence de comportement, pas de composant à monter.

## Préalables externes — bloquants

- Projet Neon Auth provisionné, **provider magic link activé côté console**, gabarit d'email, URLs de callback autorisées. Rien de tout cela n'est visible depuis le dépôt ni pilotable sans CLI.
- `NEON_AUTH_BASE_URL` et `NEON_AUTH_COOKIE_SECRET` (≥ 32 caractères, `openssl rand -base64 32`). Sans secret, `createNeonAuth()` lève **au chargement du module**, donc toute requête échoue — y compris le rendu de l'écran de connexion.
- Une adresse email atteignable pour recevoir le lien.
- s01 mergée.

Tâches 1 à 7 exécutables sans ces accès. Tâches 8 et 9 non.

## Tasks (ordered)

1. [x] **Composants du design system.** `npx shadcn@latest add button input label field spinner` — plus ceux que `docs/designs/s02-connect-magic-link.md` désigne. Vérifiable : les fichiers apparaissent sous `src/components/ui/`, `npm run check` reste vert. Ne pas les éditer à la main.
2. [x] **ADR 008 — `sameSite: 'lax'` pour les cookies de session.** `docs/decisions/008-auth-cookies-samesite-lax.md`, format MADR, avec l'option `'strict'` et pourquoi elle est rejetée (le magic link est une navigation cross-site). Commité sur la branche.
3. [x] **Instance d'auth configurée.** Compléter `src/lib/auth.ts` (créé en s01) : `cookies.sameSite: 'lax'`, `sessionDataTtl` déclaré explicitement plutôt que subi, `logLevel` maîtrisé. Test Vitest : la configuration produite porte bien `sameSite: 'lax'` ; un secret trop court lève une erreur explicite.
4. [x] **Handler d'auth.** `src/app/api/auth/[...path]/route.ts` : appeler `getAuth().handler()` **par requête, à l'intérieur de chaque export `GET`/`POST`**, jamais au chargement du module. `params` est une `Promise` en Next 16. Test Vitest : les deux verbes sont exportés et sont des fonctions. ⚠️ *Première rédaction : `export const { GET, POST } = getAuth().handler()` au chargement du module — c'est aussi l'exemple documenté par le SDK (`node_modules/@neondatabase/auth/dist/next/server/index.mjs:1698-1701`). Faux ici : `createNeonAuth()` valide `cookies.secret` de façon synchrone, et « Collecting page data » importe tous les modules de route pendant `next build` — donc cette forme casse le build dès que `NEON_AUTH_COOKIE_SECRET` n'est pas peuplé, sur n'importe quelle machine sans secrets : `Error: Missing required config: cookies.secret. You must provide the cookie secret in the config object.` (reproduit par la review, `docs/reviews/s02-connect-magic-link.md`). Même invariant que `getSql()`/`getDb()` de s01.*
5. [x] **Proxy.** `src/proxy.ts` (Next 16 : plus `middleware.ts`), appeler `getAuth().middleware({ loginUrl })` **à l'intérieur de la fonction `proxy()` exportée**, jamais au chargement du module, avec un **`matcher` négatif** excluant `_next/static`, `_next/image`, `public/` et **les routes d'API hors `/api/auth`**. Deux raisons cumulées : le middleware **redirige (307)** au lieu de renvoyer 401 — il casserait l'AC 6 ; et un matcher trop large multiplie les appels réseau sur chaque navigation, ce que le budget de 20 s de s05 ne supporte pas. Le `matcher` doit **inclure** la route de retour du lien, sans quoi les cookies ne sont jamais posés. Test Vitest : le matcher exclut `/api/health` et `/api/session`, inclut la route de retour. ⚠️ *Même piège qu'à la tâche 4 : construire l'instance d'auth au chargement du module (p. ex. `export default getAuth().middleware({ loginUrl })` au niveau module) lève au chargement dès que `NEON_AUTH_COOKIE_SECRET` n'est pas peuplé, cassant `next build` de la même façon. Reconnu et évité dès l'implémentation (commit `757a172`) : `getAuth()` est appelé à l'intérieur de `proxy()`, pas au niveau module.*
6. [x] **Écran de connexion.** Route publique, un seul champ email en `field`, validation Zod côté client, appel `authClient.signIn.magicLink({ email, callbackURL })`. État « lien envoyé » **persistant** (l'utilisateur quitte l'app pour son client mail — un toast ne suffit pas). Cas du lien expiré ou déjà consommé : message clair, jamais une page blanche. Aucun champ mot de passe nulle part. Tests Vitest : email invalide → erreur sous le champ, aucun appel réseau ; email valide → appel émis puis état « lien envoyé » ; le DOM ne contient aucun `input[type=password]`.
7. [x] **Écran authentifié provisoire et déconnexion.** Server Component en `export const dynamic = "force-dynamic"`, affichant l'email de `session.data.user.email` et un bouton de déconnexion appelant `signOut()`. **Placeholder assumé** : s06 le remplace intégralement, ne rien y investir. Tests Vitest : sans session → redirection vers la connexion ; avec session → l'email s'affiche ; la déconnexion appelle bien `signOut`.
8. [ ] **Vérification sur services réels.** *(exige les préalables)* **Avant tout test en environnement déployé : déclarer l'origine de production dans `trusted_origins` de la console Neon.** Le plugin magic-link applique `originCheck` aux trois URL qu'il gère — `callbackURL`, `errorCallbackURL`, `newUserCallbackURL` (`better-auth/dist/plugins/magic-link/index.mjs:2,84-90`) — et `neon_auth.project_config` relève `trusted_origins: []` avec `allow_localhost: true`. En local ça passe donc sans rien déclarer ; sur une origine déployée, non, tant qu'elle n'est pas ajoutée. Le symptôme n'est pas une erreur visible : **le lien ne fait rien**, ce qui est le pire cas à diagnostiquer à l'aveugle — ne pas conclure à un bug avant d'avoir vérifié `trusted_origins`. Ensuite : envoi et clic d'un vrai magic link ; session active ; rechargement → toujours connecté ; déconnexion → écran de connexion, et un rechargement ne la restaure pas. Puis confirmer la table par requête : `SELECT table_name FROM information_schema.tables WHERE table_schema='neon_auth';` et ses colonnes. Constater où pointe réellement l'URL de l'email. Protocole et résultats consignés dans la review.
9. [ ] **Régression de s01 et non-forgery.** *(exige les préalables)* `/api/session` répond 200 avec session valide et toujours 401 sans. Test d'AC 8 : aucun paramètre client (`?user_id=`, corps JSON, en-tête) n'influence l'identité retenue — seul `session.data.user.id` compte.

## Files touched

```
morpho/src/components/ui/*             générés par la CLI shadcn
morpho/src/lib/auth.ts                 complété — sameSite lax, sessionDataTtl
morpho/src/app/api/auth/[...path]/route.ts   créé
morpho/src/proxy.ts                    créé — matcher négatif
morpho/src/app/(auth)/…                créés — écran de connexion + états
morpho/src/app/page.tsx                modifié — écran authentifié provisoire
morpho/src/**/*.test.ts(x)             créés
morpho/docs/decisions/008-auth-cookies-samesite-lax.md   créé
```

## Test strategy

**Vitest** — validation d'email, états d'écran, gardes de handler avec `getSession()` mocké, contenu du `matcher`, absence de champ mot de passe.

**Playwright — pas dans cette story.** ⚠️ *Première rédaction : parcours jusqu'à l'état « lien envoyé », et écran authentifié avec session injectée, en laissant le clic sur le lien réel non automatisé. Faux à l'usage : `tests/` ne contient aucun fichier suivi pour s02, `npm run test:e2e` n'exécute donc rien pour cette story — un écart constaté par la review (finding 5), non un renoncement discret. Les mêmes états sont déjà couverts en jsdom par Vitest ci-dessus. La couverture navigateur arrive avec le mécanisme de session posé par [ADR 011](../decisions/011-e2e-session-via-verification-table.md) (`globalSetup` lisant le jeton dans `neon_auth.verification`) — dont la question ouverte (forme exacte de `value`, brute ou hachée) reste à confirmer avant qu'une story en dépende. Décision consciente, pas un manque subi : pas de spec Playwright écrite pour s02.*

**Manuel, consigné en review** — le trajet complet du magic link, la confirmation de `neon_auth."user"` (PK `id` en `uuid` — décision 1 ci-dessus), et les réglages de la console Neon (provider activé, URLs de callback), invisibles depuis le dépôt.

Piège à garder en tête pendant les tests : `sessionDataTtl` vaut 300 s par défaut. Tant que le cookie de cache est valide, `getSession()` **ne consulte pas Neon** — une session révoquée à distance reste localement valide jusqu'à expiration. Le chemin nominal de `signOut()` supprime bien les cookies ; c'est le cas indirect qui trompe.

## Definition of Done

- `npm run check` vert.
- AC 1 à 5 vérifiés de bout en bout sur services réels, protocole consigné. AC 6 à 8 couverts par des tests automatisés **plus** une vérification réelle.
- L'identité serveur ne vient jamais du client — prouvé par un test de forgery, pas par relecture.
- `neon_auth."user"` confirmée sur la base réelle : c'est ce qui débloque s03.
- ADR 008 commité sur la branche.
- Aucun secret dans le diff. Aucun composant UI Neon Auth importé.
