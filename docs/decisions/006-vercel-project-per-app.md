# ADR 006 — Un projet Vercel par app du monorepo

- Status: accepted
- Date: 2026-08-02
- Scope: framing

## Context

`multitool/` est un dépôt d'outils indépendants, pas un monorepo outillé : pas de workspaces, pas de Turborepo, pas de lockfile racine. `compoundSimulator/` a son propre `package.json` et son propre `node_modules`. Le PRD signalait déjà que morpho introduit un backend là où le dépôt n'hébergeait que des apps Vite statiques, et renvoyait la question à cette phase.

## Decision

Chaque app du dépôt est un projet Vercel distinct, avec sa **Root Directory** pointant sur son dossier. `morpho/` se déploie depuis `morpho/`, avec ses propres variables d'environnement. Aucune dépendance partagée entre apps, aucun package commun, aucun outil de monorepo introduit.

Les variables d'environnement (`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`) vivent dans les réglages du projet Vercel. `.env*` est ignoré par git ; `morpho/.env.example` documente les clés attendues, jamais leurs valeurs.

## Considered options

- **Un seul projet Vercel à la racine** — rejeté : imposerait un build racine et un routage par chemin, donc un outil de monorepo, pour un dépôt dont les apps n'ont rien en commun.
- **Introduire des workspaces npm ou Turborepo** — rejeté : refonte de `compoundSimulator/`, qui fonctionne et n'a rien demandé. Le critère de s01 « `compoundSimulator/` continue de builder à l'identique » découle de cette décision.
- **Sortir morpho dans son propre dépôt** — rejeté : l'utilisateur a explicitement demandé un sous-projet de `multitool/`.

## Consequences

Plus facile : les apps évoluent sans se gêner ; le déploiement de morpho n'expose rien de `compoundSimulator/` ; les secrets restent cantonnés à un projet.

Plus dur : pas de partage de code entre apps — si un jour deux apps ont besoin de la même chose, cette décision est à rouvrir par un nouvel ADR, pas à contourner par un import relatif à travers les dossiers.

À surveiller : la Root Directory est un réglage d'interface Vercel, invisible dans le dépôt. S'il est mal posé, le build échoue de façon peu lisible. Le noter dans la review de s01.
