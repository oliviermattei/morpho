# Design — Story s08-target-weight

> Dérivé de `docs/design-system.md` uniquement. Aucun composant, aucun token, aucune couleur inventés ici.
> Cible de référence : **iOS Safari, portrait, 375 px**. Vérifié en clair **et** en sombre.
> s08 n'ouvre aucun écran : elle **ajoute une section** au profil de s04 et **une ligne + une rangée de texte** au graphe de s07.

## Screen(s)

Deux surfaces, aucune nouvelle route.

### A. Profil — un second `FieldSet` « Poids cible » (sur l'écran de s04)

```
┌───────────────────────────── 375 px ─────────────────────────────┐
│ [‹]  Profil                                                      │
├──────────────────────────────────────────────────────────────────┤
│  Taille de référence                    ← FieldSet livré par s04 │
│  Taille (cm)  [ 175                    ]                         │
│  ────────────────────────────────────── ← Separator              │
│  Poids cible                            ← FieldSet ajouté par s08│
│                                                                  │
│  Poids cible (kg)                       ← FieldLabel             │
│  ┌────────────────────────────────────┐                          │
│  │ 70                                 │ ← Input, inputmode dec.  │
│  └────────────────────────────────────┘                          │
│  Apparaît comme ligne de référence sur le graphe du poids, avec  │
│  l'écart depuis votre dernière pesée. Ne s'applique à aucune     │
│  autre mesure. Videz le champ pour retirer la cible.             │
│                                          ← FieldDescription      │
│  ⚠ <message d'erreur>                    ← FieldError            │
│                                                                  │
│  ┌────────────────────────────────────┐                          │
│  │            Enregistrer             │ ← Button, w-full, unique │
│  └────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
```

Décisions et leur justification :

- **Un seul bouton « Enregistrer » pour les deux sections.** La note agentique de la story impose de « réutiliser le stockage de profil créé en s04 plutôt que d'ouvrir un second mécanisme de préférences » — un second formulaire avec son propre bouton serait ce second mécanisme sous forme d'UI. Un `FieldSet` par sujet, un `Separator` entre eux, un enregistrement.
- **L'unité vit dans le libellé** (« Poids cible (kg) »), comme la taille en s04. Le design system ne référence aucun composant d'addon de champ. Voir *gap 2*.
- `inputmode="decimal"` (pattern imposé « Formulaires »), virgule décimale française acceptée.
- **Aucun astérisque, aucun « requis »**, et surtout **aucune valeur par défaut ni suggestion** dérivée du poids actuel : le critère 4 exige qu'aucune cible n'existe par défaut. Le champ vide est l'état normal, pas un état d'erreur.
- **Aucune carte « écart » sur le profil.** L'écart s'affiche à un seul endroit — le graphe du poids (surface B). Le dupliquer créerait deux vérités de formatage pour un même nombre. Le retour d'enregistrement est le toast `sonner`, pas un recalcul affiché sur place. (Différence assumée avec s04, où la `Card` « IMC actuel » est le seul moyen de rendre visible le recalcul de l'historique — la cible, elle, n'a rien à recalculer.)
- La `FieldDescription` porte trois informations qui verrouillent trois critères : **où** la cible apparaît (critère 2), qu'elle **ne s'applique qu'au poids** (critère 5), et **comment la retirer** (critère 4).

### B. Graphe du poids — ligne de référence + rangée d'écart (sur l'écran de s07)

s08 ajoute exactement deux choses à la carte du graphe de s07, et rien d'autre :

```
┌─ Card (s07) ───────────────────────────────────────┐
│ Dernière valeur  74,1 kg   30 mars 2026            │
│ ┈┈  Cible 72,0 kg · écart +2,1 kg   ← AJOUT s08 (1)│
│                                                     │
│  78 ┼─────────────────────────────                  │
│     │╲                                              │
│  76 ┼──╲──────────────────────────                  │
│     │   ╲___                                        │
│  74 ┼───────╲──────────────────────                 │
│     │        ╲___                                   │
│     │  Cible 72,0 kg          ← étiquette, AJOUT (2)│
│     ├┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ ← ReferenceLine   (2)│
│     └────────────────────────────                   │
│      5 janv.    16 févr.    30 mars                 │
│ Seules les sessions où le poids a été saisi… (s07)  │
└─────────────────────────────────────────────────────┘
```

Règles de rendu, toutes issues du design system ou des critères :

1. **La ligne est en `--muted-foreground`, en tirets** — `docs/design-system.md` § Graphes le dit littéralement. Elle se distingue du trait des mesures par **trois** caractéristiques indépendantes de la couleur : le pointillé, l'épaisseur moindre, l'absence de points. Le `stroke` doit être passé explicitement : le défaut de Recharts est `"#ccc"`, que `ChartContainer` détourne vers `--border` par un sélecteur d'attribut (Research, trap 2) — ce qui contredirait le design system.
2. **La ligne porte une étiquette textuelle** — « Cible 72,0 kg » — posée **dans** l'aire de tracé, du côté le plus dégagé (au-dessus de la ligne par défaut, en dessous si la ligne est trop haute). Taille : 12 px, le plancher `--label-min-size`. Sans étiquette, la ligne ne dit pas ce qu'elle est, et l'information reposerait sur son seul aspect — ce que le design system interdit. Voir *gap 3*.
3. **L'écart est répété en texte**, au-dessus du graphe, dans la rangée `Cible <valeur> · écart <valeur signée>`. C'est cette rangée qui satisfait le critère 3, pas le graphe : le graphe montre, le texte chiffre.
4. **Le domaine de l'axe Y inclut la cible.** C'est une règle de rendu, pas un détail technique : avec le défaut de Recharts (`ifOverflow: "discard"`), une cible hors du domaine des mesures — *le cas normal au début d'un objectif* — fait disparaître la ligne entièrement (Research, trap 1). Le moyen (`ifOverflow="extendDomain"` ou domaine calculé) relève de `/ks-plan` ; le résultat visuel est non négociable. L'état **B5** de la maquette montre le prix à payer : la courbe se tasse. C'est le compromis retenu — une ligne absente est un critère faussement coché.
5. **Aucune couleur de progression, nulle part.** Ni `--progress-favorable`, ni `--progress-adverse`, ni sur la ligne, ni sur l'écart. Le sens « favorable » se déclare par mesure, et il **n'est déclaré pour le poids nulle part** : s06 renvoie explicitement le sujet ici (Research s06, question 4 ; Research s08, trap 6), et s04 a pris la même décision pour l'IMC (son *gap 5*). Pas de sens déclaré = pas de couleur. Voir *gap 4*.
6. **Formulation strictement neutre.** « écart +2,1 kg », jamais « il vous reste », « retard », « en avance », « dépassée ». morpho ne connaît aucune direction d'objectif : une cible peut être une perte comme une prise. Un écart négatif est un nombre signé, point — c'est la lecture littérale du critère 6. Seule exception, vraie dans les deux sens : quand l'écart arrondi vaut `0,0`, la note de la carte dit « Cible atteinte. »
7. **`0,0 kg`, jamais `-0,0 kg`.** Le formateur français ordinaire produit `-0,0` sur un `-0` (mesuré en Research) — soit exactement l'« écart négatif présenté comme un retard » que le critère 6 interdit. `signDisplay: 'exceptZero'` le neutralise. La règle vit dans l'utilitaire de formatage, jamais dans le composant. Voir *gap 5*.
8. **Rien sur les autres séries.** Aucune ligne, aucune rangée d'écart sur les neuf autres mesures — **ni sur l'IMC**, bien qu'une cible de poids en induise mécaniquement une (lecture littérale du critère 5 ; Research, question 12, à confirmer en `/ks-plan`). C'est le genre d'ajout « logique » qu'un agent fait spontanément : il est interdit ici.
9. **Sans cible : rien.** Pas de rangée vide, pas de `—`, pas d'invitation « définissez une cible ». L'écran est celui de s07, à l'octet près (critère 4).

## Mockup

`docs/designs/s08-target-weight.html` — référence visuelle. **NE PAS copier en production** : Execute construit avec les vrais composants shadcn générés dans `src/components/ui/` et le vrai `ReferenceLine` de Recharts.

Le fichier rend les quinze états ci-dessous dans des cadres de 375 px, chacun étiqueté, en un seul défilement. Il suit le thème système (`prefers-color-scheme`), et la dernière section force les deux thèmes côte à côte. Les blocs estompés sont du contexte livré par s04 ou s07, rappelé pour situer l'ajout.

Vérifications faites sur le fichier rendu : **aucun `.phone` ne déborde** (`scrollWidth === clientWidth` sur les 16 cadres), **aucun texte sous 12 px** sur toute la page.

Écarts assumés du mockup, à ne pas reproduire :
- Geist (`--font-sans`) n'est pas chargée (aucun asset externe autorisé) : la maquette retombe sur la pile système.
- Le graphe est un SVG écrit à la main en `viewBox 0 0 320 180` (320 ≈ la largeur réelle du contenu à 375 px, donc 1 unité ≈ 1 px et `font-size: 12` = 12 px réels). En production c'est Recharts dans `ChartContainer`.
- Les icônes sont des SVG `lucide` recopiés inline (`chevron-left`, `circle-alert`, `loader-circle`) ; en production elles viennent de `lucide-react`.
- Les classes du mockup sont ad hoc ; l'implémentation utilise les utilitaires Tailwind du preset.

## Reused components (from the design system)

Tous vérifiés dans le tableau du registre de `docs/design-system.md`, et confirmés présents dans le style `radix-nova` par la Research.

| Composant | Où | Installé par |
|---|---|---|
| `field` | `FieldSet` + `FieldLegend` « Poids cible », `Field`, `FieldLabel`, `FieldDescription`, `FieldError` | s03/s04 |
| `input` | le champ « Poids cible (kg) », `inputmode="decimal"` | s03 |
| `label` | dépendance de registre de `field` | — |
| `button` | « Enregistrer » (pleine largeur, unique pour le profil entier) | s02 |
| `spinner` | dans le bouton pendant l'écriture, jamais en plein écran | s02 |
| `sonner` | toast « Poids cible enregistré. » | s03 |
| `skeleton` | attente du cold start : forme du champ (profil) **et forme de la rangée d'écart** (graphe) | s03 |
| `separator` | entre les deux `FieldSet` du profil | dépendance de `field` |
| `card` | la carte du graphe, dans laquelle s08 insère sa rangée d'écart | s06 |
| `chart` | `ChartContainer` + `ReferenceLine` de Recharts | s07 |
| `select` | choix de la mesure — **contexte, inchangé par s08** | s07 |
| `empty` | états vides et erreur du graphe — **hérités de s07, non dupliqués** | s07 |

**Aucun composant nouveau n'est requis par s08.** Tous arrivent avec une story antérieure ; s08 compose dedans. (À la date de la Research, `src/components/ui/` est vide et aucune story n'est livrée : l'installation effective reste à faire par les stories propriétaires.)

Tokens utilisés, aucun autre : `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--primary`, `--primary-foreground`, `--destructive`, `--label-min-size`, `--radius` (paliers).
**Aucun usage de `--progress-favorable` / `--progress-adverse`** — voir *gap 4*. **Aucun usage de `--chart-1..5`** : ce sont cinq gris pensés pour des aires empilées (design system § Graphes).

## States

### A. Profil — champ « Poids cible » (états A1 à A5 du mockup)

| État | Rendu |
|---|---|
| **Vide** (aucune cible — état par défaut) | Champ vide, `placeholder` « 70 ». `FieldDescription` visible. Aucune invitation, aucune suggestion, aucun encart : l'absence de cible est un état normal, pas un manque à combler. |
| **Chargement** (cold start ~500 ms) | `skeleton` à la forme exacte du contenu : barre de libellé, barre de champ, deux barres de description. Le bouton reste rendu et désactivé. Jamais d'écran d'attente bloquant. |
| **Renseigné** | Champ pré-rempli avec la valeur persistée, au format français (`72,0`). |
| **Enregistrement en cours** | Bouton désactivé, libellé « Enregistrement… », `spinner` à gauche. Le champ reste lisible et n'est pas vidé. |
| **Erreur de validation** | `FieldError` sous le champ, `role="alert"`, en `--destructive`, bordure du champ en `--destructive`. Hors plage → « Indiquez un poids cible entre 30 et 300 kg. » ; format invalide → « Indiquez un nombre, par exemple 70. » **Les bornes 30/300 sont un exemple d'affichage** : la plage physiologique de la cible est la question 8 de la Research, à fixer en `/ks-plan` avec celle de `weight_kg`. Pas de résumé en haut de page, pas de code technique. |
| **Erreur serveur / réseau** | Même emplacement : « Enregistrement impossible pour l'instant. Réessayez. » Le bouton redevient actionnable, la valeur saisie n'est pas perdue. |
| **Succès** | Toast `sonner` « Poids cible enregistré. », discret, non bloquant. Aucune redirection automatique vers le graphe. |

**Point non tranché, hérité :** le mockup montre la variante « vider le champ retire la cible » (`target_weight_kg → NULL`), qui est le seul chemin décrit par le critère 4 pour revenir à l'état sans cible. C'est la question 7 de la Research, **jumelle de celle de la taille en s04** : les deux se décident ensemble. Si `/ks-plan` tranche l'inverse, seule la dernière phrase de la `FieldDescription` change et un message d'erreur de champ vide s'active.

### B. Graphe du poids (états B1 à B10 du mockup)

| État | Rendu |
|---|---|
| **Sans cible** | Le graphe de s07, intact. Ni ligne, ni rangée d'écart, ni placeholder. *(critère 4)* |
| **Avec cible, écart positif** | Ligne en tirets `--muted-foreground` + étiquette « Cible 72,0 kg » ; rangée « Cible **72,0 kg** · écart **+2,1 kg** ». *(critères 2 et 3)* |
| **Cible atteinte** | Écart `0,0 kg` — **jamais** `-0,0 kg`. La ligne passe par le dernier point. Note de carte : « Cible atteinte. » *(critère 6)* |
| **Cible franchie** (écart négatif) | « écart **-0,9 kg** », affiché exactement comme un écart positif. Aucune couleur, aucune mise en garde, aucune notion de retard. *(critère 6)* |
| **Cible lointaine** (hors du domaine des mesures) | L'axe Y s'étend pour inclure la cible ; la ligne reste visible, la courbe se tasse. État **B5** — le plus important de la maquette : c'est le cas où le défaut de la librairie ferait disparaître la ligne. |
| **Autre mesure sélectionnée** (et IMC) | Aucune ligne, aucune rangée d'écart. La carte est celle de s07. *(critère 5)* |
| **Un seul point + cible** | Le point s'affiche seul, la ligne reste posée, l'écart se calcule sur ce point. Rien ne plante. |
| **Chargement** | `skeleton` à la forme de la carte, **rangée d'écart comprise** : sinon la carte se réagence sous les doigts à l'arrivée des données. Le sélecteur reste utilisable. |
| **Vide** (aucune session, ou poids jamais saisi) | État vide de s07 (`empty`), **non dupliqué** : sans dernier poids, il n'y a pas d'écart à calculer, donc aucune ligne et aucune rangée — même si une cible est définie. |
| **Erreur de chargement** | État d'erreur de s07, inchangé. s08 n'ajoute pas un second message, et surtout ne calcule aucun écart sur une valeur manquante. |
| **Bi-thème** | Section B10, clair et sombre forcés côte à côte. En sombre, `--muted-foreground` passe de `oklch(0.556)` à `oklch(0.708)` pendant que le trait des mesures passe au blanc cassé : **c'est le pointillé, pas la couleur, qui porte la distinction** — vérifiable dans les deux jeux de tokens. |

## Design system gaps

Besoins que `docs/design-system.md` ne couvre pas. **Signalés, pas comblés.** À trancher, puis à reporter dans le design system.

1. **Le tableau des composants du design system saute s08.** Il attribue des composants de s02 à s10 sauf à cette story (constat de la Research, trap 12). Rien n'est inventé ici — s08 ne compose qu'avec des composants déjà attribués — mais la ligne manquante est à ajouter : *s08 → `field`, `input`, `button`, `spinner`, `sonner`, `separator` (profil) ; `card`, `chart` (graphe)*.

2. **Pas de composant d'addon d'unité dans un champ.** Déjà signalé en s04 (*gap 3*) pour « cm », re-rencontré ici pour « kg ». Contourné de la même façon : l'unité dans le libellé. Le motif s'est maintenant produit deux fois : à trancher globalement, pas story par story.

3. **L'étiquette d'une ligne de référence n'est spécifiée nulle part.** Le design system fixe la couleur et le style du trait (« ligne du poids cible : `--muted-foreground`, en tirets ») mais **rien** sur son étiquette : ni contenu, ni position, ni taille de police. Proposition de ce design, à valider : « Cible 72,0 kg », 12 px, dans l'aire de tracé, du côté le plus dégagé. Deux conséquences à consigner : (a) le plancher `--label-min-size` est aujourd'hui déclaré pour les étiquettes de la **silhouette** — l'étendre aux étiquettes de **graphe** est une décision ; (b) l'étiquette est le premier candidat au débordement à 375 px, donc sa longueur maximale est une contrainte, pas un détail.

4. **Aucun sens « favorable » n'est déclaré pour le poids.** s06 renvoie le sujet à s08, s08 constate qu'il n'appartient pas au design : déclarer qu'une cible est un objectif de perte ou de prise est une décision **produit/domaine**, et morpho refuse par ailleurs toute classification médicale (PRD). Conséquence appliquée ici, cohérente avec le *gap 5* de s04 sur l'IMC : **aucune couleur de progression sur la cible ni sur l'écart**, formulation strictement neutre. Si le domaine déclare un jour une direction, la couleur pourra être ajoutée — le texte signé restera obligatoire de toute façon.

5. **Toujours aucune convention de formatage numérique partagée** (*gap 6* de s04, non résolu). s08 la rend urgente : le même utilitaire doit produire l'écart signé du graphe (`+2,1 kg`, `signDisplay: 'exceptZero'` pour tuer le `-0,0`), les deltas de la silhouette de s06 (`-4,2 cm`) et l'IMC de s04 (`23,6`). Trois stories, un seul module — sinon trois arrondis divergents. À consigner comme convention du design system, avec la question de `--font-mono` pour les valeurs chiffrées (le mockup l'emploie pour les nombres de la carte, en écho à s07).

6. **La section § Graphes ne dit rien du domaine des axes.** Elle spécifie une couleur et un style pour la ligne cible, mais la contrainte réellement décisive est ailleurs : **le domaine de l'axe Y doit inclure la cible**, sinon la ligne n'est pas dessinée du tout. C'est une règle de rendu à ajouter au design system, au même titre que « axe temporel réel, jamais catégoriel ».

7. **Pas de pattern pour un écran de profil à plusieurs sections.** Hérité du *gap 1* de s04 (aucun pattern de navigation, aucun composant d'en-tête). s08 y ajoute une question : un formulaire et un bouton pour tout le profil, ou un formulaire par section ? Ce design tranche « un seul », pour ne pas ouvrir un second mécanisme d'écriture — mais c'est une proposition, pas une convention acquise, et elle doit être cohérente avec le choix Server Action / route handler laissé ouvert par s04 (Research, question 10).
