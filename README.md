# Affiliate Hub

Page web statique responsive pour centraliser les informations d'affiliation (promo, code, exigences, hashtags, mentions, specificites).

Le hub supporte maintenant 2 types de blocs via un toggle:

- Affiliates
- Collaborators

Les collaborators utilisent le meme principe produit (filtres, cartes, edition, import/export, mode public/admin) avec un schema adapte.

## Regle de test (obligatoire)

- Les tests fonctionnels se font uniquement en mode dev API.
- Ne pas utiliser `python3 -m http.server` pour tester les features.
- Le front est configure en mode API-only pour les tests: sans API, l'app affiche une erreur explicite.

Commande recommandee:

```bash
npm start
```

(ne pas utiliser `npm run dev` — Vercel intercepte le script `dev` et cause une invocation recursive)

## Lancer en local

Option simple (Python):

```bash
python3 -m http.server 8080
```

Puis ouvrir:

- http://localhost:8080

## Modifier le contenu

Le contenu des cartes est maintenant pilote par JSON:

- Fichier: `data/affiliates.json`
- Champs principaux: `name`, `platform`, `niche`, `format`, `tone`, `promoUrl`, `promoCode`, `mentions`, `postRequirements`
- Champs optionnels: `socialUrl`, `specificities`, `logos` (tableau de 0 a 3 URLs)
- Contenu FR/EN: `fr.tags`, `fr.specs`, `fr.caption`, `en.tags`, `en.specs`, `en.caption`

Pour les collaborators:

- Fichier: `data/collaborators.json`
- Champs principaux: `name`, `publicLink`, `platform`, `niche`, `format`, `tone`
- Champs optionnels: `privateLinks` (liste), `contact`, `rates`, `logos` (tableau de 0 a 3 URLs)
- Contenu FR/EN: `fr.tags`, `fr.specs`, `fr.caption`, `en.tags`, `en.specs`, `en.caption`
- Regle: `publicLink` doit etre une URL valide et sert de lien principal visible au mode public

## Google Sheet -> JSON (automatique)

Un template CSV pour Google Sheets est disponible ici:

- `data/affiliates_google_sheet_template.csv`

Apres export de ta sheet en CSV, convertis vers le format attendu par l'app:

```bash
node scripts/csv-to-affiliates-json.mjs <ton-fichier.csv> data/affiliates.json
```

Exemple:

```bash
node scripts/csv-to-affiliates-json.mjs data/affiliates_google_sheet_template.csv data/affiliates.json
```

Notes:

- `logo1Url`, `logo2Url`, `logo3Url` deviennent `logos` (max 3)
- Les URLs invalides sont ignorees
- Les lignes sans `name` sont ignorees

## JSON -> Google Sheet CSV (automatique)

Pour repartir du JSON du projet vers un CSV importable dans Google Sheets:

```bash
node scripts/affiliates-json-to-csv.mjs data/affiliates.json data/affiliates_export_google_sheet.csv
```

Notes:

- Le CSV genere reprend les colonnes du template Google Sheet
- `logos` est reparti sur `logo1Url`, `logo2Url`, `logo3Url`
- Les colonnes de suivi (`status`, `priority`, `lastUpdated`, `owner`, `notes`) sont laissees vides

## Save automatique (watch local)

Oui: tu peux lancer une synchro automatique locale qui reconvertit des que le fichier source change.

Sheet CSV -> JSON (auto):

```bash
node scripts/auto-sync-affiliates.mjs --mode=sheet-to-json --source=data/affiliates_google_sheet_template.csv --target=data/affiliates.json
```

JSON -> Sheet CSV (auto):

```bash
node scripts/auto-sync-affiliates.mjs --mode=json-to-sheet --source=data/affiliates.json --target=data/affiliates_export_google_sheet.csv
```

Execution unique (sans watch):

```bash
node scripts/auto-sync-affiliates.mjs --once
```

Important:

- C'est un auto-save local (sur ton poste)
- Sur Vercel/deploy statique, on ne peut pas ecrire automatiquement `data/affiliates.json` sans backend/base de donnees

### Auto-export depuis l'interface admin

Dans le formulaire admin, tu peux activer `Auto-export JSON local`.

Quand active, l'app telecharge automatiquement un fichier JSON local apres:

- ajout
- modification
- import fusion
- import remplacement
- suppression locale

Le nom du fichier est de type: `affiliations-local-autosave-YYYY-MM-DD.json`.

## Fonctions V2

- Rendu dynamique depuis `data/affiliates.json`
- Filtres avances: platform, niche, format, tone
- Recherche texte globale
- Boutons par carte: copier tags, copier specs, copier tout, dupliquer bloc
- Switch langue FR/EN global

## Fonctions V3

- Mini formulaire pour ajouter un affiliate sans modifier le JSON a la main
- Les ajouts du formulaire sont sauvegardes en localStorage (dans ton navigateur)
- Bouton d'export pour copier le JSON de tes ajouts locaux
- Bouton de reset pour supprimer les ajouts locaux

## Fonctions V3.1

- Import JSON direct depuis l'interface (sans edition manuelle)
- Mode `Importer (fusion)` pour ajouter au local existant
- Mode `Importer (remplacer local)` pour ecraser seulement les ajouts locaux
- Validation des champs obligatoires avant import

## Fonctions V3.2

- Telechargement direct d'un fichier `.json` (base + local)
- Export complet (base + local) copie dans le presse-papiers
- Anti-doublons lors de l'ajout/import base sur `id`, sinon `name + platform`

## Fonctions V4

- Page orientee operations d'affiliation (pas publication native)
- Box "Kit affiliation" dans chaque carte: `promoUrl`, `promoCode`, `mentions`, `postRequirements`, `specificities`
- Profil social conserve en option seulement (`socialUrl`)
- Nouveaux boutons de copie: URL promo, code promo, kit affiliation

## Fonctions V4.1

- Toggle d'affichage `Full` / `Compact` pour accelerer l'usage quotidien
- Mode `Compact`: cache les sections longues FR/EN et affiche un workflow court (promo + code + kit)
- Le choix de vue est sauvegarde localement dans le navigateur

## Fonctions V5 (acces public/prive)

- Les 3 blocs initiaux du fichier `data/affiliates.json` sont retires (fichier vide par defaut)
- Mode public par defaut: affiche seulement meta, lien promo et code fan
- Mode admin via mot de passe: debloque formulaire, imports, exports et details complets

## Auth backend (option 2)

- Auth admin geree cote serveur via endpoints `api/login`, `api/logout`, `api/session`
- Cookie de session `HttpOnly` en mode admin (pas de mot de passe hardcode cote front)
- Configurer dans Vercel:
	- `ADMIN_PASSWORD` = ton mot de passe admin
	- `ADMIN_SESSION_TOKEN` = token long aleatoire
	- `APP_BASE_URL` = URL publique de l'app (ex: `https://affiliates.onlymatt.ca`)

Important:

- Les secrets admin ne doivent pas avoir de fallback local en production.
- Si `ADMIN_PASSWORD` ou `ADMIN_SESSION_TOKEN` est absent, `POST /api/login` retourne une erreur serveur explicite.

## Turso (base de donnees)

Si Turso est configure, l'app lit/écrit les affiliates en base via les endpoints API.

Variables Vercel a definir:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Comportement:

- Avec Turso: la base distante devient la source de verite
- Sans Turso: fallback automatique sur `data/affiliates.json` (lecture) + localStorage pour les ajouts admin

Pour collaborators, le meme comportement s'applique avec:

- table `collaborators`
- fallback `data/collaborators.json`

## Health check production

Endpoint disponible:

- `GET /api/health`

Reponse:

- `200` si application OK (et Turso OK si configure)
- `503` si Turso est configure mais inaccessible

Payload expose:

- `ok`
- `ts`
- `persistence.tursoConfigured`
- `persistence.tursoHealthy`

## Rate limiting distribue (multi-instance)

Le rate limiter supporte un mode global distribue via Upstash Redis REST.

Variables optionnelles a configurer dans Vercel:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Comportement:

- Si ces variables sont presentes: compteur partage entre instances serverless (limite globale).
- Si absentes ou indisponibles: fallback automatique sur compteur memoire local (best effort).

## Vue publique allegee

- Sans mot de passe: interface allegee (moins de texte et aucun controle admin)
- Les visiteurs voient seulement:
	- meta de la fiche
	- promo URL
	- code fan
	- image meta du lien promo (og:image/twitter:image) quand disponible

Mode public collaborators:

- la carte collaborator est cliquable
- le clic ouvre le lien principal (`publicLink`) dans un nouvel onglet
- l'URL n'est pas exposee en texte dans la carte publique

## Endpoints collaborators

- `GET /api/collaborators`
- `POST /api/collaborators-upsert`
- `POST /api/collaborators-bulk-upsert`
- `POST /api/collaborators-replace`
- `POST /api/collaborators-clear`

Les writes collaborators suivent la meme auth admin que les writes affiliates.

Note importante:

- Le fichier `data/affiliates.json` reste la source du repo Git
- Les ajouts via formulaire ne modifient pas automatiquement ce fichier
- Pour versionner tes nouveaux affiliates dans Git, copie le JSON exporte puis colle-le dans `data/affiliates.json`

## Deploy Vercel

1. Push ce dossier sur GitHub.
2. Importer le repo dans Vercel.
3. Ajouter le domaine `affiliates.onlymatt.ca` dans les settings du projet.
4. Creer le record DNS demande par Vercel pour `affiliates`.
5. Garder `affiliate.onlymatt.ca` inchange pour dub.co.
