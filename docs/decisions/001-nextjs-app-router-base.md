# ADR 001 — Next.js App Router comme base, plutôt que Vite

- Status: accepted
- Date: 2026-08-02
- Scope: framing

## Context

Le PRD annonçait « React + Vite, aligné sur `compoundSimulator/` », et dans la même section : « le déploiement de morpho n'est pas celui de compoundSimulator — à trancher en phase Architecture ». Ces deux phrases se contredisent dès que le projet a besoin d'auth, d'une API et d'une base.

L'analyse du repo a confirmé qu'il n'existe aucun boilerplate à hériter : `compoundSimulator/` est un `App.jsx` de 882 lignes, en JS, styles inline, sans test, sans linter, sans backend. Il constitue un précédent de style, pas une base technique. La décision se prend donc à froid, sans coût de conformité à un existant.

Le besoin réel de morpho : routes protégées, endpoints serveur, session, schéma versionné, PWA.

## Decision

Next.js 16 (App Router, TypeScript, Turbopack), Tailwind v4, shadcn/ui (base radix, preset nova), dans `morpho/`.

## Considered options

- **Vite + React + dossier `/api` sur Vercel** — rejeté : le routage, la garde des routes, la lecture de session et le rendu serveur s'écrivent à la main. Surtout, l'intégration Neon Auth hors Next.js est le chemin le moins documenté, alors que l'auth est déjà le point le plus risqué du projet.
- **ship-saas.now** — rejeté : embarque billing, marketing et multi-tenant, dont morpho (outil personnel mono-utilisateur, cf. PRD « Kill mode ») n'a aucun usage. Le tri coûterait plus que le gain.
- **Rester en JS comme `compoundSimulator/`** — rejeté : le PRD impose de distinguer un champ vide d'un zéro sur tout le trajet formulaire → API → base, et une corruption y est silencieuse pendant des semaines. Le typage est un filet direct sur ce risque précis.

## Consequences

Plus facile : route handlers natifs pour l'API, `proxy.ts` pour protéger les routes, Neon Auth sur son chemin d'intégration principal, composants shadcn au lieu d'un design maison.

Plus dur : morpho ne ressemble plus à `compoundSimulator/`. `multitool/` cesse d'être un monorepo homogène d'apps Vite statiques — voir [ADR 006](006-vercel-project-per-app.md).

À surveiller : **Next 16 diffère franchement des versions antérieures**. `middleware.ts` est renommé `proxy.ts`, les Request APIs (`cookies()`, `headers()`, `params`) sont asynchrones, Turbopack est le bundler par défaut. `morpho/AGENTS.md` (écrit par `create-next-app`) impose de lire `node_modules/next/dist/docs/` avant d'écrire du code. Cette règle n'est pas décorative : le modèle a des conventions Next 14/15 en mémoire qui produiront du code faux.
