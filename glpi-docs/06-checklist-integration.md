# Checklist d'intégration

Guide étape par étape pour monter l'application de bout en bout.

---

## Phase 1 — Préparation GLPI

- [ ] Vérifier que GLPI est accessible : `http://localhost/glpi`
- [ ] Activer l'API REST : **Configuration > Générale > API** → cocher "Activer l'API REST"
- [ ] Créer ou identifier un utilisateur avec les droits suffisants (DELETE sur les types cibles)
- [ ] Récupérer sa clé API (`user_token`) : **Préférences utilisateur > Accès distant**
- [ ] Tester manuellement l'authentification :
  ```bash
  curl -X GET \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Basic Z2xwaTpnbHBp' \
    'http://localhost/glpi/apirest.php/initSession'
  ```
  Résultat attendu : `{"session_token":"..."}`

---

## Phase 2 — Setup Vue.js

> **TypeScript** : utiliser les extensions `.ts` | **JavaScript** : utiliser `.js` et supprimer les annotations de types.

- [ ] Installer les dépendances supplémentaires :
  ```bash
  cd glpi-front
  npm install vue-router@4
  ```
- [ ] Configurer le proxy Vite dans `vite.config.js` (voir [01-vue-app-setup.md](./01-vue-app-setup.md))
- [ ] Créer la structure de dossiers :
  ```bash
  mkdir -p src/{components/{ImportFichier,Reinitialisation,shared},composables,services,views,router}
  # TypeScript seulement :
  mkdir -p src/types
  ```
- [ ] **(TS only)** Créer `src/types/glpi.ts`
- [ ] Créer `src/services/glpiApi.js` (ou `.ts`) — code complet dans [02-api-client.md](./02-api-client.md)
- [ ] Créer `src/router/index.js` (ou `.ts`) avec la navigation guard
- [ ] Mettre à jour `src/main.js` (ou `.ts`)

---

## Phase 3 — Feature Import

- [ ] Créer `src/composables/useImport.js` (ou `.ts`) — code dans [03-feature-import.md](./03-feature-import.md)
- [ ] Créer `src/components/ImportFichier/ImportForm.vue`
- [ ] Créer `src/components/ImportFichier/ImportResult.vue`
- [ ] Créer `src/views/ImportView.vue`
- [ ] Tester l'upload d'un fichier PDF ou JSON
- [ ] Vérifier que le document apparaît dans GLPI : **Outils > Documents**
- [ ] Vérifier que les fichiers trop grands ou au mauvais format sont refusés

---

## Phase 4 — Feature Réinitialisation

- [ ] Créer `src/composables/useReinit.js` (ou `.ts`) — code dans [04-feature-reinitialisation.md](./04-feature-reinitialisation.md)
- [ ] Créer `src/components/Reinitialisation/ResetPanel.vue`
- [ ] Créer `src/components/Reinitialisation/ResetConfirm.vue`
- [ ] Créer `src/components/Reinitialisation/ResetResult.vue`
- [ ] Créer `src/views/ReinitialisationView.vue`
- [ ] Tester la suppression d'un ticket de test
- [ ] Vérifier que la modale de confirmation s'affiche bien
- [ ] Vérifier que `ResetResult` affiche le décompte succès/échec

---

## Phase 5 — Authentification UI

- [ ] Créer `src/composables/useGlpiAuth.js` (ou `.ts`) — code dans [02-api-client.md](./02-api-client.md)
- [ ] Créer `src/components/shared/LoginForm.vue` (code dans [02-api-client.md](./02-api-client.md))
- [ ] Créer `src/views/LoginView.vue` (code dans [01-vue-app-setup.md](./01-vue-app-setup.md))
- [ ] Vérifier que la navigation guard fonctionne (accès `/import` sans session → redirige vers `/login`)
- [ ] Ajouter l'écouteur d'événement `glpi:session-expired` dans `App.vue`
- [ ] Afficher le bouton "Déconnexion" dans la nav (conditionné à `authenticated`)

---

## Phase 6 — Polish

- [ ] Ajouter un composant `AppLoader.vue` pour les états de chargement
- [ ] Ajouter un composant `AppAlert.vue` pour les erreurs et succès
- [ ] Gérer les erreurs 401 (session expirée) : intercepter et rediriger vers login
- [ ] Tester sur mobile (responsive)
- [ ] Vérifier les droits GLPI si certains types ne fonctionnent pas

---

## Arborescence finale attendue

Les extensions `.ts` / `.js` dépendent de votre choix TypeScript ou JavaScript.

```
glpi-front/src/
├── components/
│   ├── ImportFichier/
│   │   ├── ImportForm.vue          # Formulaire + drag & drop
│   │   └── ImportResult.vue        # Résultat après upload
│   ├── Reinitialisation/
│   │   ├── ResetPanel.vue          # Sélection et liste des items
│   │   ├── ResetConfirm.vue        # Modale de confirmation
│   │   └── ResetResult.vue         # Décompte succès/échec
│   └── shared/
│       └── LoginForm.vue           # Formulaire de connexion
├── composables/
│   ├── useGlpiAuth.js              # Authentification GLPI
│   ├── useImport.js                # Logique upload fichier
│   └── useReinit.js                # Logique réinitialisation
├── services/
│   └── glpiApi.js                  # Client HTTP centralisé
├── types/                          # TypeScript uniquement
│   └── glpi.ts
├── views/
│   ├── LoginView.vue
│   ├── ImportView.vue
│   └── ReinitialisationView.vue
├── router/
│   └── index.js
├── App.vue
└── main.js
```

---

## Commandes utiles

```bash
# Démarrer le serveur de dev
npm run serve

# Build de production
npm run build

# Tester l'API GLPI directement
curl -X GET \
  -H 'Content-Type: application/json' \
  -H 'Session-Token: VOTRE_TOKEN' \
  'http://glpi.localhost/apirest.php/Ticket?range=0-4'
```
