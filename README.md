# Affiliate Hub

Hub web orienté opérations pour gérer des fiches `affiliate`, `collaborator` et `event`, avec un mode public, un mode admin, et un assistant IA (`HeyHi`) capable de créer/modifier des fiches.

## Stack

- Front: `index.html`, `app.js`, `styles.css` (vanilla JS)
- API serverless: dossier `api/`
- Persistance: Turso/libSQL (si configuré) + fallback JSON/localStorage
- Dev local: `vercel dev`

## Démarrage local

Pré-requis:

- Node 18+

Installer et lancer:

```bash
npm install
npm start
```

Ne pas utiliser un serveur statique (`python3 -m http.server`) pour valider les fonctionnalités API/auth.

## Variables d'environnement

Admin/auth:

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_TOKEN`
- `APP_BASE_URL`

IA:

- `OPENAI_API_KEY`

Base de données Turso (optionnel mais recommandé en prod):

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Rate limiting distribué (optionnel):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Modèle de données

Entités supportées:

- `affiliate`
- `collaborator`
- `event`

Fichiers de fallback:

- `data/affiliates.json`
- `data/collaborators.json`

Chaque fiche utilise une `visibility` par champ (`public` | `private` | `both`) pour contrôler ce qui est affiché côté public.

## Auth et permissions

Admin:

- Cookie de session admin (`api/login`, `api/logout`, `api/session`)
- Peut créer/modifier/supprimer toutes les fiches

Collaborator (Twitter/X unlock):

- Cookie `collab_token`, scope limité à sa propre fiche
- Endpoints privés dédiés pour actions autorisées

Important:

- Les permissions collaborator et admin sont séparées
- Les suppressions restent admin-only

## HeyHi (assistant IA)

Endpoint principal:

- `POST /api/ai-assistant`

Modes:

- `post`: génération de texte
- `intake`: extraction structurée et édition de fiches

Sécurité IA en place:

- Contrôle d'auth (admin ou collaborator token)
- Scope collaborator forcé sur sa carte
- Restriction de champs en session collaborator
- Anti-invention URL: URLs extraites filtrées par preuves (messages user + carte active)

UX IA:

- Workspace collaborator (preview public/private + chat)
- Mode intake admin avec preview live public/private
- Auto-save intake (création/mise à jour) avec feedback de statut

## UI/UX (état actuel)

- Grille mosaïque droite avec templates de cartes
- Types explicites visibles (`affiliate`, `collaborators`, `event`)
- Variations typographiques légères pour casser la rigidité
- Fonds visuels aléatoires (banque large) à chaque refresh

## CSV / Google Sheets

Template CSV:

- `data/affiliates_google_sheet_template.csv`

Conversion CSV -> JSON:

```bash
node scripts/csv-to-affiliates-json.mjs <source.csv> data/affiliates.json
```

Conversion JSON -> CSV:

```bash
node scripts/affiliates-json-to-csv.mjs data/affiliates.json data/affiliates_export_google_sheet.csv
```

Mode watch local:

```bash
node scripts/auto-sync-affiliates.mjs --mode=sheet-to-json --source=data/affiliates_google_sheet_template.csv --target=data/affiliates.json
```

```bash
node scripts/auto-sync-affiliates.mjs --mode=json-to-sheet --source=data/affiliates.json --target=data/affiliates_export_google_sheet.csv
```

## Endpoints utiles

- `GET /api/health`
- `GET/POST /api/affiliates`
- `GET/POST /api/collaborators`
- `GET/POST /api/collaborators/private`
- `POST /api/ai-assistant`

## Notes d'exploitation

- En prod, éviter le fallback local comme source de vérité
- Vérifier les variables secrètes avant tout déploiement
- Conserver les limites de payload/rate-limit sur les routes write/IA

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
