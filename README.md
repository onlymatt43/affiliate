# Affiliate Hub

Page web statique responsive pour centraliser les informations de publication affiliate.

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
- Champs principaux: `name`, `platform`, `niche`, `format`, `tone`, `contactUrl`
- Contenu FR/EN: `fr.tags`, `fr.specs`, `fr.caption`, `en.tags`, `en.specs`, `en.caption`

## Fonctions V2

- Rendu dynamique depuis `data/affiliates.json`
- Filtres avances: platform, niche, format, tone
- Recherche texte globale
- Boutons par carte: copier tags, copier specs, copier tout, dupliquer bloc
- Switch langue FR/EN global

## Deploy Vercel

1. Push ce dossier sur GitHub.
2. Importer le repo dans Vercel.
3. Ajouter le domaine `affiliates.onlymatt.ca` dans les settings du projet.
4. Creer le record DNS demande par Vercel pour `affiliates`.
5. Garder `affiliate.onlymatt.ca` inchange pour dub.co.
