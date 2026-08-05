# ADR 022 — TypeScript 6 plutôt que 7, et ESLint 10 avec une version React explicite

- Status: accepted
- Date: 2026-08-05
- Scope: framing — outillage

## Contexte

Deux montées de version proposées par dependabot sont restées ouvertes
quand les cinq autres ont été intégrées : `typescript` 5.9.3 → **7.0.2**
(#6) et `eslint` 9.39.5 → **10.8.0** (#7). Les deux échouaient, chacune
sur un mur différent, et il fallait décider ce qu'on en faisait plutôt
que de les laisser ouvertes indéfiniment.

### TypeScript 7 n'est pas la version suivante de TypeScript 5

C'est le point que la proposition de dependabot masque en affichant un
simple « 5.9.3 → 7.0.2 ». TypeScript 7 est le portage natif du
compilateur : il n'expose plus l'**API compilateur JavaScript** dont
dépendent les outils qui s'appuient sur `typescript` comme bibliothèque.
Les deux consommateurs de cette API dans ce projet le disent eux-mêmes,
et tous deux nomment la même issue de sortie :

```
TypeScript 7.0.2 does not provide the compiler API required by Next.js.
Enable experimental.useTypeScriptCli in your Next.js config to use the
TypeScript CLI, or install TypeScript 6 instead.
```

```
typescript-eslint does not support TS 7.0.
Please see […] to run typescript-eslint using the TS 6 API.
```

`tsc --noEmit` passe pourtant sans une erreur sous TS 7 : le code de
l'application est déjà compatible. Ce qui bloque n'est pas le langage,
c'est l'outillage autour.

**TypeScript 6.0.3 est publié en stable**, et c'est la branche qui porte
encore l'API compilateur JS. `typescript-eslint@8.66.0` déclare
`typescript: >=4.8.4 <6.1.0` — 6.0.3 y entre, 7.0.2 non.

### ESLint 10 casse sur la détection de version de `eslint-plugin-react`

```
TypeError: Error while loading rule 'react/display-name':
contextOrFilename.getFilename is not a function
    at resolveBasedir (…/eslint-plugin-react/lib/util/version.js:31)
    at detectReactVersion (…/version.js:85)
    at getReactVersionFromContext (…/version.js:116)
```

`context.getFilename()` est une API qu'ESLint 10 a supprimée.
`eslint-plugin-react@7.37.5` — sa dernière version publiée — l'appelle
encore, et déclare `eslint: ^3 || … || ^9.7`. Il n'y a pas de version à
laquelle monter.

Mais l'échec n'est **pas** dans une règle de lint : il est dans la
détection automatique de la version de React. `eslint-config-next` pose
`settings.react.version = "detect"`, et `getReactVersionFromContext`
n'appelle `detectReactVersion` — donc `resolveBasedir`, donc l'API
supprimée — que dans ce cas précis. Une version explicite court-circuite
tout le chemin cassé.

## Décision

### 1. `typescript` monte en **6.0.3**, pas en 7.0.2

C'est la montée que dependabot aurait dû proposer. Elle est réelle — deux
majeures d'écart avec la 5.9.3 — et elle laisse `next build` et
`typescript-eslint` sur l'API dont ils ont besoin.

TypeScript 7 est reporté jusqu'à ce que ses deux consommateurs le
supportent. L'alternative aurait été le drapeau expérimental
`experimental.useTypeScriptCli` **et** l'abandon du lint typé : deux
régressions réelles pour un gain nul, le typecheck étant déjà vert.

### 2. `eslint` monte en **10.8.0**, avec la version de React lue à la source

```js
const reactVersion = createRequire(import.meta.url)("react/package.json").version;
// …
{ settings: { react: { version: reactVersion } } },
```

Lire `react/package.json` donne exactement la réponse que la détection
aurait produite — elle `resolve.sync('react')` puis lit `react.version` —
sans passer par l'API supprimée. La valeur suit les montées de React
toute seule : rien à remettre à jour au prochain bump, et pas de version
codée en dur qui dériverait en silence.

C'est un contournement, et il est marqué comme tel dans
`eslint.config.mjs` : il disparaît le jour où `eslint-plugin-react`
publie une version compatible ESLint 10.

## Alternatives écartées

- **Fermer #6 et #7 sans rien faire.** C'était le constat de départ :
  « bloquées en amont ». Il était juste pour TS 7 et faux pour ESLint 10,
  dont le blocage tient à une ligne de configuration. Et il laissait
  passer que la vraie montée de TypeScript disponible est la 6.
- **Épingler `settings.react.version` à `"19.2.8"` en dur.** Rejeté :
  la valeur dériverait au premier bump de React, en silence, et le lint
  jugerait le code contre une version qui n'est plus installée.
- **Désactiver les règles `react/*` sous ESLint 10.** Rejeté — c'est
  perdre 17 règles actives pour éviter une ligne de configuration.
- **`overrides` npm pour forcer un `eslint-plugin-react` corrigé.**
  Rejeté : il n'existe aucune version corrigée à forcer.
- **Monter Next.js en 16.3.0 dans la foulée.** Écarté d'ici — hors du
  périmètre de ces deux montées, et rien n'indique que ça change le
  besoin d'API compilateur.

## Conséquences

Plus facile : la CI valide désormais l'outillage courant, ESLint 10 et
TypeScript 6, au lieu de deux majeures de retard. Les sept propositions
de dependabot sont soldées.

À surveiller, et c'est le vrai coût :

- **Le contournement ESLint est silencieux s'il est supprimé par
  mégarde.** Retirer la ligne `settings` ne dégrade pas le lint : il
  s'arrête net, sur une `TypeError` dans une règle, à mille lieues de sa
  cause. Le commentaire au-dessus existe pour ça.
- **La montée vers TypeScript 7 reste à faire**, et elle attend deux
  amonts indépendants : `typescript-eslint`
  ([issue #10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940))
  et l'API compilateur de Next.js. Le code applicatif, lui, passe déjà —
  vérifié sous 7.0.2 avant d'écrire cet ADR.
- **`react/display-name` et les 16 autres règles `react/*` tournent sur
  une version fournie, plus détectée.** Si un jour `react` n'était plus
  une dépendance directe, `createRequire` lèverait au chargement de la
  configuration plutôt que de retomber sur un défaut — un échec bruyant,
  ce qui est le bon sens ici.
