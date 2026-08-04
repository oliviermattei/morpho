# ADR 013 — Le retour arrière peut montrer un état périmé, et on l'accepte

- Status: accepted
- Date: 2026-08-03
- Scope: framing

## Context

Trois plans ont buté sur le même trou, indépendamment : `/saisie` → `/historique` (s03), `/profil` → le suffixe IMC de l'historique (s04), `/profil` → `/graphes` (s08).

Le mécanisme, vérifié dans la documentation Next 16 livrée avec le paquet :

- le cache client réutilise le payload RSC lors des navigations arrière/avant (`01-app/04-glossary.md:43`) ;
- `staleTimes` ne change pas ce comportement (`…/05-config/01-next-config-js/staleTimes.md:36`) ;
- `useRouter().refresh()` « clears the Client Cache for the current route » (`…/04-functions/use-router.md`) — donc l'écran d'où l'on écrit, pas les autres.

Le remède qu'un plan avait écrit était mesurablement faux et a été retiré : le chemin d'écriture est un route handler, pas une Server Action, et `revalidatePath` appelé depuis un Route Handler ne fait que « mark the path for revalidation … on the next visit » — sans objet pour une page en `force-dynamic`, et hors d'atteinte du cache navigateur.

Concrètement : on enregistre une session, on va voir le graphe, on revient en arrière — l'écran précédent peut afficher l'état d'avant la saisie.

## Decision

**On l'accepte, explicitement.** Aucun mécanisme d'invalidation inter-écrans n'est construit au v1.

Ce qui est exigé en contrepartie, et qui n'est pas rien :
- la navigation **avant** est toujours fraîche — un lien, un `goto`, un rechargement rendent l'état réel. C'est le seul chemin que les critères d'acceptation asserteront ;
- les plans qui touchent un écran concerné **mesurent** le comportement du retour arrière et consignent le résultat dans leur review, plutôt que de le corriger à l'aveugle ou de l'ignorer ;
- si l'usage réel montre que ça trompe, c'est un ADR remplaçant, pas un correctif ponctuel dans une story.

## Considered options

- **Un mécanisme d'invalidation global** (bus d'événements, `router.refresh()` au retour de focus, revalidation par tag sur chaque écriture) — rejeté au v1. Chaque variante ajoute un mécanisme transverse qu'il faut ensuite maintenir sur dix écrans, pour un outil **mono-utilisateur** dont les données changent au mieux une fois par semaine. Le coût de la complexité dépasse celui du symptôme.
- **`staleTimes: { dynamic: 0 }`** — rejeté : la doc dit explicitement que ce réglage ne couvre pas les navigations arrière/avant. Il donnerait l'illusion d'avoir traité le sujet.
- **`revalidatePath` depuis les route handlers d'écriture** — rejeté : mesuré sans effet ici, pour les deux raisons ci-dessus. C'est le remède qui avait été écrit avant vérification.
- **Ne rien décider et laisser chaque story improviser** — rejeté : c'est l'état qui a produit trois analyses redondantes du même problème dans trois plans écrits en parallèle.

## Consequences

Plus facile : aucun mécanisme transverse à construire, à tester et à maintenir. Les stories restent indépendantes.

Plus dur : un retour arrière peut afficher une valeur périmée de quelques secondes à quelques minutes. Le symptôme est réel et il faut le connaître avant de le prendre pour un bug de persistance — c'est exactement pour ça qu'il est écrit ici plutôt que découvert deux fois.

À surveiller : le cas le plus visible sera `/saisie` → `/historique` → retour, juste après une saisie. Si l'usage montre que c'est trompeur, rouvrir avec un ADR remplaçant.
