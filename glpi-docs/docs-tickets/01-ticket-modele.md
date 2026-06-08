# Modèle de données — Ticket GLPI

Source : schéma SQL `glpi_tickets` (GLPI 11.0.7)

---

## Table `glpi_tickets`

### Champs principaux (utilisables en API)

| Champ | Type SQL | Défaut | Description |
|-------|----------|--------|-------------|
| `id` | int unsigned | AUTO | Identifiant GLPI |
| `name` | varchar(255) | NULL | **Titre du ticket** (obligatoire à la création) |
| `content` | longtext | NULL | **Description** / corps du ticket |
| `type` | int | `1` | Type : `1`=Incident, `2`=Demande |
| `status` | int | `1` | Statut (voir énumération ci-dessous) |
| `urgency` | int | `1` | Urgence `1`→`5` |
| `impact` | int | `1` | Impact `1`→`5` |
| `priority` | int | `1` | Priorité `1`→`6` (calculée ou manuelle) |
| `date` | timestamp | NULL | Date d'ouverture |
| `date_creation` | timestamp | NULL | Date de création (auto) |
| `closedate` | timestamp | NULL | Date de clôture |
| `solvedate` | timestamp | NULL | Date de résolution |
| `entities_id` | int unsigned | `0` | Entité GLPI (organisation) |
| `locations_id` | int unsigned | `0` | FK → `glpi_locations` |
| `itilcategories_id` | int unsigned | `0` | FK → `glpi_itilcategories` |
| `requesttypes_id` | int unsigned | `0` | FK → `glpi_requesttypes` (téléphone, courriel…) |
| `users_id_recipient` | int unsigned | `0` | FK → `glpi_users` (demandeur) |
| `users_id_lastupdater` | int unsigned | `0` | FK → `glpi_users` (dernier modificateur) |
| `slas_id_ttr` | int unsigned | `0` | FK → SLA délai de résolution |
| `slas_id_tto` | int unsigned | `0` | FK → SLA délai de prise en charge |
| `time_to_resolve` | timestamp | NULL | Échéance résolution (calculée par SLA) |
| `time_to_own` | timestamp | NULL | Échéance prise en charge (calculée par SLA) |
| `actiontime` | int | `0` | Temps passé total (secondes) |
| `waiting_duration` | int | `0` | Durée d'attente cumulée (secondes) |
| `is_deleted` | tinyint | `0` | `1` = ticket en corbeille |
| `externalid` | varchar(255) | NULL | ID externe (import, intégration tiers) |

---

## Énumérations

### `status` — Statut du ticket

| Valeur | Constante PHP | Label |
|--------|--------------|-------|
| `1` | `Ticket::INCOMING` | Nouveau |
| `2` | `Ticket::ASSIGNED` | En cours (assigné) |
| `3` | `Ticket::PLANNED` | En cours (planifié) |
| `4` | `Ticket::WAITING` | En attente |
| `5` | `Ticket::SOLVED` | Résolu |
| `6` | `Ticket::CLOSED` | Clos |

### `type` — Type de ticket

| Valeur | Label |
|--------|-------|
| `1` | Incident |
| `2` | Demande |

### `urgency` / `impact` — Urgence et impact

| Valeur | Label |
|--------|-------|
| `1` | Très basse |
| `2` | Basse |
| `3` | Moyenne |
| `4` | Haute |
| `5` | Très haute |

### `priority` — Priorité

| Valeur | Label |
|--------|-------|
| `1` | Très basse |
| `2` | Basse |
| `3` | Moyenne |
| `4` | Haute |
| `5` | Très haute |
| `6` | Majeure |

> La priorité peut être calculée automatiquement par GLPI selon urgence × impact,
> ou définie manuellement si la configuration le permet.

---

## Cycle de vie (statuts)

```
          ┌──────────────────────────────────────────────────┐
          │                                                  │
 Création → [1] Nouveau → [2] Assigné → [3] Planifié → [4] En attente
                                   │                         │
                                   └──────────┬──────────────┘
                                              ↓
                                        [5] Résolu
                                              ↓
                                         [6] Clos
```

- Un ticket **Résolu** peut être **réouvert** → retour en Nouveau (si l'utilisateur refuse la solution)
- Un ticket **Clos** ne peut plus être modifié (selon configuration)
- La date `solvedate` est renseignée au passage en statut 5
- La date `closedate` est renseignée au passage en statut 6

---

## Payload API — Exemples

### Créer un ticket (POST)

```http
POST /api/Ticket
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "name": "Écran cassé bureau 3A",
    "content": "La dalle du moniteur est brisée suite à une chute.",
    "type": 1,
    "urgency": 4,
    "impact": 3,
    "status": 1,
    "itilcategories_id": 0,
    "date": "2026-06-03 13:45:00"
  }
}
```

**Réponse 201 :**
```json
{ "id": 42, "message": "Item successfully added: Écran cassé bureau 3A" }
```

### Modifier le statut (PATCH)

```http
PATCH /api/Ticket/42
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "status": 5,
    "solvedate": "2026-06-05 10:00:00"
  }
}
```

### Lire un ticket avec tous ses champs (GET)

```http
GET /api/Ticket/42
Session-Token: <token>
```

**Réponse 200 :**
```json
{
  "id": 42,
  "name": "Écran cassé bureau 3A",
  "content": "La dalle du moniteur est brisée...",
  "status": 1,
  "type": 1,
  "urgency": 4,
  "impact": 3,
  "priority": 4,
  "date": "2026-06-03 13:45:00",
  "date_creation": "2026-06-03 13:45:00",
  "closedate": null,
  "solvedate": null,
  "entities_id": 0,
  "locations_id": 0,
  "itilcategories_id": 0,
  "is_deleted": 0
}
```

### Lister avec filtre statut (GET)

```http
GET /api/Ticket?range=0-49&sort=date_creation&order=DESC&is_deleted=0
Session-Token: <token>
```

> Pour filtrer par statut, utiliser les critères de recherche GLPI :
> ```
> GET /api/Ticket?criteria[0][field]=12&criteria[0][searchtype]=equals&criteria[0][value]=1
> ```
> (`field=12` = statut dans le moteur de recherche GLPI)

---

## Champs en lecture seule (calculés)

Ces champs sont renseignés automatiquement par GLPI et **ne doivent pas être envoyés en POST/PATCH** :

| Champ | Renseigné quand |
|-------|----------------|
| `date_creation` | À la création |
| `closedate` | Passage en statut 6 |
| `solvedate` | Passage en statut 5 |
| `takeintoaccountdate` | Premier suivi ajouté |
| `actiontime` | Calculé depuis les tâches |
| `waiting_duration` | Calculé depuis les périodes d'attente |
| `close_delay_stat` | Statistique délai clôture |
| `solve_delay_stat` | Statistique délai résolution |
