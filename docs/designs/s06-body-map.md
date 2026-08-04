# Design — Story s06-body-map

> Dérivé de `docs/design-system.md`. Aucun token, aucune couleur, aucun composant hors système.
> Cible primaire : iOS Safari, portrait, **375 px**. Desktop secondaire.
> Ce document tranche le **gap n°1 du design system** (« le dessin de la silhouette ») et remonte les gaps découverts en le traitant.

## Screen(s)

Un seul écran, un seul défilement vertical : `/` — l'accueil de l'app authentifiée. Il remplace intégralement le placeholder de s02.

### Structure, de haut en bas

| # | Bloc | Contenu | Rôle vis-à-vis des critères |
|---|---|---|---|
| 1 | **En-tête collant** (`sticky top-0`, fond `--background`, bordure basse `--border`) | « morpho » + `Button` **Saisir** | Critère 8 : le bouton reste atteignable pendant tout le défilement → **un tap**, jamais deux |
| 2 | **La silhouette** | SVG + 7 étiquettes HTML + légende | Critères 1, 2, 4, 5, 6, 7 |
| 3 | **Hors silhouette** | 4 `card` : Poids, IMC, Masse grasse, Masse musculaire | Critère 3 |

Rien d'autre. Ni liste, ni tableau de bord chiffré, ni onglets (critère 1).

### Le bloc silhouette — géométrie décidée ici

C'est la partie que le design system laissait ouverte. Décisions :

- **Le SVG ne contient que le corps.** `viewBox="0 0 120 312"` (ratio 1:2,6), coordonnées relatives, aucune position en pixels. Il est rendu à `width: 34%` du conteneur (`max-width: 8.5rem`), centré : ≈ 117 px de large × 303 px de haut à 375 px de viewport.
- **Aucun texte dans le SVG.** Les étiquettes sont du HTML positionné en pourcentages au-dessus du conteneur. Deux raisons : un `<text>` SVG voit sa taille de police multipliée par l'échelle du `viewBox` (le plancher de 12 px deviendrait invérifiable), et le trap n°14 de la research impose de passer par l'utilitaire `text-label-min`, donc par une classe HTML. Le SVG est `aria-hidden="true"` : toute l'information est dans le texte.
- **Deux colonnes d'étiquettes**, `width: 30%` chacune, collées aux bords (`left: 0` / `right: 0`). Le corps occupe la bande centrale 33 %–67 %. À 375 px : 103 px par étiquette, 117 px pour le corps, ≈ 10 px de gouttière. **Aucun débordement, aucun défilement horizontal** (critère 7).
- **Répartition des 7 zones**, choisie pour qu'aucune étiquette n'en chevauche une autre (chaque étiquette fait 3 lignes ≈ 51 px ≈ 17 % de la hauteur) :
  - colonne gauche : Épaules (top 1 %), Poitrine (20 %), Hanches (43 %), Mollet (74 %)
  - colonne droite : Biceps (9 %), Taille (30 %), Cuisse (56 %)
- **Lignes de rappel.** Un second SVG en surimpression (`viewBox="0 0 100 100"`, `preserveAspectRatio="none"`, `vector-effect="non-scaling-stroke"`, trait `--border`) relie le milieu de chaque étiquette au bord de sa zone. C'est ce qui autorise l'écart vertical entre l'étiquette et la zone sans ambiguïté de lecture.
- **Découpe du corps.** 7 zones suivies + 5 groupes non suivis (tête, cou, avant-bras/mains, genoux, pieds). Les non-suivis sont toujours `--muted` / contour `--border` et n'ont jamais d'étiquette. Biceps, cuisse et mollet sont chacun deux tracés symétriques pilotés par la même valeur.
- **Pas de zone cliquable** (story ligne 178). Le SVG ne porte aucun `onClick`, aucun `<a>`, aucun `role="button"`.

### Étiquette d'une zone — 3 lignes, toujours dans cet ordre

```
Taille              ← nom, text-label-min (12 px), --muted-foreground
86,3 cm             ← dernière valeur, text-sm, tabular-nums, --foreground
▲ -7,4 cm           ← delta depuis la première mesure, text-label-min
```

La ligne 3 change selon l'état de la zone (voir *States*). **Aucune ligne ne descend sous `text-label-min`.**

### Format numérique (non fixé par le système, arrêté ici)

- Une décimale partout ; **virgule décimale française** ; unité collée à la valeur (`86,3 cm`, `78,4 kg`, `21,8 %` avec espace insécable avant `%`).
- Delta **toujours signé**, `+` explicite pour un delta positif.
- Delta exactement nul → `0,0 cm`, sans signe, en `--muted-foreground`, sans glyphe et sans couleur de progression : ce n'est ni un progrès ni un recul.
- Chiffres en `tabular-nums` pour que les deux colonnes s'alignent.

### Le bloc hors silhouette

Grille 2 × 2 de `card` (`size="sm"`), sous la silhouette, visuellement séparée (fond `--card`, bordure `--border`) : **Poids** (kg), **IMC**, **Masse grasse** (%), **Masse musculaire** (%). Même trame que les étiquettes : nom / valeur / delta signé.

Ces quatre valeurs sont **affichées sans couleur de progression** dans ce design. Ce n'est pas un oubli : le sens « favorable » du poids, de la masse grasse et de la masse musculaire n'est déclaré nulle part dans le PRD, les stories ni le design system (research, questions ouvertes 3 et 4). Colorier sur une intuition violerait la règle « le sens favorable est déclaré par mesure ». Le delta signé reste affiché, donc l'information est complète. Dès que les directions sont déclarées, ces cartes prennent le même traitement que les zones, sans changement de structure.

## Mockup

`docs/designs/s06-body-map.html` — référence visuelle. **NE PAS COPIER en production** : l'exécution reconstruit l'écran avec les vrais composants shadcn (`button`, `card`, `empty`, `skeleton`) et les utilitaires Tailwind des tokens.

Le fichier rend, en une seule page, chaque état dans un cadre de **375 px** : nominal (clair), nominal (sombre forcé), zones en détail, initial (aucune session), chargement, erreur, et les variantes de la carte IMC. Toutes les couleurs y passent par les variables CSS du design system ; aucune valeur en dur.

## Reused components (from the design system)

| Composant | Où | Pourquoi |
|---|---|---|
| `button` | En-tête (« Saisir », `asChild` + `<Link>`), CTA de l'état initial, bouton « Réessayer » de l'état d'erreur | Critère 8 (un tap) et sorties d'état |
| `card` | Les 4 blocs hors silhouette (`Card` / `CardHeader` / `CardTitle` / `CardContent`), en `size="sm"` | Critère 3 : « affichés distinctement de la silhouette mais sur le même écran » |
| `empty` | État initial sans session, état d'erreur de chargement (`Empty` / `EmptyHeader` / `EmptyTitle` / `EmptyDescription` / `EmptyContent`) | Critère 9 ; pattern « États » du design system |
| `skeleton` | `app/loading.tsx` : un bloc à l'emprise de la silhouette, 7 blocs aux positions réelles des étiquettes, 4 cartes | Cold start Neon ~500 ms, sans écran d'attente bloquant |

À installer, noms vérifiés dans la table du design system :

```bash
npx shadcn@latest add button card empty skeleton
```

**Composant applicatif, hors registre** : `src/components/BodyMap.tsx` — le SVG et ses étiquettes. Le design system le prévoit explicitement (« La silhouette n'est pas un composant shadcn »). Il ne consomme que des tokens.

Notes d'implémentation relevées en research, à ne pas redécouvrir :
- `Empty` porte `border-dashed` **sans classe de largeur de bordure** : ajouter `border` sinon aucune bordure n'apparaît.
- `Button` expose `asChild` (via `Slot`) : c'est la voie pour envelopper un `<Link>` sans imbriquer un bouton dans un lien.
- Aucun `"use client"` sur cet écran : rien n'y est interactif côté client (research, trap 16).

## States

### États de page

| État | Traitement |
|---|---|
| **Initial** (aucune session) | La silhouette **reste affichée**, intégralement neutre (`--muted` / `--border`), sans étiquette de valeur — le corps reste l'écran d'accueil. Sous elle, un `empty` : titre « Aucune mesure enregistrée », description « Votre silhouette s'annotera dès la première session. », `EmptyContent` = `Button` « Saisir ma première mesure ». Jamais une silhouette « vide et muette » (critère 9), jamais une page blanche. |
| **Chargement** | `loading.tsx` : en-tête réel (le bouton Saisir reste tapable), puis `skeleton` à la forme du contenu — un bloc centré à l'emprise du corps, 7 blocs d'étiquettes aux positions définies plus haut, 4 cartes. Pas de spinner plein écran. Suppose que la session est lue **dans la page**, pas dans le layout, sinon `loading.tsx` ne s'affiche jamais (research, trap 17). |
| **Erreur** (lecture impossible) | `empty` : « Impossible de charger vos mesures. », description « Vérifiez votre connexion, puis réessayez. », `Button` « Réessayer ». Message en clair, en français, aucun code technique. La silhouette n'est pas rendue à moitié. |
| **Succès / nominal** | Silhouette annotée + 4 cartes. Aucun toast : rien n'a été déclenché par l'utilisateur ici. |

### États d'une zone — trois, pas deux

| Cas | Remplissage | Ligne 3 de l'étiquette |
|---|---|---|
| **Aucune mesure** (critère 4) | `--muted`, contour `--border` | `Aucune mesure` en `--muted-foreground` ; la ligne 2 affiche `—`, pas un `0` |
| **Une seule mesure** (critère 5) | `--muted`, contour `--border` | `1 mesure` en `--muted-foreground`, aucun delta, aucune couleur |
| **Deux mesures ou plus** | token de progression à `fill-opacity: .22`, contour au même token | `▲ -7,4 cm` (progrès) ou `▼ +0,6 cm` (recul), ou `0,0 cm` neutre si le delta est nul |

Le sens favorable est lu depuis la déclaration par `kind` du domaine. **Jamais `delta < 0 ? favorable : adverse`** : dans le mockup, Taille `-7,4 cm` et Biceps `+1,2 cm` sont tous deux `--progress-favorable`, et Hanches `+0,6 cm` est `--progress-adverse` — trois signes, deux verdicts.

### État de la carte IMC

L'IMC dépend de `profiles.height_cm` (s04). Deux rendus :
- **taille renseignée** → valeur à une décimale + delta ;
- **taille absente** → aucune valeur, aucun `—` trompeur : « Renseignez votre taille pour calculer l'IMC. » + lien vers le profil. Conforme au critère 2 de s04 (« l'IMC n'est affiché nulle part »).

Une session sans poids n'affiche ni poids ni IMC : mêmes règles que les zones (`Aucune mesure`).

### Vérifications à mener sur cet écran

- 375 px de large : aucun défilement horizontal, aucun débordement (Playwright, viewport forcé à 375 — le projet `mobile` est à **390 px**, il faut le surcharger, research trap 10).
- Rendu en clair **et** en sombre : le vert de progression change de valeur entre les deux jeux (`0.55 0.12 152` → `0.7 0.14 152`), le remplissage à 0,22 doit rester distinguable du `--muted` dans les deux.
- Aucune étiquette sous 12 px.

## Design system gaps

Besoins non couverts par `docs/design-system.md`. **Signalés, pas comblés à la volée** — chaque point demande une décision avant ou pendant `/ks-plan`, et un reversement dans le design system.

### Gaps visuels

1. **Gap n°1 du système (« le dessin de la silhouette ») — traité ici.** Proportions, `viewBox`, découpe des 7 zones, positions des étiquettes, lignes de rappel : tout est arrêté dans la section *Screen(s)*. **À reverser dans `docs/design-system.md`** pour que s07 et s09 s'y réfèrent au lieu de le redécouvrir.

2. **Intensité de remplissage d'une zone — non couverte.** Le système fournit `--progress-favorable` / `--progress-adverse` en couleur pleine ; un aplat plein sur une zone de corps est illisible sous une étiquette. Proposition : **remplissage au token à `fill-opacity: 0.22`, contour au même token à pleine opacité**. Aucun token ni couleur ajoutés. À entériner.

3. **Le delta signé ne suffit pas à porter le sens favorable sans la couleur.** Le système affirme que « chaque zone affiche sa valeur et son delta signé ; la couleur ne fait que renforcer ». C'est faux ici : `-4,2 cm` est un progrès au tour de taille et un recul au biceps. Un lecteur avec une déficience rouge-vert (≈ 8 % des hommes, argument du système lui-même) ne peut pas trancher. Proposition : **glyphe typographique `▲` (progrès) / `▼` (recul) devant le delta, plus une légende sous la silhouette**. Le glyphe qualifie le *verdict*, pas le sens du chiffre. Pas d'icône lucide, donc le gap n°2 du système (icônes) reste ouvert et intact. **Amendement à entériner dans le design system.**

4. **Taille de cible tactile — non couverte.** `Button` du preset fait `h-8` (32 px) par défaut, `h-9` (36 px) en `size="lg"` : sous les 44 px recommandés sur iOS, pour le bouton qui porte le critère du tap unique. Le mockup rend les boutons **aux tailles du preset**, sans les corriger. À trancher : palier de hauteur ajouté au système, zone tactile étendue, ou acceptation explicite du 36 px.

5. **Navigation globale — inexistante dans le système.** Aucun composant de navigation n'est listé (ni `tabs`, ni barre). s06 ne livre que le tap vers la saisie ; l'accès aux graphes (s07), à l'historique (s03/s09), au profil (s04, requis par la variante « taille absente » de la carte IMC) et à la déconnexion (s02) n'a **aucun emplacement défini**. À trancher avant s07, sinon chaque story improvisera son propre lien.

6. **Format numérique — non couvert.** Décimales par unité, virgule française, signe explicite, traitement du delta nul : arrêtés dans *Screen(s)*, mais c'est une convention globale (elle sert aussi à s03, s07, s08). À reverser dans le système.

7. **Famille typographique effectivement appliquée.** Anomalie préexistante du shell : `@theme inline` déclare `--font-sans: var(--font-sans)` (auto-référence) alors que `layout.tsx` expose `--font-geist-sans` — la chaîne n'est pas branchée. La typographie de cet écran n'est donc pas celle décrite par le système tant que s01 ne le corrige pas. **À signaler, pas à corriger dans le diff de s06.**

### Points à trancher avant l'exécution — non visuels, mais bloquants pour ce design

- **Sens « favorable » par `kind`.** Seuls `waist_cm` (↓) et `biceps_cm` (↑) sont sourcés (critère 6 de la story). `chest_cm`, `hips_cm`, `thigh_cm`, `calf_cm`, `shoulders_cm`, `weight_kg`, `body_fat_pct`, `muscle_pct` ne le sont nulle part. Les couleurs du mockup sur ces zones sont **illustratives** et doivent être remplacées par la déclaration réelle. À confirmer avec l'utilisateur (research, questions ouvertes 3 et 4).
- **Coloration des 4 blocs hors silhouette** : conséquence directe du point précédent. Le design les laisse neutres tant que rien n'est déclaré.
- **Cible du tap unique** : la route du formulaire de saisie n'existe pas encore ; son chemin appartient à s03/s05. Le mockup écrit `/saisie` à titre de repère, pas de décision.
- **Libellés définitifs** de l'état initial et du CTA : proposés ici, à valider.
