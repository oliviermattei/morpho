# Design System — morpho

> **Ce document est la seule source visuelle du projet.** `/ks-design` s'y appuie à chaque story. Inventer un composant ou un token en dehors est interdit : un besoin non couvert est un *design system gap* à signaler, jamais à combler à la volée.

## Origine

Deux sources, et rien d'autre :

1. **Le preset shadcn installé** — base `radix`, style `radix-nova`, base color `neutral`, icônes `lucide`. Tokens réellement présents dans `src/app/globals.css`, relevés et non estimés.
2. **Trois décisions prises avec l'utilisateur**, parce que shadcn ne les couvre pas : le couple favorable/défavorable, le thème, et le seuil de lisibilité des étiquettes.

Le preset est **entièrement achromatique** : tous ses tokens sont à chroma 0, y compris `--chart-1` à `--chart-5` qui sont cinq gris. Le seul token coloré livré est `--destructive`. C'est le point de départ, assumé : morpho est un outil de lecture de chiffres, pas une vitrine.

## Tokens

### Couleurs

Toutes en OKLCH, définies dans `src/app/globals.css`, en deux jeux (`:root` et `.dark`). **Aucune couleur en dur dans un composant** — on passe toujours par l'utilitaire Tailwind qui référence le token.

| Rôle | Token | Clair | Sombre |
|---|---|---|---|
| Fond | `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| Encre | `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| Carte | `--card` / `--card-foreground` | blanc / encre | `oklch(0.205 0 0)` / encre claire |
| Primaire | `--primary` / `--primary-foreground` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| Secondaire | `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| Atténué | `--muted` / `--muted-foreground` | `oklch(0.97 0 0)` / `oklch(0.556 0 0)` | `oklch(0.269 0 0)` / `oklch(0.708 0 0)` |
| Bordure / champ | `--border` / `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| Focus | `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |
| Erreur | `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| **Progrès** | `--progress-favorable` | `oklch(0.55 0.12 152)` | `oklch(0.7 0.14 152)` |
| **Recul** | `--progress-adverse` | `= --destructive` | `= --destructive` |

Les deux derniers sont les seuls ajouts de morpho au preset. `--progress-adverse` **pointe sur `--destructive`** plutôt que de dupliquer une valeur : un seul rouge dans le projet, qui suit automatiquement le thème.

Utilitaires Tailwind disponibles : `text-progress-favorable`, `fill-progress-favorable`, `stroke-progress-adverse`, etc. (le mapping est déclaré dans le bloc `@theme inline`).

### Typographie

- Famille : `--font-sans` (Geist, fournie par le preset nova), `--font-mono` pour les valeurs chiffrées alignées si besoin.
- `--font-heading` est aliasé sur `--font-sans` : pas de seconde famille.
- ⚠️ **Chaîne cassée dans le shell, à réparer en s01** : `globals.css` déclare `--font-sans: var(--font-sans)` — une auto-référence, donc une valeur indéfinie — alors que `layout.tsx` expose la police sous `--font-geist-sans`. Tant que ce n'est pas raccordé, aucun écran n'affiche réellement Geist, quoi qu'en dise ce document.
- Valeurs numériques : `tabular-nums`, pour que les colonnes de chiffres s'alignent.
- **Plancher de lisibilité : `--label-min-size: 0.75rem` (12 px)**, exposé en utilitaire `text-label-min`. C'est le seuil chiffré que le critère 7 de s06 délègue à ce document — aucune étiquette de la silhouette ne descend en dessous. **Étendu aux étiquettes de graphe** (s08) : l'étiquette d'une `ReferenceLine` (le nom de la cible posé sur la ligne) suit le même plancher — ce n'est pas une seconde règle, c'est la même appliquée à une deuxième surface qui en a besoin.

### Cible tactile — 44 px

Les défauts du preset sont **sous le seuil iOS**, relevés au registre et non estimés : `Input` en `h-8` (32 px), `Button` en `h-8` par défaut et `h-9` (36 px) en `size="lg"`, contre 44 pt recommandés par Apple.

Ce n'est pas un détail de confort ici. Le PRD décrit un usage debout, téléphone à une main, mètre ruban dans l'autre, et s05 chronomètre dix champs sous 20 secondes. Un champ manqué coûte deux taps.

**Règle** : tout contrôle qu'on touche dans un parcours de saisie — champ, bouton d'action, entrée de navigation — fait au minimum `h-11` (44 px). Les contrôles secondaires, jamais sur le chemin critique, gardent les défauts du preset.

### Espacement, rayon

- Échelle d'espacement : celle de Tailwind v4, par défaut. Aucune valeur arbitraire (`p-[13px]` est interdit).
- **Exception : la géométrie en pourcentages de la silhouette** (s06, décision 20). Les positions (emprise du corps, `top` des étiquettes) viennent de la table du domaine (`src/lib/measurements.ts`, `bodyMapZone`) et passent par l'attribut `style`, jamais par une classe Tailwind arbitraire (`top-[20%]` reste interdit). La règle « aucune valeur arbitraire » porte sur les `className`, pas sur `style` : aucune de ces valeurs n'existe sur l'échelle Tailwind, et `style` reste la seule voie qui ne les invente pas en dur dans une classe.
- Rayon : `--radius: 0.625rem`, avec l'échelle dérivée du preset — `--radius-sm` (×0.6), `md` (×0.8), `lg` (=), `xl` (×1.4), `2xl` (×1.8), `3xl` (×2.2), `4xl` (×2.6). Utiliser les paliers, jamais un rayon en dur.

### Thème

**L'app suit le réglage système.** Le preset fonctionne par classe (`@custom-variant dark (&:is(.dark *))`), donc la classe `dark` doit être posée sur `<html>` d'après `prefers-color-scheme`, par un script inline dans le layout — avant la peinture, pour éviter le flash de thème clair. C'est une tâche du shell (s01), pas un choix à refaire par story.

**Conséquence directe sur chaque story UI** : tout écran se vérifie dans les deux modes. Un contraste qui passe en clair peut tomber en sombre.

## Composants disponibles

`src/components/ui/` est **vide** à ce stade : shadcn n'installe rien à l'init. Chaque composant s'ajoute par la CLI, à la story qui en a besoin :

```bash
npx shadcn@latest add <composant>
```

Composants du registre `@shadcn` (471 items) pertinents pour le périmètre de morpho — vérifiés présents dans le registre, pas supposés :

| Composant | Usage dans morpho | Story |
|---|---|---|
| `button` | Actions : enregistrer, se connecter, se déconnecter, supprimer, réessayer (page `/~offline`) | s02+, s08, s10 |
| `input` | Champs de mesure et email | s02, s03, s08 |
| `label` | Libellé d'un champ | s02 |
| `field` | Groupe libellé + champ + message d'erreur, cohérent partout | s02, s08 |
| `card` | Blocs de l'accueil : poids, IMC, pourcentages hors silhouette ; carte du graphe (s07), rangée d'écart de la cible (s08) | s06, s07, s08 |
| `item` | Ligne d'historique (date + mesures) | s03 |
| `empty` | États vides : aucune session, mesure sans donnée ; page technique de repli `/~offline` hors ligne, route jamais visitée en ligne | s03, s06, s07, s10 |
| `skeleton` | Attente pendant le cold start Neon | s03, s06, s08 |
| `spinner` | Chargement court dans un bouton | s02, s08 |
| `sonner` | Confirmation d'enregistrement, message hors ligne | s03, s08, s10 |
| `alert` | Erreur d'opération (échec réseau, lien expiré, formulaire entièrement vide) ; bandeau « données potentiellement périmées » hors ligne | s02 (installé), s03, s10 |
| `alert-dialog` | Confirmation de suppression d'une session | s09 |
| `dropdown-menu` | Menu secondaire de l'en-tête (profil, graphes, historique, déconnexion), déclencheur `h-11` | E1 (blocage s07, tranché avant s09) |
| `select` | Choix de la mesure affichée sur le graphe | s07 |
| `chart` | Enveloppe Recharts alignée sur les tokens ; ligne de référence du poids cible (s08) | s07, s08 |
| `separator`, `badge`, `tooltip` | Appoint (`separator` : entre les deux `FieldSet` du profil, s08) | s08 (separator) |

**La silhouette n'est pas un composant shadcn.** C'est un SVG applicatif, dans `src/components/`, qui consomme les tokens ci-dessus. C'est le seul élément visuel propre au produit.

## Patterns UI imposés

### Formulaires

- Un champ = un `field` (libellé + contrôle + zone de message). Jamais un `input` nu.
- **`field`, pas `form`.** Le composant `form` du registre est l'ancien style `new-york-v4` et tire `react-hook-form` + `@hookform/resolvers`, qui ne sont pas dans la stack. En `radix-nova`, la composition passe par `field` ; l'état du formulaire vient de React et la validation de Zod, côté serveur.
- Champs numériques : `inputmode="decimal"` pour obtenir le pavé numérique iOS ; la virgule décimale française est acceptée à la saisie.
- Tous les champs de mesure sont **optionnels**. Aucun astérisque, aucun « requis » : le formulaire n'est refusé que s'il est entièrement vide.
- Erreurs **par champ**, sous le champ, jamais un résumé en haut de page.
- Le focus est visible partout (`--ring`) : la saisie se fait au clavier système, sur mobile, en tapant de champ en champ.
- **Valeur pré-remplie non touchée** (s05) : un champ repris de l'historique et pas encore modifié porte `data-prefilled="true"`, sa valeur en `--muted-foreground`, et la légende « Les valeurs grisées sont vos dernières mesures. Touchez un champ pour le remplacer. » est **obligatoire** dès qu'au moins un champ est pré-rempli — la couleur ne porte jamais l'information seule. Seule la valeur à l'intérieur du champ change ; bordure, fond, libellé et hauteur restent ceux d'un champ ordinaire. Le marqueur disparaît, irréversiblement, à la première modification du champ. **Ne s'applique jamais aux valeurs réellement enregistrées** : sur un écran d'édition (s09), la valeur affichée est celle stockée en base, elle n'est donc jamais grisée — c'est une valeur confirmée, pas une suggestion.

### États

| État | Traitement |
|---|---|
| Vide | `empty`, avec l'action qui en sort. Jamais une page blanche ni un graphe aux axes nus. |
| Confirmation d'écran persistante | `empty` également — cas de l'état « lien envoyé » de s02, où l'utilisateur quitte l'app pour son client mail. Un toast disparaîtrait avant d'être utile. `empty` ne sert donc pas qu'aux états vides. |
| Erreur de lecture | `empty`, titre + description en clair + bouton « Réessayer ». **Reste la règle** quand tout le contenu de l'écran dépend de cette lecture — l'historique de s03, les graphes de s07. |
| Chargement | `skeleton` à la forme du contenu attendu. **Jamais d'écran d'attente bloquant** : le cold start Neon est de ~500 ms et le budget de saisie est de 20 s. |
| Introuvable ou non autorisé | `empty`, écran **identique** dans les deux cas — jamais un message distinct « cette ressource ne vous appartient pas » (s09, D6). Rendu par le fichier de convention `not-found.tsx` du segment concerné, jamais par un appel direct à un composant `Empty` depuis la page : `notFound()` ne rend que le `not-found.tsx` le plus proche (`node_modules/next/dist/docs/.../not-found.md`). Premier cas d'usage : `src/app/historique/[id]/not-found.tsx`. |

**Exception portée — erreur de lecture non bloquante (s05).** Quand la lecture qui échoue n'est qu'un **confort** et que l'écran reste pleinement utilisable sans elle (le pré-remplissage de `/saisie` : le formulaire fonctionne vide, exactement comme au premier usage), l'échec **ne** prend **pas** la forme `empty` + « Réessayer ». Il se signale par une ligne atténuée *in situ*, en `--muted-foreground`, à l'endroit où le confort manquant aurait agi — pour `/saisie` : « Vos dernières valeurs n'ont pas pu être chargées. Vous pouvez saisir directement. » L'écran entier ne disparaît jamais derrière un panneau d'erreur pour la perte d'un confort. **Condition d'application** : seulement quand l'échec ne retire qu'un confort, jamais quand il retire le contenu que l'écran existe pour montrer — c'est la ligne au-dessus qui reste la règle dans ce cas.
| Erreur | Message en clair, en français, disant quoi faire. Pas de code technique à l'écran. |
| Succès | `sonner`, discret, non bloquant. |

### Feedback

- Confirmation d'action → toast `sonner`. **Le `<Toaster />` se monte une seule fois, à la racine** (`src/app/layout.tsx`, décidé en s03) : aucun layout authentifié n'existe encore (l'écran authentifié de s02 vit dans `src/app/page.tsx`), et en créer un juste pour héberger le toast ajouterait une structure que s06 refera de toute façon. Constat assumé : `sonner` tire `next-themes`, dont le projet n'a pas besoin puisque le thème est posé par un script inline (§ Thème) ; vérifié dans le paquet installé, `useTheme()` hors provider ne lève pas et retombe sur `"system"`.
- **Erreur de champ** → inline, sous le champ concerné.
- **Erreur d'opération** — celle qui n'appartient à aucun champ : échec réseau, lien expiré, formulaire entièrement vide → `alert`, **adjacente à l'action qui l'a déclenchée**. Le design system interdisait « un résumé en haut de page » : cette interdiction vise le résumé des erreurs de champ, pas l'erreur d'opération, qui n'a nulle part ailleurs où vivre. Sur un formulaire d'un seul champ (écran de connexion, s02), « adjacente » veut dire en tête, puisque la tête est aussi le seul champ. Sur un formulaire plus long qu'un écran (`/saisie`, s03, dix champs), « en tête » placerait l'alerte hors du viewport au moment où l'utilisateur tape le bouton d'envoi — la position qui reste réellement adjacente à l'action y est **juste au-dessus du bouton d'envoi**, pas en tête. C'est la même règle appliquée deux fois, pas deux règles.
- Action destructive (supprimer une session) → `alert-dialog`, avec le contenu concerné nommé dans le texte.

### Zone dangereuse

Motif entériné par s09 (D4) pour tout écran qui porte une action destructive à côté d'une action principale :

- **Toujours en fin d'écran**, après un `FieldSeparator`, sous l'action principale — on ne la rencontre qu'après avoir dépassé celle qu'on cherchait.
- **Précédée d'une ligne d'avertissement** en `--muted-foreground`, qui nomme ce qui est perdu (pas un texte générique « attention »).
- Le bouton lui-même reste `variant="destructive"`, `h-11`, et la confirmation qui le suit (`alert-dialog`) nomme la ressource concernée dans son titre (D9) — jamais un « Êtes-vous sûr ? » nu.

### Format numérique

Convention globale — elle sert à la silhouette, à l'historique, aux graphes et au poids cible :

- **Virgule décimale française**, une décimale, pas de zéro de queue superflu (`82,4 kg`, pas `82,40 kg`).
- Unité collée à la valeur, espace insécable avant `%`.
- **Delta toujours signé**, `+` explicite, précédé du glyphe de verdict (`▲` / `▼`).
- Delta exactement nul → sans signe, sans glyphe, en `--muted-foreground`.
- `tabular-nums` sur toute colonne de chiffres, pour que les valeurs s'alignent.
- **Le glyphe de verdict ne qualifie qu'un delta de progression** — « comment ce chiffre a-t-il changé depuis la première mesure » (silhouette, s06). L'écart entre une valeur et une **cible choisie par l'utilisateur** (poids cible, s08) est un nombre signé de nature différente : il utilise la même règle de signe et le même arrondi, mais **jamais** le glyphe ni une couleur de progression — la cible ne porte aucune direction déclarée, contrairement à la mesure elle-même (ADR 012, `docs/decisions/012-target-gap-is-not-a-delta.md`).

**Alignement base ↔ affichage (s03)** : les colonnes `numeric` des mesures sont déclarées `precision: 5, scale: 1` (`src/lib/db/schema.ts`) — une décimale, jamais deux. C'est la même échelle que cette convention d'affichage : la valeur stockée et la valeur affichée n'ont donc jamais à diverger (pas d'arrondi supplémentaire à l'écran, pas de zéro de queue à masquer). L'arrondi lui-même se fait dans l'app, à la frontière serveur (`Math.round(v * 10) / 10`, `src/lib/measurements.ts`), jamais silencieusement par Postgres.

**Champ de saisie vs surface d'affichage (s09, D7)** : deux formats **différents et voulus**, une seule source chacun. `formatMeasurementValue` (surface d'affichage — historique, silhouette, graphes) colle l'unité et l'espace insécable, comme ci-dessus. `formatMeasurementValueForInput` (champ de saisie éditable) rend la même précision **sans unité et sans espace**, pour rester une chaîne que `parseMeasurementInput` peut relire telle quelle. Ce n'est pas un second système de formatage : le champ de saisie n'affiche jamais une valeur avec son unité collée, et la surface d'affichage n'est jamais réinjectée dans un `<input>`.

### Format de date

Convention transversale (s07) : deux formats, jamais un troisième, tous deux en `fr-FR` **explicite** et `timeZone: 'UTC'` **explicite** — jamais `toLocaleString()` nu, qui diverge entre serveur et navigateur et produit un écart d'hydratation.

- **Étiquette d'axe, abrégée** : jour + mois court (`5 janv.`, `16 févr.`). Utilisée pour les graduations d'un axe temporel, où la place est comptée.
- **Date isolée, en toutes lettres, sans jour de semaine** : jour + mois + année (`26 janvier 2026`). Utilisée pour une valeur ponctuelle mise en avant (l'en-tête chiffré et le tooltip d'un graphe).
- Distincte de `formatSessionDate` (s03, `src/lib/date.ts`), qui **ajoute** le jour de semaine (`dimanche 2 août 2026`) — c'est la convention de l'historique, une liste de sessions, pas celle d'un graphe.
- `timeZone: 'UTC'` parce que `measured_on` est une `date` sans heure : formater dans le fuseau local du processus déciderait arbitrairement d'une heure de la journée et pourrait décaler l'étiquette d'un jour sur un fuseau à l'ouest de Greenwich.

### Silhouette et progression

- Le sens « favorable » est **déclaré par mesure** dans le domaine. Il ne se déduit jamais du signe du delta : une taille qui baisse et un biceps qui monte sont deux progrès.

**Déclaration complète, arrêtée avec l'utilisateur** — c'est la table que le domaine implémente, et la seule source :

| Mesure | Favorable quand | Origine |
|---|---|---|
| `biceps_cm` | ↑ monte | circonférence de muscle — on veut du volume |
| `thigh_cm` | ↑ monte | idem |
| `shoulders_cm` | ↑ monte | idem |
| `calf_cm` | ↑ monte | idem |
| `chest_cm` | ↓ baisse | circonférence de gras dans ce contexte |
| `waist_cm` | ↓ baisse | idem |
| `hips_cm` | ↓ baisse | idem |
| `weight_kg` | ↓ baisse | objectif du PRD : perte de poids |
| `body_fat_pct` | ↓ baisse | découle du précédent |
| `muscle_pct` | ↑ monte | contrepartie de la masse grasse |

**L'IMC n'a pas de direction déclarée** (s06, décision 5). Ce n'est pas un `kind` de la table ci-dessus — cette table a été *arrêtée avec l'utilisateur* mesure par mesure, et l'IMC n'y a jamais figuré. Il s'affiche donc **neutre** : valeur, delta signé, mais **aucun glyphe et aucune couleur de progression**, tant qu'une décision explicite ne lui en donne pas une.

La règle des circonférences n'est pas « monte = bien » ni « baisse = bien » : elle sépare **les zones où le volume est du muscle** (bras, cuisse, épaules, mollet) de **celles où il est du gras** (poitrine, taille, hanches). Le poids et les deux pourcentages ne sont pas des circonférences et suivent l'objectif du PRD.
- La couleur ne porte **jamais** l'information seule. Chaque zone affiche sa valeur et son delta signé (`-4,2 cm`).
- **Le signe ne suffit pas à porter le verdict.** Première rédaction de ce document : « le delta signé suffit, la couleur ne fait que renforcer ». C'était faux — `-4,2 cm` est un progrès au tour de taille et un recul au biceps, donc le signe seul est ambigu dès que le sens favorable varie par mesure. Un lecteur avec une déficience rouge-vert (≈ 8 % des hommes) ne peut pas trancher. Le delta est donc **précédé d'un glyphe qui qualifie le verdict, pas le sens du chiffre** : `▲` progrès, `▼` recul, aucun glyphe si le delta est nul. Une légende sous la silhouette explicite les deux glyphes. Pas d'icône lucide ici : un glyphe typographique évite d'ouvrir le sujet des icônes.
- Delta exactement nul → affiché sans signe et sans glyphe, en `--muted-foreground` : ce n'est ni un progrès ni un recul.
- Zone sans donnée → `--muted`, aucun delta, aucune couleur de progression.
- Zone avec une seule mesure → valeur affichée, pas de delta, pas de couleur : il n'y a rien à comparer.

### Graphes

- **Une seule série à la fois.** Les échelles (kg, cm, %) ne sont pas comparables.
- Trait de la mesure : `--foreground`. Les `--chart-1..5` du preset sont des gris pensés pour des aires empilées ; `--chart-1` (`oklch(0.87 0 0)`) est quasi invisible en trait sur fond clair.
- Ligne du poids cible : `--muted-foreground`, en tirets, pour se distinguer sans concurrencer la courbe.
- Axe temporel réel, jamais catégoriel. Un trou n'est ni un zéro ni une interpolation silencieuse.
- **Quand une cible est affichée, le domaine de l'axe Y l'inclut toujours** (s08) — une règle de rendu, pas un détail technique : avec le comportement par défaut d'une ligne de référence (masquée dès qu'elle sort du domaine visible), une cible en dehors de la plage des mesures — le cas normal en début d'objectif — ferait disparaître la ligne entièrement. Une ligne de cible absente n'est jamais un état acceptable tant qu'une cible est définie.

## Do / Don't

- ✅ Composer au-dessus de `src/components/ui/` — ces fichiers sont générés par la CLI et ne s'éditent pas à la main.
- ✅ Toute couleur vient d'un token ; tout rayon vient d'un palier ; tout espacement vient de l'échelle Tailwind.
- ✅ Vérifier chaque écran en clair **et** en sombre, et à 375 px de large en portrait.
- ✅ Signaler un *design system gap* quand le besoin n'est pas couvert, et mettre à jour ce document — c'est une décision, pas une improvisation.
- ❌ Pas de couleur en dur (`#0E7C6B`, `text-green-500`), pas de valeur arbitraire (`p-[13px]`, `text-[13px]`).
- ❌ Pas de `delta < 0 ? vert : rouge`. Le sens favorable est une propriété de la mesure.
- ❌ Pas d'information portée par la seule couleur.
- ❌ Pas de seconde famille typographique, pas de police importée.
- ❌ Pas de composant UI écrit à la main quand le registre shadcn en a un.
- ❌ Pas de spinner plein écran pendant le cold start : un squelette à la forme du contenu.
- ❌ Pas d'étiquette de silhouette ou de graphe sous `text-label-min` (12 px).

## Navigation

Le système ne listait aucun composant de navigation, et le profil (s04) est un quatrième écran que l'architecture ne décrivait pas. Sans convention, chaque story improvise son propre lien. Décidé ici :

- **En-tête collant** sur chaque écran authentifié : mot-symbole `morpho` à gauche, action principale à droite.
- Sur l'accueil, l'action principale est **Saisir** — c'est elle qui porte le critère du tap unique, et rien ne doit la concurrencer.
- Les entrées secondaires (profil, graphes, historique, déconnexion) vivent dans un menu de l'en-tête, jamais en concurrence du bouton Saisir. **Construit** (E1, blocage s07 tranché avant s09/s10) : `dropdown-menu` du registre shadcn, déclencheur `h-11`, dans `src/components/AppHeader.tsx`.
- Les écrans secondaires portent un retour en tête, à gauche.
- **Pas de logo.** `morpho` s'écrit en toutes lettres, en `--muted-foreground`, dans la famille du système. Aucun asset, aucune seconde famille typographique.

## Silhouette — géométrie

Le gap n°1 est refermé par `docs/designs/s06-body-map.md`, qui fait foi : `viewBox="0 0 120 312"`, corps rendu à 34 % de la largeur du conteneur dans la bande centrale 33 %–67 %, deux colonnes d'étiquettes HTML à 30 % collées aux bords, lignes de rappel en `--border`, SVG en `aria-hidden` (toute l'information est dans le texte HTML).

**Aucun `<text>` dans le SVG** : une étiquette SVG voit sa taille de police multipliée par l'échelle du `viewBox`, ce qui rendrait le plancher de 12 px invérifiable. Les étiquettes sont du HTML positionné en pourcentages.

Remplissage d'une zone : le token de progression à `fill-opacity: 0.22`, contour au même token à pleine opacité. Un aplat plein est illisible sous une étiquette.

s07 et s09 s'y réfèrent au lieu de le redécouvrir.

## Identité PWA

Ferme le gap n°3 (s10, décision 7). Cinq PNG dans `public/icons/`, générés une fois par `scripts/generate-icons.mjs` (non branché sur `npm run build`) et commités :

| Fichier | Taille | `purpose` |
|---|---|---|
| `icon-32.png` | 32×32 | — (favicon) |
| `icon-192.png` | 192×192 | `any` |
| `icon-512.png` | 512×512 | `any` |
| `icon-512-maskable.png` | 512×512 | `maskable` |
| `apple-touch-icon-180.png` | 180×180 | — (iOS, opaque, coins carrés — iOS applique son propre masque) |

Contenu : la lettre **`m` bas de casse, blanche sur `#0a0a0a`**, centrée, famille sans-serif système — pas le mot-symbole complet (illisible à 60 pt sur un écran d'accueil), pas de logo (cohérent avec § Navigation). Variante `maskable` : glyphe contenu dans le cercle central à **80 %** du côté (marge de sécurité Android).

**Écran de démarrage (splash) et couleurs du manifest** : `background_color` et `theme_color` du manifest n'acceptent **qu'une** valeur, non médiatisable (contrairement à `viewport.themeColor`, qui reste bi-thème et suit `prefers-color-scheme`). Arbitré à **`#0a0a0a`** — la conversion sRGB exacte de `--background` en thème sombre (`oklch(0.145 0 0)`) — plutôt que `#ffffff` (conversion de `oklch(1 0 0)` en clair), pour trois raisons : l'icône est blanche sur `#0a0a0a`, donc la vignette et le fond du splash forment une surface continue ; un flash blanc plein écran en environnement sombre est le seul des deux cas réellement pénible, et c'est exactement ce que le script de thème du shell (s01) existe pour éliminer ailleurs ; la balise `theme-color` réellement lue par les navigateurs pour teinter leur interface est celle, médiatisée, de `viewport`, jamais celle du manifest. **Contrepartie assumée** : sur un appareil en thème clair, le splash est sombre puis l'app peint en clair — à observer sur appareil, jamais garanti par un test.

## Textes hors ligne (s10)

Les deux messages du parcours hors ligne, fixés ici pour ne pas être réinventés à chaque écran :

- **Bandeau « données périmées »** (critère 4, `OfflineBanner`) : « Vous êtes hors ligne. Les données affichées peuvent être périmées. »
- **Refus de saisie hors ligne** (critère 5, toast `sonner`) : « Saisie impossible hors ligne. Vos valeurs sont conservées, réessayez une fois reconnecté. »

## Marqueur de version

Motif introduit par s10 (critère 6) : le sha court du déploiement (`resolveRevision`), en `--muted-foreground`, en bas de l'écran profil (s04). Ce n'est pas décoratif — c'est le seul moyen de distinguer au doigt, sur l'appareil, le déploiement A du déploiement B lors du protocole de lancement à froid. Élément d'interface permanent désormais, pas un artefact de debug à retirer.

## Gaps connus

Ce que ce document ne couvre toujours pas :

1. **Icônes** — la librairie est `lucide` (fournie par le preset), mais aucune icône n'est attribuée à une action. Les designs proposent `MailCheck`, `TriangleAlert`, `LogOut`, `ChevronLeft` ; `Loader2Icon` est imposé par `Spinner`. À arbitrer d'un coup plutôt que story par story. s09 décline aussi (D1) : affordance par le mot « Modifier », bouton de suppression en texte seul, aucun `AlertDialogMedia`.
2. **Suffixe d'unité dans un champ** — pas de composant d'addon. Contourné en mettant l'unité dans le libellé (« Taille (cm) »). Le motif revient en s08. À trancher globalement.
3. **~~Icônes et écran de démarrage PWA~~ — fermé par s10.** Voir § Identité PWA.
4. **Seuil de contraste de la variante `destructive`** (s09, D3) — aucun seuil chiffré n'est déclaré dans le preset ni ici ; `alert-dialog` et le bouton de suppression sont translucides, donc leur contraste dépend du fond (`--background` sur l'écran, `--popover` dans le dialogue). Constaté à l'œil, en clair et en sombre, story par story ; aucun outil de mesure n'est en place.
5. **Composant de navigation secondaire (fil d'Ariane, lien de retour)** (s09, D8) — le système impose la règle (« retour en tête, à gauche », `docs/design-system.md` § Navigation) mais n'attribue aucun composant : chaque écran compose un `Link` texte à la main. Un besoin de second niveau (breadcrumb à plus de deux étapes) resterait à trancher.
