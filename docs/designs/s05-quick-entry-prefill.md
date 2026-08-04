# Design — Story s05-quick-entry-prefill

> **Ce n'est pas un nouvel écran.** s05 est un delta sur l'écran de saisie livré par s03. Tout ce qui est marqué *(s03)* ci-dessous est du contexte repris pour que le delta soit lisible — s05 n'y touche pas. Tout ce qui est marqué **(s05)** est le périmètre de cette story.
>
> `docs/designs/` était vide au moment d'écrire ce document : aucun design s03 n'existe. La description de la ligne de base ci-dessous est donc une **hypothèse de travail** dérivée de `docs/stories.md` s03 et de `docs/architecture.md` § Design/UX, pas un design validé. Si `/ks-design s03` a lieu après coup et diverge, c'est lui qui fait foi et ce document s'y réaligne.

Cible : iOS Safari, portrait, **375 px**. Thème système, vérifié en clair **et** en sombre. Aucune couleur, aucun rayon, aucun espacement hors `docs/design-system.md`.

## Screen(s)

### 1. Écran d'accueil — le tap unique **(s05)**

L'écran d'accueil authentifié provisoire de s02. s05 n'a qu'une exigence dessus : **un seul tap pour atteindre la saisie** (critère 5).

Un `Button` unique, pleine largeur, en variante `default` (donc `--primary`), libellé **« Nouvelle saisie »**, enveloppé dans un `<Link>` vers la route de saisie. Placé immédiatement sous l'en-tête, avant tout le reste : c'est l'action principale de l'écran, pas une entrée de menu.

- Pas d'icône : l'attribution des icônes `lucide` aux actions est un gap connu du design system (§ Gaps connus, point 2). Bouton texte seul tant qu'il n'est pas tranché.
- Pas de FAB flottant, pas de barre d'onglets : rien de tel n'existe dans le design system, et l'ajouter serait une invention.
- Ce bloc est repris **à l'identique** par s06 en non-régression, au-dessus de la silhouette.

### 2. Écran de saisie — la ligne de base *(s03)*

Un écran, une colonne, pas de navigation interne, pas d'accordéon, pas d'étapes.

```
┌──────────────────────────────── 375 px ───┐
│  Nouvelle saisie                          │  h1
│  [ Date ▸ 02/08/2026 ]                    │  Field (date)
│                                           │
│  ─────────────────────────────────────    │  FieldSeparator
│  Les valeurs grisées sont vos dernières   │  légende (s05)
│  mesures. Touchez un champ pour le        │
│  remplacer.                               │
│                                           │
│  Poids (kg)                    [  82,4 ]  │  Field ×10
│  Poitrine (cm)                 [   104 ]  │
│  Biceps (cm)                   [  34,5 ]  │
│  Taille (cm)                   [    96 ]  │
│  Hanches (cm)                  [   101 ]  │
│  Cuisse (cm)                   [    58 ]  │
│  Mollet (cm)                   [    39 ]  │
│  Épaules (cm)                  [   118 ]  │
│  Masse grasse (%)              [  24,8 ]  │
│  Masse musculaire (%)          [  36,2 ]  │
│                                           │
│  [        Enregistrer         ]           │  Button, w-full
└───────────────────────────────────────────┘
```

Décisions de mise en page *(s03, reprises telles quelles)* :

- **Ligne compacte** : libellé à gauche, champ à droite, sur la même ligne. Dix champs empilés en libellé-au-dessus feraient une page deux fois plus longue à parcourir au pouce. La composition se fait par les utilitaires Tailwind **au-dessus** de `ui/field.tsx`, jamais en éditant le composant généré.
- **Champ à largeur fixe** (`w-28`), valeur **alignée à droite**, en `--font-mono` : dix nombres alignés sur la même colonne se relisent d'un coup d'œil. Le design system autorise explicitement `--font-mono` pour « les valeurs chiffrées alignées si besoin » — c'est ce cas.
- **Unité dans le libellé**, entre parenthèses, en `--muted-foreground`. Pas de sélecteur d'unité (métrique uniquement), pas de suffixe dans le champ qui viendrait concurrencer la valeur.
- **Ordre des dix mesures** : celui de `docs/stories.md` s03 (poids, poitrine, biceps, taille, hanches, cuisse, mollet, épaules, % grasse, % musculaire). Réordonner n'est pas au périmètre de s05.
- **Aucun astérisque, aucun « requis »** : tous les champs sont optionnels (règle du design system § Formulaires).
- `type="text"` + `inputMode="decimal"` : `type="number"` refuse la virgule française et supporte mal `select()`. Le `Input` de radix-nova étale ses props sur l'`<input>` natif, donc rien à envelopper.
- **Bouton d'enregistrement en fin de flux, pleine largeur — pas de footer collant.** Un `position: fixed` sous le clavier iOS Safari est notoirement instable ; et avec le clavier levé, la validation se fait au clavier système, pas au pouce.

### 3. Le delta s05 — ce que cette story ajoute

Quatre choses, et rien d'autre :

**a) Les champs arrivent pré-remplis** avec la dernière valeur connue **par mesure** (pas « les valeurs de la dernière session »).

**b) Distinction visuelle du pré-rempli non touché.** Pilotée par le marqueur DOM du critère 3, pas par un état React invisible :

| Attribut DOM | Couleur de la valeur | Signification |
|---|---|---|
| `data-prefilled="true"` | `--muted-foreground` | reprise de l'historique, non touchée |
| *(marqueur retiré)* | `--foreground` | saisie ou modifiée par l'utilisateur, cette session |
| *(champ vide)* | — | jamais mesurée, rien à reprendre |

Seule la **valeur à l'intérieur du champ** change de couleur. La bordure (`--input`), le fond, le libellé et la hauteur sont identiques dans les trois cas : un champ pré-rempli reste un champ ordinaire, pas un contrôle désactivé.

**La couleur ne porte pas l'information seule.** Deux porteurs non chromatiques la doublent :
1. la **légende** en tête de liste, affichée seulement s'il existe au moins un champ pré-rempli : « Les valeurs grisées sont vos dernières mesures. Touchez un champ pour le remplacer. » ;
2. l'attribut `data-prefilled` lui-même, lisible par un test et par les outils d'inspection.

Risque assumé et tranché ici : `--muted-foreground` est aussi la couleur d'un *placeholder*, et un utilisateur pourrait croire le champ vide. La légende existe pour ça. Le contraste tient dans les deux thèmes (0.556 sur 1 en clair, 0.708 sur 0.145 en sombre) — c'est du texte atténué lisible, pas du texte fantôme. **Ne pas descendre en opacité par-dessus.**

**c) Toucher un champ pré-rempli sélectionne son contenu** (critère 6) : une frappe remplace la valeur sans effacement manuel. La surbrillance est celle du navigateur — on ne la restyle pas, il n'y a donc aucun token à définir. Le mockup l'approxime avec `--primary` / `--primary-foreground` pour la rendre visible.

**d) Le formulaire se peint avant ses valeurs.** Le cold start Neon (~500 ms) ne doit jamais produire d'écran d'attente : voir l'état *Chargement* ci-dessous.

## Mockup

`docs/designs/s05-quick-entry-prefill.html` — référence visuelle. **NE PAS copier en production** : Execute construit avec les vrais composants shadcn (`ui/field.tsx`, `ui/input.tsx`, `ui/button.tsx`, `ui/skeleton.tsx`) et les utilitaires Tailwind qui référencent les tokens.

Le fichier rend tous les états ci-dessous dans un seul défilement, chacun étiqueté, dans un cadre de 375 px. Une section rejoue l'état nominal forcé en `.dark` pour que les deux thèmes soient visibles côte à côte quel que soit le réglage de la machine qui l'ouvre. Un script inline de six lignes démontre le retrait du marqueur à la première frappe et la sélection au focus — c'est une démonstration, pas l'implémentation.

Écarts connus du mockup avec le rendu réel :
- police : pile système (Geist n'est pas embarquable sans asset externe) ;
- `--input` en sombre : `oklch(1 0 0 / 15%)`, la valeur réellement dans `globals.css` (le design system annonce 10 % — divergence relevée en Research, à corriger dans le document, pas dans le code) ;
- `--progress-favorable` / `--progress-adverse` sont déclarés dans le bloc de tokens mais **non utilisés** : cet écran n'affiche aucun delta.

## Reused components (from the design system)

Aucun composant n'existe encore dans `src/components/ui/`. Les cinq ci-dessous sont installés par s03 ; s05 n'en ajoute **aucun** et se contente de les composer autrement.

| Composant | Où / pourquoi |
|---|---|
| `field` | Une ligne = un `Field` (`FieldLabel` + `Input` + `FieldError`). Jamais un `input` nu. Tire `label` et `separator` en `registryDependencies`. |
| `input` | Les dix champs de mesure et le champ de date. Étale ses props → `inputMode`, `data-prefilled`, `onFocus` passent sans wrapper. `text-base` sous 768 px, ce qui évite le zoom automatique d'iOS au focus. |
| `label` | Libellé de chaque mesure (installé par `field`). |
| `button` | « Nouvelle saisie » sur l'accueil (le tap unique) et « Enregistrer » en fin de formulaire. |
| `skeleton` | Emplacement des dix valeurs pendant le chargement du pré-remplissage. |
| `sonner` | Confirmation d'enregistrement — **propriété de s03**, réutilisé tel quel. s05 ne l'introduit pas. |

Non utilisés, volontairement :
- **`empty`** — l'état « aucun historique » de s05 n'est pas une page vide : c'est un formulaire pleinement utilisable. Y coller un composant `Empty` remplacerait l'action par un panneau explicatif, à l'exact opposé du budget de 20 secondes.
- **`form`** du registre — item vide en `radix-nova` (aucun fichier). Voir les gaps.
- **`alert`**, **`card`**, **`tooltip`** — rien à signaler, à encadrer ni à survoler sur cet écran.

## States

| État | Traitement |
|---|---|
| **Chargement** | Le squelette de la page (titre, date, libellés, bouton) est peint **immédiatement**. Les dix valeurs sont derrière une frontière Suspense : chaque emplacement de champ porte un `Skeleton` à la hauteur exacte du champ, aligné à droite comme lui. Aucun spinner plein écran, aucun blocage. Un champ vide et interactif qui se ferait écraser 500 ms plus tard par les valeurs serait pire que l'attente : le `Skeleton` est ce qui rend l'arrivée des valeurs non destructive. La stratégie technique (Suspense / remontage par `key` / champs contrôlés) est tranchée au Plan, pas ici. |
| **Vide** *(premier usage, aucun historique)* | Les dix champs sont vides, sans marqueur `data-prefilled`. La légende du pré-remplissage **disparaît** et cède la place à une ligne atténuée : « Première saisie : rien à reprendre. Les prochaines fois, vos valeurs seront déjà là. » Le formulaire reste identique et pleinement utilisable. |
| **Vide partiel** *(cas courant)* | Certaines mesures sont pré-remplies, d'autres jamais renseignées donc vides. La légende s'affiche. Aucune valeur inventée, aucun `0`, aucun placeholder chiffré dans un champ vide. |
| **Champ touché** | À la première modification, le marqueur `data-prefilled` disparaît et la valeur passe en `--foreground`. Irréversible dans la session : revenir à la valeur d'origine ne remet pas le marqueur. |
| **Champ focalisé** | Anneau `--ring` visible (obligatoire, la saisie se fait au clavier système en chaînant les champs), contenu sélectionné en surbrillance native. |
| **Erreur de champ** | Valeur hors plage physiologique refusée par le serveur → `FieldError` sous le champ concerné, en `--destructive`, en français, sans code technique. Les autres champs conservent leur valeur et leur marqueur. Jamais de résumé d'erreurs en haut de page. |
| **Erreur de pré-remplissage** *(propre à s05)* | Si la lecture des dernières valeurs échoue, le formulaire **reste utilisable et vide**, avec une ligne atténuée sous la date : « Vos dernières valeurs n'ont pas pu être chargées. Vous pouvez saisir directement. » Ce n'est pas une erreur bloquante : l'échec du confort ne doit pas emporter la capacité de saisir. |
| **Succès** | Toast `sonner` discret et non bloquant (« Session enregistrée »), puis retour à l'accueil. Comportement de s03, inchangé. |

Vérifications à 375 px, à repasser à l'exécution : aucun défilement horizontal, aucun débordement, la ligne libellé + champ tient sans troncature sur le libellé le plus long (« Masse musculaire (%) »).

## Design system gaps

Besoins que `docs/design-system.md` ne couvre pas. **À trancher et à remonter dans le document — rien n'est comblé à la volée ici.**

1. **Cible tactile — le gap bloquant de cette story.** `Input` en `radix-nova` fait `h-8` (32 px), sous le repère iOS de 44 px. Sur dix champs à enchaîner au doigt en 20 secondes, c'est le facteur d'échec le plus probable du critère 7. Le design system ne définit **aucun token ni règle de hauteur minimale de cible tactile**. Un `h-11` posé au cas par cas serait exactement l'improvisation que le dépôt interdit. À trancher : token de hauteur de contrôle tactile (`--control-min-target`) appliqué à tous les formulaires du produit, ou acceptation documentée des 32 px. Le mockup illustre les deux hauteurs côte à côte, sans choisir.

2. **État « valeur pré-remplie non touchée ».** Le système décrit les états Vide / Chargement / Erreur / Succès, mais aucun état « valeur suggérée reprise de l'historique ». La convention retenue ici (`--muted-foreground` sur la valeur + légende + `data-prefilled`) ne réutilise que des tokens existants, mais **c'est une convention nouvelle** : elle doit être consignée dans `docs/design-system.md` § Formulaires, sinon s09 (édition d'une session, où les valeurs affichées sont les valeurs *réellement enregistrées* et ne sont donc **jamais** grisées) refera le choix différemment. C'est précisément la collision signalée comme piège de s09.

3. **Format d'affichage des décimales.** Aucun document du projet ne tranche entre `82.4` et `82,4` dans un champ pré-rempli, alors que s03 impose d'accepter la virgule à la saisie et que la valeur arrive de Postgres en `number`. Ce design affiche le format français (`82,4`) par cohérence avec une UI en français ; la fonction de formatage et son parseur symétrique sont à fixer au Plan. Un aller-retour asymétrique corromprait silencieusement l'historique.

4. **Correction à porter au design system, pas un gap nouveau** : la ligne `form` du tableau des composants ne correspond pas au registre `radix-nova` (item vide, aucun fichier, `npx shadcn@latest add form` n'installe rien). Le § Patterns UI le dit déjà correctement (« `field`, pas `form` ») — c'est le tableau qui est à corriger.

5. **Icônes.** Gap déjà connu (§ Gaps connus, point 2) : `lucide` est la librairie, mais aucune icône n'est attribuée à une action. Conséquence directe ici : le bouton du tap unique est en texte seul. À rouvrir en s06, qui reprend ce bouton.
