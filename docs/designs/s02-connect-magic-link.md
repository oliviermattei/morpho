# Design — Story s02-connect-magic-link

> Phase Design du pipeline killer-saas. Ce document dérive les écrans de `docs/design-system.md` — **seule source visuelle du projet**. Aucun composant, aucun token, aucune couleur n'est inventé ici : ce que le système ne couvre pas est remonté en § *Design system gaps*, jamais comblé à la volée.
>
> Cible primaire : **iOS Safari, portrait, 375 px**. Desktop en secondaire. Chaque écran est vérifié en thème clair **et** sombre.

---

## Screen(s)

Trois écrans, dont un explicitement provisoire.

### Contraintes de gabarit (communes aux trois)

- **Colonne unique, largeur de contenu `min(100%, 24rem)` centrée, marge horizontale `px-6` (échelle Tailwind).** À 375 px, cela donne 327 px de contenu — aucun élément ne déborde, aucun défilement horizontal.
- Pas d'en-tête applicatif, pas de navigation : ni l'écran de connexion ni le placeholder n'ont de destination à proposer.
- Le mot-symbole est **purement typographique** : le texte `morpho`, en `--foreground`, casse normale. Le design system ne définit aucun logo (voir *gaps* § 6).
- Aucune image, aucune illustration, aucun asset externe. Les seuls glyphes sont des icônes `lucide` (voir *gaps* § 4).
- **Prérequis hors design** : la classe `.dark` doit être posée sur `<html>` d'après `prefers-color-scheme` (`docs/design-system.md` § Thème ; `docs/research/s02-connect-magic-link.md` § Traps 12). Sans elle, le thème sombre de ces écrans est inatteignable. C'est une tâche du shell, pas de ce design.

---

### 1. Écran de connexion — `/auth/sign-in`

Chemin **imposé** par le SDK : `SKIP_ROUTES` de Neon Auth contient `/auth/sign-in` en dur (Research § Traps 3).

Composition verticale, de haut en bas :

| Bloc | Contenu | Traitement |
|---|---|---|
| Mot-symbole | `morpho` | `text-sm`, `--muted-foreground`, aligné à gauche, en haut de l'écran |
| Zone centrale | *(centrée verticalement dans l'espace restant)* | |
| — Titre | « Connexion » | `text-2xl font-semibold`, `--foreground` |
| — Sous-titre | « Entrez votre adresse email. Vous recevrez un lien pour ouvrir votre session. » | `text-sm`, `--muted-foreground` |
| — Bandeau d'erreur d'opération | *(conditionnel — voir États)* | `alert`, pleine largeur, au-dessus du formulaire |
| — Champ | `field` : label « Adresse email » + `input` + zone de message | pleine largeur |
| — Action | `button` variant `default`, pleine largeur : « Recevoir le lien » | |
| Pied | « Pas de mot de passe, pas de compte à créer. » | `text-xs`, `--muted-foreground`, centré |

**Un seul champ, une seule action.** C'est la matérialisation de l'angle n°3 du PRD (« zéro compte au sens habituel ») : aucun lien « créer un compte », aucun « mot de passe oublié », aucun fournisseur tiers, aucune case à cocher.

Attributs du champ (contraintes mobiles, pas décoratifs) :

- `type="email"`, `inputMode="email"`, `autoComplete="email"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`.
- `autoFocus` : le clavier système s'ouvre à l'arrivée. Le seul geste requis avant la frappe est nul.
- Placeholder discret (`vous@exemple.fr`) — il ne remplace pas le label, qui reste visible (pattern `field` imposé).
- L'`input` du preset porte `text-base md:text-sm` : **16 px sur mobile**, ce qui évite le zoom automatique d'iOS Safari au focus. Ne pas forcer `text-sm` sur ce champ.

Le pied de page et le sous-titre ne se chevauchent pas à 375 px × 667 px (le plus petit écran iOS courant) : la zone centrale est en `flex-1` avec `justify-center`, le pied en `mt-auto`.

---

### 2. État « lien envoyé » — même route, changement d'état d'écran

**Ce n'est pas un toast.** L'utilisateur va quitter l'app pour son client mail : le message doit survivre au retour, être lisible sans action, et porter la sortie de secours en cas de faute de frappe. Le § États du design system associe « Succès → `sonner` », ce qui ne couvre pas ce cas (Research § Traps 11, remonté en *gaps* § 3).

Le formulaire est **remplacé** dans la même colonne (pas de navigation, pas de nouvelle route) par un bloc `empty` :

| Slot `empty` | Contenu |
|---|---|
| `EmptyMedia` | icône `MailCheck` (lucide), `--muted-foreground` |
| `EmptyTitle` | « Lien envoyé » |
| `EmptyDescription` | « Un lien de connexion vient d'être envoyé à **olivier@exemple.fr**. Ouvrez-le sur cet appareil pour vous connecter. » — l'adresse en `--foreground`, le reste en `--muted-foreground` |
| `EmptyContent` | note « Rien reçu ? Vérifiez vos indésirables. » (`text-xs`, `--muted-foreground`), puis les actions |

Actions, dans cet ordre :

1. **« Utiliser une autre adresse »** — `button` variant `outline`, pleine largeur. **Requis.** Sans compte ni mot de passe, une faute de frappe dans l'email est un cul-de-sac total : c'est la seule issue. Ramène au formulaire, champ pré-rempli avec la valeur saisie, sélectionnée.
2. **« Renvoyer le lien »** — `button` variant `ghost`, pleine largeur. **Optionnel** : aucun critère d'acceptation ne l'exige, le plan peut le retirer sans casser la story. Pas de minuteur de temporisation (ce serait inventer un comportement produit non spécifié).

Le mot-symbole et le pied de page restent identiques à l'écran 1 : seule la zone centrale change.

---

### 3. Écran authentifié provisoire — `/`

> **Placeholder assumé.** `docs/stories.md` l. 64 : « Ne pas y investir de design : s06 le remplace intégralement. » Ce qui suit est le strict nécessaire pour rendre les critères de session testables, et rien de plus.

Colonne unique, même gabarit :

- Mot-symbole `morpho` en haut.
- Bloc centré : `text-xs` `--muted-foreground` « Connecté en tant que », puis l'email en `text-base` `--foreground` (`break-all` — une adresse longue ne doit pas déborder à 375 px).
- `button` variant `outline`, icône `LogOut` en tête, libellé « Se déconnecter ». Pleine largeur.
- Mention en pied, `text-xs` `--muted-foreground` : « Écran provisoire — remplacé par la silhouette (s06). »

Pas de `card`, pas d'avatar, pas de menu utilisateur, pas de squelette de chargement : la page est un Server Component qui dispose déjà de la session au rendu. **Aucun composant ne doit être installé pour cet écran seul.**

---

### 4. Transitoire de retour du lien — conditionnel, hors périmètre visuel

Le retour du magic link est matérialisé **par le proxy**, qui pose les cookies et redirige (Research § Échange de session). Dans le cas nominal, aucun écran n'est rendu : l'utilisateur atterrit directement sur `/`.

Si l'implémentation exige malgré tout une page de callback visible (Research § Open questions 2 — non tranché, ça se constate avec un vrai email), elle affiche le strict minimum : `Spinner` centré + « Connexion en cours… » en `--muted-foreground`. Rendu dans le mockup pour référence, à ne construire **que si** la route de callback se révèle nécessaire.

---

## Mockup

`morpho/docs/designs/s02-connect-magic-link.html` — référence visuelle.

**NE PAS copier dans la production** : l'exécution construit avec les vrais composants shadcn installés par la CLI. Le HTML reproduit les classes du preset à la main pour être autonome (aucun framework, aucun CDN) ; il n'a pas vocation à être du code.

Le mockup rend **chaque état ci-dessous, en clair et en sombre côte à côte**, dans un cadre de 375 px de large. Les jetons y sont recopiés depuis `src/app/globals.css` (valeurs OKLCH exactes, `:root` et `.dark`), et le thème de la page suit `prefers-color-scheme`.

---

## Reused components (from the design system)

Tous vérifiés présents au registre `@shadcn`, style `radix-nova` (Research § Réseau : 200 sur les douze items ; classes relues item par item).

| Composant | Où / pourquoi | Ligne du tableau du design system |
|---|---|---|
| `button` | « Recevoir le lien » (`default`), « Utiliser une autre adresse » et « Se déconnecter » (`outline`), « Renvoyer le lien » (`ghost`) | s02+ — conforme |
| `input` | Le champ email, unique champ de la story | s02 — conforme |
| `field` | Groupe label + contrôle + message d'erreur. **Imposé par le § Patterns UI : « Jamais un `input` nu. »** | tabulé s03 → voir *gaps* § 1 |
| `label` | Libellé « Adresse email ». Installé automatiquement : `field` le déclare en `registryDependencies` (avec `separator`) | tabulé s03 → voir *gaps* § 1 |
| `spinner` | Chargement **dans** le bouton : envoi du lien, renvoi, déconnexion. Jamais en plein écran | s02 — conforme |
| `alert` | Erreur d'opération : échec d'envoi, lien expiré ou déjà utilisé. Variante `destructive` | tabulé s10 → voir *gaps* § 2 |
| `empty` | État « lien envoyé » : bloc centré icône + titre + description + actions | tabulé s03/s06/s07 → voir *gaps* § 3 |

**Commande d'installation** (`src/components/ui/` est vide — Research § État actuel) :

```bash
npx shadcn@latest add button input field spinner alert empty
```

`label` et `separator` arrivent avec `field`. Ces fichiers sont générés et **ne s'éditent jamais à la main** (AGENTS.md).

Notes d'usage relevées dans le code du registre, à ne pas redécouvrir en exécution :

- `Spinner` porte `role="status" aria-label="Loading"` **avant** le spread des props : passer `aria-label="Chargement"` au point d'appel suffit à le franciser, sans toucher au fichier généré.
- `Alert` variant `destructive` est un traitement **texte** (`text-destructive` sur fond `--card`), pas un bandeau plein rouge. Le contraste tient dans les deux thèmes.
- `Button` variant `destructive` est lui aussi un traitement doux, réservé aux actions destructives. **La déconnexion n'en est pas une** → `outline`.
- L'`input` du preset gère déjà `aria-invalid` : bordure et anneau `--destructive`. L'erreur de champ n'a aucune couleur à poser elle-même.

**Aucun composant Neon Auth UI.** `@neondatabase/auth/react/ui` (`MagicLinkForm`, `AuthView`, `UserButton`…) embarque son propre CSS, ses propres jetons et ses textes anglais : ce serait une seconde source de vérité visuelle, ce que le design system interdit (Research § Traps 9). L'écran appelle `authClient.signIn.magicLink(...)` directement.

---

## States

### Écran de connexion

| État | Traitement | Détail |
|---|---|---|
| **Vide** | État par défaut du formulaire | Champ vide, focus posé, bouton actif. Il n'existe pas d'état « vide » au sens données sur cet écran : rien n'est chargé. |
| **Chargement** | `Spinner` **dans** le bouton | Libellé « Envoi… », bouton `disabled`, champ `disabled`. Pas de squelette, pas d'écran d'attente bloquant (§ États du design system). La largeur du bouton ne bouge pas entre « Recevoir le lien » et « Envoi… » : pas de saut de mise en page. |
| **Erreur — champ** | Message **sous le champ**, dans la zone `FieldError` | « Cette adresse email n'est pas valide. » `input` en `aria-invalid` (bordure + anneau `--destructive`). Validation Zod côté client puis serveur. Aucun résumé en haut de page (§ Patterns UI). |
| **Erreur — opération** | `alert` `destructive` **au-dessus** du formulaire | Échec d'envoi : titre « L'envoi a échoué », description « Vérifiez votre connexion et réessayez. » Le champ **conserve sa valeur**. Message en clair, en français, sans code technique. |
| **Erreur — lien expiré / déjà utilisé** | `alert` `destructive` au-dessus du formulaire | Titre « Ce lien n'est plus valable », description « Il a expiré ou a déjà été utilisé. Demandez-en un nouveau. » Répond à la note de story « prévoir le cas du lien expiré ou déjà consommé : un message clair, pas une page blanche ». Le champ est vide : après la redirection, l'app ne connaît plus l'adresse. |
| **Succès** | Bascule vers l'état « lien envoyé » | Voir ci-dessous. Pas de `sonner` : le succès est un écran, pas un toast. |

### État « lien envoyé »

| État | Traitement |
|---|---|
| **Succès** | Bloc `empty` complet, adresse rappelée en clair. |
| **Chargement (renvoi)** | `Spinner` dans le bouton « Renvoyer le lien » → « Envoi… », les deux boutons `disabled`. |
| **Erreur (renvoi échoué)** | `alert` `destructive` au-dessus du bloc `empty`, même formulation que l'échec d'envoi. L'état « lien envoyé » n'est pas perdu. |
| **Retour au formulaire** | « Utiliser une autre adresse » restaure l'écran 1, champ pré-rempli et **contenu sélectionné** (une correction ne doit pas commencer par un effacement). |

### Écran authentifié provisoire

| État | Traitement |
|---|---|
| **Succès** | Email + bouton de déconnexion. C'est le seul état nominal. |
| **Chargement (déconnexion)** | `Spinner` dans le bouton → « Déconnexion… », bouton `disabled`. |
| **Vide / Erreur** | **Aucun.** Sans session, le proxy redirige vers `/auth/sign-in` avant tout rendu : cet écran n'a pas d'état non authentifié à dessiner. |

### Transitoire de retour du lien *(conditionnel)*

| État | Traitement |
|---|---|
| **Chargement** | `Spinner` centré + « Connexion en cours… ». Le seul cas où un chargement occupe l'écran, parce qu'il n'y a aucun contenu à esquisser. |
| **Erreur** | Redirection vers `/auth/sign-in` en état « lien expiré / déjà utilisé ». Pas d'écran d'erreur dédié. |

---

## Design system gaps

Besoins non couverts par `docs/design-system.md`. **À trancher et à consigner dans ce document — rien n'a été inventé ici.** Les points 1 à 3 bloquent la cohérence documentaire, pas l'exécution : les composants existent, seule leur ligne de tableau est fausse.

**1. `field` et `label` sont tabulés s03 alors que le premier formulaire est celui de s02.**
Le § Patterns UI impose « un champ = un `field` […] jamais un `input` nu » et « erreurs par champ, sous le champ ». Ce pattern s'applique dès l'écran de connexion. Les deux composants sont bien au registre (200 vérifié) : ce n'est pas un manque, c'est une ligne de tableau à corriger en `s02`. Déjà relevé en Research § Traps 10.
→ *Correction proposée : passer `input`, `label` et `field` à « s02, s03 ».*

**2. `alert` est tabulé s10, mais s02 a besoin d'un traitement d'erreur qui n'appartient à aucun champ.**
Le § Patterns UI ne connaît que l'erreur de validation (inline, sous le champ) et interdit « un résumé en haut de page ». Or « l'envoi a échoué » et « ce lien a expiré » ne sont attachés à aucun champ : les afficher sous le champ email serait un mensonge sur leur cause.
→ *Règle proposée à ajouter au § Patterns UI : **erreur de champ → inline sous le champ ; erreur d'opération (échec réseau, jeton invalide) → `alert` en tête de formulaire.** L'interdiction du résumé en haut de page vise les récapitulatifs de validation, pas les erreurs d'opération. Et passer `alert` à « s02, s10 ».*

**3. L'état « lien envoyé » n'a pas de traitement défini — le § États n'a pas de case « confirmation persistante ».**
Il associe le succès à `sonner`, or ici l'utilisateur quitte l'app pour son client mail : un toast fugace disparaît avant même d'être utile. Le besoin est un **écran de confirmation qui persiste et porte sa sortie de secours**. Composé ici avec `empty`, dont la structure (média + titre + description + action) correspond exactement, mais dont le libellé dans le tableau (« États vides ») ne décrit pas cet emploi.
→ *À trancher : soit élargir `empty` à « états vides **et confirmations d'écran persistantes** » et le passer à « s02, s03, s06, s07 », soit ajouter une ligne d'état dédiée au § États. Ne pas créer un composant maison dans les deux cas.* Déjà relevé en Research § Traps 11.

**4. Aucune icône n'est attribuée à une action** (gap connu n°2 du design system).
Cette story en consomme trois. Proposition, à valider et à consigner : `MailCheck` (lien envoyé), `TriangleAlert` (erreur d'opération et lien expiré), `LogOut` (déconnexion). `Loader2Icon` est imposé : c'est ce que `Spinner` résout pour `lucide`.
→ *Ouvrir une table « action → icône lucide » dans le design system, alimentée story par story.*

**5. Aucune taille de cible tactile minimale n'est définie — et les défauts du preset sont sous le seuil iOS.**
Relevé dans le registre, pas estimé : `Input` est en `h-8` (**32 px**) ; `Button` est en `h-8` par défaut, `h-9` (**36 px**) en `size="lg"`. La recommandation Apple est de **44 pt**. Le PRD décrit un usage « debout, téléphone à une main, mètre ruban dans l'autre » et s05 chronomètre dix champs sous 20 secondes : ce n'est pas un détail de confort, c'est la condition du critère de vitesse.
→ *À trancher : définir au design system une taille de contrôle mobile (`h-11`, 44 px) applicable aux formulaires, ou assumer les défauts du preset. **Le mockup rend les défauts du preset** — il ne préempte pas la décision. Le sujet devient critique en s03 (dix champs), s02 est simplement l'endroit où il se voit en premier.*

**6. Aucun mot-symbole ni logo n'est défini.**
L'écran de connexion est le premier écran sans contenu propre : il lui faut au minimum un repère d'identité. Traité ici en texte simple `morpho` (`--muted-foreground`, `--font-sans`) — aucun asset, aucune seconde famille typographique, conforme aux interdits.
→ *À consigner : soit « morpho s'écrit en toutes lettres, sans logo », soit produire une marque. Une décision d'une ligne, mais elle vaut mieux qu'une reconduction implicite.*

**7. Le châssis authentifié (position du mot-symbole, de la déconnexion, de la navigation) n'est pas défini.**
Volontairement **non tranché ici** : l'écran authentifié de s02 est un placeholder que s06 remplace intégralement, et le critère « au plus un tap vers la saisie » (s05/s06) le redessinera de toute façon.
→ *À traiter en `/ks-design s06`, pas avant. Signalé pour qu'il ne se règle pas par accident dans le placeholder.*

**8. Le thème sombre est aujourd'hui inatteignable** (Research § Traps 12) : rien ne pose la classe `.dark` sur `<html>`, alors que `@custom-variant dark (&:is(.dark *))` l'exige. Ce n'est pas un manque du design system — celui-ci assigne explicitement la tâche au shell (s01, non livré) — mais **la vérification « chaque écran en clair et en sombre » est impossible tant que ce n'est pas fait**. À rattacher au plan de s02 si s01 ne le livre pas.

*Note connexe, hors design mais visible dès cet écran :* `globals.css` l. 10 déclare `--font-sans: var(--font-sans)` (auto-référence) alors que `layout.tsx` expose `--font-geist-sans`. La famille typographique n'est probablement pas raccordée. Le mockup suppose Geist ; le premier écran réel révélera le contraire. Ressort du shell.
