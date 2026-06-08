# État existant — glpi-front vs attendu Jour 1

Analyse de ce qui est déjà en place dans `glpi-front` par rapport aux livrables attendus.

---

## Tableau de bord des livrables

| Module | Attendu | État dans glpi-front | Fichiers concernés |
|--------|---------|---------------------|-------------------|
| Auth backoffice — code unique | Code unique pré-rempli, pas de login | ⚠️ Partiel — login/password classique | `LoginView.vue`, `useGlpiAuth.js` |
| Protection des pages backoffice | Navigation guard → redirige si non auth | ✅ Présent | `router/index.js` |
| Page réinitialisation | Sélection type + suppression batch | ✅ Présent | `ReinitialisationView.vue`, composants |
| Page import (3 CSV + 1 ZIP) | Upload, parsing, import vers GLPI | ❌ Absent | — |
| Dashboard — stats éléments | Compteurs par type d'asset | ❌ Absent | — |
| Dashboard — stats tickets | Compteurs par statut/type | ❌ Absent | — |
| FrontOffice — liste éléments | Recherche multi-critère, pagination | ❌ Absent | — |
| FrontOffice — créer un ticket | Formulaire + association d'éléments | ❌ Absent (seul le backoffice CRUD existe) | — |

---

## Ce qui est déjà prêt (réutilisable à 100 %)

### Infrastructure

| Fichier | Rôle | Réutilisable pour |
|---------|------|-------------------|
| `src/services/glpiApi.js` | Client GLPI REST (fetch natif, session token) | Tous les modules |
| `src/services/springApi.js` | Client Spring Boot (logs, snapshots, imports, préférences) | Import, Dashboard |
| `vite.config.js` | Proxys `/api` → GLPI, `/spring` → Spring Boot | Toute l'app |
| `src/router/index.js` | Vue Router + navigation guard | Architecture backoffice/frontoffice |

### Composables

| Fichier | Rôle |
|---------|------|
| `src/composables/useGlpiAuth.js` | login / logout réactif (à adapter pour code unique) |
| `src/composables/useReinit.js` | Chargement, sélection, suppression batch |

### Vues / Composants

| Fichier | Module Jour 1 couvert |
|---------|----------------------|
| `src/views/LoginView.vue` | Auth backoffice (à adapter : remplacer login → code unique) |
| `src/views/ReinitialisationView.vue` | Page réinitialisation ✅ |
| `src/views/TicketsView.vue` | CRUD tickets backoffice (pas frontoffice) |
| `src/components/Reinitialisation/ResetPanel.vue` | Sélection et suppression ✅ |
| `src/components/Tickets/TicketModal.vue` | Modal création/édition ticket |

---

## Ce qui reste à créer

### 1 — Adapter l'auth → code unique (30 min)

L'authentification actuelle utilise un champ `login` + `password`.  
Il faut :
- Supprimer le champ identifiant
- Garder uniquement le champ "Code d'accès" pré-rempli avec la valeur par défaut
- La connexion GLPI continue en arrière-plan avec des credentials fixes (`glpi/glpi`)

→ Guide : [`01-auth-backoffice.md`](./01-auth-backoffice.md)

---

### 2 — Page import (3 CSV + 1 ZIP) (2–3 h)

Nouvelle page `/import` en backoffice.  
Fonctionnalités :
- Zone de dépôt pour chacun des 4 fichiers (ou upload groupé)
- Parsing CSV → prévisualisation → import vers GLPI via `POST /api/{type}`
- Extraction du ZIP → upload image par image via `POST /api/Document`
- Rapport de résultats (succès / erreurs)
- Enregistrement dans `springApi.imports`

→ Guide : [`03-import-fichiers.md`](./03-import-fichiers.md)

---

### 3 — Dashboard stats (1 h 30)

Nouvelle page `/dashboard` en backoffice.  
Fonctionnalités :
- Compteurs d'éléments par type (`Content-Range` trick)
- Compteurs de tickets par statut
- Cartes visuelles avec badge "En ligne / Erreur"
- Rafraîchissement manuel

→ Guide : [`04-dashboard.md`](./04-dashboard.md)

---

### 4 — FrontOffice liste éléments (1 h 30)

Nouvelle page `/elements` publique (non protégée).  
Fonctionnalités :
- Liste paginée tous types d'assets
- Recherche par nom, filtre par type, filtre par localisation
- Vue fiche détail sur clic

→ Guide : [`05-frontoffice-elements.md`](./05-frontoffice-elements.md)

---

### 5 — FrontOffice créer un ticket (1 h 30)

Nouvelle page `/nouveau-ticket` publique.  
Fonctionnalités :
- Formulaire titre, description, urgence, type
- Association de plusieurs éléments GLPI au ticket (champ `items_id`)
- Validation et confirmation

→ Guide : [`06-frontoffice-ticket.md`](./06-frontoffice-ticket.md)

---

### 6 — Architecture Backoffice / FrontOffice (30 min)

Séparer clairement les routes protégées (backoffice) et publiques (frontoffice) dans le router.  
Modifier `App.vue` pour afficher deux navbars distinctes.

→ Détail dans [`01-auth-backoffice.md`](./01-auth-backoffice.md) section "Architecture router"

---

## Estimation temps total restant

| Module | Durée estimée |
|--------|--------------|
| Auth code unique + architecture | 30 min |
| Page import | 2 h 30 |
| Dashboard | 1 h 30 |
| FrontOffice liste éléments | 1 h 30 |
| FrontOffice créer ticket | 1 h 30 |
| **Total** | **~7 h 30** |
