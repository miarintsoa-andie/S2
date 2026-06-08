# Guide : fonctions JS de récupération des métadonnées de tickets GLPI

Ce guide explique comment créer quatre fonctions JavaScript utilisables dans `glpi-front` pour récupérer :
- les statuts de tickets,
- les types de tickets,
- les priorités,
- les urgences.

Toutes les données doivent provenir de l'API REST GLPI, via le client `glpiApi` déjà présent dans `glpi-front/src/services/glpiApi.js`.

---

## 1. Contexte GLPI

Dans GLPI 11, les tickets sont stockés dans la table `glpi_tickets`.
Les colonnes importantes sont :

- `status` → statut du ticket
- `type` → type du ticket
- `priority` → priorité du ticket
- `urgency` → urgence du ticket

Dans GLPI :

- `status` et `type` sont des codes gérés par le code de GLPI (`glpi/src/Ticket.php`).
- `priority` et `urgency` sont configurables et leurs libellés sont stockés dans `glpi_configs`.

Dans `glpi-front`, on doit donc récupérer les informations via l'API REST plutôt que via un accès SQL direct.

---

## 2. Pré-requis dans glpi-front

Assurez-vous que `glpi-front/src/services/glpiApi.js` contient :

- `getItems(itemtype, params)` pour interroger des objets GLPI,
- `getItem(itemtype, id)` pour charger un objet unique.

Nous utiliserons ces méthodes pour lire les données nécessaires.

---

## 3. Fonction `getTicketStatuses()`

### Objectif
Retourner un objet des statuts de tickets connus par GLPI.

### Stratégie
GLPI ne propose pas d'API REST séparée pour les labels de statut. On lit donc les tickets existants et on mappe les codes de statut connus vers leurs libellés.

### Exemple de fonction JS

```js
import { glpiApi } from '../services/glpiApi.js'

const TICKET_STATUS_LABELS = {
  1: 'New',
  2: 'Processing (assigned)',
  3: 'Processing (planned)',
  4: 'Pending',
  5: 'Solved',
  6: 'Closed',
}

export async function getTicketStatuses() {
  const tickets = await glpiApi.getItems('Ticket', { range: '0-499', only_id: 1 })
  const distinctStatus = Array.from(new Set(tickets.map((ticket) => ticket.status).filter(Boolean)))
  return distinctStatus.sort((a, b) => a - b).reduce((acc, status) => {
    acc[status] = TICKET_STATUS_LABELS[status] ?? `Status ${status}`
    return acc
  }, {})
}
```

### Remarque
Cette fonction suppose que la session GLPI est déjà initialisée et que l'utilisateur dispose des droits nécessaires.

---

## 4. Fonction `getTicketTypes()`

### Objectif
Retourner un objet des types de ticket reconnus par GLPI.

### Stratégie
Les types de ticket sont codés dans GLPI :

- `1` → `Incident`
- `2` → `Request`

On peut récupérer les tickets existants pour déterminer les codes réellement utilisés.

### Exemple de fonction JS

```js
import { glpiApi } from '../services/glpiApi.js'

const TICKET_TYPE_LABELS = {
  1: 'Incident',
  2: 'Request',
}

export async function getTicketTypes() {
  const tickets = await glpiApi.getItems('Ticket', { range: '0-499', only_id: 1 })
  const distinctTypes = Array.from(new Set(tickets.map((ticket) => ticket.type).filter(Boolean)))
  return distinctTypes.sort((a, b) => a - b).reduce((acc, type) => {
    acc[type] = TICKET_TYPE_LABELS[type] ?? `Type ${type}`
    return acc
  }, {})
}
```

---

## 5. Fonction `getTicketPriorities()`

### Objectif
Retourner les labels de priorité configurés dans GLPI.

### Stratégie
On lit l'objet `Config` via l'API REST GLPI. Les libellés de priorité sont stockés dans :

- `priority_1`
- `priority_2`
- `priority_3`
- `priority_4`
- `priority_5`
- `priority_6`

### Exemple de fonction JS

```js
import { glpiApi } from '../services/glpiApi.js'

export async function getTicketPriorities() {
  const config = await glpiApi.getItem('Config', 1)
  return {
    1: config.priority_1 || 'Priority 1',
    2: config.priority_2 || 'Priority 2',
    3: config.priority_3 || 'Priority 3',
    4: config.priority_4 || 'Priority 4',
    5: config.priority_5 || 'Priority 5',
    6: config.priority_6 || 'Priority 6',
  }
}
```

### Remarque
`GET /api/Config/1` doit renvoyer la configuration courante du système GLPI.

---

## 6. Fonction `getTicketUrgencies()`

### Objectif
Retourner les labels d'urgence configurés dans GLPI.

### Stratégie
On lit l'objet `Config` via l'API REST GLPI. Les libellés d'urgence sont stockés dans :

- `urgency_1`
- `urgency_2`
- `urgency_3`
- `urgency_4`
- `urgency_5`

### Exemple de fonction JS

```js
import { glpiApi } from '../services/glpiApi.js'

export async function getTicketUrgencies() {
  const config = await glpiApi.getItem('Config', 1)
  return {
    1: config.urgency_1 || 'Urgency 1',
    2: config.urgency_2 || 'Urgency 2',
    3: config.urgency_3 || 'Urgency 3',
    4: config.urgency_4 || 'Urgency 4',
    5: config.urgency_5 || 'Urgency 5',
  }
}
```

---

## 7. Utilisation dans glpi-front

Ces fonctions peuvent être placées dans un fichier de composables ou de service, par exemple `src/composables/useTicketMetadata.js`.

### Exemple d'usage

```js
import {
  getTicketStatuses,
  getTicketTypes,
  getTicketPriorities,
  getTicketUrgencies,
} from '../composables/useTicketMetadata.js'

async function loadMetadata() {
  const statuses = await getTicketStatuses()
  const types = await getTicketTypes()
  const priorities = await getTicketPriorities()
  const urgencies = await getTicketUrgencies()
  return { statuses, types, priorities, urgencies }
}
```

---

## 8. Remarques importantes

- `status` et `type` sont des codes GLPI et ne sont pas fournis via une table de labels distincte.
- `priority` et `urgency` sont des paramètres configurables et se lisent via `Config`.
- Si l'API `Config/1` n'est pas accessible, vérifiez que la session GLPI est bien initialisée et que l'utilisateur a les droits nécessaires.

---

Ce fichier est désormais un guide pour écrire des fonctions JavaScript utilisables dans `glpi-front` et basées sur l'API REST GLPI.
