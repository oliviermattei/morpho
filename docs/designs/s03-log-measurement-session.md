# Design — Story s03-log-measurement-session

> Phase Design. Rien ici n'est du code de production : la maquette est une **référence visuelle**, l'implémentation passe par les vrais composants shadcn.
> Toute valeur visuelle vient de `docs/design-system.md`. Ce que le système ne couvre pas est **signalé** en fin de document, jamais comblé ici.
> Cible primaire : **iOS Safari, portrait, 375 px**. Desktop en secondaire. Les deux thèmes (clair et sombre) sont vérifiés.

---

## Screen(s)

s03 livre **deux écrans** et **ne redessine pas l'accueil** (placeholder de s02, remplacé en s06).

| Route | Rôle | Rendu |
|---|---|---|
| `/saisie` | Le formulaire : une date + 10 mesures optionnelles | client (`"use client"`) — interactif |
| `/historique` | La liste des sessions, de la plus récente à la plus ancienne | serveur, avec `skeleton` pendant la lecture |

**Pourquoi deux routes et pas une page unique** : l'accueil devient la silhouette en s06 ; l'historique n'aurait alors plus de domicile s'il était collé sous le formulaire. Deux routes laissent aussi la place à l'ouverture en édition de s09 (`/historique` → session). Coût : un tap depuis l'accueil vers `/saisie`, ce qui reste conforme au critère « au plus un tap » repris en s05 et s06.

Sur l'accueil provisoire de s02, s03 ajoute seulement **deux contrôles** — un `Button` primaire « Saisir mes mesures » (→ `/saisie`) et un lien secondaire « Historique » (→ `/historique`). Aucun autre changement de cet écran.

### `/saisie` — structure verticale

```
┌─ 375 px ────────────────────────────────┐
│  ‹ Retour            (lien texte)        │   en-tête : lien retour + titre
│  Nouvelle session    (h1)                │
├──────────────────────────────────────────┤
│  Date                                    │   Field pleine largeur
│  [ 2026-08-02              ]             │   <input type="date">
│                                          │
│  Poids                                   │   Field pleine largeur
│  [                   ] kg dans le label  │
│  ───────────────────────  FieldSeparator │
│  Mensurations (cm)        FieldLegend    │   FieldSet + grille 2 colonnes
│  ┌ Épaules ──┐ ┌ Poitrine ─┐             │
│  │[        ] │ │[        ] │             │
│  ┌ Biceps ───┐ ┌ Tour de taille ┐        │
│  ┌ Hanches ──┐ ┌ Cuisse ───┐             │
│  ┌ Mollet ───┐ ┌  (vide)   ┐             │
│  ───────────────────────  FieldSeparator │
│  Composition (%)          FieldLegend    │   FieldSet + grille 2 colonnes
│  ┌ Masse grasse ┐ ┌ Masse musculaire ┐   │
│                                          │
│  ⚠ message d'erreur de formulaire        │   FieldError non rattaché à un champ
│  [   Enregistrer la session   ]          │   Button primaire, pleine largeur
└──────────────────────────────────────────┘
```

Décisions de mise en page, toutes tirées de contraintes existantes :

- **Grille 2 colonnes pour les 9 champs courts** (7 mensurations + 2 pourcentages), 1 colonne pour la date et le poids. À 375 px : padding 1 rem de chaque côté → 343 px utiles, gouttière 0,75 rem → colonnes de ~165 px. Aucun débordement horizontal ; c'est la contrainte de l'échelle Tailwind, pas une valeur arbitraire.
- **L'unité vit dans la légende du groupe**, pas dans chaque libellé (`Mensurations (cm)`, `Composition (%)`), sauf le poids qui est seul (`Poids (kg)`). Ça garde les libellés sur une ligne à 165 px — `Tour de poitrine (cm)` ne tiendrait pas — et ça rend l'unité métrique visible partout sans jamais suggérer un sélecteur (critère 9).
- **`Tour de taille`, pas `Taille`** : `Taille` désigne la taille de référence en s04. La collision se règle par le libellé, une fois.
- **Ordre des champs** : poids d'abord (la mesure la plus fréquente, seule sur sa ligne, donc atteignable sans viser), puis le corps de haut en bas — épaules, poitrine, biceps, tour de taille, hanches, cuisse, mollet — puis les pourcentages. C'est l'ordre de lecture de la silhouette de s06, et l'ordre naturel du mètre ruban.
- **Bouton en fin de formulaire, non collant.** La saisie se termine sur `Masse musculaire` ; le bouton est juste dessous. Une barre d'action `sticky bottom` serait masquée ou déplacée par le clavier iOS, pour un gain nul ici.

### Champs — type et clavier

- Les 10 champs de mesure sont des `Input` en **`type="text"` + `inputMode="decimal"`**, jamais `type="number"`. C'est la question ouverte n°3 de la Research, tranchée ici : `type="number"` refuse la virgule française et renvoie `""` sur une valeur invalide, ce qui **ramène au piège vide → zéro**. `inputMode="decimal"` donne le pavé numérique iOS sans imposer de format.
- **Taille de police de 1 rem sur les champs** (le `text-base md:text-sm` du `Input` du registre) : en dessous de 16 px, iOS Safari zoome à la prise de focus et casse la mise en page à 375 px.
- **Hauteur tactile de 2,75 rem (44 px)** sur les champs et le bouton, composée par `className` au-dessus du composant généré — l'`Input` du registre est en `h-8` (32 px), sous la cible tactile iOS. Voir *gap n°2*.
- `autoComplete="off"` sur les mesures. Aucun `placeholder` : un champ vide doit se lire comme vide, pas comme une suggestion.
- La **date par défaut est celle de l'appareil**, pas celle du serveur : un « aujourd'hui » calculé côté serveur (UTC sur Vercel) date une pesée matinale de la veille en heure française. Contrainte d'UI ; le mécanisme est du ressort du Plan.

### `/historique` — structure

```
┌─ 375 px ────────────────────────────────┐
│  Historique          (h1)                │
│  [   Nouvelle session   ]                │  Button primaire, pleine largeur
├──────────────────────────────────────────┤
│  ┌ Item ────────────────────────────┐    │  ItemGroup, tri décroissant
│  │ dimanche 2 août 2026   ItemTitle │    │
│  │ Poids                    82,4 kg │    │  libellé à gauche, valeur à droite
│  │ Épaules                   118 cm │    │  valeurs en --font-mono
│  │ …                                │    │  seules les mesures renseignées
│  └──────────────────────────────────┘    │
│  ┌ Item ────────────────────────────┐    │
│  │ dimanche 26 juillet 2026         │    │
│  │ Poids            83,1 kg         │    │  session partielle : une seule ligne
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

- Une session = un `Item variant="outline"`. Titre = la date en toutes lettres (`fr-FR`). Contenu = une liste des **seules mesures renseignées**, libellé à gauche et valeur alignée à droite. Une session au poids seul affiche une seule ligne — c'est la preuve visuelle du critère « session partielle acceptée ».
- **Une colonne, pas deux**, contrairement au formulaire : à 311 px utiles dans la carte, deux colonnes obligeraient à abréger les libellés (`M. musc.`, `Taille`) et rouvriraient l'ambiguïté taille/tour de taille. L'historique est un écran de consultation, pas l'écran chronométré : le coût en hauteur est acceptable, l'ambiguïté ne l'est pas.
- **Aucun delta, aucune couleur de progression ici.** Les deltas sont s06. La règle « la couleur ne porte jamais l'information seule » n'a donc rien à arbitrer sur cet écran : il n'y a aucune sémantique favorable/défavorable en s03, et ni `--progress-favorable` ni `--progress-adverse` n'y apparaissent.
- **Les lignes ne sont pas cliquables** en s03 : l'édition et la suppression sont s09. Pas de `ItemActions`, pas de chevron — ne pas suggérer une affordance qui n'existe pas encore.
- Valeurs alignées en `--font-mono`, libellés en `--muted-foreground` : la colonne de chiffres se lit verticalement.

---

## Mockup

`docs/designs/s03-log-measurement-session.html` — référence visuelle. **NE PAS copier en production** : l'exécution reconstruit ces écrans avec les vrais composants de `src/components/ui/`.

Le fichier rend les **sept états** décrits ci-dessous, chacun dans un cadre de 375 px étiqueté, tous visibles en un seul défilement. Les variables CSS y sont recopiées à l'identique depuis `src/app/globals.css` ; le thème sombre s'y active par `prefers-color-scheme`. La police est la police système : Geist n'est pas embarquée dans une maquette hors ligne.

---

## Reused components (from the design system)

Tous vérifiés présents dans le registre `radix-nova` (requête HTTP réelle, pas supposée).

| Composant | Où / pourquoi |
|---|---|
| `field` | Le socle des deux écrans de formulaire. `FieldSet` + `FieldLegend` pour les groupes « Mensurations (cm) » et « Composition (%) », `FieldGroup` pour l'espacement vertical, `Field` (orientation `vertical`) pour chaque champ, `FieldLabel`, `FieldSeparator` entre les groupes, `FieldError` pour les erreurs par champ **et** pour l'erreur de formulaire au-dessus du bouton. `FieldError` accepte `errors?: Array<{ message?: string }>` et rend `role="alert"` — il consomme directement le `fieldErrors` d'un `flattenError` de Zod, sans react-hook-form. |
| `input` | Les 10 champs de mesure (`type="text"`, `inputMode="decimal"`) et le champ de date (`type="date"`). Le spread `{...props}` en fin de composant laisse passer `inputMode`, `name`, `defaultValue`, `aria-invalid`. |
| `button` | « Enregistrer la session » (primaire, pleine largeur), « Nouvelle session » (primaire, sur `/historique`), « Saisir mes mesures » (dans l'état vide), « Réessayer » (état d'erreur de lecture). |
| `item` | Une ligne d'historique = `Item variant="outline"` + `ItemContent` + `ItemTitle`. `ItemGroup` enveloppe la liste. |
| `empty` | État vide de l'historique (`Empty` + `EmptyHeader` + `EmptyTitle` + `EmptyDescription` + `EmptyContent` portant le bouton). Réutilisé pour l'état d'erreur de lecture — voir *gap n°6*. `EmptyMedia` n'est pas utilisé : aucune icône n'est encore attribuée (*gap n°4*). |
| `skeleton` | Trois blocs à la forme d'un `Item` pendant la lecture de l'historique. Jamais de spinner plein écran (cold start Neon ~500 ms). |
| `spinner` | Dans le bouton d'enregistrement pendant la soumission, avec le libellé « Enregistrement… ». |
| `sonner` | Toast de confirmation « Session enregistrée » après un enregistrement réussi. Le `<Toaster />` se monte une fois — voir *gap n°5*. |

**À installer par la CLI** (`npx shadcn@latest add …`) :

```
field  input  button  item  empty  skeleton  spinner  sonner
```

`label` et `separator` arrivent en dépendances transitives de `field` et `item` : ne pas les ajouter à la main. `sonner` tire les paquets npm `sonner` et `next-themes`.

**Ce qui n'est pas utilisé** et ne doit pas l'être ici : `card` (s06), `select` et `chart` (s07), `alert` (s10), `alert-dialog` (s09), `badge`, `tooltip`. Et **`form` n'existe pas** dans ce style — voir *gap n°1*.

---

## States

Sept états, tous rendus dans la maquette.

### `/saisie`

| # | État | Traitement |
|---|---|---|
| 1 | **Initial** | Formulaire affiché immédiatement, date pré-remplie à aujourd'hui (fuseau de l'appareil), 10 champs vides. Aucun squelette : rien n'est lu en base pour afficher ce formulaire (le pré-remplissage est s05). |
| 2 | **Erreur de validation** | Retour serveur. Chaque champ fautif porte `aria-invalid` et un `FieldError` **sous le champ**, jamais un résumé en haut de page. Les valeurs saisies sont conservées : on corrige, on ne ressaisit pas. Messages en français, sans code technique — p. ex. « Le poids doit être compris entre 20 et 400 kg. » ou « Valeur non reconnue. Utilisez des chiffres, avec une virgule si besoin (ex. 82,4). » **Les bornes chiffrées de la maquette sont des exemples** : les plages réelles par `kind` sont une décision du Plan (Research, question ouverte n°4). |
| 3 | **Erreur de formulaire (non rattachée à un champ)** | Formulaire entièrement vide → « Renseignez au moins une mesure avant d'enregistrer. » Échec réseau/serveur → « L'enregistrement a échoué. Vérifiez votre connexion et réessayez. » Les deux s'affichent dans un `FieldError` placé **juste au-dessus du bouton**, dans le champ de vision de l'action. Voir *gap n°3*. |
| 4 | **Soumission en cours** | Bouton désactivé, `Spinner` + libellé « Enregistrement… ». Les champs restent lisibles et non désactivés. Pas de recouvrement de l'écran. |
| — | **Succès** | Navigation vers `/historique`, où le toast `sonner` « Session enregistrée » s'affiche et où la nouvelle session apparaît en tête. La preuve de persistance est la ligne, pas le message ; le toast est le confirmateur discret exigé par le design system. Effet de bord voulu : plus de double soumission depuis un formulaire resté à l'écran. |

### `/historique`

| # | État | Traitement |
|---|---|---|
| 5 | **Chargement** | Trois `Skeleton` à la forme d'un `Item` (une barre de titre + deux lignes de valeurs). Le bouton « Nouvelle session » est déjà actif : on peut saisir sans attendre la base. |
| 6 | **Vide** | `Empty` : « Aucune session enregistrée », « Vos mesures apparaîtront ici, de la plus récente à la plus ancienne. », puis le bouton « Saisir mes mesures » qui sort de l'état. Jamais une page blanche. |
| 7 | **Erreur de lecture** | « Impossible de charger l'historique. Vérifiez votre connexion et réessayez. » + bouton « Réessayer ». Message en clair, pas de code HTTP à l'écran. |
| — | **Rempli** | `ItemGroup` trié du plus récent au plus ancien. Une session complète, une session au poids seul, des intervalles irréguliers : les trois cas du domaine sont visibles dans la maquette. |

### Vérifications transverses portées par la maquette

- **375 px, aucun défilement horizontal** : tout est en largeurs relatives, la grille est en `minmax(0, 1fr)`, aucune largeur fixe en pixels dans le contenu.
- **Clair et sombre** : chaque état se relit dans les deux thèmes. Le point sensible est la bordure des `Input` et des `Item`, qui passe de `oklch(0.922 0 0)` à `oklch(1 0 0 / 10-15%)` — d'où le choix de `Item variant="outline"` plutôt que `default` (bordure transparente, invisible sur les deux fonds).
- **Aucune couleur en dur, aucun rayon en dur** : tout vient d'un token ou d'un palier `--radius-*`.

---

## Design system gaps

Besoins que `docs/design-system.md` ne couvre pas. **À trancher et à consigner dans ce document**, pas à improviser à l'exécution.

1. **`form` est attribué à s03 mais n'existe pas dans `radix-nova`.** `design-system.md:71` liste `form` pour cette story. Le registre renvoie un item littéralement sans fichier (`{ "$schema": …, "name": "form", "type": "registry:ui" }`) : `npx shadcn add form` n'installe rien. Le besoin réel — libellé + contrôle + message d'erreur — est couvert par `field`, déjà listé à la ligne précédente. **Correction proposée** : retirer la ligne `form` de la table du design system. Corollaire à acter : `react-hook-form` et `@hookform/resolvers` restent hors stack, l'état du formulaire vient de React et la validation de Zod côté serveur.

2. **Aucune hauteur tactile minimale n'est définie.** L'`Input` du registre est en `h-8` (32 px), et le `Button` par défaut en `h-9` (36 px) : les deux sont sous les 44 px recommandés sur iOS, alors que le contexte d'usage du PRD est « debout, téléphone à une main, mètre ruban dans l'autre ». s03 compose `h-11` (44 px, palier Tailwind) sur les champs et les boutons d'action. **À acter** comme règle du design system (« hauteur d'interaction minimale : 2,75 rem sur mobile »), sinon chaque story la re-décidera.

3. **Où loger une erreur de formulaire non rattachée à un champ ?** Le design system dit « erreurs par champ, sous le champ, jamais un résumé en haut de page » — mais le formulaire vide et l'échec d'enregistrement ne sont rattachés à aucun champ. s03 les place dans un `FieldError` juste au-dessus du bouton d'envoi. **À acter** comme pattern, ou à remplacer par une autre décision.

4. **Aucune icône n'est encore attribuée** (gap n°2 déjà connu du design system). s03 est conçu **sans icône** pour ne pas le combler à la volée : le retour est un lien texte « ‹ Retour », et `Empty` est rendu sans `EmptyMedia`. Les deux emplacements qui en bénéficieraient sont identifiés (retour d'écran, média d'état vide). À trancher avant s06/s07, qui en auront un besoin plus net.

5. **Le point de montage du `<Toaster />` n'est pas défini.** `sonner` est le feedback de succès du design system, mais rien ne dit où le composant vit (layout racine ? layout authentifié ?) ni ce qu'on fait de `next-themes`, qu'il tire alors que le thème est posé à la main par un script inline. La Research a vérifié que `useTheme()` hors provider ne lève pas et retombe sur `"system"` : le comportement est correct, la dépendance est inutile. **À acter** : emplacement du `Toaster`, et constat assumé sur `next-themes`.

6. **Le conteneur d'un état d'erreur de lecture n'est pas défini.** Le tableau des états dit « message en clair, en français », sans nommer de composant, et `alert` est attribué à s10. s03 réutilise `Empty` (titre + description + action « Réessayer »), qui est un conteneur générique de « rien à afficher ». **À acter** : `Empty` pour les erreurs de lecture, ou `alert` généralisé aux erreurs non bloquantes.

7. **Aucun format d'affichage des valeurs numériques.** Le design system ne fixe le format que pour les deltas de la silhouette (`-4,2 cm`, virgule française, une décimale). Rien ne dit comment afficher une valeur brute dans l'historique : `82,4 kg` ou `82,40 kg` ? La question rejoint la précision des colonnes `numeric` (Research, question ouverte n°6). s03 affiche la valeur telle qu'enregistrée, virgule française, sans zéro de queue. **À acter** avec la décision de précision du Plan.

---

## Ce que ce design ne fait pas

Garde-fous explicites, pour que l'exécution ne dérive pas :

- **Pas de champ IMC**, ni saisi ni affiché (s04).
- **Pas de pré-remplissage**, pas de `data-prefilled`, pas de sélection du contenu au focus (s05).
- **Pas de delta, pas de couleur de progression, pas de silhouette** (s06).
- **Pas de graphe** (s07).
- **Pas de ligne cliquable, pas d'édition, pas de suppression, pas d'`alert-dialog`** (s09).
- **Pas de bandeau hors ligne** (s10).
- **Aucun sélecteur d'unité**, nulle part.
