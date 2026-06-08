# Référence API REST GLPI

Version : GLPI 11.0.7  
Point d'entrée : `http://<hote>/glpi/apirest.php`  
Via proxy Vite : `/api`

---

## Authentification

### `GET /initSession`

Ouvrir une session. Retourne un `session_token` à utiliser sur tous les appels suivants.

**Headers requis :**
```
Authorization: Basic <base64(login:password)>
Content-Type: application/json
```

**Réponse 200 :**
```json
{ "session_token": "83af7e620c83a50a18d3eac2f6ed05a3ca0bea62" }
```

---

### `GET /killSession`

Fermer la session.

**Headers requis :**
```
Session-Token: <session_token>
```

**Réponse 200 :**
```json
true
```

---

## Lecture d'items

### `GET /{itemtype}`

Lister les items d'un type.

**Paramètres URL utiles :**

| Paramètre | Type | Description |
|-----------|------|-------------|
| `range` | string | Pagination ex: `0-49` (50 premiers) |
| `sort` | string | Champ de tri ex: `id`, `name` |
| `order` | string | `ASC` ou `DESC` |
| `only_id` | int | `1` pour retourner seulement les IDs |
| `searchText[name]` | string | Filtrer par nom |

**Exemple :**
```
GET /api/Ticket?range=0-99&sort=id&order=DESC
Session-Token: <token>
```

**Réponse 200 :**
```json
[
  { "id": 42, "name": "Problème réseau", "status": 1, ... },
  { "id": 41, "name": "Écran cassé", "status": 5, ... }
]
```

---

### `GET /{itemtype}/{id}`

Récupérer un item unique.

**Réponse 200 :**
```json
{ "id": 42, "name": "Problème réseau", "content": "...", ... }
```

---

## Suppression d'items

### `DELETE /{itemtype}/{id}`

Supprimer un item unique.

**Headers :**
```
Session-Token: <token>
Content-Type: application/json
```

**Réponse 200 :**
```json
[{ "42": true, "message": "" }]
```

---

### `DELETE /{itemtype}`

Supprimer plusieurs items.

**Corps JSON :**
```json
{
  "input": [
    { "id": 1 },
    { "id": 2 },
    { "id": 3 }
  ]
}
```

**Réponse 200 :**
```json
[
  { "1": true, "message": "" },
  { "2": true, "message": "" },
  { "3": false, "message": "Item locked" }
]
```

---

## Upload de fichiers (Document)

### `POST /Document`

Créer un document GLPI en uploadant un fichier.

**Headers :**
```
Session-Token: <token>
Content-Type: multipart/form-data
```

**Corps (FormData) :**

| Champ | Valeur |
|-------|--------|
| `uploadManifest` | JSON : `{ "input": { "name": "Mon doc", "_filename": ["fichier.pdf"] } }` |
| `filename[0]` | Le fichier binaire |

**Exemple fetch :**
```ts
const formData = new FormData()
formData.append('uploadManifest', JSON.stringify({
  input: { name: 'Mon rapport', _filename: ['rapport.pdf'] }
}))
formData.append('filename[0]', file, file.name)

await fetch('/api/Document', {
  method: 'POST',
  headers: { 'Session-Token': token },
  body: formData,
})
```

**Réponse 201 :**
```json
{
  "id": 123,
  "message": "Item successfully added: Mon rapport"
}
```

---

## Gestion des erreurs

GLPI retourne les erreurs sous forme de tableau :

```json
["ERROR_GLPI_LOGIN", "Mauvais identifiant ou mot de passe"]
```

| Code HTTP | Signification |
|-----------|---------------|
| 400 | Mauvaise requête (champ manquant, item verrouillé) |
| 401 | Non authentifié ou session expirée |
| 403 | Permission refusée (profil insuffisant) |
| 404 | Item introuvable |
| 500 | Erreur serveur GLPI |

**Gestion dans le client :**
```ts
if (!res.ok) {
  const err = await res.json()
  // err est soit ["CODE", "message"] soit { message: "..." }
  throw new Error(Array.isArray(err) ? err[1] : err.message)
}
```

---

## Types d'items (itemtype) disponibles

| itemtype | Table BDD | Description |
|----------|-----------|-------------|
| `Ticket` | `glpi_tickets` | Incidents et demandes |
| `Problem` | `glpi_problems` | Problèmes |
| `Change` | `glpi_changes` | Changements |
| `Computer` | `glpi_computers` | Ordinateurs |
| `Monitor` | `glpi_monitors` | Écrans |
| `Printer` | `glpi_printers` | Imprimantes |
| `Software` | `glpi_softwares` | Logiciels |
| `Contract` | `glpi_contracts` | Contrats |
| `Document` | `glpi_documents` | Documents |
| `User` | `glpi_users` | Utilisateurs |
| `Group` | `glpi_groups` | Groupes |
| `Entity` | `glpi_entities` | Entités |

---

## Statuts des tickets

| Valeur | Statut |
|--------|--------|
| 1 | Nouveau |
| 2 | En cours (assigné) |
| 3 | En cours (planifié) |
| 4 | En attente |
| 5 | Résolu |
| 6 | Clos |

---

## Limites et bonnes pratiques

- **Pagination** : par défaut GLPI retourne 50 items max. Utiliser `range=0-499` pour en obtenir plus.
- **Timeout** : les suppressions en masse au-delà de 100 items peuvent dépasser le timeout PHP (30s). Traiter par batches.
- **Session** : les sessions expirent après inactivité. Intercepter les 401 et redemander une connexion.
- **CORS** : configurer le proxy Vite en dev, et les headers `Access-Control-Allow-*` en prod.
