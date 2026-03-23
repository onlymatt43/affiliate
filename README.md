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

Edite les cartes directement dans `index.html`:

- Nom: balise `<h2>`
- Plateforme et niche: balise `.meta`
- Tags/specs/caption FR et EN: blocs `.copy-source`

## Deploy Vercel

1. Push ce dossier sur GitHub.
2. Importer le repo dans Vercel.
3. Ajouter le domaine `affiliates.onlymatt.ca` dans les settings du projet.
4. Creer le record DNS demande par Vercel pour `affiliates`.
5. Garder `affiliate.onlymatt.ca` inchange pour dub.co.
