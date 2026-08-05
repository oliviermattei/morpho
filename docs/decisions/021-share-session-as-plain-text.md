# ADR 021 — Partager une session : du texte brut, une valeur par ligne

- Status: accepted
- Date: 2026-08-05
- Scope: historique

## Contexte

L'historique affiche chaque session enregistrée sous forme de carte. Le
besoin exprimé est de pouvoir **sortir** une de ces sessions de l'app —
la coller dans WhatsApp, un SMS, une note — sans que personne n'ait à
recopier dix nombres à la main.

Trois choses se décident ici, et une seule d'entre elles est évidente :
le **format** de ce qui sort, le **canal** par lequel ça sort, et la
**structure de la carte**, qui était jusqu'ici un `<Item asChild>`
enveloppant un `Link` — c'est-à-dire une ligne entièrement occupée par un
seul `<a>`, sans place pour un second contrôle.

## Décision

### 1. Le format : du texte brut, une mesure par ligne

`buildSessionShareText` (`src/lib/session-share.ts`) produit :

```
Mesures du dimanche 2 août 2026
Poids : 82,4 kg
Épaules : 118 cm
Masse grasse : 18,5 %
IMC : 23,6
```

- Les nombres passent par `formatMeasurementValue` et `formatBmi` — les
  formateurs de **surface d'affichage** (`docs/design-system.md`
  § Format numérique). Le texte partagé **est** une surface d'affichage :
  ce qui sort de l'app est par construction ce que l'écran montre, jamais
  un second formatage des mêmes nombres.
- L'ordre vient de `MEASUREMENT_CATALOG`, pas de l'ordre d'arrivée des
  lignes — le même ordre canonique que le formulaire de saisie et le
  sélecteur des graphes.
- **Vide ≠ zéro jusque dans le texte partagé** (ADR 004) : une mesure non
  renseignée ne produit aucune ligne, jamais `Biceps : 0 cm` ni un tiret.
- L'IMC est **dérivé à la lecture**, via l'unique `computeBmi` du dépôt :
  pas de taille connue → pas de ligne du tout, et une taille corrigée
  change ce que les sessions passées partagent (critère 5 de s04, porté
  jusqu'ici).
- **Espace normale avant le deux-points**, pas insécable : la destination
  est du texte brut dans l'app de quelqu'un d'autre, où un U+00A0 survit
  inégalement au copier-coller. L'espace insécable que le design system
  impose — celle d'avant `%` — vit dans `formatMeasurementValue` et n'est
  pas touchée.

La chaîne est construite **côté serveur**, dans le Server Component qui
rend déjà la ligne (`SessionHistoryList`), à partir de la même `session`
et de la même `heightCm`.

### 2. Le canal : `navigator.share`, puis le presse-papier

`ShareSessionButton` (`src/components/ShareSessionButton.tsx`) est la
seule frontière client ajoutée — une feuille, qui ne formate rien et ne
fait que transporter la chaîne reçue en prop.

1. `navigator.share({ text })` si l'API existe. Sur le téléphone pour
   lequel cette PWA est faite, **c'est ça, le chemin WhatsApp** : une
   tape, on choisit le contact, c'est parti. Appelé de façon synchrone
   depuis le `onClick`, sans rien attendre avant : l'API exige un geste
   utilisateur actif, et un `await` préalable le dépenserait.
2. `navigator.clipboard.writeText` sinon — desktop, et tout navigateur
   sans feuille de partage. Les valeurs atterrissent dans le
   presse-papier, ce qui est exactement le besoin exprimé au départ.

**`AbortError` n'est pas un échec.** Quelqu'un qui ouvre la feuille de
partage puis revient en arrière a pris une décision : aucun toast, et pas
non plus de repli silencieux vers le presse-papier, qui copierait ce
qu'il vient de refuser d'envoyer. C'est le bug classique de cette API, et
c'est pour ça que le `name` du rejet est inspecté plutôt qu'avalé en bloc.

### 3. La carte : un lien étiré, plus un `<Item asChild>`

Un `<button>` à l'intérieur d'un `<a>` est du HTML invalide qu'aucun
navigateur ne traite pareil. La ligne devient donc un `Item` **positionné**
(`relative`) contenant :

- un `<a>` qui n'enveloppe plus que la date, et dont le `::after` couvre
  toute la carte (`after:absolute after:inset-0`) — **toute la ligne reste
  tapable** ;
- le bouton de partage, `relative`, donc au-dessus de ce `::after`.

Le DOM porte exactement un `<a>` et un `<button>`, aucun des deux dans
l'autre. Le focus visible remonte sur la carte via `has-[a:focus-visible]`.

**Ce que s09 R9 refusait reste refusé** : R9 écartait un contrôle
**destructeur** sur une carte tapée au pouce, et un déclencheur
d'`alert-dialog` qui aurait fait basculer toute la liste côté client.
Partager n'est ni l'un ni l'autre — ça ne détruit rien, et sa frontière
client est une feuille isolée. `SessionHistoryList` reste un Server
Component, ce que son propre test verrouille toujours.

## Options écartées

- **Un bouton « Copier » seul, sans `navigator.share`** — écarté. Sur
  mobile, ça impose deux gestes (copier, puis ouvrir WhatsApp et coller)
  là où la feuille de partage native en demande un. Le presse-papier
  reste, mais comme repli, pas comme chemin principal.
- **`navigator.share` seul** — écarté dans l'autre sens. L'API n'existe
  pas sur tous les navigateurs desktop ; sans repli, le bouton serait mort
  sur ceux-là, ou pire, absent selon l'appareil.
- **Partager une image de la carte** — écarté. Il faudrait un rendu canvas
  ou un service de capture, pour un résultat qu'on ne peut ni relire, ni
  chercher, ni recopier dans un tableur. Le besoin exprimé était
  explicitement « une valeur par ligne » à coller.
- **Un lien de partage public vers la session** — écarté, et pas
  seulement pour le coût. Il faudrait publier une URL non authentifiée
  contenant des données de santé, avec sa révocation, sa durée de vie et
  sa fuite par l'historique du destinataire. Le texte brut ne sort de
  l'app que si l'utilisateur l'envoie, et n'existe nulle part sur un
  serveur.
- **Mettre le partage sur l'écran d'édition plutôt que dans la liste** —
  écarté. Ça évitait la restructuration de la carte, mais imposait
  d'ouvrir la session pour la partager, alors que la liste est justement
  l'endroit où l'on choisit *laquelle*.

## Conséquences

Plus facile : toute surface future qui voudrait exporter une session
(plusieurs sessions, un export texte complet) réutilise
`buildSessionShareText` plutôt que de réinventer un formatage — et hérite
au passage de l'ordre canonique, du « vide ≠ zéro » et de l'IMC dérivé.

Plus difficile : la carte de l'historique n'est plus un simple
`<Item asChild>`. Toute évolution de sa mise en page doit préserver deux
invariants, tous deux verrouillés par test — le `relative` sur l'`Item`
(sans lui, le `::after` s'étire sur un autre ancêtre et la zone tapable
part ailleurs), et le fait qu'aucun des deux contrôles ne contienne
l'autre.

À surveiller : `tests/e2e/historique-edition.spec.ts` cible encore les
lignes par `getByRole("link", { name: /Modifier/ })`, un libellé supprimé
avant cette ADR. Le spec est `test.skip` faute de `E2E_STORAGE_STATE`, et
ce sélecteur devra être repris (le nom accessible de la ligne est
maintenant sa date) le jour où la session e2e sera câblée.
