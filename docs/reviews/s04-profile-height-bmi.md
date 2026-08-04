# Review — s04-profile-height-bmi

Branche : `feature/s04-profile-height-bmi` (empilée sur s03 → s02 → s01, aucune mergée).
Diff jugé : `git diff feature/s03-log-measurement-session...feature/s04-profile-height-bmi` — 11 commits, 39 fichiers, +2434/−58.

## Ce que le reviewer a exécuté lui-même

| Commande / vérification | Résultat |
|---|---|
| `npm --prefix morpho run check` | **vert** — 36 fichiers, **221 tests**, 12,35 s (s03 : 136 / 11,0 s). Inclut le `next build` réel. |
| `npm --prefix morpho run check:leak` | **vert**. |
| Build avec les trois secrets vidés | **vert**, `/profil` et `/api/profile` en `ƒ (Dynamic)`. Neutralisation des secrets vérifiée indépendamment (`loadEnvConfig` → longueurs 0 avec override, 150/82/44 sans). `.env.local` non modifié. |
| Introspection de la base Neon réelle | `neon_auth` = **9 tables inchangées**. `public` = `measurement_sessions`, `measurements`, `profiles` (`user_id uuid` PK, `height_cm numeric`, `CHECK (80..260)`, **aucune FK**). |
| Requête « colonne IMC » sur toute la base | `column_name ILIKE '%bmi%' OR '%imc%'` → **0 ligne**. Le critère 5 tient sur la vraie base, pas seulement dans le dépôt. |
| **Spike FK** (worktree jetable, supprimé) | `.references(() => authUser.id)` avec `authUser` **non exporté** → `ALTER TABLE "profiles" … REFERENCES "neon_auth"."user"("id")`, **0 `CREATE TABLE "neon_auth"`, 0 `CREATE SCHEMA`**. Voir finding 1. |
| `card.tsx` vs registre shadcn | Identique aux deux transformations standard de la CLI près. **Non retouché à la main.** |

Non rejoué : Playwright — `playwright.config.ts` réutilise le serveur de `:3000`, occupé par un **autre projet**. À noter en faveur de l'implémenteur : l'assertion du spec est `toHaveURL(/\/auth\/sign-in/)`, qui **échouerait** contre ce serveur étranger — un faux vert par réutilisation du mauvais serveur est mécaniquement impossible. Non rejoué également : le parcours magic link, donc pas de session authentifiée, donc pas de mesure 44 px en navigateur réel, pas de 375 px, pas de clair/sombre, pas d'iOS Safari.

## L'IMC est dérivé, jamais stocké — tenu, prouvé aux trois niveaux

- **Schéma / migration** : `0001_talented_groot.sql` est un `CREATE TABLE "profiles"` avec `user_id`, `height_cm numeric(4,1)` et le `CHECK`. Aucune colonne `bmi`/`imc` nulle part.
- **Garde mécanique** : `schema.test.ts` scanne la source **et** tous les `drizzle/*.sql` avec `/"(bmi|imc)\w*"/i` — motif « identifiant de colonne cité », insensible aux docstrings. Ajouter la colonne fait tomber le test.
- **Base réelle** : 0 colonne `bmi`/`imc`, vérifié par le reviewer.
- **Fonctionnel, non tautologique** : `SessionHistoryList.test.tsx:157` rend trois sessions à `heightCm={175}`, capture le `textContent`, démonte, re-rend à `178`, et assère `before[0] !== after[0]` **et** `before[1] !== after[1]` — deux sessions antérieures, exactement ce qu'exige le critère 5. Sur une implémentation qui figerait l'IMC, les deux comparaisons deviennent égales et le test tombe. `BmiCard.test.tsx:58` double la preuve.
- **Source unique** : `computeBmi`/`formatBmi` sont les seuls diviseurs du dépôt. `computeBmi` rend la valeur non arrondie, `formatBmi` arrondit une seule fois.

## La règle `neon_auth` tient — ADR 014 ne tient pas

Le verrou est intact : `authUser` reste un `const` non exporté, la migration `0001` ne contient ni `CREATE SCHEMA` ni `CREATE TABLE "neon_auth"`, le test de s03 reste vert, la base réelle montre `neon_auth` à 9 tables après application. Rien à redire.

La **justification** d'ADR 014, en revanche, est fausse — voir finding 1.

## `force-dynamic`, sécurité, vide ≠ zéro

- `force-dynamic` sur `/profil` et `/api/profile`, tous deux **assertés au niveau module** — la seule assertion qui attrape la régression sur une machine dont `.env.local` est peuplé.
- Identité **exclusivement** `getAuth().getSession()`. **401 sans le moindre accès base**, non tautologique. Taxonomie 503 reprise de `/api/session`. **Forgery** sur trois surfaces (corps, query, en-tête), chacune avec un id différent de celui de la session. **Isolation croisée sur du vrai SQL PGlite**, en lecture **et** en écriture, tentée explicitement dans les deux sens.
- `heightInputSchema` intercepte `""` **avant toute coercition** et rend `null` ; un test reproduit le piège en vrai (`z.coerce.number().safeParse("")` → `0`) puis prouve que ce module rend `null`. Session sans poids → **rien** n'est rendu : absence de `—`, de `IMC 0`, de `NaN` et du mot « IMC » assertée.

La faille est en amont, dans le handler : **absent ≠ vide** n'est pas tenu. Voir finding 2.

## Design system et périmètre — conformes

Un seul fichier ajouté sous `src/components/ui/` (`card.tsx`), sorti de la CLI, jamais retouché. `package.json`, `layout.tsx`, `drizzle.config.ts`, `docs/design-system.md` inchangés comme le plan l'exigeait. Aucune couleur littérale ni valeur arbitraire (scan automatisé, plus un test qui scanne la source de `HeightForm`). `h-11` asserté sur le champ, le bouton, le retour, `min-h-11` sur l'entrée « Profil ». Virgule française partout.

Périmètre respecté : aucune classification ni seuil (test explicite sur « surpoids », « obésité »), aucune carte IMC sur l'accueil, aucune taille dans la silhouette ni les graphes, `profiles` = **deux colonnes**, pas de table clé/valeur ni de JSONB — place prête pour `target_weight_kg` en s08.

## La `<Suspense>` au-delà du plan — justifiée

La tâche 8 demandait littéralement « `skeleton` à la forme du contenu, jamais d'attente bloquante ». Le premier jet `await`ait dans `page.tsx`, ce qui bloquait l'en-tête derrière Neon — l'attente bloquante que le plan interdisait. Le découpage `ProfileContent` / `ProfileSkeleton` reproduit le motif que s03 a livré pour `/historique`, garde `redirect()` laissée hors de la frontière Suspense comprise.

## Findings

### 1 — major — ADR 014 rejette la clé étrangère sur une mesure fausse, que le dépôt réfute lui-même

`docs/decisions/014-profiles-user-id-no-fk.md:24-31` affirme comme fait mesuré que « the **only way** to make Drizzle emit an actual `REFERENCES` constraint … the moment the declaration is **exported** — **which `pgTable`'s own extra-config callback needs** — `drizzle-kit generate` serializes it into `CREATE TABLE "neon_auth"."user"` ».

**La prémisse est fausse : rien n'oblige à exporter quoi que ce soit.** `.references()` s'appelle sur le *column builder*, comme le fait déjà `measurement_sessions.user_id` **soixante lignes plus haut dans le même fichier**, avec `authUser` non exporté — et `0000_busy_rocket_racer.sql` prouve que ça produit la FK sans jamais toucher `neon_auth`.

Rejoué en worktree jetable, drizzle-kit 0.31.10, `schemaFilter: ["public"]`, `authUser` laissé **non exporté**, seul ajout `.references(() => authUser.id, { onDelete: "cascade" })` :

```
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade;
```

`grep -c 'CREATE TABLE "neon_auth"'` → **0**. `grep -c 'CREATE SCHEMA'` → **0**. L'option A d'ADR 014 était donc **disponible sans enfreindre la règle absolue**. Le comportement incriminé se produit bien — mais quand `authUser` est *exporté*, ce qui est le spike de la review s03, mesuré puis généralisé à tort.

Conséquences réelles :
- Deux tables du même fichier, visant la même colonne, traitées différemment : `measurement_sessions` cascade, `profiles` laisse une ligne orpheline. L'ADR présente cette asymétrie comme subie — or elle ne l'est pas.
- Les ADR sont **immuables** et cités par numéro. Le plan remonte à l'orchestrateur une décision de cadrage sur la FK de **toutes** les tables `public` : elle se prendrait sur une mesure fausse.
- Le commentaire de `src/lib/db/schema.ts:99-104` répète la même affirmation dans le code.

Ce qui n'est **pas** cassé : aucune ligne orpheline n'est atteignable aujourd'hui (seul chemin d'écriture = `PUT /api/profile`, `user_id` issu de la session, aucun parcours de suppression de compte). D'où major et non critical.

### 2 — major — `PUT /api/profile` efface silencieusement la taille sur un corps malformé, et répond 200

`src/app/api/profile/route.ts:77-100` : un `heightCm` **absent**, **non-string** (`{"heightCm": 175}`), ou un JSON illisible deviennent tous `""`. Or `""` est le signal d'effacement (R7) : le handler appelle `saveHeight(db, userId, null)`, **écrit `NULL`** et répond `200`. Une requête que la story considère comme invalide **détruit la donnée** au lieu d'être refusée.

C'est la classe de bug que le dépôt combat sous « vide ≠ zéro » : ici c'est **absent ≠ vide**, confondus par un `: ""` de repli. Le plan (tâche 7) exige « payload invalide → **400** ». Aucun test ne couvre le cas : les huit tests de payload envoient tous une chaîne.

Non atteignable depuis l'app (`HeightForm` envoie toujours une string). Dommage borné à une colonne nullable ressaisissable. D'où major.

### 3 — major — Un 401 sur `/api/profile` s'affiche comme une panne serveur — la régression d'un correctif de s03

`src/components/HeightForm.tsx:63-82` : seuls `200` et `400` sont traités ; **tout le reste**, 401 compris, tombe dans « Enregistrement impossible pour l'instant. Réessayez. »

1. Le plan le tranche explicitement (P6) : « 401 → renvoi vers la connexion ». La moitié serveur est impeccable, la moitié client absente.
2. C'est la **régression du finding 2 de la review de s03**, corrigé par `47b66c9`, dont le commentaire explique pourquoi (`sessionDataTtl: 300` rend l'expiration banale, et « vérifiez votre connexion » ment sur la cause). Le composant frère reprend le comportement fautif.
3. Effet : session expirée → l'utilisateur réessaie indéfiniment, sa taille n'est jamais enregistrée, aucune sortie vers `/auth/sign-in`.

Aucun test ne couvre le 401 côté client.

### 4 — minor — L'invitation « renseignez votre taille » s'affiche alors que la taille **est** renseignée

`BmiCard.tsx:30` : `if (bmi === null || latestWeighIn === null)` rend « Votre IMC apparaîtra ici **dès que votre taille sera enregistrée** ». Atteint quand la taille est enregistrée mais qu'aucune session ne porte de poids : l'écran affirme le contraire du champ juste au-dessus. Le design tranche l'inverse (`designs/s04:116` : « aucune session avec poids → **aucune carte IMC** ; la taille n'y change rien »). Atteignable dès qu'un utilisateur renseigne sa taille avant sa première pesée.

### 5 — minor — Le troisième chemin 503 du handler n'est pas testé

`route.ts:46-54` : `getAuth()` ou `getSession()` qui **lève** → 503. Les deux autres chemins 503 ont chacun leur test ; celui-ci non — alors que c'est précisément celui qu'emprunte `createNeonAuth()` quand la config manque.

### 6 — minor — La taille n'est pas arrondie côté application avant stockage

s03 arrondit à la frontière serveur avant insertion ; s04 laisse Postgres le faire : `175,55` devient `175.6` par l'arrondi implicite de `numeric(4,1)`. L'utilisateur voit sa saisie changer après `router.refresh()` sans qu'aucune règle ne le dise, et la règle d'arrondi vit à deux endroits différents selon la table.

## Honnêteté du reporting

Bonne. Le spec Playwright **écrit dans son propre code** que les trois vérifications conditionnelles ne sont pas automatisées, pourquoi, et qu'elles ne sont **pas** remplacées par une assertion de classe en jsdom. Les commits ne revendiquent rien qui n'ait pu être recoupé : l'état de la base décrit correspond au caractère près à l'introspection du reviewer.

Reste non vérifié : iOS Safari avec `175,5` au pavé décimal, le rendu clair/sombre, l'absence de défilement horizontal à 375 px, les hauteurs réelles des contrôles, et le trajet complet sur données persistées avec une vraie session.

## Verdict

Aucun critical. Le cœur de la story — l'IMC dérivé et jamais stocké — tient aux trois niveaux et sa preuve fonctionnelle est un vrai test qui tombe sur du code cassé, sur deux sessions antérieures comme le critère l'exige. La règle `neon_auth` tient, la sécurité tient, le build sans secret passe, le design system n'est ni contourné ni retouché, le périmètre n'a pas débordé.

Trois défauts réels, bornés : un ADR immuable qui repose sur une mesure que le dépôt réfute lui-même, un handler qui confond « absent » et « vide » au point d'effacer la donnée en répondant 200, et un 401 client qui refait l'erreur pour laquelle s03 s'est déjà fait sanctionner.

Max severity: major
Ship allowed: yes
