# ADR 020 — Refonte de l'accueil : silhouette dessinée, barre basse, onboarding obligatoire

- Status: accepted
- Date: 2026-08-04
- Scope: framing
- Source: Claude Design, projet `a63805c1-b440-4805-93bc-b6a4cde52b94`, fichier `Morpho Redesign.dc.html` (options 1f/1g — homme/femme, barre « classic » à encoche)
- Supersedes: la silhouette géométrique de s06 sur l'écran d'accueil, et la navigation par menu déroulant en en-tête (s07 E1)

## Context

L'accueil de s06 dessinait un corps en 7 zones SVG teintées selon le verdict, avec des étiquettes placées en pourcentage. Ça fonctionnait, mais ça ne ressemblait pas à un produit : un pictogramme, pas une silhouette.

Le redesign apporte trois choses, et la troisième force les deux autres à demander des données que l'application n'avait jamais collectées :

1. une **silhouette dessinée au trait**, sexuée, avec des lignes de rappel pointillées vers une mesure de chaque côté ;
2. une **barre de navigation basse** à cinq emplacements, avec un bouton d'action central — le menu déroulant en haut de l'écran disparaît ;
3. un **compteur « J+42 »** en en-tête, qui suppose une date d'origine.

Or le profil ne connaissait ni le sexe (quelle silhouette dessiner) ni la date de départ (à partir de quand compter). La taille, elle, existait mais restait facultative — l'IMC avait une branche « pas de taille renseignée » sur l'accueil.

## Decision

**Un onboarding obligatoire de trois questions — taille, sexe, date de début de transformation — qui garde tous les écrans authentifiés.**

- Deux colonnes ajoutées à `profiles` : `sex` (enum `profile_sex`, `male`/`female`) et `transformation_started_on` (`date`). Toutes deux **nullables en base** : elles s'ajoutent à des lignes qui existent déjà, et Postgres n'a aucun moyen d'inventer une valeur pour elles. « Obligatoire » est une règle applicative, portée par `src/lib/onboarding.ts` (`isOnboarded`) et appliquée par `src/lib/onboarding-gate.ts` (`requireOnboarded`).
- Le gate redirige vers `/auth/sign-in` sans session, vers `/onboarding` si le profil est incomplet. Il est appelé par `/`, `/saisie`, `/historique` et `/graphes`. **`/profil` en est délibérément exempt** : c'est là qu'on corrige les trois réponses, le garder derrière « il faut les avoir données » rendrait une date fausse impossible à réparer. `/onboarding` non plus, pour la raison évidente.
- Les trois réponses sont modifiables depuis `/profil`, dans le formulaire qui portait déjà taille et poids cible — un seul formulaire, un seul bouton, une seule écriture.
- `PUT /api/profile` accepte `sex` et `transformationStartedOn` en **paire optionnelle**. Optionnelle, parce que tout appelant antérieur au redesign n'en envoie aucun et doit continuer à fonctionner ; en paire, parce que le gate teste les deux — accepter l'un sans l'autre écrirait un profil qui échoue encore au gate, sans champ à l'écran pour expliquer pourquoi.

**La silhouette est un asset, pas un composant.** `public/silhouettes/{homme,femme}.svg`, servis par une balise `<img>`.

- Pas de SVG inliné en TSX : ~13 Ko de données de tracé par sexe dans le bundle JS, pour un dessin qui ne change jamais.
- Pas de `next/image` : faire passer un vecteur par un optimiseur de raster n'a pas de sens.
- Le thème passe par `dark:invert`. `currentColor` ne franchit pas la frontière d'un `<img>`, et le dessin est du trait noir sur fond transparent : l'inverser donne exactement le blanc-sur-sombre attendu.
- La géométrie des étiquettes est **une table par silhouette**, recopiée du design. Les hanches et les mollets du dessin féminin sont plus bas : partager une seule table ferait flotter deux étiquettes à côté du corps qu'elles annotent.

**La barre basse remplace l'en-tête de navigation.** Quatre destinations (Accueil, Graphes, Historique, Profil) plus le bouton de saisie au centre. La déconnexion, qui vivait dans le menu déroulant, descend sur `/profil` : la barre a cinq emplacements et les cinq sont des destinations.

## Considered options

- **Garder la silhouette géométrique et ne changer que les cartes** — rejeté : c'est précisément le dessin qui fait la différence entre un outil et un pictogramme, et c'est ce que le design apporte.
- **Rendre `sex` et `transformation_started_on` NOT NULL en base** — rejeté : il aurait fallu soit un défaut fabriqué (un mensonge sur le corps de l'utilisateur), soit une migration qui échoue sur la première ligne existante. La contrainte vit dans le gate, où elle a un écran pour se réparer.
- **Un endpoint `/api/onboarding` séparé** — rejeté : les mêmes trois champs sont écrits depuis deux écrans, et deux endpoints auraient divergé sur la validation. `PUT /api/profile` les accepte en paire optionnelle.
- **Reproduire l'encoche de la barre avec le SVG du design** — rejeté : le tracé est écrit pour une largeur unique (390 px). Une barre qui s'arrête à 390 px est fausse sur tout autre écran, et la même étirée en `preserveAspectRatio="none"` déforme la courbe. Un anneau de la couleur du fond autour du bouton donne le même rendu à toutes les largeurs, sans géométrie.
- **La feuille de saisie en bottom sheet (option 1d du design)** — **non retenue pour l'instant, et c'est un écart assumé.** Le bouton central navigue vers `/saisie`, la page qui existe déjà avec son formulaire, son préremplissage et sa couverture de tests. Transformer cette page en feuille modale est un travail à part entière ; le faire en même temps que la refonte de l'accueil aurait mélangé deux risques. Le design de la feuille reste valable et applicable ensuite, sans rien défaire de ce qui est fait ici.

## Consequences

Plus facile :

- La branche « pas de taille renseignée » de l'IMC disparaît de l'accueil : le gate garantit une taille avant que l'écran soit atteignable. Ce qui était un filet de sécurité serait devenu du code mort déguisé.
- L'accueil ne lit plus le profil deux fois : le gate l'a déjà lu, et `getBodyMapData` accepte désormais la taille en paramètre plutôt que de rejouer la même requête (un aller-retour de moins sur un démarrage à froid Neon).
- `AppHeader` et `OffBodyCards` sont supprimés, pas laissés en place « au cas où ». La barre et les cartes de stats les remplacent intégralement.

Plus dur, et deux pièges rencontrés :

- **Le SVG exporté n'a pas de CSS.** Les tracés portent des classes `cls-*` dont les règles vivaient dans un `<defs>` que l'export a vidé. Rendus tels quels avec un `fill`, ils donnent une **silhouette entièrement noire** — le contour du corps est un tracé fermé. Le remplissage et le contour sont donc déclarés sur la racine du `<svg>` (`fill="#ffffff" stroke="#111111"`). Ce sont des couleurs en dur, dans un **fichier d'image** — la règle « aucune couleur codée en dur » vise les composants, et un asset n'a pas accès aux tokens.
- **`82.5 - 82.4` vaut `0.09999999999999432` en IEEE 754.** Le seuil de stabilité du compteur d'en-tête (0,1 kg, la précision de stockage) laissait donc passer une perte réelle de 100 g pour « poids stable ». Le delta est arrondi à la précision de stockage **avant** la comparaison. Trouvé par un test écrit exprès sur la valeur limite, pas à la relecture.
- `date` reste une **chaîne** de bout en bout (`mode: "string"`, comparaisons lexicographiques sur l'ISO), comme `measurement_sessions.measured_on`. Le passage par un `Date` JS réintroduirait le décalage UTC qui transforme « 4 août » en « 3 août » à l'ouest de Greenwich. Le schéma de validation vérifie l'aller-retour de la date pour refuser un « 2026-02-31 » que `Date.UTC()` avancerait silencieusement au 3 mars.
- **`/silhouettes/**` a dû être exclu de `src/proxy.ts`.** Sans cette exclusion, le proxy répond 307 vers l'écran de connexion — constaté en production, pas déduit. Une redirection HTML servie à une balise `<img>` est une image cassée, pas un écran de connexion ; et comme `public/**/*` est le glob de precache, un service worker s'installant sur une session froide aurait mis la redirection en cache à la place du SVG. Même classe de piège que les quatre exclusions ajoutées par s10.
- Le libellé du tour de taille est repassé à **« Taille »**, comme le design l'écrit (voir plus bas). Les libellés restent dérivés du catalogue, jamais redéclarés par écran.

## Amendement du 2026-08-04 — libellé et ordre de saisie

Deux réglages demandés après la mise en production, tous deux dans `src/lib/measurements.ts` :

- **`waist_cm` s'appelle « Taille »**, plus « Tour de taille ». s03 avait choisi la forme longue pour éviter la collision avec la taille de référence de s04 — mais les deux n'apparaissent jamais sur le même écran : la hauteur vit sur `/profil`, dans un champ intitulé « Taille (cm) » sous une légende « Taille de référence ». La forme courte est aussi celle dont la colonne d'étiquettes de la silhouette a besoin ; la longue passe à la ligne.
- **Le biceps passe en dernier des mensurations.** L'ordre du catalogue était jusqu'ici verrouillé par test sur `measurementKind.enumValues`. Il ne l'est plus : l'ordre d'un enum Postgres est figé à la création — `ALTER TYPE` sait ajouter une valeur, pas en réordonner une existante — et recréer le type sous des données vivantes pour un gain purement cosmétique n'en vaut pas le prix. L'enum garde l'ordre de **stockage**, le catalogue porte l'ordre d'**affichage** (saisie, squelette, sélecteur de graphes), et le test vérifie désormais que les deux couvrent le même *ensemble* de kinds, plus la même séquence. L'ordre d'affichage est verrouillé à part, explicitement, parce qu'il est devenu une décision et non plus une conséquence.
