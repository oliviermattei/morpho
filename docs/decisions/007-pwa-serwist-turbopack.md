# ADR 007 — Serwist (variante Turbopack) pour la couche PWA

- Status: accepted
- Date: 2026-08-02
- Scope: framing

## Context

s10 exige un manifest, une installation sur l'écran d'accueil iOS, un mode standalone, un shell servi hors ligne et une mise à jour fiable après déploiement. Cette dernière est le vrai risque : un service worker mal versionné sert indéfiniment un shell obsolète, avec un symptôme qui ne se reproduit pas en dev.

Next 16 utilise Turbopack par défaut, ce qui disqualifie les intégrations PWA construites sur Webpack.

## Decision

Serwist, via le module `@serwist/turbopack`. Le manifest est fourni par la convention Next (`app/manifest.ts`).

La décision est prise ici pour que s10 n'ait pas à rouvrir le sujet, mais **le branchement exact reste à vérifier en `/ks-research s10`** : le support Turbopack est récent, et `@serwist/next` (variante Webpack) ne convient pas à cette configuration.

## Considered options

- **`@serwist/next`** — rejeté pour ce projet : construit sur Webpack, alors que Next 16 build en Turbopack. Basculer le projet sur Webpack pour obtenir un service worker reviendrait à renoncer au bundler par défaut du framework.
- **`next-pwa`** — rejeté : non maintenu. Serwist en est le successeur.
- **Service worker écrit à la main** — rejeté : le versioning de cache et la stratégie de mise à jour sont précisément la partie que l'on rate, et le critère de s10 exige de la prouver avant merge.
- **Renoncer à la PWA, rester un site web** — rejeté : l'installation n'est pas cosmétique. iOS purge le stockage d'un site non installé après 7 jours sans visite ; installé sur l'écran d'accueil, il en est exempté. Le PRD la pose comme obligatoire.

## Consequences

Plus facile : manifest, précache du shell et gestion de version fournis, au lieu d'être écrits à la main.

Plus dur : le cache doit exclure les réponses API contenant des données utilisateur — critère explicite de s10, à ne pas laisser au comportement par défaut de la librairie. Le hors-ligne est en **lecture seule** : l'écriture offline est au graveyard du PRD, donc pas de file d'attente ni de résolution de conflits.

À surveiller : ne pas introduire Serwist avant s10. Mettre en cache un shell qui change encore à chaque story ferait payer le coût du versioning de cache à chaque livraison — c'est la raison pour laquelle s10 est placée en dernier.
