# ADR 005 — Vitest + Testing Library pour la logique, Playwright pour le navigateur

- Status: accepted
- Date: 2026-08-02
- Scope: framing

## Context

Le pipeline impose le TDD (`/ks-execute` passe par le subagent implementer, skill `tdd-skill`) et la Definition of Done exige des tests passants sur la logique métier. Il faut donc un harnais avant la première story.

Les critères d'acceptation de morpho se répartissent en deux natures irréductibles :
- de la logique et du rendu de composants — calcul de l'IMC, deltas, sens « favorable » par mesure, refus d'un formulaire vide, validation des plages, isolation inter-utilisateurs sur un route handler ;
- du comportement navigateur réel — absence de défilement horizontal à 375 px, mode standalone, ouverture hors ligne, mise à jour du service worker après déploiement.

Aucun outil unique ne couvre les deux honnêtement.

## Decision

- **Vitest** (environnement `jsdom`) + **Testing Library** + `@testing-library/jest-dom` : logique métier, composants, et route handlers appelés directement. Tests co-localisés, `src/**/*.test.ts(x)`.
- **Playwright** : critères navigateur, dans `tests/e2e/`. Deux projets — `mobile` (iPhone 13, la cible principale) et `desktop`.

`npm run check` enchaîne `typecheck`, `lint` et `test`. C'est la commande que la review invoque.

**Complément (review s01, finding 3, 2026-08-02)** : `npm run check` doit rester vert sans aucun secret, dans n'importe quel environnement — un dépôt fraîchement cloné y compris. Or le test qui vérifie l'absence de la connection string Neon dans le build (critère 5 de s01) a besoin d'un `DATABASE_URL` réel et d'un build produit avec lui ; l'y laisser rendait `check` rouge par construction partout où ce secret n'est pas peuplé, ce qui aurait rendu la gate inutilisable dès s02. Ce test vit donc à part, dans `src/build-connection-leak.check.ts`, exclu du glob `include` par défaut (`src/**/*.test.{ts,tsx}`) et exécuté uniquement par `npm run check:leak` (`vitest.leak.config.mts`), qui échoue durement s'il manque `DATABASE_URL` ou un `.next/` frais — jamais un passage silencieux à vide. C'est la commande que la review rejoue au protocole du critère 5, sur un build peuplé. Le test du critère 6 (traceurs tiers), qui n'a besoin d'aucun secret, reste dans `npm run test` / `npm run check` ; il produit lui-même le build s'il est absent (`next build`, sans secret requis), plutôt que d'échouer sur un `.next/` manquant.

Note sur la forme de ce complément (review s01, second passage, finding G) : `AGENTS.md` déclare les ADR immuables — un changement se fait par un nouvel ADR qui en supersède un ancien, jamais par une modification en place. Ce complément déroge à la règle sciemment : il est purement additif (il ne retire ni ne contredit rien de la décision d'origine, il ferme un trou qu'elle n'avait pas anticipé) et la review qui l'a demandé l'a explicitement formulé comme un amendement de ce fichier plutôt que comme un nouvel ADR. Un vrai changement de décision — remplacer Vitest, abandonner Playwright, etc. — suivrait la règle normale : un nouvel ADR superseding celui-ci.

## Considered options

- **Vitest seul** — rejeté : jsdom ne mesure pas un défilement horizontal, ne connaît pas le mode standalone, ne sait pas couper le réseau. Les critères correspondants seraient cochés sans preuve, ce que la review des stories a déjà refusé une fois.
- **Playwright seul** — rejeté : faire tourner un navigateur pour vérifier un calcul d'IMC rend la boucle TDD trop lente pour être tenue.
- **Jest** — rejeté : configuration ESM/TS plus lourde, sans avantage ici.
- **Cypress** — rejeté : Playwright émule mieux le mobile et gère nativement le hors-ligne, qui est un critère explicite de s10.

## Consequences

Plus facile : boucle TDD rapide sur la logique ; les critères navigateur deviennent réellement vérifiables avant la gate, pas après le ship.

Plus dur : deux harnais à maintenir, et une frontière à tenir — `vitest.config.ts` restreint `include` à `src/**` pour que Vitest n'essaie jamais d'exécuter les specs Playwright. Les navigateurs Playwright s'installent séparément (`npx playwright install`), à faire en s01.

À surveiller : `@vitejs/plugin-react` a été volontairement **écarté** — il tire `@babel/core@8.0.0-rc` et entre en conflit de peer dependency avec `shadcn`. Vitest 4 s'appuie sur Vite 8, dont la transformation passe par **Rolldown / oxc** (et non esbuild, contrairement à ce qu'affirmait la première rédaction de cet ADR) ; le JSX est transpilé d'après `jsx: "react-jsx"` du `tsconfig.json`. Ne pas réintroduire ce plugin « pour faire comme partout » : l'installation casserait.

`npm run test` passe `--passWithNoTests` : sans ce drapeau, Vitest sort en code 1 quand aucun fichier de test n'existe encore, ce qui fait échouer `npm run check` — la commande même que la review invoque — sur une story qui n'a pas encore écrit son premier test.

Les tests d'isolation inter-utilisateurs (s02, s03, s09) supposent une base de test. Le mécanisme — base Neon dédiée, branche Neon éphémère, ou conteneur Postgres local — reste à trancher en `/ks-research s03`. C'est le seul trou connu de ce harnais.
