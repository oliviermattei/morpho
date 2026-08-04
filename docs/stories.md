# User Stories — morpho

> One story = one shippable slice, written to be executed by an agent.
> Id format: `s<number>-<short-slug>` — reused in every pipeline file and in the branch name.

**Note de cadrage** — le PRD n'a pas de SaaS cible : il n'existe aucune implémentation de référence à consulter en production. Le PRD *est* la spec. Là où une app du marché éclaire un choix (Renpho, MyFitnessPal, Withings), c'est signalé comme repère visuel, jamais comme source de vérité.

**Racine du projet** : `morpho/`. Tous les chemins ci-dessous sont relatifs à `multitool/morpho/`, sauf mention contraire. Les docs du pipeline vivent dans `morpho/docs/`.

**Ordre de livraison** : s01 → s10. Chaque story suppose les précédentes livrées.

---

## Story s01-deploy-skeleton — Un squelette déployé et étanche
**As a** propriétaire de morpho **I want** une app déployée dont l'API refuse les requêtes non authentifiées **so that** la base ne soit jamais joignable depuis le navigateur.

### Complexity
3

### Acceptance criteria
- [ ] `morpho/` contient une app Vite + React qui démarre en local (`npm run dev`) et produit un build (`npm run build`).
- [ ] L'app est déployée et accessible à une URL publique ; le déploiement se déclenche depuis le dépôt.
- [ ] Une route API serverless existe et répond 401 à toute requête sans session valide, sans exécuter la moindre requête base.
- [ ] Une route API de santé, non protégée, atteint la base Neon et retourne un succès — la connexion Postgres est prouvée côté serveur.
- [ ] Une recherche de la connection string Neon (`postgres://`, nom d'hôte Neon) dans les fichiers produits par `npm run build` ne retourne aucun résultat.
- [ ] Une recherche d'analytics ou de traceurs tiers (Google Analytics, Segment, Plausible, Sentry, Hotjar…) dans le build ne retourne aucun résultat, et l'app ne contient aucun écran premium ni emplacement publicitaire.
- [ ] Les secrets (connection string, clés) sont fournis par variables d'environnement, jamais commités ; `.env` est ignoré par git.
- [ ] `compoundSimulator/` continue de builder à l'identique — l'ajout de `morpho/` ne casse rien dans le monorepo.

### Dependencies
Aucune (première story). Suppose `docs/architecture.md` validé : la décision de déploiement de `morpho/` dans un monorepo qui n'hébergeait que des apps Vite statiques est un préalable, pas un sujet de cette story.

### Agentic notes
- **Amorçage** : créer `morpho/` sur le modèle de `compoundSimulator/` (Vite 5 + React 18, `type: module`, scripts `dev`/`build`/`preview`). Ne pas toucher à `compoundSimulator/`.
- **Piège central, valable pour tout le projet** : Neon n'est pas Supabase. Aucun SDK client, aucune RLS. Le navigateur ne parle **jamais** à Postgres. Tout accès aux données passe par une Vercel Function. Une connection string dans du code importé par le bundle client est une faille, pas un détail de config — d'où le critère de recherche dans le build, qui doit rester vérifié à chaque story suivante.
- Cette story livre volontairement une app quasi vide : sa valeur est l'étanchéité et le pipeline de déploiement, pas l'écran. Le 401 et l'absence de secret dans le build sont ce qui la rend testable de bout en bout.
- **Cold start Neon** (~500 ms après inactivité) : la route de santé doit en tenir compte dans son timeout, sinon elle échouera de façon intermittente.
- Le critère anti-analytics est écrit ici parce que c'est le point du projet où le contenu du bundle est le plus simple à inspecter. Il matérialise l'angle n°3 du PRD (« zéro pub, zéro upsell, zéro tracking »).

---

## Story s02-connect-magic-link — Connexion sans mot de passe
**As a** propriétaire de morpho **I want** me connecter par un lien reçu par email **so that** mes données soient rattachées à moi plutôt qu'à mon téléphone.

### Complexity
3

### Acceptance criteria
- [ ] Un visiteur non authentifié qui ouvre l'app arrive sur un écran de connexion demandant uniquement une adresse email.
- [ ] Soumettre une adresse email valide déclenche l'envoi d'un magic link et affiche un état « lien envoyé » ; aucun mot de passe n'est demandé à aucun moment.
- [ ] Ouvrir le magic link ouvre une session authentifiée et affiche un écran authentifié provisoire — écran d'accueil de cette story, remplacé par la silhouette en s06 — portant au minimum l'email connecté et le bouton de déconnexion.
- [ ] Une session active survit à un rechargement complet de la page : recharger ne renvoie pas sur l'écran de connexion.
- [ ] Le bouton de déconnexion termine la session ; l'écran suivant est celui de connexion, et un rechargement ne restaure pas la session terminée.
- [ ] La route protégée de s01 répond en succès avec une session valide, et continue de répondre 401 sans session.
- [ ] L'utilisateur authentifié existe en base avec un identifiant stable, réutilisable comme clé étrangère par les stories suivantes.
- [ ] L'identité utilisée côté serveur provient du token vérifié, jamais d'un identifiant envoyé par le client : une requête forgeant un autre identifiant n'accède pas aux données d'autrui.

### Dependencies
s01-deploy-skeleton (app déployée, couche API en place, base joignable).

### Agentic notes
- **Auth** : Neon Auth (Stack Auth intégré) synchronise les utilisateurs dans une table de la base Neon. Vérifier en phase Research le nom réel de la table de synchronisation et sa clé primaire — c'est cette colonne que s03 référencera. Ne pas la deviner.
- **Vérification serveur** : le dernier critère est le pivot de sécurité du projet. Il se pose ici une fois pour toutes ; toutes les stories suivantes en dépendent et le supposent acquis.
- L'écran authentifié de cette story est un placeholder assumé. Ne pas y investir de design : s06 le remplace intégralement. Il existe pour rendre les critères de session testables à leur propre livraison.
- Prévoir le cas du lien expiré ou déjà consommé : un message clair, pas une page blanche.

---

## Story s03-log-measurement-session — Saisir une session de mesures
**As a** utilisateur connecté **I want** enregistrer mes mesures du jour **so that** mon historique se construise.

### Complexity
3

### Acceptance criteria
- [ ] Un écran de saisie propose une date (par défaut aujourd'hui) et un champ par mesure : poids, tour de poitrine, biceps, tour de taille, hanches, cuisse, mollet, épaules, % masse grasse, % masse musculaire.
- [ ] Soumettre une session complète la persiste en base et affiche une confirmation.
- [ ] Soumettre une session partielle — le poids seul — est accepté : la session est persistée, et les mesures non renseignées sont absentes en base, pas stockées à zéro ni à une valeur héritée.
- [ ] Soumettre un formulaire entièrement vide est refusé avec un message ; rien n'est persisté.
- [ ] Une valeur hors plage physiologique (poids négatif, tour de taille à 500 cm, pourcentage > 100) est refusée côté serveur avec une erreur de champ, même si le client l'a laissée passer.
- [ ] Les sessions enregistrées apparaissent dans une liste triée de la plus récente à la plus ancienne, avec leur date et les mesures renseignées.
- [ ] Un utilisateur A authentifié ne voit et ne modifie aucune session appartenant à un utilisateur B : le filtrage se fait côté serveur sur l'identité du token, vérifié par un test qui tente explicitement l'accès croisé.
- [ ] Se connecter depuis un appareil vierge — autre navigateur, stockage local vide — restaure l'intégralité de l'historique après le magic link. C'est le critère de succès #12 du PRD, celui qui justifie Neon contre un stockage local.
- [ ] Toutes les valeurs sont en unités métriques (kg, cm) — aucun sélecteur d'unité nulle part.

### Dependencies
s02-connect-magic-link (identité utilisateur en base, session côté client).

### Agentic notes
- **Modèle** : une session = une date + N mesures optionnelles. Le schéma doit rendre l'absence d'une mesure naturelle, pas exceptionnelle — c'est le cas courant, pas le cas limite (voir PRD, section Constraints/Données). Deux formes possibles : colonnes nullables sur `measurement_sessions`, ou table `measurements` en lignes (session_id, type, value). Le choix se tranche en Research/Architecture et mérite un ADR : il conditionne la lecture des graphes en s07.
- **Ne pas inclure l'IMC** dans les champs saisis. C'est une valeur dérivée, traitée en s04.
- **Ne pas implémenter le pré-remplissage ici** — c'est s05. Cette story livre la capacité brute de saisie ; s05 livre la vitesse.
- **Migrations** : mettre en place le mécanisme de migration dès cette story (premier schéma métier réel). Ne pas créer les tables à la main dans la console Neon : le schéma doit être versionné dans le dépôt.
- **Mobile** : `inputmode="decimal"` sur les champs numériques pour obtenir le pavé numérique iOS. La virgule décimale française doit être acceptée à la saisie.
- **Piège** : le champ vide et la valeur zéro doivent rester distincts sur tout le trajet formulaire → API → base. Un `Number("")` qui devient `0` corrompt silencieusement l'historique — et l'erreur ne se voit qu'au moment du graphe, des semaines plus tard.
- Le critère de restauration depuis un appareil vierge se teste avec un profil de navigateur neuf, pas avec un simple vidage de cache : il doit prouver qu'aucune donnée métier ne vit côté client.

---

## Story s04-profile-height-bmi — Taille de référence et IMC calculé
**As a** utilisateur **I want** renseigner ma taille une fois **so that** mon IMC se calcule tout seul à chaque pesée.

### Complexity
2

### Acceptance criteria
- [ ] Un écran de profil permet de saisir et de modifier une taille en centimètres, persistée et rattachée à l'utilisateur.
- [ ] Tant que la taille n'est pas renseignée, l'IMC n'est affiché nulle part, et l'app invite à la renseigner au lieu d'afficher une valeur vide ou fausse.
- [ ] Une fois la taille renseignée, chaque session comportant un poids affiche un IMC calculé (`poids_kg / taille_m²`), arrondi à une décimale.
- [ ] L'IMC n'est jamais saisissable : aucun champ IMC dans le formulaire de s03.
- [ ] L'IMC n'est pas stocké en base : modifier la taille de référence met à jour l'IMC de toutes les sessions passées, vérifié sur au moins deux sessions antérieures.
- [ ] Une session sans poids n'affiche pas d'IMC.

### Dependencies
s03-log-measurement-session (les sessions et leur poids existent).

### Agentic notes
- **Décision structurante** : l'IMC est dérivé à la lecture, jamais persisté. Le critère « modifier la taille recalcule l'historique » est là pour verrouiller ce point — c'est ce qui empêche un futur agent de le stocker « pour aller plus vite ».
- La taille vit sur le profil utilisateur, pas sur la session : c'est une constante, pas une mesure suivie. Elle n'apparaît donc pas dans la silhouette (s06) ni dans les graphes (s07).
- % masse grasse et % masse musculaire restent des mesures saisies manuellement en s03 : aucune estimation, aucune formule. Le PRD est explicite là-dessus.
- Le stockage de profil créé ici sera réutilisé par le poids cible (s08) — le concevoir pour accueillir une seconde préférence, sans construire un système de préférences générique.
- Le seuil d'arrondi et l'absence de classification (« surpoids », « obésité ») sont volontaires : morpho affiche un nombre, il ne donne pas d'avis médical.

---

## Story s05-quick-entry-prefill — Saisie en moins de 20 secondes
**As a** utilisateur debout dans ma salle de bain **I want** retrouver mes dernières valeurs déjà en place **so that** je n'aie qu'à corriger ce qui a changé.

### Complexity
2

### Acceptance criteria
- [ ] À l'ouverture du formulaire de saisie, chaque champ est pré-rempli avec la dernière valeur connue pour cette mesure, indépendamment de la session d'où elle provient.
- [ ] Une mesure jamais renseignée reste vide, sans valeur inventée.
- [ ] Un champ non encore touché porte un marqueur observable dans le DOM (par exemple `data-prefilled="true"`), retiré dès la première modification du champ ; ce marqueur pilote la distinction visuelle et rend le critère testable sans jugement à l'œil.
- [ ] Soumettre le formulaire sans rien modifier enregistre une nouvelle session avec ces valeurs — le pré-remplissage n'empêche pas d'enregistrer un plateau.
- [ ] Depuis l'écran d'accueil courant, atteindre le formulaire de saisie prend **au plus un tap**. (Re-vérifié en s06, qui remplace cet écran d'accueil.)
- [ ] Toucher un champ pré-rempli sélectionne son contenu, pour qu'une nouvelle valeur remplace l'ancienne sans effacement manuel.
- [ ] La saisie complète des dix mesures est chronométrée sous **20 secondes** sur téléphone, app déjà ouverte, formulaire affiché. La review consigne le protocole : appareil, point de départ, point d'arrivée, valeurs saisies.

### Dependencies
s03-log-measurement-session (le formulaire existe et persiste), s02 (l'historique lu est celui de l'utilisateur connecté).

### Agentic notes
- **C'est l'angle n°2 du PRD, pas un confort.** Sans pré-remplissage, le critère des 20 secondes est inatteignable — le PRD le dit noir sur blanc.
- « Dernière valeur connue **par mesure** » ≠ « valeurs de la dernière session ». Si la dernière session ne contenait que le poids, les autres champs se remplissent depuis les sessions antérieures. C'est une requête par mesure, pas une lecture de la dernière ligne — le piège principal de cette story.
- Le critère du tap unique s'applique ici à l'écran d'accueil provisoire de s02. s06 remplace cet écran et reprend le critère en non-régression : ne pas considérer le sujet clos à la livraison de cette story.
- Attention au cold start Neon sur le chargement du pré-remplissage : un formulaire qui met 800 ms à s'afficher mange 4 % du budget. Prévoir un affichage immédiat du formulaire, valeurs injectées à l'arrivée — jamais un écran d'attente bloquant.

---

## Story s06-body-map — La silhouette comme écran d'accueil
**As a** utilisateur **I want** ouvrir l'app sur une silhouette annotée **so that** je voie d'un coup d'œil où mon corps a changé.

### Complexity
3

### Acceptance criteria
- [ ] L'écran d'accueil de l'app authentifiée est la silhouette — elle remplace le placeholder de s02. Ni liste, ni tableau de bord chiffré.
- [ ] Chaque zone corporelle suivie (poitrine, biceps, taille, hanches, cuisse, mollet, épaules) affiche sa valeur la plus récente et son delta depuis la première mesure enregistrée, signe compris (`-4,2 cm`).
- [ ] Le poids, l'IMC et les pourcentages de masse, qui ne correspondent à aucune zone, sont affichés distinctement de la silhouette mais sur le même écran.
- [ ] Une zone sans aucune mesure enregistrée s'affiche dans un état neutre, sans delta et sans couleur de progression.
- [ ] Une zone dont une seule mesure existe affiche sa valeur sans delta : il n'y a rien à comparer.
- [ ] La coloration d'une zone reflète le sens de la progression, et le sens « favorable » est déclaré par mesure : un tour de taille qui baisse et un biceps qui monte sont tous deux des progrès.
- [ ] Sur une fenêtre de 375 px de large, la page ne produit aucun défilement horizontal et aucun élément ne déborde du viewport ; les étiquettes de la silhouette respectent une taille de police minimale définie dans le design system.
- [ ] **Non-régression de s05** : depuis cette silhouette, atteindre le formulaire de saisie prend au plus un tap.
- [ ] Un utilisateur sans aucune session voit un état initial qui l'oriente vers la saisie, jamais une silhouette vide et muette.

### Dependencies
s03 (les mesures existent), s04 (l'IMC est calculable), s05 (le critère du tap unique est repris ici en non-régression).

### Agentic notes
- **C'est l'angle n°1 du PRD** : « le corps est l'écran d'accueil ». Les apps du marché (Renpho, MyFitnessPal) ouvrent sur un chiffre de balance et enterrent les mensurations — c'est précisément ce qu'on refuse.
- Story avec UI forte : elle passe par `/ks-design`, et sa silhouette doit sortir du design system (`docs/design-system.md`), pas d'une improvisation. La taille de police minimale des étiquettes est un token à y définir, pas une valeur inventée ici.
- **Le sens du « favorable » n'est pas universel** et ne doit pas être codé en dur par un `delta < 0 ? vert : rouge`. Il se déclare par mesure. C'est le piège le plus probable de cette story.
- SVG en coordonnées relatives avec `viewBox`, jamais de positions absolues en pixels : le critère des 375 px ne tient pas autrement.
- Le référentiel du delta est **la première mesure enregistrée** pour cette mesure, pas la session précédente. Un delta « depuis la dernière fois » raconte le bruit ; un delta « depuis le départ » raconte la progression.
- Pas de zone cliquable ici : la navigation par le corps a été écartée au profit de la version étiquettes seules. Ne pas l'ajouter spontanément.

---

## Story s07-measurement-charts — Courbes d'évolution
**As a** utilisateur **I want** voir l'évolution d'une mesure dans le temps **so that** je distingue une tendance d'une fluctuation.

### Complexity
3

### Acceptance criteria
- [ ] Un écran de graphes affiche une courbe temporelle pour la mesure sélectionnée, sélectionnable parmi les dix mesures suivies plus l'IMC.
- [ ] L'axe temporel respecte les intervalles réels entre sessions : deux sessions espacées d'un mois ne sont pas affichées à la même distance que deux sessions espacées d'un jour.
- [ ] Une mesure absente d'une session ne produit ni point, ni valeur à zéro, ni interpolation silencieuse traitée comme une donnée réelle.
- [ ] Une mesure ne comportant aucune donnée affiche un état vide explicite, pas un graphe aux axes nus.
- [ ] Une mesure ne comportant qu'un seul point affiche ce point sans planter le rendu.
- [ ] Chaque point est survolable ou tapotable pour révéler sa date et sa valeur exactes.
- [ ] Sur une fenêtre de 375 px de large, le graphe ne produit aucun défilement horizontal et ne déborde pas du viewport.

### Dependencies
s03 (l'historique existe), s04 (l'IMC est une série affichable).

### Agentic notes
- Recharts est déjà utilisé dans `compoundSimulator/` — même monorepo, même famille d'outils. Vérifier en Research qu'il tient la charge sur mobile, sinon consigner l'alternative en ADR.
- **Piège majeur** : un axe temporel catégoriel affiche les sessions à intervalles égaux et ment sur la vitesse de la progression. L'axe doit être de type temporel avec les dates réelles. Le critère est écrit pour attraper exactement cette erreur.
- **Deuxième piège** : les trous. Une mesure absente n'est pas un zéro. Selon le rendu choisi (rupture de ligne ou raccord entre points connus), le comportement doit être explicite et testé — jamais le résultat par défaut de la librairie sur un `null` ou un `undefined`.
- Une courbe à la fois, pas de superposition multi-mesures : les échelles (kg, cm, %) ne sont pas comparables. Le multi-séries n'est pas au périmètre.
- Le lissage par moyenne mobile a été écarté du v1 : ne pas l'ajouter.

---

## Story s08-target-weight — Poids cible
**As a** utilisateur **I want** fixer un poids cible **so that** je voie ce qu'il me reste à parcourir.

### Complexity
2

### Acceptance criteria
- [ ] Un poids cible unique se définit et se modifie depuis le profil, et il est persisté.
- [ ] Le graphe du poids affiche la cible comme ligne horizontale de référence, visuellement distincte de la courbe des mesures.
- [ ] L'écart entre le dernier poids enregistré et la cible est affiché en clair, avec son signe.
- [ ] Aucune cible n'est définie par défaut : sans cible, ni ligne ni écart n'apparaissent, et le graphe du poids reste parfaitement fonctionnel.
- [ ] La cible ne s'applique qu'au poids : aucune ligne de référence sur les autres mesures.
- [ ] La cible atteinte ou dépassée s'affiche sans erreur d'arrondi ni écart négatif présenté comme un retard.

### Dependencies
s07-measurement-charts (la ligne de référence se pose sur le graphe du poids), s04 (le profil utilisateur existe déjà comme lieu de stockage).

### Agentic notes
- Une seule cible, sur le poids. Les cibles par mensuration sont au graveyard du PRD — ne pas généraliser le mécanisme « au cas où ».
- Ne pas ajouter de projection de date d'atteinte, de courbe de tendance ou de pourcentage de progression : hors périmètre.
- Réutiliser le stockage de profil créé en s04 (taille) plutôt que d'ouvrir un second mécanisme de préférences.

---

## Story s09-edit-delete-session — Corriger une saisie
**As a** utilisateur **I want** modifier ou supprimer une session **so that** une erreur de frappe ne pollue pas mes courbes.

### Complexity
2

### Acceptance criteria
- [ ] Une session de la liste d'historique s'ouvre en édition, pré-remplie avec ses valeurs réellement enregistrées.
- [ ] Modifier une valeur et enregistrer met à jour la session existante sans en créer une nouvelle : le nombre total de sessions est inchangé.
- [ ] Vider un champ en édition supprime cette mesure de la session au lieu de la mettre à zéro.
- [ ] Supprimer une session demande une confirmation explicite avant d'agir.
- [ ] Une session supprimée disparaît de l'historique, de la silhouette et des graphes.
- [ ] Éditer ou supprimer une session appartenant à un autre utilisateur est refusé côté serveur, vérifié par un test d'accès croisé.
- [ ] Les deltas de la silhouette et les courbes reflètent la correction, y compris quand la session modifiée était la première ou la dernière de l'historique.

### Dependencies
s03 (les sessions et leur liste existent), s06 et s07 (ce sont les vues à réévaluer après correction).

### Agentic notes
- **Cas limite à tester explicitement** : corriger ou supprimer la *première* session change le référentiel de tous les deltas de la silhouette (s06). Une implémentation qui mémorise la première mesure quelque part se désynchronise ici.
- La suppression est définitive, sans corbeille : le volume de données ne justifie pas une suppression logique. Consigner en ADR si le choix inverse est retenu.
- Le pré-remplissage en édition affiche les valeurs **réellement enregistrées**, y compris les champs vides — à ne pas confondre avec le pré-remplissage « dernière valeur connue » de s05, qui est une mécanique différente sur le même formulaire. Cette collision est le piège de la story.

---

## Story s10-pwa-install-offline — Installation et lecture hors ligne
**As a** utilisateur **I want** installer morpho sur mon écran d'accueil et l'ouvrir sans réseau **so that** mes données ne soient jamais purgées et que l'app s'ouvre toujours.

### Complexity
3

### Acceptance criteria
- [ ] L'app expose un manifest valide (nom, icônes aux tailles requises, `display: standalone`, couleur de thème) et s'installe sur l'écran d'accueil iOS.
- [ ] Lancée depuis l'écran d'accueil, l'app s'ouvre en mode standalone, sans barre d'adresse du navigateur.
- [ ] Un service worker met en cache le shell applicatif : ouverte sans réseau, l'app affiche son interface et le dernier état connu, jamais la page d'erreur du navigateur.
- [ ] Hors ligne, l'app signale clairement qu'elle affiche des données potentiellement périmées.
- [ ] Hors ligne, une tentative de saisie est refusée par un message explicite ; rien n'est mis en file d'attente et aucune donnée n'est perdue silencieusement.
- [ ] **Avant merge** : sur un déploiement de preview installé sur l'appareil, deux déploiements successifs sont effectués ; après le second, un lancement à froid depuis l'écran d'accueil sert la nouvelle version sans vidage manuel du cache. Le protocole et les identifiants de déploiement sont consignés dans la review.
- [ ] La stratégie de cache exclut les réponses de l'API contenant les données d'un utilisateur d'un cache partagé ou persistant après déconnexion : se déconnecter puis rouvrir hors ligne n'expose aucune donnée de la session précédente.

Post-ship (confirmation, hors gate) : rejouer le même lancement à froid sur l'URL de production après le premier déploiement réel.

### Dependencies
Toutes les stories précédentes — le shell mis en cache doit être l'app complète, pas une version partielle.

### Agentic notes
- **La raison d'être de l'installation est technique, pas cosmétique** : iOS purge le stockage d'un site non installé après 7 jours sans visite. Installé sur l'écran d'accueil, il en est exempté. Le PRD le pose comme obligatoire.
- **Risque connu** : un service worker mal versionné sert indéfiniment un shell obsolète. Le symptôme est un bug fantôme sur mobile, très coûteux à diagnostiquer parce qu'il ne se reproduit pas en dev. Le critère de mise à jour est écrit pour être vérifiable **avant** la gate, sur une preview — un critère constatable seulement après ship serait coché sans preuve.
- `vite-plugin-pwa` couvre manifest + service worker + gestion de version. Vérifier en Research son comportement sur iOS Safari en mode standalone, qui est le cas le moins bien supporté.
- **L'écriture offline est au graveyard** : ne pas implémenter de file d'attente, de synchronisation différée ou de résolution de conflits. Le critère demande un refus explicite, pas une mise en attente.
- Placer cette story en dernier est délibéré : mettre en cache un shell qui change encore à chaque story ferait payer le coût du versioning de cache à chaque livraison.

---

## Hors périmètre — rappel

Aucune story ne sera créée pour, conformément au graveyard du PRD : nutrition et calories, suivi d'entraînement, photos de progression, intégrations matérielles (balances Bluetooth, Apple Health, Google Fit), notifications push et rappels, cibles par mensuration, multi-utilisateur réel et partage, fonctions sociales, exports PDF/CSV, unités impériales, écriture hors ligne.
