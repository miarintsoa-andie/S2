# Modèle de données — Éléments du parc GLPI

Source : schéma SQL GLPI 11.0.7 (`glpi_computers`, `glpi_monitors`, tables lookup).

---

## Types d'éléments disponibles

| `itemtype` | Table BDD | Endpoint API |
|------------|-----------|-------------|
| `Computer` | `glpi_computers` | `/api/Computer` |
| `Monitor` | `glpi_monitors` | `/api/Monitor` |
| `NetworkEquipment` | `glpi_networkequipments` | `/api/NetworkEquipment` |
| `Printer` | `glpi_printers` | `/api/Printer` |
| `Phone` | `glpi_phones` | `/api/Phone` |
| `Peripheral` | `glpi_peripherals` | `/api/Peripheral` |
| `Software` | `glpi_softwares` | `/api/Software` |
| `Rack` | `glpi_racks` | `/api/Rack` |
| `Appliance` | `glpi_appliances` | `/api/Appliance` |

---

## Champs communs à tous les éléments

Ces champs existent sur **tous** les types d'assets :

| Champ | Type SQL | Description |
|-------|----------|-------------|
| `id` | int | Identifiant GLPI |
| `name` | varchar(255) | **Nom** (obligatoire) |
| `serial` | varchar(255) | Numéro de série |
| `otherserial` | varchar(255) | Numéro d'inventaire interne |
| `contact` | varchar(255) | Nom du contact principal |
| `contact_num` | varchar(255) | Téléphone du contact |
| `comment` | text | Commentaire libre |
| `date_creation` | timestamp | Date de création (auto) |
| `date_mod` | timestamp | Dernière modification |
| `entities_id` | int | FK → `glpi_entities` |
| `locations_id` | int | FK → `glpi_locations` |
| `manufacturers_id` | int | FK → `glpi_manufacturers` |
| `states_id` | int | FK → `glpi_states` (état : en prod, panne…) |
| `users_id` | int | FK → `glpi_users` (utilisateur) |
| `users_id_tech` | int | FK → `glpi_users` (technicien responsable) |
| `is_deleted` | tinyint | `1` = en corbeille |
| `is_template` | tinyint | `1` = gabarit |

---

## `glpi_computers` — Champs spécifiques

| Champ | Type SQL | Description |
|-------|----------|-------------|
| `computermodels_id` | int | FK → `glpi_computermodels` |
| `computertypes_id` | int | FK → `glpi_computertypes` (Desktop, Laptop…) |
| `networks_id` | int | FK → `glpi_networks` (réseau d'appartenance) |
| `uuid` | varchar(255) | UUID matériel |
| `autoupdatesystems_id` | int | FK → système d'inventaire automatique |
| `is_dynamic` | tinyint | `1` = géré par agent d'inventaire |
| `ticket_tco` | decimal(20,4) | TCO (coût total de possession) calculé |
| `last_inventory_update` | timestamp | Dernier inventaire agent |
| `last_boot` | timestamp | Dernier démarrage |

---

## `glpi_monitors` — Champs spécifiques

| Champ | Type SQL | Description |
|-------|----------|-------------|
| `monitormodels_id` | int | FK → `glpi_monitormodels` |
| `monitortypes_id` | int | FK → `glpi_monitortypes` |
| `size` | decimal(5,2) | Taille en pouces |
| `have_micro` | tinyint | `1` = microphone intégré |
| `have_speaker` | tinyint | `1` = haut-parleurs intégrés |
| `have_hdmi` | tinyint | `1` = port HDMI |
| `have_displayport` | tinyint | `1` = port DisplayPort |
| `have_dvi` | tinyint | `1` = port DVI |
| `have_pivot` | tinyint | `1` = pivotable |
| `is_global` | tinyint | `1` = non assigné à un utilisateur unique |

---

## Tables de lookup (FK)

Ces tables sont référencées par `states_id`, `locations_id`, `manufacturers_id`, etc.  
Elles se gèrent via l'API exactement comme les autres items.

### `glpi_states` — États

| Champ | Description |
|-------|-------------|
| `id` | PK |
| `name` | Nom de l'état (ex: "En production", "En panne") |
| `states_id` | FK → état parent (hiérarchique) |
| `is_helpdesk_visible` | `1` = visible dans le helpdesk |

**API :**
```http
GET  /api/State
POST /api/State   body: { "input": { "name": "En production" } }
```

**États courants à créer pour le projet :**
```json
["En production", "Maintenance", "En panne", "En stock"]
```

---

### `glpi_locations` — Localisations

| Champ | Description |
|-------|-------------|
| `id` | PK |
| `name` | Nom court (ex: "Administration") |
| `completename` | Chemin complet (ex: "Bâtiment A > RDC > Administration") |
| `locations_id` | FK → localisation parente (hiérarchique) |
| `code` | Code interne |
| `building` | Bâtiment |
| `room` | Salle |
| `address` | Adresse |

**API :**
```http
GET  /api/Location
GET  /api/Location?searchText=Administration
POST /api/Location   body: { "input": { "name": "Administration" } }
```

---

### `glpi_manufacturers` — Fabricants

| Champ | Description |
|-------|-------------|
| `id` | PK |
| `name` | Nom (ex: "Dell", "HP", "Lenovo") |

**API :**
```http
GET  /api/Manufacturer?searchText=Dell
POST /api/Manufacturer   body: { "input": { "name": "Dell" } }
```

---

### `glpi_computermodels` / `glpi_monitormodels` — Modèles

Chaque type d'asset a sa propre table de modèles :

| Type | Table | Champ FK |
|------|-------|---------|
| Computer | `glpi_computermodels` | `computermodels_id` |
| Monitor | `glpi_monitormodels` | `monitormodels_id` |
| NetworkEquipment | `glpi_networkequipmentmodels` | `networkequipmentmodels_id` |
| Printer | `glpi_printermodels` | `printermodels_id` |
| Phone | `glpi_phonemodels` | `phonemodels_id` |

**API (exemple Computer) :**
```http
GET  /api/ComputerModel?searchText=OptiPlex
POST /api/ComputerModel   body: { "input": { "name": "OptiPlex 7010" } }
```

---

## Payloads API — Exemples

### Créer un ordinateur

```http
POST /api/Computer
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "name": "PC-ADM-001",
    "serial": "SRV2026X01",
    "otherserial": "ITU-2026-0001",
    "states_id": 1,
    "locations_id": 3,
    "manufacturers_id": 2,
    "computermodels_id": 5,
    "users_id_tech": 7,
    "comment": "Poste Administration — Rakoto Jean"
  }
}
```

**Réponse 201 :**
```json
{ "id": 15, "message": "Item successfully added: PC-ADM-001" }
```

---

### Créer un moniteur

```http
POST /api/Monitor
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "name": "MN-FORM-002",
    "serial": "MON2026X10",
    "otherserial": "ITU-2026-0010",
    "states_id": 4,
    "locations_id": 8,
    "manufacturers_id": 2,
    "monitormodels_id": 3,
    "size": 24.00,
    "have_hdmi": 1,
    "have_displayport": 1
  }
}
```

---

### Lister les ordinateurs avec filtres

```http
GET /api/Computer?range=0-49&sort=name&order=ASC&is_deleted=0
Session-Token: <token>
```

**Filtrer par localisation :**
```http
GET /api/Computer?criteria[0][field]=3&criteria[0][searchtype]=equals&criteria[0][value]=3
```
(`field=3` = locations_id dans le moteur de recherche GLPI)

---

### Modifier l'état d'un élément

```http
PATCH /api/Computer/15
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "states_id": 2
  }
}
```

---

## Champs calculés / en lecture seule

| Champ | Renseigné par |
|-------|--------------|
| `date_creation` | GLPI à la création |
| `date_mod` | GLPI à chaque modification |
| `ticket_tco` | Calculé par GLPI depuis les coûts tickets |
| `last_inventory_update` | Agent d'inventaire (GLPI Agent) |
| `is_dynamic` | Agent d'inventaire |

---

## Droits GLPI nécessaires

| Action | Droit requis |
|--------|-------------|
| Lire les assets | Parc > {type} > Voir |
| Créer | Parc > {type} > Créer |
| Modifier | Parc > {type} > Modifier |
| Supprimer | Parc > {type} > Supprimer |
| Créer State / Location / Manufacturer | Configuration > Listes déroulantes > Modifier |
