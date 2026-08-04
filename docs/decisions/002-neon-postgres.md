# ADR 002 — Neon Postgres pour la persistance

- Status: accepted
- Date: 2026-08-02
- Scope: framing

## Context

Le critère de succès #12 du PRD — « depuis un appareil neuf, une connexion restaure l'intégralité de l'historique » — est la raison d'être du backend. Aucun stockage local ne le satisfait : IndexedDB, localStorage, OPFS et SQLite/WASM vivent tous sur l'appareil. Téléphone perdu = données perdues, dans les quatre cas.

L'usage sera irrégulier (sessions de mesure espacées, parfois des semaines).

## Decision

Neon (Postgres serverless), accédé exclusivement côté serveur via `@neondatabase/serverless` + Drizzle ORM. Schéma versionné dans le dépôt via `drizzle-kit`, dossier `drizzle/`.

## Considered options

- **Supabase** — rejeté : le tier gratuit suspend un projet après 7 jours d'inactivité, ce qui demande une réactivation manuelle. Neon ne fait que du scale-to-zero (cold start ~500 ms, projet jamais suspendu). Sur un usage volontairement irrégulier, c'est le critère décisif. Le prix payé est réel : Supabase aurait fourni auth + API + RLS d'un bloc, là où Neon n'apporte que la base.
- **SQLite WASM / IndexedDB / OPFS** — rejeté : ne satisfait pas le critère #12. Retenu un temps par confusion sur ce que « persistance » veut dire — SQLite ne change que la façon d'interroger les données, jamais l'endroit où elles vivent.
- **Local + export/import JSON manuel** — rejeté par l'utilisateur : « je ne penserais jamais à faire un export ». Un filet qu'on oublie de tendre n'en est pas un.
- **Postgres managé classique (RDS, Supabase DB seule)** — rejeté : coût fixe mensuel pour quelques milliers de lignes.

## Consequences

Plus facile : les données survivent à l'appareil ; SQL complet pour des lectures comme « dernière valeur connue par mesure » (s05) ; migrations versionnées avec le code.

Plus dur : **Neon n'expose aucun SDK client sécurisé.** Le navigateur ne parle jamais à Postgres — toute lecture ou écriture passe par un route handler. Il n'y a pas de RLS pour rattraper une erreur : l'isolation entre utilisateurs est portée par le code serveur seul (voir [ADR 003](003-neon-auth.md)).

À surveiller : le cold start (~500 ms) frappe la première requête après inactivité — exactement le cas d'usage de morpho. Toute UI qui attend la base avant de s'afficher paraîtra cassée. La connection string ne doit jamais être préfixée `NEXT_PUBLIC_` ; s01 en fait un critère vérifiable par recherche dans le build.
