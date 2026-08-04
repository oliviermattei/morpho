# ADR 019 — Email + mot de passe remplace le magic link

- Status: accepted
- Date: 2026-08-04
- Scope: framing
- Supersedes: le mécanisme de connexion de [ADR 003](003-neon-auth.md) (magic link). Le reste d'ADR 003 — le choix de Neon Auth, le schéma `neon_auth`, la règle « l'identité vient de la session vérifiée » — reste en vigueur.
- Impacte: [ADR 008](008-auth-cookies-samesite-lax.md), [ADR 011](011-e2e-session-via-verification-table.md)

## Context

Le magic link n'a jamais pu être exercé de bout en bout. Il exige une vraie boîte mail et un clic humain, ce qui a deux conséquences que les stories s01 à s10 ont accumulées :

1. **Personne n'a jamais ouvert de session dans cette application.** L'écran de connexion, l'échange de session au retour du lien et l'alerte « lien expiré » n'ont été validés que par des tests jsdom et par lecture du code de Better Auth — jamais contre le service Neon Auth réel. La branche d'erreur en particulier n'avait jamais été jouée (voir Consequences : elle était cassée).
2. **Aucun test e2e authentifié n'existe.** ADR 011 prévoyait un `globalSetup` appelant `signIn.magicLink()` pour de vrai ; il n'a jamais été branché, précisément parce qu'il envoie un email. Les vérifications qui demandent une session — les quatre écrans protégés, la déconnexion, le comportement hors-ligne — sont restées documentées comme « protocole manuel » dans `docs/reviews/s04` à `s10`.

L'angle n°3 du PRD (« pas de mot de passe ») visait l'absence de friction. Sur une application personnelle mono-utilisateur, un gestionnaire de mots de passe supprime cette friction ; une boîte mail à ouvrir à chaque connexion l'ajoute. L'argument s'est retourné.

## Decision

**Email + mot de passe, sur le même Neon Auth.** `authClient.signIn.email()` et `authClient.signUp.email()` remplacent `authClient.signIn.magicLink()` dans `src/components/auth/SignInScreen.tsx`. Un seul écran, deux modes (connexion / création de compte) commutés par un lien.

Rien d'autre ne bouge : même SDK, même route catch-all `/api/auth/[...path]`, même `src/proxy.ts`, même `auth.getSession()`, même schéma `neon_auth`, mêmes cookies. Le plugin `magicLink` reste activé côté serveur — il n'est simplement plus appelé par l'interface. Le rebrancher plus tard ne demande pas de migration.

Vérifié sur le serveur d'auth réel, pas déduit de la documentation (`neon_auth.project_config`) :

```
email_and_password = { "enabled": true, "requireEmailVerification": false,
                       "sendVerificationEmailOnSignUp": false,
                       "sendVerificationEmailOnSignIn": false }
trusted_origins    = [{ "domain": "https://morpho.olm.re" }]
allow_localhost    = true
```

`POST /sign-up/email` retourne 200 avec un jeton de session et le cookie `__Secure-neon-auth.session_token` bien que `emailVerified` soit `false`, et `POST /sign-in/email` sur ce compte retourne 200. **Aucun email n'est envoyé à aucun moment** : c'est ce qui rend le flux testable de bout en bout, ce qui était l'objectif.

## Considered options

- **Réparer le magic link** — rejeté : il n'y a rien à réparer, il n'a jamais été prouvé cassé ni fonctionnel. Le problème est qu'il est *invérifiable* sans boîte mail, et cela ne se corrige pas par du code.
- **Remplacer Neon Auth par Better Auth** (le repli explicitement prévu en fin d'ADR 003) — rejeté, et c'est le point important : Neon Auth **est** Better Auth. Le paquet beta pose le schéma Better Auth dans `neon_auth` et son client enveloppe `better-auth/client`. Migrer aurait signifié reconstruire à la main la synchronisation utilisateurs que Neon fournit, pour arriver à la même bibliothèque. Le repli d'ADR 003 était fondé sur une hypothèse — « si Neon Auth se révèle inutilisable » — que la Research a invalidée : la seule chose inutilisable était le magic link, pas Neon Auth.
- **Garder les deux, magic link et mot de passe** — rejeté pour l'instant : deux chemins d'authentification, c'est deux fois plus de surface d'erreur pour un utilisateur unique, et le chemin en trop est justement celui qu'on ne sait pas tester. La décision est réversible (le plugin reste activé) ; elle sera reprise si un besoin réel apparaît.
- **OTP par email** (`emailVerificationMethod: "otp"` est déjà configuré) — rejeté : même dépendance à une boîte mail que le magic link.

## Consequences

Plus facile :

- **Les tests e2e authentifiés existent enfin.** `tests/e2e/auth.setup.ts` ouvre une session par l'interface réelle et enregistre un `storageState` ; le projet Playwright `authenticated` le réutilise. Ce que ADR 011 décrivait est en place, sans table `verification` ni email. `tests/e2e/session.auth.spec.ts` couvre les quatre écrans protégés, `/api/session`, et l'aller-retour connexion → déconnexion.
- Le suffixe `*.auth.spec.ts` est la convention « demande une session ». Les projets anonymes (`mobile`, `desktop`) l'ignorent, les projets `setup` et `authenticated` ne sont enregistrés que si `E2E_EMAIL` et `E2E_PASSWORD` sont présents : sans identifiants, la suite est exactement celle d'avant.
- ADR 008 (`sameSite: 'lax'`) perd sa justification d'origine — il existait pour que le cookie survive à la navigation cross-site d'un clic depuis un client mail. Le réglage est **conservé** : `lax` reste le bon défaut et le repasser à `strict` serait un changement de sécurité gratuit, non motivé par cette story.

Plus dur, et une leçon :

- **La branche d'erreur du SDK n'a pas la forme documentée, et c'était un vrai bug.** Un mot de passe faux ne résout pas la promesse avec `{ error }` : le SDK Neon normalise l'échec en `AuthApiError` et **rejette**. Sans `try/catch`, le rejet s'échappait de `void submit(...)`, `setIsPending(false)` n'était jamais atteint, et le bouton restait bloqué sur « Connexion… » sans le moindre message — l'utilisateur enfermé dehors sans explication. Trouvé en jouant le scénario dans un vrai navigateur ; **aucun test jsdom ne l'aurait attrapé**, puisqu'ils simulaient la forme documentée. Les deux formes sont désormais gérées et testées.
- **Les codes d'erreur sont ceux de Neon, pas ceux de Better Auth.** L'erreur normalisée porte `code: "invalid_credentials"` (taxonomie `AuthErrorCode` de `@neondatabase/auth`), là où le handler de route renvoie `INVALID_EMAIL_OR_PASSWORD` (taxonomie Better Auth) une couche plus bas. Les deux tables sont mappées ; une correspondance faite sur la seule lecture du handler aurait affiché le message générique à chaque échec — ce qui a effectivement été observé avant correction.
- `emailVerified` reste `false` pour tout compte créé par mot de passe. Sans conséquence tant que `requireEmailVerification` est `false` côté projet Neon ; **l'activer côté console rendrait la connexion impossible sans boîte mail** et annulerait cette décision. À ne pas toucher sans nouvel ADR.
- Un compte créé par magic link n'a pas de ligne `credential` dans `neon_auth.account` : il ne peut pas se connecter par mot de passe, et `sign-up` sur la même adresse renvoie `user_already_exists`. Aucune passerelle sans email. Le seul compte concerné (`olmattei@gmail.com`, créé le 2026-08-03 lors d'un essai de magic link) ne porte **aucune donnée** — zéro ligne dans `profiles` et `measurement_sessions` — et peut être supprimé sans perte pour libérer l'adresse.
