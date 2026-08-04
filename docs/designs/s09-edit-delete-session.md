# Design — Story s09-edit-delete-session

> Phase Design. Rien ici n'est du code de production : la maquette est une **référence visuelle**, l'implémentation
> passe par les vrais composants générés dans `src/components/ui/`.
> Toute valeur visuelle vient de `docs/design-system.md`. Ce que le système ne couvre pas est **signalé** en fin de
> document, jamais comblé ici.
> Cible primaire : **iOS Safari, portrait, 375 px**. Desktop en secondaire. Les deux thèmes sont vérifiés.
>
> **Ligne de base.** s09 est un delta sur les écrans de s03 (`/saisie`, `/historique`) : le formulaire, la liste, la
> grille à deux colonnes, les libellés et la hauteur d'interaction sont repris **tels quels** de
> `docs/designs/s03-log-measurement-session.md`, qui fait foi. Tout ce qui est marqué **(s09)** est le périmètre de
> cette story. Aucun de ces écrans n'existe encore dans le code : `src/` contient cinq fichiers et
> `src/components/ui/` n'est même pas créé (voir la Research).

---

## Screen(s)

s09 livre **un écran neuf** et **un delta** sur un écran existant.

| Route | Rôle | Rendu | Statut |
|---|---|---|---|
| `/historique` | Liste des sessions, de la plus récente à la plus ancienne | serveur | **delta (s09)** : les lignes deviennent ouvrables |
| `/historique/[id]` | Édition d'une session + suppression | client (`"use client"`) | **neuf (s09)** |

**Pourquoi `/historique/[id]` et pas une modale.** L'entrée en édition part de la liste (critère 1) ; une route
enfant garde l'URL partageable, le bouton Retour du navigateur fonctionnel, et n'oblige pas à monter un état
d'ouverture dans un Server Component. C'est aussi **le premier segment dynamique du projet** (Research § Traps 9) :
le chemin exact reste une décision du Plan, la structure — liste → détail — est ce que ce design fixe.

### 1. `/historique` — le delta (s09)

s03 avait explicitement laissé les lignes **non cliquables** (« l'édition et la suppression sont s09 : ne pas
suggérer une affordance qui n'existe pas encore »). s09 ouvre cette affordance, et rien d'autre.

```
┌─ 375 px ────────────────────────────────┐
│  Historique          (h1)                │
│  [   Nouvelle session   ]                │  inchangé (s03)
├──────────────────────────────────────────┤
│  ┌ Item ─────────────────────────────┐   │  Item variant="outline" asChild > Link
│  │ dimanche 2 août 2026     Modifier │   │  ← date à gauche, mot d'action à droite
│  │ Poids                     82,4 kg │   │
│  │ Épaules                    118 cm │   │  contenu inchangé (s03)
│  │ …                                 │   │
│  └───────────────────────────────────┘   │
│  ┌ Item ─────────────────────────────┐   │
│  │ dimanche 26 juillet 2026 Modifier │   │
│  │ Poids                     83,1 kg │   │
│  └───────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

- **La ligne entière est le lien.** `Item` accepte `asChild` (vérifié dans le registre) : `<Item asChild><Link …>`.
  Cible tactile = toute la carte, ce qui est le bon geste debout, téléphone à une main.
- **L'affordance est le mot « Modifier »**, en `--muted-foreground`, `text-sm`, aligné à droite du titre. C'est du
  **texte**, pas un contrôle : aucun élément interactif imbriqué dans le `<a>`. Un chevron serait la forme naturelle,
  mais aucune icône n'est encore attribuée à une action (*gap n°1*).
- **Aucun bouton de suppression sur la ligne.** Décision de ce design, qui répond à la question ouverte n°9 de la
  Research. Trois raisons cumulées :
  1. un bouton destructif collé à une carte tapotable au pouce, dans une salle de bain, est une erreur de manip qui
     attend son heure — et la suppression est **définitive, sans corbeille** (`docs/stories.md:253`) ;
  2. deux contrôles dans une ligne-lien forceraient soit du HTML invalide, soit l'abandon de la ligne cliquable ;
  3. un `AlertDialogTrigger` dans la liste ferait basculer `/historique` en Client Component (Research § Traps 13),
     alors que la liste est un Server Component naturel. En posant la suppression sur `/historique/[id]` — déjà
     client parce que le formulaire l'est — le coût est nul.
- **Toujours aucun delta, aucune couleur de progression** sur cet écran : c'est s06 qui les porte. Ni
  `--progress-favorable` ni `--progress-adverse` n'apparaissent nulle part dans s09.

### 2. `/historique/[id]` — écran d'édition (s09)

Le formulaire de s03, **au caractère près** pour la mise en page : une date pleine largeur, le poids seul,
`FieldSet` « Mensurations (cm) » en grille 2 colonnes, `FieldSet` « Composition (%) ». Ce qui change tient en
quatre points.

```
┌─ 375 px ────────────────────────────────┐
│  ‹ Historique         (lien texte)       │
│  Modifier la session  (h1)               │
│  Enregistrée le 26 juillet 2026          │  ← rappel, --muted-foreground
├──────────────────────────────────────────┤
│  Date                                    │
│  [ 2026-07-26            ]               │
│                                          │
│  Poids (kg)                              │
│  [ 83,1              ]                   │
│  ───────────────────────  FieldSeparator │
│  Mensurations (cm)                       │
│  ┌ Épaules ──┐ ┌ Poitrine ─┐             │
│  │[ 118    ] │ │[ 104,5  ] │             │
│  ┌ Biceps ───┐ ┌ Tour de taille ┐        │
│  │[ 34,5   ] │ │[ 97          ] │        │
│  ┌ Hanches ──┐ ┌ Cuisse ───┐             │
│  │[        ] │ │[ 58,5   ] │             │  ← non mesurée : reste VIDE
│  ┌ Mollet ───┐ ┌  (vide)   ┐             │
│  │[        ] │ │           │             │
│  ───────────────────────  FieldSeparator │
│  Composition (%)                         │
│  ┌ Masse grasse ┐ ┌ Masse musculaire ┐   │
│  │[ 25,2      ] │ │[              ] │    │
│                                          │
│  Vider un champ retire cette mesure de   │  ← FieldDescription, en tête de formulaire
│  la session.                             │
│  [   Enregistrer les modifications   ]   │  Button primaire, pleine largeur
│  ───────────────────────  FieldSeparator │
│  La suppression est définitive.          │  --muted-foreground, text-sm
│  [    Supprimer cette session    ]       │  Button variant="destructive"
└──────────────────────────────────────────┘
```

**a) Les valeurs affichées sont celles réellement enregistrées — et elles ne sont jamais grisées.**
C'est le piège désigné de la story (Research § Traps 2). Le tableau ci-dessous est le contrat visuel :

| | s05 — création | **s09 — édition** |
|---|---|---|
| Origine de la valeur | dernière valeur connue, toutes sessions confondues | **la session elle-même** |
| Couleur de la valeur | `--muted-foreground` tant que non touchée | **`--foreground`, toujours** |
| Attribut DOM | `data-prefilled="true"` puis retiré | **absent, dans tous les cas** |
| Champ jamais renseigné | vide | **vide, et il le reste** |
| Légende « valeurs grisées » | affichée | **absente** |

Un champ vide en édition est un **fait** (la mesure n'a pas été prise ce jour-là), pas un manque à combler. Le
remplir depuis une autre session ferait enregistrer une mesure jamais réalisée.

**b) Une phrase explique la sémantique du vidage.** `FieldDescription` placée juste sous le rappel de date, avant les
champs : « Vider un champ retire cette mesure de la session. » Sans elle, le critère 3 est un comportement invisible :
personne ne devine qu'effacer supprime plutôt que de mettre à zéro. Quand un champ **qui portait une valeur** est
vidé, une seconde `FieldDescription` apparaît sous ce champ précis : « Cette mesure sera retirée. » — feedback local,
en `--muted-foreground`, sans couleur d'alerte : ce n'est pas une erreur, c'est l'effet voulu.

**c) La date reste modifiable.** Le formulaire de s03 est repris sans amputation : une date mal tapée est exactement
le genre d'erreur que cette story existe pour réparer. Conséquence à porter au Plan et non à ce document : deux
sessions peuvent alors partager la même `measured_on`, ce qui rouvre le départage du `DISTINCT ON`
(Research § Traps 17). C'est une contrainte de requête, pas de design.

**d) La zone de suppression est en fin d'écran, après un `FieldSeparator`.** Sous l'action principale, jamais au-dessus
ni à côté : on ne rencontre le bouton destructif qu'après avoir dépassé celui qu'on cherchait. Une ligne
`--muted-foreground` le précède — « La suppression est définitive : la session et ses mesures ne seront pas
récupérables. » — parce que le design system exige de nommer ce qui est concerné, et parce qu'il n'y a pas de
corbeille. Le bouton est en `Button variant="destructive"`, pleine largeur.

Rappel de s03 conservé tel quel : `type="text"` + `inputMode="decimal"` (jamais `type="number"`, qui refuse la virgule
française et renvoie `""` sur une valeur invalide — le piège vide → zéro), police de champ à 1 rem pour éviter le zoom
iOS au focus, hauteur d'interaction composée à 2,75 rem, aucun `placeholder`, aucun astérisque.

### 3. La confirmation de suppression (s09)

`alert-dialog`, imposé par `docs/design-system.md` § Feedback : « Action destructive (supprimer une session) →
`alert-dialog`, **avec le contenu concerné nommé dans le texte** ».

```
┌─ overlay ───────────────────────────────┐
│                                          │
│   ┌────────────────────────────────┐     │
│   │ Supprimer la session du         │    │  AlertDialogTitle
│   │ 26 juillet 2026 ?               │    │
│   │                                 │    │
│   │ Cette session et ses 7 mesures  │    │  AlertDialogDescription
│   │ seront définitivement           │    │
│   │ supprimées. Cette action est    │    │
│   │ irréversible.                   │    │
│   │                                 │    │
│   │ [  Annuler  ] [  Supprimer  ]   │    │  Cancel (outline) / Action (destructive)
│   └────────────────────────────────┘     │
└──────────────────────────────────────────┘
```

- **Le titre nomme la date de la session**, pas « cet élément ». Une confirmation générique (« Êtes-vous sûr ? ») ne
  satisfait pas la règle du design system.
- **La description compte les mesures concernées.** C'est la seule information qui manque à l'écran au moment de
  décider : elle chiffre ce qu'on perd.
- `AlertDialogCancel` garde son défaut `variant="outline"` ; `AlertDialogAction` reçoit `variant="destructive"`
  (les deux acceptent `variant`, vérifié dans le composant du registre). Dans `radix-nova`, `destructive` est un fond
  `--destructive/10` translucide avec le texte en `--destructive` — un bouton **atténué**, pas un aplat rouge. Le rouge
  reste donc le seul signal coloré de l'écran ; à vérifier en clair **et** en sombre (*gap n°3*).
- **« Annuler » porte le focus à l'ouverture**, et `Échap` / le clic sur l'overlay ferment le dialogue sans agir.
  Exigence de design ; le mécanisme (`onOpenAutoFocus`) est du ressort du Plan.
- **Pas d'`AlertDialogMedia`** : le composant existe dans le registre, mais y loger une icône d'alerte reviendrait à
  trancher le gap des icônes à la volée (*gap n°1*).
- La couleur ne porte aucune information seule : le verbe « Supprimer », le titre et la description disent tout. Un
  lecteur qui ne perçoit pas le rouge lit exactement la même chose.

### 4. Après l'action

| Action réussie | Destination | Feedback |
|---|---|---|
| Enregistrement des modifications | `/historique` | toast `sonner` « Modifications enregistrées » ; la session corrigée est à sa place dans la liste |
| Suppression | `/historique` | toast `sonner` « Session supprimée » ; la ligne a disparu |

Retour à la liste dans les deux cas, jamais un maintien sur un écran d'édition dont la session vient d'être détruite.
La preuve est la liste elle-même, le toast n'est que le confirmateur discret exigé par le design system. Si c'était la
dernière session, `/historique` retombe sur l'état `Empty` de s03 — rendu dans la maquette, parce que c'est le
chemin le plus facile à oublier.

Rien n'est affiché de façon figée : la silhouette (s06) et les graphes (s07) se recalculent à la lecture. Le
référentiel des deltas est la **première mesure enregistrée**, obtenue par requête — corriger ou supprimer la
première session le déplace, et aucun écran ne doit en garder une copie (Research § Traps 7). C'est une contrainte
d'implémentation que ce design ne peut que rappeler.

---

## Mockup

`docs/designs/s09-edit-delete-session.html` — référence visuelle. **NE PAS copier en production** : l'exécution
reconstruit ces écrans avec les vrais composants de `src/components/ui/` (`item`, `field`, `input`, `button`,
`alert-dialog`, `empty`, `skeleton`, `spinner`, `sonner`).

Le fichier rend les **treize états** ci-dessous, chacun dans un cadre étiqueté de 375 px, tous visibles en un seul
défilement. Les variables CSS y sont recopiées à l'identique depuis `src/app/globals.css` ; le thème suit
`prefers-color-scheme`, et une dernière section force `.dark` pour que les deux thèmes soient visibles quel que soit
le réglage de la machine qui ouvre le fichier.

Écarts connus de la maquette avec le rendu réel, hérités de s03 et s05 :
- police : pile système (Geist n'est pas embarquable sans asset externe) ;
- `--input` en sombre : `oklch(1 0 0 / 15%)`, la valeur réellement dans `globals.css` (le design system annonce 10 % —
  divergence relevée en Research, à corriger dans le document, pas dans le code) ;
- `--progress-favorable` / `--progress-adverse` sont déclarés dans le bloc de tokens mais **volontairement inutilisés** :
  aucun écran de s09 n'affiche de delta.

---

## Reused components (from the design system)

Tous vérifiés présents dans le registre `radix-nova` (requête HTTP réelle en Research, exports relevés dans le
contenu des items).

| Composant | Où / pourquoi | Nouveau ? |
|---|---|---|
| `alert-dialog` | La confirmation de suppression. `AlertDialog` + `Trigger` + `Content` + `Header` + `Title` + `Description` + `Footer` + `Cancel` + `Action`. `Cancel` et `Action` sont des `Button` en `asChild` et acceptent `variant` / `size`. **`"use client"`** : à isoler dans un composant de `src/components/`. | **oui — s09** |
| `item` | La ligne d'historique, désormais `Item variant="outline" asChild` autour d'un `<Link>`. `ItemContent`, `ItemTitle`, `ItemGroup` inchangés depuis s03. `ItemActions` **n'est pas utilisé** (voir la décision « aucun bouton de suppression sur la ligne »). | s03 |
| `field` | Tout le formulaire d'édition : `FieldSet` + `FieldLegend` pour les groupes, `FieldGroup`, `Field`, `FieldLabel`, `FieldSeparator` (entre les groupes **et** avant la zone de suppression), `FieldError` par champ et pour l'erreur de formulaire, **`FieldDescription`** pour la sémantique du vidage — les dix exports du composant sont vérifiés. | s03 |
| `input` | Les dix champs de mesure (`type="text"`, `inputMode="decimal"`) et la date (`type="date"`), pré-remplis avec les valeurs réellement enregistrées. | s03 |
| `button` | « Enregistrer les modifications » (primaire, pleine largeur), « Supprimer cette session » (`variant="destructive"`), « Nouvelle session » et « Réessayer » (hérités). Tiré aussi en `registryDependency` par `alert-dialog`. | s03 |
| `empty` | Session introuvable ou n'appartenant pas à l'utilisateur ; historique vide après suppression de la dernière session ; erreur de lecture. `EmptyMedia` non utilisé (*gap n°1*). | s03 |
| `skeleton` | Lecture de la session à éditer : squelettes à la forme exacte des champs, pendant le cold start Neon (~500 ms). Jamais de spinner plein écran. | s03 |
| `spinner` | Dans le bouton pendant l'enregistrement (« Enregistrement… ») et dans `AlertDialogAction` pendant la suppression (« Suppression… »). | s03 |
| `sonner` | Toasts « Modifications enregistrées » et « Session supprimée », sur `/historique`. **Sans action « Annuler »** : la suppression est définitive, un undo impliquerait une suppression logique et donc un ADR. | s03 |

**À installer par la CLI** pour que ces écrans existent :

```bash
npx shadcn@latest add alert-dialog item field input button empty skeleton spinner sonner
```

`label` et `separator` arrivent en dépendances transitives de `field` et `item` — ne pas les ajouter à la main.
`alert-dialog` tire `button` et **aucune dépendance npm** : `radix-ui@1.6.7` réexporte déjà
`@radix-ui/react-alert-dialog`. `sonner` tire les paquets npm `sonner` et `next-themes`.

**Non utilisés, volontairement** : `card` (s06), `select` et `chart` (s07), `alert` (s10), `badge`, `tooltip`. Et
`form`, qui **n'existe pas** dans ce style (item vide dans le registre — voir les gaps de s03 et s05).

---

## States

Treize états, tous rendus dans la maquette.

### `/historique` (delta)

| # | État | Traitement |
|---|---|---|
| 1 | **Rempli** | `ItemGroup` trié du plus récent au plus ancien, chaque ligne ouvrable, mot « Modifier » en `--muted-foreground` à droite du titre. |
| 2 | **Ligne au focus / pressée** | Anneau `--ring` sur toute la carte (navigation au clavier en desktop) ; fond `--muted` à l'état actif, pour que le tap soit accusé avant la navigation. |
| 3 | **Après enregistrement** | Toast `sonner` « Modifications enregistrées », la session corrigée à sa place. |
| 4 | **Après suppression** | Toast `sonner` « Session supprimée », une ligne de moins. |
| 5 | **Vide après suppression de la dernière session** | `Empty` de s03 (« Aucune session enregistrée ») + bouton « Saisir mes mesures ». Pas d'écran mort, pas de liste à zéro élément. |

### `/historique/[id]`

| # | État | Traitement |
|---|---|---|
| 6 | **Chargement** | En-tête, libellés, séparateurs et boutons peints immédiatement ; chaque emplacement de valeur porte un `Skeleton` à la hauteur exacte du champ. Le bouton de suppression est **désactivé** tant que la session n'est pas chargée : on ne supprime pas ce qu'on n'a pas encore lu. |
| 7 | **Nominal** | Valeurs réellement enregistrées, en `--foreground`, sans `data-prefilled`. Les mesures absentes de la session sont des champs **vides**. |
| 8 | **Champ vidé** | Le champ qui portait une valeur et vient d'être effacé affiche sous lui « Cette mesure sera retirée. » en `--muted-foreground`. Ni `--destructive`, ni icône : c'est une information, pas une erreur. Réversible — retaper une valeur fait disparaître la ligne. |
| 9 | **Erreur de champ** | Valeur hors plage physiologique refusée par le serveur → `FieldError` sous le champ, en `--destructive`, en français, sans code technique. Les autres champs conservent leur valeur. Jamais de résumé en haut de page. (Les bornes chiffrées de la maquette sont des **exemples** : les plages réelles par mesure sont une décision du Plan.) |
| 10 | **Enregistrement en cours** | Bouton principal désactivé, `Spinner` + « Enregistrement… ». Champs lisibles et non désactivés. Bouton de suppression désactivé pendant l'opération. Aucun recouvrement d'écran. |
| 11 | **Erreur d'enregistrement ou de suppression** | `FieldError` non rattaché à un champ, **juste au-dessus du bouton concerné** (pattern posé par s03, gap n°3) : « L'enregistrement a échoué. Vérifiez votre connexion et réessayez. » / « La suppression a échoué. Vérifiez votre connexion et réessayez. » Le dialogue se ferme, rien n'est perdu, l'écran reste utilisable. |
| 12 | **Session introuvable ou non autorisée** | `Empty` : « Session introuvable », « Elle a peut-être été supprimée. » + bouton « Retour à l'historique ». **Un accès croisé rend exactement le même écran qu'une session inexistante** — ne rien divulguer est la position par défaut de ce design ; le choix technique 404 / 403 reste au Plan (*gap n°6*). |

### Confirmation de suppression

| # | État | Traitement |
|---|---|---|
| 13 | **Dialogue ouvert** | Overlay assombrissant, contenu centré, titre nommant la date, description chiffrant les mesures, `Annuler` (focus initial) et `Supprimer` (`variant="destructive"`). |
| 13b | **Suppression en cours** | Les deux boutons désactivés, `Spinner` + « Suppression… » dans l'action. Le dialogue reste ouvert : rien ne bouge sous les doigts tant que le serveur n'a pas répondu. |

### Vérifications transverses portées par la maquette

- **375 px, aucun défilement horizontal, aucun débordement** : largeurs relatives partout, grille en
  `minmax(0, 1fr)`, aucune largeur fixe dans le contenu. Le titre du dialogue (le texte le plus long de la story) est
  vérifié sur deux lignes sans débordement.
- **Clair et sombre** : chaque état se relit dans les deux thèmes. Points sensibles ici — la bordure de l'`Item`
  (d'où `variant="outline"`, hérité de s03), le fond du `AlertDialogContent` (`--popover`, distinct de `--background`
  en sombre seulement), et le bouton `destructive` translucide (*gap n°3*).
- **Aucune couleur en dur, aucun rayon en dur, aucune valeur arbitraire** : tout vient d'un token ou d'un palier
  `--radius-*`.
- **La couleur ne porte jamais l'information seule** : le seul usage de couleur sémantique de s09 est le rouge de la
  suppression, toujours doublé par le mot « Supprimer » et par le texte du dialogue.

---

## Design system gaps

Besoins que `docs/design-system.md` ne couvre pas. **Signalés, pas comblés à la volée** — chaque point demande une
décision avant ou pendant `/ks-plan`, et un reversement dans le design system. Chacun est assorti du repli tenu par
ce design en attendant.

1. **Icônes — gap n°2 du système, toujours ouvert, et s09 le heurte trois fois.** La ligne d'historique appelle un
   chevron, le bouton de suppression une corbeille (`Trash2` est vérifiée présente dans `lucide-react@1.28.0`), le
   dialogue un `AlertDialogMedia` d'alerte. *Repli* : **aucune icône**, comme s03, s06 et s07 — affordance par le mot
   « Modifier », bouton de suppression en texte seul, dialogue sans média. À trancher globalement, pas story par story.

2. **Cible tactile — gap déjà signalé par s03 (n°2), s05 (n°1) et s06 (n°4), et il devient sensible ici.**
   `Button` du registre fait `h-8` (32 px) par défaut, `h-9` en `lg` ; `AlertDialogCancel` et `AlertDialogAction` sont
   des `Button`. Deux contrôles voisins de 32 px, dont un irréversible, sur un écran de 375 px manipulé au pouce, c'est
   le pire endroit du produit pour rester sous 44 px. *Repli* : la composition `h-11` posée par s03 sur les boutons
   d'action, étendue aux deux boutons du dialogue. **À acter comme règle** (« hauteur d'interaction minimale :
   2,75 rem sur mobile ») plutôt que re-décidée à chaque story.

3. **Aucune règle de contraste, et la variante `destructive` du preset est atténuée.** `buttonVariants` rend
   `bg-destructive/10 text-destructive` — du texte rouge sur un fond translucide à 10 %, donc un contraste qui dépend
   du fond sous-jacent (`--background` sur l'écran, `--popover` dans le dialogue) et qui diffère en clair et en sombre.
   Le design system impose de « vérifier chaque écran en clair et en sombre » mais ne fixe **aucun seuil ni méthode**.
   Aggravant : la classe `dark` n'est posée par personne aujourd'hui (Research), donc le thème sombre n'est pas encore
   vérifiable dans l'app. *Repli* : variantes du registre inchangées, contraste à vérifier à l'exécution.

4. **Aucun pattern de « zone dangereuse » dans un formulaire.** Le système dit quel composant utiliser pour confirmer
   (`alert-dialog`) mais rien sur où loger le déclencheur : au-dessus ou en dessous de l'action principale, dans un
   encadré, séparé ou non. *Repli* : après un `FieldSeparator`, en fin d'écran, précédé d'une ligne d'avertissement en
   `--muted-foreground`. **À entériner** ; sinon un futur écran destructif le re-décidera autrement.

5. **La collision de pré-remplissage n'est pas écrite dans le système — c'est le piège de la story.** s05 introduit la
   convention « valeur reprise de l'historique = `--muted-foreground` + `data-prefilled` + légende » et son gap n°2
   demandait déjà qu'elle soit consignée. Tant qu'elle ne l'est pas, rien n'interdit à l'implémentation d'appliquer le
   même grisé en édition, où les valeurs sont **réelles**. *Repli* : la table de contrat visuel de la section
   *Screen(s)* § a. **À reverser dans `docs/design-system.md` § Formulaires** comme deux états distincts et
   mutuellement exclusifs : « valeur suggérée » (création) et « valeur enregistrée » (édition).

6. **Aucun motif pour « ressource introuvable ou non autorisée ».** Le système couvre Vide / Chargement / Erreur /
   Succès ; ni le 404 ni le refus d'accès n'ont de conteneur. *Repli* : réutiliser `Empty`, dans la ligne du gap n°6 de
   s03 (qui proposait déjà `Empty` pour les erreurs de lecture), avec un écran identique dans les deux cas pour ne rien
   divulguer. **La décision technique** (`notFound()` vs `forbidden()`, ce dernier exigeant
   `experimental.authInterrupts`) est un choix de sécurité à acter au Plan ou en ADR, pas un choix visuel.

7. **Format des nombres — gap connu (s03 n°7, s06 n°6, s07 n°3), et s09 en fait un risque de corruption.** En édition,
   la valeur affichée est **réinjectée telle quelle** au prochain enregistrement : si le formatage à l'affichage
   (`82,4`) et le parseur à la soumission ne sont pas symétriques, ré-enregistrer une session sans rien toucher altère
   les données. *Repli* : virgule française, aucun zéro de queue, comme s03. **La paire formateur / parseur doit être
   fixée au Plan**, et testée dans les deux sens.

8. **Navigation — gap n°5 de s06, toujours ouvert.** s09 ajoute un troisième niveau (`accueil → historique →
   session`) sans qu'aucun composant de navigation n'existe dans le système. *Repli* : lien texte « ‹ Historique » en
   tête d'écran, comme le « ‹ Retour » de s03. Le chemin `/historique/[id]` proposé ici est **un repère, pas une
   décision** : la route appartient au Plan (premier segment dynamique du projet).

9. **Rien ne dit qui confirme, ni où.** Le système impose `alert-dialog` et le fait de nommer le contenu, mais ne fixe
   ni l'ordre des boutons (`Annuler` à gauche ou à droite), ni lequel porte le focus initial, ni si l'action
   destructive doit être la variante appuyée ou atténuée. *Repli* : `Annuler` à gauche en `outline` **et** au focus,
   `Supprimer` à droite en `destructive`. **À entériner** pour que toute future confirmation destructive du produit s'y
   conforme.

---

## Ce que ce design ne fait pas

Garde-fous explicites, pour que l'exécution ne dérive pas :

- **Pas de corbeille, pas de suppression logique, pas d'« Annuler » dans le toast.** La suppression est définitive
  (`docs/stories.md:253`) ; un undo impliquerait un `deleted_at`, donc un ADR, donc une autre story.
- **Pas de geste de balayage pour supprimer.** Aucun composant du système ne le porte, l'affordance est invisible, et
  un balayage destructif sans confirmation contredirait le critère 4.
- **Pas de sélection multiple, pas de suppression en lot.** Un seul utilisateur, ~1 session par semaine.
- **Pas de `data-prefilled`, pas de valeur grisée, pas de légende « dernières mesures »** : c'est s05, et l'appliquer
  ici serait le bug que la Research désigne.
- **Pas de delta, pas de couleur de progression, pas de silhouette, pas de graphe** : s06 et s07. s09 les *invalide*,
  il ne les redessine pas.
- **Pas d'`ItemActions`, pas de menu contextuel, pas de bouton flottant** sur la liste.
- **Pas de duplication de session, pas d'historique des modifications, pas de champ « note »** : hors périmètre.
- **Aucun sélecteur d'unité**, nulle part.
