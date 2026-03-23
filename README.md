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
