# ADR 004 — Les mesures sont des lignes, pas des colonnes

- Status: accepted
- Date: 2026-08-02
- Scope: framing

## Context

Les notes agentiques de s03 posaient explicitement ce choix comme méritant un ADR, parce qu'il conditionne la lecture des graphes (s07) et du pré-remplissage (s05).

Une session = une date + N mesures **optionnelles**. Le PRD insiste : l'absence d'une mesure est le cas courant, pas le cas limite. Deux formes possibles :
- des colonnes nullables sur `measurement_sessions` (`weight_kg`, `waist_cm`, …) ;
- une table `measurements` en lignes (`session_id`, `kind`, `value`).

Deux requêtes tranchent, parce qu'elles sont au cœur de l'angle produit :
- s05 — « dernière valeur connue **par mesure** », indépendamment de la session d'origine ;
- s06 — « première valeur enregistrée par mesure », référentiel de tous les deltas de la silhouette.

## Decision

Table `measurements` en lignes. `measurement_sessions` ne porte que la date et le propriétaire ; chaque valeur saisie est une ligne `(session_id, kind, value)`, avec une contrainte d'unicité sur `(session_id, kind)`. `kind` est un enum Postgres.

## Considered options

- **Colonnes nullables** — rejeté pour trois raisons cumulées. (1) Les deux requêtes ci-dessus deviennent dix sous-requêtes corrélées ou un `LATERAL` par mesure, là où la forme en lignes donne un `DISTINCT ON (kind)` unique et exact. (2) Ajouter une mesure devient une migration de schéma. (3) Surtout : une colonne `numeric` nullable rend le piège du PRD — `Number("")` qui devient `0` — silencieux et persistant, alors qu'en lignes une mesure non saisie n'a **pas de ligne**, ce qui rend l'erreur structurellement impossible.
- **JSONB par session** — rejeté : perd le typage, les contraintes et l'indexation, pour un gain de flexibilité dont un ensemble de dix mesures figées n'a aucun besoin.
- **Une table par type de mesure** — rejeté : dix tables quasi identiques, chaque lecture devient une union.

## Consequences

Plus facile : `DISTINCT ON (kind) … ORDER BY kind, measured_on DESC` répond à s05 en une requête, `ASC` répond à s06 ; une mesure absente est l'absence d'une ligne, jamais un zéro ; ajouter un `kind` est une valeur d'enum, pas une refonte.

Plus dur : l'affichage d'une session en tableau demande un pivot côté application. Le typage par mesure n'existe pas au niveau base — c'est Zod, à la frontière de l'API, qui porte les plages physiologiques par `kind` (le critère de validation serveur de s03).

À surveiller : **Drizzle renvoie les colonnes `numeric` sous forme de chaîne par défaut.** Une valeur qui arrive en `"72.40"` au lieu de `72.4` casse silencieusement les calculs de delta et l'axe des graphes. Fixer le mode de lecture dès la définition du schéma et le couvrir par un test — c'est la variante base de données du piège « vide vs zéro ».
