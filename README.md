# Outil clients BARA WRLD

5 fichiers, aucune étape de build : tu peux les déposer tels quels sur GitHub Pages
(ou tout autre hébergement statique).

## Avant de déployer

1. **Configurer les liens d'authentification dans Supabase**
   Dashboard Supabase → *Authentication → URL Configuration* :
   - **Site URL** : l'adresse où tu vas héberger le site (ex. `https://tonpseudo.github.io/bara-outil/`)
   - **Redirect URLs** : ajoute la même adresse, plus `http://localhost:5500/` si tu veux tester en local

2. **Vérifier que le bucket existe**
   Le script SQL l'a déjà créé (`bara-deliverables`, public). Rien à faire.

3. **Déployer**
   - Crée un dépôt GitHub, pousse ces 6 fichiers à la racine.
   - Dans *Settings → Pages*, active GitHub Pages sur la branche `main`.
   - Ton tableau de bord sera à `https://tonpseudo.github.io/NOM_DU_DEPOT/dashboard.html`

## Utilisation

- **Toi** : `dashboard.html` → entre `hilarion2004@gmail.com`, reçois un lien par
  e-mail, clique dessus. Pas de mot de passe à retenir.
- **Le client** : `client.html?t=SON_CODE` — le lien complet est généré et copiable
  depuis la fiche du projet, dans le tableau de bord.

## Ce qui est simulé pour l'instant / à faire évoluer plus tard

- Le PDF de l'identité n'est présenté qu'en téléchargement, pas encore en
  défilement page par page (nécessite de convertir le PDF en images).
- Les mises en situation du logo (carte, enseigne…) sont des fichiers que **tu**
  prépares et déposes toi-même — l'outil ne les génère pas automatiquement.
- Les fichiers sont dans un bucket public à chemin imprévisible : suffisant pour
  démarrer, mais pas de vrais liens de téléchargement à durée limitée (Anthropic
  ne peut pas héberger ce petit serveur supplémentaire — je peux te montrer
  comment l'ajouter avec une fonction Supabase Edge quand tu voudras).
- Le projet Supabase est partagé avec l'appli de l'hôtel (mêmes quotas gratuits :
  500 Mo base, 1 Go fichiers, 5 Go transfert/mois). Si un projet gratuit reste
  inactif une semaine, il se met en pause — utile à savoir si les pages clients
  doivent rester accessibles en continu.
