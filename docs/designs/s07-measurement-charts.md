# Design — Story s07-measurement-charts

> Dérivé de `docs/design-system.md`, qui est la seule source visuelle. Rien de ce document n'introduit
> un token, une couleur ou un composant hors système : ce qui manque est listé en **Design system gaps**,
> pas comblé ici. Cible de conception : iOS Safari, portrait, **375 px**. Le desktop est secondaire.

## Screen(s)

Un seul écran, une seule colonne, **pas d'onglet, pas de second niveau** : `/…/graphes` (route arrêtée au plan).
De haut en bas, à 375 px, marge latérale `px-4` (16 px) :

| # | Bloc | Contenu | Composant |
|---|---|---|---|
| 1 | Barre de retour | Lien « ← Accueil » vers la silhouette (s06) | `button` en variante lien, ou lien nu |
| 2 | Titre | « Évolution » | `<h1>` |
| 3 | Sélecteur de mesure | Libellé « Mesure » + contrôle pleine largeur, valeur courante affichée | `label` + `select` |
| 4 | Carte du graphe | En-tête chiffré, courbe, légende de série | `card` |
| 4a | En-tête chiffré | « Dernière valeur » + valeur en mono tabulaire + date | — |
| 4b | Courbe | `ChartContainer` → `LineChart` : une série, axe X temporel, axe Y, tooltip | `chart` |
| 4c | Légende de série | Une ligne atténuée : « Seules les sessions où *la mesure* a été saisie apparaissent — N mesures. » | — |

Le bloc 4 est un **emplacement unique** : selon l'état, il contient la courbe, un squelette, un état vide
ou un message d'erreur. Les blocs 1 à 3 ne bougent jamais — changer de mesure depuis un état vide doit
rester possible sans quitter l'écran.

### Décisions de conception

**Une seule série, trait `--foreground`.** Conforme au design system (§ Graphes). Les `--chart-1..5` du
preset restent **inutilisés** : ce sont cinq gris pensés pour des aires empilées, et `--chart-1` est quasi
invisible en trait sur fond clair. Le canal légitime pour donner un token au trait est le `config` de
`ChartContainer` (`{ value: { label: "Poids", color: "var(--foreground)" } }` → `stroke="var(--color-value)"`),
qui écrase le `#3182bd` en dur de Recharts.

**Aucune couleur de progression sur cet écran.** Pas de vert, pas de rouge, pas de
`--progress-favorable` / `--progress-adverse` : le sens favorable est l'affaire de la silhouette (s06).
La courbe est neutre, et la règle « la couleur ne porte jamais l'information seule » est respectée par
construction — ici la couleur ne porte **aucune** information. L'écart depuis la première mesure n'est
pas repris : il vit sur la silhouette, le dupliquer ici serait deux sources pour le même chiffre.

**Les points sont visibles en permanence** (`dot` au défaut Recharts). C'est ce qui rend lisible *où sont
les mesures réelles* — la contrepartie textuelle du critère 3 — et ce qui donne une cible tapotable au
critère 6.

**Trous : raccord entre points connus, pas de rupture de ligne.** La série ne contient que des mesures
réellement enregistrées (une ligne `measurements` par mesure existante, ADR 004) ; il n'y a donc pas de
`null` à traverser. Deux points éloignés sont reliés par un segment long, et la légende 4c dit combien de
mesures composent la série. Alternative écartée : rompre la ligne à chaque session où la mesure est absente
— les sessions partielles étant le cas courant (PRD, § Données), chaque courbe deviendrait une poussière de
segments. **Ce que le design interdit formellement** : un point, un zéro ou un tick pour une mesure absente.
Le plan doit verrouiller par test que la préparation des données ne comble aucun trou (`?? 0`, `Number(undefined)`).

**Axe X temporel réel.** Format des ticks : `j mmm` abrégé français (`5 janv.`, `16 févr.`, `30 mars`),
3 ticks à 375 px. Format retenu parce qu'il tient en ~42 px à 12 px de fonte et reste juste sur un axe
irrégulier ; la densité exacte (`minTickGap` / `interval`) est un réglage du plan, pas un choix visuel.

**Axe Y.** Largeur `auto` plutôt que le défaut Recharts de 60 px, qui mangerait 16 % des 375 px. Trois
graduations, jamais forcées à zéro : sur un poids qui va de 78 à 74 kg, un axe partant de 0 écrase la
lecture. La police des ticks vient de `ChartContainer` (`text-xs` = 0.75 rem = 12 px), donc au niveau du
plancher `--label-min-size`.

**Tooltip.** Date complète en français (`26 janvier 2026`) en en-tête, puis nom de la mesure et valeur
avec son unité, décimale française (`77,2 kg`). `formatter` et `labelFormatter` explicites : sans eux,
`ChartTooltipContent` appelle `toLocaleString()` sans locale et l'affichage diverge entre serveur et
navigateur. Le déclencheur (`hover` vs `click`) reste une décision technique du plan — le design exige
seulement que le tooltip s'ouvre au doigt et ne sorte pas du viewport.

**375 px.** Carte et conteneur en `min-w-0` (le conteneur responsive de Recharts pose déjà
`min-width: 0`), popover du `select` contraint à la largeur du viewport moins la marge, aucune valeur de
largeur en dur nulle part. La maquette met `overflow: hidden` sur chaque cadre de 375 px : ce qui déborde
se voit immédiatement.

## Mockup

`docs/designs/s07-measurement-charts.html` — référence visuelle. **NE PAS copier en production** :
l'exécution rebâtit avec les vrais composants shadcn. Le fichier rend les 11 vues en un seul défilement
(succès, sélecteur ouvert, tooltip, série clairsemée, point unique, chargement, trois états vides, erreur,
vérification bi-thème forcée). Les tokens y sont recopiés depuis `src/app/globals.css`, sans un seul hex.

Deux écarts assumés de la maquette par rapport à l'implémentation : la police est celle du système
(Geist n'est pas embarquable sans asset externe ; l'implémentation utilise `--font-sans`), et la courbe
est un SVG écrit à la main — Recharts produira une géométrie proche, pas identique.

## Reused components (from the design system)

Tous vérifiés présents dans le registre `@shadcn` (tableau du design system + relevé de Research).
`src/components/ui/` est vide : chacun s'installe par la CLI, jamais à la main.

| Composant | Où / pourquoi |
|---|---|
| `select` | Le sélecteur de mesure — attribution explicite du design system à s07. 11 entrées en 2 groupes (`SelectGroup` + `SelectLabel`) : « Poids et indices » (Poids, IMC, Masse grasse, Masse musculaire) et « Mensurations » (Épaules, Poitrine, Biceps, Taille, Hanches, Cuisse, Mollet). Une liste plate de 11 lignes est illisible au pouce. |
| `label` | Libellé « Mesure » du sélecteur, avec le nom accessible du déclencheur. `field` n'est pas utilisé ici : ce n'est pas un champ de formulaire, il n'y a ni validation ni zone de message — la règle « jamais un contrôle nu » est satisfaite par le `label`. |
| `chart` | `ChartContainer` / `ChartTooltip` / `ChartTooltipContent`. Seul canal autorisé pour colorer la courbe par un token, et seule configuration testable sous jsdom (`initialDimension`). |
| `card` | Cadre du bloc graphe, et emplacement unique où les états se remplacent. |
| `empty` | Les trois états vides **et** l'état d'erreur (voir gap 4). `Empty` / `EmptyTitle` / `EmptyDescription` / `EmptyContent`. Sans `EmptyMedia` : aucune icône n'est encore attribuée (gap 2). |
| `button` | Actions des états vides et de l'erreur : « Saisir une session », « Renseigner ma taille », « Réessayer » ; variante `outline` pour le réessai. |
| `skeleton` | État de chargement, à la forme du contenu attendu (valeur, aire du graphe, légende). |

Tokens utilisés, tous existants : `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`,
`--popover-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--accent`,
`--primary` / `--primary-foreground`, `--radius` et ses paliers, `--font-sans`, `--font-mono`,
`--label-min-size`. Aucun autre.

## States

| État | Déclencheur | Rendu |
|---|---|---|
| **Chargement** | Première arrivée sur l'écran, changement de mesure si la série est rechargée côté serveur | `skeleton` dans la carte : barre de valeur, aire du graphe, ligne de légende. Titre et sélecteur déjà affichés et actionnables. Jamais d'attente bloquante (cold start Neon ~500 ms). |
| **Succès — série complète** | ≥ 2 mesures | Courbe + points + axes + légende « Seules les sessions où *X* a été saisi apparaissent — N mesures. » |
| **Succès — série clairsemée** | ≥ 2 mesures, absentes de certaines sessions | Identique ; la légende chiffre l'écart (« 4 mesures sur 7 sessions »). Aucun point fantôme, aucun zéro. |
| **Succès — point unique** | Exactement 1 mesure | Le point seul, sans courbe (Recharts ne trace pas de `d`). Légende : « Une seule mesure enregistrée : pas encore de tendance à lire. » |
| **Point tapoté** | Tap / survol d'un point | Tooltip : date complète + nom de la mesure + valeur et unité en français. Le point actif est rempli, un curseur vertical en tirets marque la date. |
| **Vide — mesure sans donnée** | 0 mesure pour la mesure choisie, alors que des sessions existent | `empty` : « Aucune mesure de *X* » + explication + bouton « Saisir une session ». Le sélecteur reste actif. |
| **Vide — IMC sans taille** | Mesure = IMC et `profiles.height_cm` absent | `empty` distinct : « Taille non renseignée » + bouton « Renseigner ma taille » (profil, s04). Cause différente, action différente : deux messages, pas un seul (répond à la question ouverte 9 de la Research). |
| **Vide — aucune session** | Compte sans aucune session | `empty` : « Aucune session enregistrée » + bouton « Saisir ma première session ». Le sélecteur est désactivé : aucune série n'existe. |
| **Erreur** | Échec de chargement de la série | Message en clair, en français, disant quoi faire : « Impossible de charger la courbe. Les données n'ont pas pu être récupérées. Vérifiez votre connexion, puis réessayez. » + bouton « Réessayer ». Aucun code technique à l'écran. |

Pas de toast `sonner` sur cet écran : il n'y a aucune écriture, donc rien à confirmer.

## Design system gaps

Besoins que `docs/design-system.md` ne couvre pas. **À trancher et à reporter dans le design system, pas à
improviser à l'exécution.** Chaque gap est assorti du repli provisoire à tenir en attendant, choisi pour ne
rien inventer.

1. **Hauteur ou ratio d'un graphe.** Le système ne définit ni token de hauteur ni ratio. `ChartContainer`
   impose `aspect-video` (16:9), soit ~190 px de haut pour ~340 px de large sur un écran de 375 px — une
   courbe assez écrasée pour une lecture de tendance. *Repli* : garder `aspect-video`, le défaut du
   composant. **Interdit** : `h-[220px]` ou toute valeur arbitraire. Un ratio dédié aux séries temporelles
   (4:3 ?) serait un ajout au design system.

2. **Icônes.** Gap déjà connu (design system, § Gaps connus n°2) : la librairie est `lucide` mais aucune
   icône n'est attribuée à une action. Cet écran en demanderait quatre : retour, chevron du `select`,
   coche de l'item sélectionné, illustration des états vides (`EmptyMedia`). *Repli* : chevron et coche
   sont fournis par le `select` généré ; le retour reste textuel et les `empty` sont sans média.

3. **Format des nombres et des dates en français.** Le système ne fixe aucune convention pour rendre une
   valeur mesurée (`72,4 kg` — séparateur décimal, position de l'unité, nombre de décimales) ni une date
   (`26 janvier 2026` vs `26/01` vs `janv.`). Le besoin est transversal — le tooltip et les ticks ici, les
   deltas de la silhouette en s06, l'historique en s03 — donc il appartient au design system, pas à cette
   story. Aggravant : `ChartTooltipContent` appelle `toLocaleString()` sans locale, avec risque d'écart
   d'hydratation. *Repli* : `formatter` / `labelFormatter` explicites en `fr-FR`, décimale virgule, unité
   suffixée, une décimale — cohérent avec l'arrondi de l'IMC fixé en s04.

4. **Placeholder d'erreur pour un emplacement de données.** Le système attribue `alert` au seul bandeau
   hors ligne de s10 et ne définit aucun motif pour « ce bloc n'a pas pu charger ». *Repli assumé* :
   réutiliser `empty` comme conteneur (titre + description + `button` « Réessayer », avec `role="alert"`),
   parce que c'est le même emplacement et le même geste de sortie. Si le système préfère `alert` inline,
   c'est une décision à consigner, pas à prendre à l'exécution.

5. **Échelle typographique.** Le design system fixe la famille et un plancher (`--label-min-size`), mais
   aucune échelle de titres ni de valeurs chiffrées. Cet écran utilise un titre, un libellé, une valeur
   proéminente et une légende atténuée. *Repli* : l'échelle Tailwind par défaut (`text-lg` titre,
   `text-sm` libellé, `text-2xl` valeur, `text-xs` légende), sans aucune valeur arbitraire. À figer si
   d'autres écrans doivent s'y aligner.

6. **Point d'entrée vers cet écran.** Aucun critère de s07 ne l'exige, et s06 interdit explicitement les
   zones cliquables sur la silhouette. La maquette suppose un simple retour « ← Accueil » et laisse le
   chemin aller ouvert. **Ce n'est pas un gap visuel mais une décision de navigation à prendre avec s06** ;
   la signaler ici évite qu'un agent improvise un onglet ou une barre de navigation absente du système.
