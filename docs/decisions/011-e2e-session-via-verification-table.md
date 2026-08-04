# ADR 011 — Authentifier Playwright en lisant le jeton dans la base, sans code de test en production

- Status: accepted
- Date: 2026-08-03
- Scope: framing

## Context

Tous les écrans de morpho, sauf l'écran de connexion, sont derrière `src/proxy.ts` et une garde de session. Playwright ne peut donc rien vérifier d'utile sans une session valide — or plusieurs critères d'acceptation ne se prouvent que dans un vrai navigateur : absence de défilement horizontal à 375 px, hauteur des cibles tactiles à 44 px, `data-prefilled` retiré à la première saisie, mode standalone, lecture hors ligne.

Le trou est structurel et personne ne l'a possédé : [le plan de s02](../plans/s02-connect-magic-link.md) décide de ne pas automatiser le mail, [celui de s03](../plans/s03-log-measurement-session.md) constate le blocage et le renvoie à s06, et celui de s04 invoque « le mécanisme mis en place par s02 » — un mécanisme que s02 n'a jamais prévu. s04 et s05 en ont besoin **avant** s06. Sans décision, chaque story improvisera la sienne, ou désactivera ses tests navigateur.

Le cookie de session est signé par le SDK avec `NEON_AUTH_COOKIE_SECRET` et porte le préfixe `__Secure-`. On ne peut pas le fabriquer à la main sans réimplémenter la signature du SDK — c'est-à-dire sans écrire de l'auth maison, ce que le projet a explicitement refusé ([ADR 003](003-neon-auth.md)).

## Decision

Un `globalSetup` Playwright ouvre une vraie session, **sans une ligne de code de test dans l'application** :

1. `authClient.signIn.magicLink({ email: <adresse de test> })` — le vrai chemin, le vrai serveur Neon Auth.
2. Lecture du jeton dans **`neon_auth.verification`** (`identifier`, `value`, `expiresAt`), via la `DATABASE_URL` dont les tests disposent déjà.
3. Appel de l'URL de vérification avec ce jeton, exactement comme le ferait un clic depuis un client mail.
4. `storageState` sauvegardé et réutilisé par les projets Playwright.

L'adresse de test est une variable d'environnement (`E2E_TEST_EMAIL`), jamais une valeur en dur. Sans elle, les specs authentifiées se **skippent avec un message explicite** — jamais un faux vert.

## Considered options

- **Une route de test qui crée une session, protégée par un secret d'environnement** — rejetée. Elle met du code d'authentification dégradé dans le bundle de production, dont la sûreté ne tient qu'à une variable absente. C'est la classe de bug qui se découvre en post-mortem. Le projet n'a pas de RLS pour rattraper une erreur d'auth ([ADR 002](002-neon-postgres.md)) : sa seule défense est qu'aucun chemin d'authentification alternatif n'existe.
- **Fabriquer le cookie signé dans le harnais** — rejetée : il faudrait réimplémenter la signature du SDK, donc maintenir une seconde implémentation d'auth qui dérivera silencieusement de la vraie. Et un test qui signe lui-même son cookie ne prouve plus que le SDK sait le lire.
- **Une boîte mail jetable pilotable par API** (Mailosaur, MailSlurp) — rejetée : dépendance tierce facturée, et l'angle « zéro service tiers » du PRD. À rouvrir seulement s'il faut un jour tester le contenu du mail lui-même, ce qui n'est au périmètre d'aucune story.
- **Renoncer aux tests navigateur authentifiés** — rejetée : les critères de 375 px, de 44 px et du hors-ligne deviendraient invérifiables, et la revue des stories a déjà refusé une fois qu'un critère soit coché sans preuve.

## Consequences

Plus facile : l'application ne contient **aucun** chemin d'authentification autre que le vrai. Le setup exerce le flux réel de bout en bout — s'il casse, c'est que la connexion est cassée, ce qui est une information et non un faux positif.

Plus dur : les tests navigateur exigent `DATABASE_URL` et `E2E_TEST_EMAIL`. Ils se skippent proprement sans, donc `npm run check` reste vert sur un clone frais, mais une CI qui veut les exécuter doit porter les deux.

À surveiller : **le nom de la colonne portant le jeton dans `neon_auth.verification` et sa forme exacte ne sont pas confirmés.** La table existe (`identifier`, `value`, `expiresAt`, relevés en base) et Better Auth y range les jetons de magic link, mais le format de `value` — jeton brut ou haché — reste à constater. **À vérifier en exécutant le setup une fois**, avant que s04 en dépende. Si `value` est haché, cette décision tombe et l'option de la boîte mail jetable revient : ce serait un nouvel ADR, pas un contournement.

Le jeton expire en 5 minutes (`plugin_configs.magicLink.expiresIn` relevé dans `neon_auth.project_config`) : le setup doit consommer le jeton immédiatement après l'avoir lu.
