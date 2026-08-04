# Design — Story s04-profile-height-bmi

> Dérivé de `docs/design-system.md` uniquement. Aucun composant, aucun token, aucune couleur inventés ici.
> Cible de référence : **iOS Safari, portrait, 375 px**. Vérifié en clair **et** en sombre.

## Screen(s)

Deux surfaces, pas deux écrans autonomes : un écran nouveau (le profil) et un **bloc d'affichage** qui se pose là où un poids existe.

### A. Écran de profil — `/profil` (nouveau)

Colonne unique, pleine largeur, marge horizontale à l'échelle Tailwind (`px-4`). Aucun élément à largeur fixe : le critère « pas de défilement horizontal à 375 px » tient par construction.

```
┌───────────────────────────── 375 px ─────────────────────────────┐
│ [‹]  Profil                                    ← en-tête simple  │
├──────────────────────────────────────────────────────────────────┤
│  Taille de référence                           ← FieldSet/legend │
│                                                                  │
│  Taille (cm)                                   ← FieldLabel      │
│  ┌────────────────────────────────────────────┐                  │
│  │ 175                                        │ ← Input          │
│  └────────────────────────────────────────────┘                  │
│  Sert uniquement au calcul de l'IMC.           ← FieldDescription │
│  Elle n'apparaît ni sur la silhouette ni dans les graphes.        │
│  ⚠ <message d'erreur>                          ← FieldError      │
│                                                                  │
│  ┌────────────────────────────────────────────┐                  │
│  │              Enregistrer                   │ ← Button, w-full │
│  └────────────────────────────────────────────┘                  │
│                                                                  │
│  ┌─ Card ─────────────────────────────────────┐                  │
│  │ IMC actuel                                 │                  │
│  │ 23,6                                       │                  │
│  │ d'après 72,4 kg, le 2 août                 │                  │
│  │ Recalculé sur vos 14 sessions.             │                  │
│  └────────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

Décisions et leur justification :

- **L'unité vit dans le libellé** (« Taille (cm) »), pas dans un suffixe à l'intérieur du champ : le design system ne référence aucun composant d'addon de champ. Voir *gap 3*.
- `inputmode="decimal"` (pattern imposé « Formulaires »), virgule décimale acceptée.
- **Aucun astérisque, aucun « requis »** : conforme au pattern « tous les champs de mesure sont optionnels ». La taille est facultative — c'est son absence qui déclenche l'état vide de l'IMC, pas une erreur.
- La `Card` « IMC actuel » n'est pas décorative : elle rend visible, sur place, le critère « modifier la taille recalcule tout l'historique ». Elle n'est **pas saisissable** et ne porte aucune classification (« surpoids », « obésité ») — morpho affiche un nombre.
- **Aucune couleur de progression** sur l'IMC. Le sens « favorable » se déclare par mesure ; il n'est déclaré pour l'IMC nulle part. Pas de sens déclaré = pas de couleur. Voir *gap 5*.
- L'en-tête ne contient qu'un retour et un titre. **La façon d'atteindre `/profil` depuis l'accueil n'est pas tranchée ici** : le design system n'a pas de pattern de navigation et le critère « au plus un tap vers la saisie » (s05, repris en non-régression par s06) ne doit pas régresser. Voir *gap 1*.
- Point produit hérité de la Research (question 7, **non tranché par ce design**) : vider le champ et enregistrer doit-il remettre la taille à `NULL` — et donc faire disparaître l'IMC partout, ce que décrit le 2ᵉ critère — ou être refusé ? Le mockup montre la variante « autorisé », avec un `FieldDescription` explicite (« Videz le champ pour retirer l'IMC »). Si `/ks-plan` tranche l'inverse, seul ce texte change et le message d'erreur du champ vide s'active.

### B. Affichage de l'IMC là où un poids existe

L'IMC n'a pas d'écran. Il apparaît en **trois endroits**, tous portés par des composants déjà attribués :

| Surface | Composant | Rendu |
|---|---|---|
| Accueil hors silhouette (s06) | `card` | Carte « IMC » à côté de la carte « Poids » — dans la bande « poids / IMC / pourcentages », distincte de la silhouette |
| Ligne d'historique (s03) | `item` | Suffixe de la ligne : `IMC 23,6`, en `text-muted-foreground`, aligné avec les autres mesures |
| Graphes (s07) | — | Hors périmètre s04 : l'IMC devient une série sélectionnable, cadré par s07 |

Règles d'affichage, communes aux trois surfaces :

1. **Pas de taille → aucun IMC nulle part.** À la place, une seule invitation sur l'accueil (composant `empty`, dans l'emplacement de la carte IMC), avec l'action qui en sort. **L'invitation ne se répète pas** ligne par ligne dans l'historique : trente sessions ne produisent pas trente invitations, elles n'affichent simplement pas d'IMC.
2. **Session sans poids → rien.** Pas de tiret, pas de `—`, pas de `0`. L'absence est silencieuse — même règle que « vide ≠ zéro » dans tout le projet.
3. **Format français** : `23,6` (virgule, une décimale). Sans unité — l'IMC n'en a pas.
4. **Jamais de champ.** Aucune surface ne rend l'IMC éditable ; il n'existe aucun `input` d'IMC dans le formulaire de s03.

## Mockup

`docs/designs/s04-profile-height-bmi.html` — référence visuelle. **NE PAS copier en production** : Execute construit avec les vrais composants shadcn générés dans `src/components/ui/`.

Le fichier rend toutes les sections décrites ci-dessous dans un cadre de 375 px, chacune étiquetée, en un seul défilement. Il suit le thème système (`prefers-color-scheme`), comme l'app.

Écarts assumés du mockup par rapport à l'implémentation, à ne pas reproduire :
- La famille Geist n'est pas chargée (aucun asset externe autorisé) : le mockup retombe sur la pile système. En production, `--font-sans` vient du preset.
- Les icônes sont des SVG inline recopiés de `lucide` (`chevron-left`) : en production elles viennent du paquet `lucide-react`.
- Les classes du mockup sont ad hoc ; l'implémentation utilise les utilitaires Tailwind du preset et les composants du registre.

## Reused components (from the design system)

Tous vérifiés dans le tableau du registre de `docs/design-system.md` et confirmés présents dans le style `radix-nova` par la Research.

- **`field`** — le groupe taille : `FieldSet` + `FieldLegend` (« Taille de référence »), `Field`, `FieldLabel`, `FieldDescription`, `FieldError`. C'est le bloc de construction des formulaires du preset, **pas `form`** (voir *gap 4*).
- **`input`** — le champ taille, `inputmode="decimal"`.
- **`label`** — tiré automatiquement comme dépendance de registre de `field`.
- **`button`** — « Enregistrer » (pleine largeur), « Renseigner ma taille » dans l'état vide, retour de l'en-tête (variante discrète).
- **`spinner`** — dans le bouton pendant l'enregistrement, jamais en plein écran.
- **`card`** — « IMC actuel » sur le profil, carte « IMC » de l'accueil. Composant déjà attribué à l'accueil hors silhouette.
- **`empty`** — l'invitation « Renseignez votre taille » à l'emplacement de la carte IMC.
- **`skeleton`** — attente du cold start Neon, à la forme du champ et de la carte.
- **`sonner`** — toast « Taille enregistrée ».
- **`item`** — ligne d'historique portant le suffixe IMC. Installé par s03 ; s04 ne fait que composer dedans.
- **`separator`** — dépendance de registre de `field` et de `item`, pas utilisé directement.

Tokens utilisés, aucun autre : `--background`, `--foreground`, `--card`, `--card-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--primary`, `--primary-foreground`, `--destructive`, `--radius` (paliers). **Aucun usage de `--progress-favorable` / `--progress-adverse`** — voir *gap 5*.

## States

### Écran de profil

| État | Rendu |
|---|---|
| **Vide** (aucune taille enregistrée) | Champ vide, `placeholder` « 175 ». `FieldDescription` visible. La `Card` « IMC actuel » est remplacée par un `empty` court : « Votre IMC apparaîtra ici dès que votre taille sera enregistrée. » Aucun bouton dans cet `empty` : l'action est déjà le champ juste au-dessus. |
| **Chargement** (cold start ~500 ms) | `skeleton` à la forme exacte du contenu attendu : une barre de libellé, une barre de champ, un bloc de carte. Le bouton reste rendu et désactivé. **Jamais d'écran d'attente bloquant.** |
| **Renseigné** | Champ pré-rempli avec la valeur persistée (`175`). `Card` « IMC actuel » avec la valeur, le poids et la date d'où elle vient, et le nombre de sessions recalculées. |
| **Enregistrement en cours** | Bouton désactivé, libellé « Enregistrement… », `spinner` à gauche du libellé. Le champ reste lisible et n'est pas vidé. |
| **Erreur de validation** | `FieldError` sous le champ, `role="alert"`, en `--destructive`, bordure du champ en `--destructive`. Textes : hors plage → « Indiquez une taille entre 80 et 260 cm. » ; format invalide → « Indiquez un nombre, par exemple 175. » Pas de résumé en haut de page, pas de code technique. Les bornes exactes restent à fixer en `/ks-plan` (Research, question 6) : ce sont des valeurs d'exemple, pas une décision de design. |
| **Erreur serveur / réseau** | Message en clair dans la même zone que l'erreur de champ : « Enregistrement impossible pour l'instant. Réessayez. » Le bouton redevient actionnable, la valeur saisie n'est pas perdue. |
| **Succès** | Toast `sonner` « Taille enregistrée », discret, non bloquant. La `Card` « IMC actuel » affiche immédiatement la valeur recalculée — c'est le retour visuel du critère « modifier la taille met à jour l'IMC de toutes les sessions passées ». |

### Affichage de l'IMC

| État | Rendu |
|---|---|
| **Vide — aucune taille** | Accueil : `empty` à l'emplacement de la carte IMC, titre « IMC indisponible », description « Renseignez votre taille pour le calculer. », action `button` « Renseigner ma taille » → `/profil`. Historique : aucun IMC sur aucune ligne, **aucune invitation répétée**. |
| **Vide — aucune session avec poids** | Aucune carte IMC : il n'y a rien à afficher, et la taille n'y change rien. L'orientation vers la saisie est déjà portée par l'état initial de l'accueil (s06). |
| **Chargement** | `skeleton` à la forme de la carte : une ligne de titre courte, un bloc de valeur. |
| **Erreur de lecture** | La carte IMC n'affiche ni valeur ni zéro : message en clair « Impossible de charger vos données. » — traité par l'écran hôte (s06), pas dupliqué par l'IMC. |
| **Succès — IMC disponible** | Carte : intitulé « IMC », valeur `23,6`, sous-texte « d'après 72,4 kg, le 2 août ». Aucune couleur, aucune classification, aucun delta. Historique : `IMC 23,6` en fin de ligne, en `text-muted-foreground`. |
| **Succès — session sans poids** | La ligne d'historique s'affiche normalement, sans mention d'IMC. |

Les deux thèmes sont rendus par le mockup ; le contraste des zones `--muted-foreground` sur `--card` a été vérifié dans les deux jeux de tokens.

## Design system gaps

Besoins non couverts par `docs/design-system.md`. **Signalés, pas comblés.** À trancher puis à reporter dans le design system.

1. **Aucun pattern de navigation, et l'écran de profil est un 4ᵉ écran.** `docs/architecture.md` n'en décrit que trois (silhouette, saisie, graphes) et le design system n'attribue aucun composant à s04. Deux questions ouvertes : (a) où se pose l'entrée « Profil » sur l'accueil sans consommer le tap unique de s05, repris en non-régression par s06 ; (b) quel composant porte l'en-tête et le retour (aucun `header`, `navigation-menu` ou `breadcrumb` n'est dans le tableau du design system). Le mockup montre un en-tête minimal composé d'un `button` discret et d'un titre — c'est une **proposition**, pas une convention acquise.

2. **Icônes non attribuées** (gap connu n°2 du design system). Cet écran en demande deux : le retour (`chevron-left` chez `lucide`) et l'entrée « Profil » depuis l'accueil (`user`, ou une autre). À arbitrer avec les icônes des autres stories plutôt qu'une par une.

3. **Pas de composant d'addon d'unité dans un champ.** Le tableau du design system ne liste rien pour afficher « cm » collé au champ. Contourné ici par l'unité dans le libellé (« Taille (cm) »). Le motif se répétera en s08 (poids cible en kg) : à trancher globalement, pas story par story.

4. **`form` est un stub vide dans le style `radix-nova`.** Le tableau du design system le liste comme installable (s03) ; la Research a vérifié par requête HTTP que le registre renvoie `{"name":"form","type":"registry:ui"}` sans aucun fichier. Le vrai bloc de construction est **`field`**, ce que le pattern « Formulaires » du design system dit déjà par ailleurs. **Correction à apporter au tableau** : remplacer `form` par `field`.

5. **Le sens « favorable » de l'IMC n'est pas déclaré**, et le design system exige qu'il le soit par mesure. Conséquence appliquée ici : l'IMC s'affiche **sans couleur de progression et sans delta**. Si s06 veut colorer ou deltaiser la carte IMC, il faut d'abord déclarer ce sens dans le domaine — ce qui n'est pas neutre médicalement, alors que le PRD interdit toute classification. À trancher en `/ks-design s06`, pas ici.

6. **Aucune convention de formatage numérique.** Le design system parle de `--font-mono` « pour les valeurs chiffrées alignées si besoin », sans trancher. Deux points à fixer : (a) les valeurs (IMC, poids, mensurations) passent-elles en `--font-mono` ? Le mockup a retenu `--font-sans` pour rester homogène avec le reste du texte ; (b) la virgule française (`23,6`) et l'arrondi à une décimale sont une règle produit sans utilitaire déclaré — un module de formatage partagé s'impose (Research, traps 4 et 5), à consigner comme convention.
