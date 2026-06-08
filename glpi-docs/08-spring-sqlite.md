# Backend Spring Boot + SQLite

Persistance locale pour glpi-front : imports, snapshots, préférences, logs.

---

## Architecture

```
glpi-front (Vue 3 :5173)
  │
  ├── /api/*   → proxy Vite → http://localhost/glpi/apirest.php  (GLPI REST)
  └── /spring/* → proxy Vite → http://localhost:8081             (Spring Boot)

glpi-spring (Spring Boot :8081)
  └── SQLite → ./glpi-data.db
```

---

## Démarrer le backend

```bash
cd glpi-spring
mvn spring-boot:run
# → démarre sur http://localhost:8081
# → crée glpi-data.db à la racine du projet au premier lancement
```

Premier lancement : Maven télécharge les dépendances (~200 Mo). Les suivants sont instantanés.

---

## Entités / Tables SQLite

| Table | Entité Java | Rôle |
|-------|-------------|------|
| `import_history` | `ImportHistory` | Trace chaque import CSV |
| `snapshots` | `Snapshot` | État avant opération bulk (rollback) |
| `snapshot_items` | `SnapshotItem` | Détail par item du snapshot |
| `user_preferences` | `UserPreference` | Préférences clé/valeur JSON |
| `action_logs` | `ActionLog` | Journal des actions GLPI |

---

## Endpoints REST

Base : `http://localhost:8081` (ou `/spring` via proxy Vite)

### Historique d'imports — `/spring/imports`

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/spring/imports` | Liste tous les imports (tri date desc) |
| GET | `/spring/imports?itemtype=Ticket` | Filtre par type |
| GET | `/spring/imports/{id}` | Détail d'un import |
| POST | `/spring/imports` | Enregistre un import |
| DELETE | `/spring/imports/{id}` | Supprime un enregistrement |

**Corps POST :**
```json
{
  "filename": "tickets-2024.csv",
  "itemtype": "Ticket",
  "totalRows": 150,
  "successCount": 148,
  "failureCount": 2,
  "status": "PARTIAL"
}
```
> `status` : `COMPLETED` | `PARTIAL` | `FAILED`  
> `importedAt` est auto-renseigné par `@PrePersist`.

---

### Snapshots — `/spring/snapshots`

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/spring/snapshots` | Liste tous les snapshots |
| GET | `/spring/snapshots?itemtype=Ticket` | Filtre par type |
| GET | `/spring/snapshots/{id}` | Détail + items |
| POST | `/spring/snapshots` | Crée snapshot avec items |
| DELETE | `/spring/snapshots/{id}` | Supprime (cascade sur items) |

**Corps POST :**
```json
{
  "label": "Fermeture bulk — 12 tickets",
  "itemtype": "Ticket",
  "itemCount": 12,
  "items": [
    {
      "glpiId": 42,
      "originalState": "{\"status\":2,\"urgency\":3}",
      "modifiedFields": "[\"status\"]"
    },
    {
      "glpiId": 43,
      "originalState": "{\"status\":1,\"urgency\":2}",
      "modifiedFields": "[\"status\"]"
    }
  ]
}
```

---

### Préférences utilisateur — `/spring/preferences`

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/spring/preferences` | Liste toutes les préférences |
| GET | `/spring/preferences/{key}` | Lit une préférence |
| PUT | `/spring/preferences/{key}` | Crée ou met à jour |
| DELETE | `/spring/preferences/{key}` | Supprime |

**Corps PUT :**
```json
{ "value": "[\"Ticket\",\"Computer\",\"Software\"]" }
```
La valeur est toujours une **string JSON** — sérialise côté Vue avant d'envoyer,
désérialise avec `JSON.parse(pref.value)` après lecture.

**Exemples de clés :**

| Clé | Valeur (JSON string) |
|-----|----------------------|
| `dashboard.watchedTypes` | `["Ticket","Computer","Software","Document"]` |
| `search.defaultItemtype` | `"Ticket"` |
| `search.pageSize` | `"10"` |

---

### Logs d'actions — `/spring/logs`

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/spring/logs` | Tous les logs (desc) |
| GET | `/spring/logs?itemtype=Ticket` | Filtre par type |
| GET | `/spring/logs?action=DELETE` | Filtre par action |
| POST | `/spring/logs` | Enregistre une action |
| DELETE | `/spring/logs` | Vide tous les logs |
| DELETE | `/spring/logs/{id}` | Supprime un log |

**Corps POST :**
```json
{
  "action": "PATCH",
  "itemtype": "Ticket",
  "glpiId": 42,
  "payload": "{\"input\":{\"status\":5}}",
  "response": "[{\"42\":true,\"message\":\"\"}]",
  "status": "SUCCESS"
}
```
> `action` : `CREATE` | `PATCH` | `DELETE`  
> `status` : `SUCCESS` | `ERROR`  
> `timestamp` auto-renseigné.

---

## Utilisation dans glpi-front

Importer depuis `src/services/springApi.js` :

```js
import { imports, snapshots, preferences, logs } from '../services/springApi.js'
```

### Exemples

**Sauvegarder un snapshot avant une opération bulk :**
```js
const snap = await snapshots.create({
  label: `Fermeture bulk — ${selectedIds.length} tickets`,
  itemtype: 'Ticket',
  itemCount: selectedIds.length,
  items: selectedIds.map(id => ({
    glpiId: id,
    originalState: JSON.stringify(originalValues[id]),
    modifiedFields: JSON.stringify(['status']),
  })),
})
// snap.id peut être stocké pour rollback
```

**Rollback (restaurer depuis un snapshot) :**
```js
const snap = await snapshots.get(snapId)
for (const item of snap.items) {
  const original = JSON.parse(item.originalState)
  await glpiApi.patchItem('Ticket', item.glpiId, original)
}
await snapshots.delete(snapId)
```

**Sauvegarder les préférences du dashboard :**
```js
await preferences.set('dashboard.watchedTypes', ['Ticket', 'Computer', 'Software'])

// Lire au montage :
const pref = await preferences.get('dashboard.watchedTypes')
const watchedTypes = pref ? JSON.parse(pref.value) : defaultTypes
```

**Logger une action :**
```js
try {
  const res = await glpiApi.patchItem('Ticket', 42, { status: 5 })
  await logs.create({
    action: 'PATCH', itemtype: 'Ticket', glpiId: 42,
    payload: JSON.stringify({ input: { status: 5 } }),
    response: JSON.stringify(res),
    status: 'SUCCESS',
  })
} catch (e) {
  await logs.create({
    action: 'PATCH', itemtype: 'Ticket', glpiId: 42,
    status: 'ERROR', errorMessage: e.message,
  })
}
```

**Enregistrer un import CSV :**
```js
await imports.create({
  filename: file.name,
  itemtype: 'Ticket',
  totalRows: rows.length,
  successCount: results.filter(r => r.ok).length,
  failureCount: results.filter(r => !r.ok).length,
  status: failureCount === 0 ? 'COMPLETED' : failureCount === rows.length ? 'FAILED' : 'PARTIAL',
})
```

---

## Structure du projet

```
glpi-spring/
├── pom.xml
└── src/main/
    ├── java/com/glpi/spring/
    │   ├── GlpiSpringApplication.java
    │   ├── config/
    │   │   └── CorsConfig.java              # CORS → localhost:5173
    │   ├── model/
    │   │   ├── ImportHistory.java
    │   │   ├── Snapshot.java
    │   │   ├── SnapshotItem.java
    │   │   ├── UserPreference.java
    │   │   └── ActionLog.java
    │   ├── repository/                      # Spring Data JPA
    │   │   ├── ImportHistoryRepository.java
    │   │   ├── SnapshotRepository.java
    │   │   ├── UserPreferenceRepository.java
    │   │   └── ActionLogRepository.java
    │   └── controller/                      # REST controllers
    │       ├── ImportHistoryController.java
    │       ├── SnapshotController.java
    │       ├── UserPreferenceController.java
    │       └── ActionLogController.java
    └── resources/
        └── application.properties
```

---

## Dépendances clés (pom.xml)

| Dépendance | Rôle |
|------------|------|
| `spring-boot-starter-web` | API REST (Jackson, Tomcat embarqué) |
| `spring-boot-starter-data-jpa` | JPA + Hibernate 6 |
| `org.xerial:sqlite-jdbc:3.45.3.0` | Driver SQLite |
| `org.hibernate.orm:hibernate-community-dialects` | Dialecte SQLite pour Hibernate 6 |
| `org.projectlombok:lombok` | `@Getter/@Setter/@Builder` sur les entités |

---

## Notes importantes

- Le fichier `glpi-data.db` est créé automatiquement au démarrage dans le dossier courant (`./`).
- `spring.jpa.hibernate.ddl-auto=update` crée/modifie les tables automatiquement — ne pas utiliser `create` en prod (efface les données).
- Les dates sont stockées en TEXT ISO 8601 dans SQLite et désérialisées en `LocalDateTime` par Hibernate.
- Les valeurs JSON dans `UserPreference.value`, `SnapshotItem.originalState`, etc. sont des strings — toujours `JSON.stringify` avant envoi et `JSON.parse` après lecture.
