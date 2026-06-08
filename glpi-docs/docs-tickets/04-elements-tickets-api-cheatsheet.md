# Cheat Sheet API — Éléments & Tickets

Référence rapide pour les opérations courantes depuis `glpiApi.js`.  
Toutes les requêtes passent par le proxy Vite : `/api` → `http://localhost/glpi/apirest.php`.

---

## Authentification (rappel)

```js
// initSession → stocke le session_token en mémoire
await glpiApi.initSession('glpi', 'glpi')

// killSession
await glpiApi.killSession()
```

---

## Tickets

### Lire

```js
// Liste (tri date desc, max 100)
const tickets = await glpiApi.getItems('Ticket', {
  range: '0-99', sort: 'date_creation', order: 'DESC', is_deleted: 0
})

// Un ticket
const ticket = await glpiApi.getItem('Ticket', 42)

// Total sans charger (header Content-Range)
const { total } = await glpiApi.getItemsRaw('Ticket', { range: '0-0', only_id: '1' })
```

### Créer

```js
const created = await glpiApi.createItem('Ticket', {
  name: 'Titre du ticket',
  content: 'Description détaillée',
  type: 1,          // 1=Incident, 2=Demande
  urgency: 3,       // 1→5
  status: 1,        // 1=Nouveau
  date: '2026-06-03 13:45:00',
})
// created.id → ID GLPI du nouveau ticket
```

### Modifier

```js
await glpiApi.patchItem('Ticket', 42, { status: 5 })   // → Résolu
await glpiApi.patchItem('Ticket', 42, { status: 6 })   // → Clos
await glpiApi.patchItem('Ticket', 42, {
  priority: 4,
  urgency: 4,
})
```

### Supprimer

```js
await glpiApi.deleteItem('Ticket', 42)                  // 1 ticket
await glpiApi.deleteItems('Ticket', [42, 43, 44])      // batch
```

---

## Éléments du parc

### Lire

```js
// Tous les ordinateurs
const computers = await glpiApi.getItems('Computer', {
  range: '0-499', sort: 'name', order: 'ASC'
})

// Un moniteur
const monitor = await glpiApi.getItem('Monitor', 8)

// Tous les types en parallèle
const [computers, monitors, switches] = await Promise.all([
  glpiApi.getItems('Computer', { range: '0-499' }),
  glpiApi.getItems('Monitor',  { range: '0-499' }),
  glpiApi.getItems('NetworkEquipment', { range: '0-499' }),
])
```

### Créer un ordinateur

```js
const pc = await glpiApi.createItem('Computer', {
  name: 'PC-ADM-001',
  otherserial: 'ITU-2026-0001',
  states_id: 1,          // ID état "En production"
  locations_id: 3,       // ID localisation "Administration"
  manufacturers_id: 2,   // ID fabricant "Dell"
  computermodels_id: 5,  // ID modèle "OptiPlex 7010"
  users_id_tech: 7,      // ID technicien responsable
})
```

### Créer un moniteur

```js
const mn = await glpiApi.createItem('Monitor', {
  name: 'MN-FORM-002',
  otherserial: 'ITU-2026-0010',
  states_id: 4,          // ID état "En panne"
  locations_id: 8,       // ID localisation "Salle 301"
  manufacturers_id: 2,   // ID fabricant "Dell"
  monitormodels_id: 3,   // ID modèle "AC1000"
  size: 24.00,
  have_hdmi: 1,
})
```

---

## Relations

### Lier un élément à un ticket

```js
await glpiApi.createItem('Item_Ticket', {
  tickets_id: 42,
  itemtype: 'Computer',
  items_id: 15,
})
```

### Ajouter un suivi

```js
await glpiApi.createItem('ITILFollowup', {
  itemtype: 'Ticket',
  items_id: 42,
  content: 'Le remplacement a été commandé.',
  is_private: 0,
})
```

### Ajouter un coût

```js
await glpiApi.createItem('TicketCost', {
  tickets_id: 42,
  name: 'Remplacement écran',
  cost_fixed: 109.00,
  cost_time: 8.70,
  actiontime: 600,  // secondes
})
```

---

## Lookup tables (FK)

### State — Chercher ou créer

```js
import { lookupOrCreate } from '../composables/useGlpiLookup.js'

const stateId = await lookupOrCreate('State', 'En production')
// → retourne l'ID GLPI existant ou crée l'état et retourne son ID
```

### Location

```js
const locationId = await lookupOrCreate('Location', 'Administration')
```

### Manufacturer

```js
const manufacturerId = await lookupOrCreate('Manufacturer', 'Dell')
```

### Model (dépend du type)

```js
const modelId = await lookupOrCreate('ComputerModel', 'OptiPlex 7010')
const monitorModelId = await lookupOrCreate('MonitorModel', 'AC1000')
```

### User (par nom complet)

```js
import { lookupUser } from '../composables/useGlpiLookup.js'

const userId = await lookupUser('Rakoto Jean')
// Cherche un user avec firstname="Rakoto" realname="Jean" (ou l'inverse)
```

---

## Compteurs (pour dashboard)

```js
// Total tickets
const { total: ticketTotal } = await glpiApi.getItemsRaw('Ticket', {
  range: '0-0', only_id: '1', is_deleted: 0
})

// Total ordinateurs
const { total: computerTotal } = await glpiApi.getItemsRaw('Computer', {
  range: '0-0', only_id: '1', is_deleted: 0
})

// Tous les totaux en parallèle
const types = ['Computer', 'Monitor', 'NetworkEquipment', 'Printer', 'Software']
const totals = await Promise.all(
  types.map((t) =>
    glpiApi.getItemsRaw(t, { range: '0-0', only_id: '1', is_deleted: 0 })
      .then(({ total }) => ({ type: t, total }))
      .catch(() => ({ type: t, total: 0, error: true }))
  )
)
```

---

## Statuts — Référence rapide

```js
// Constantes à copier dans tes composants
const TICKET_STATUS = {
  NEW:      1,  // Nouveau
  ASSIGNED: 2,  // En cours (assigné)
  PLANNED:  3,  // En cours (planifié)
  WAITING:  4,  // En attente
  SOLVED:   5,  // Résolu
  CLOSED:   6,  // Clos
}

const TICKET_TYPE = { INCIDENT: 1, REQUEST: 2 }

const URGENCY = {
  VERY_LOW: 1, LOW: 2, MEDIUM: 3, HIGH: 4, VERY_HIGH: 5
}

const PRIORITY = {
  VERY_LOW: 1, LOW: 2, MEDIUM: 3, HIGH: 4, VERY_HIGH: 5, MAJOR: 6
}
```

---

## Erreurs fréquentes

| Erreur API | Cause | Solution |
|------------|-------|----------|
| `["ERROR_GLPI_LOGIN_WITH_CREDENTIALS", "..."]` | Mauvais login/password | Vérifier les credentials dans `.env` |
| `["ERROR_SESSION_TOKEN_INVALID", "..."]` | Session expirée | Rappeler `initSession` |
| `400 Bad Request` | Champ obligatoire manquant (`name`) | Vérifier le payload |
| `403 Forbidden` sur Item_Ticket | Droit "Éléments associés" absent | Setup > Profils > Assistance |
| `403 Forbidden` sur TicketCost | Droit "Suivi financier" absent | Setup > Profils > Assistance |
| `UNIQUE constraint` sur Item_Ticket | Même élément lié deux fois | Vérifier avant de créer l'association |
