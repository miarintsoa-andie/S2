# Relations du Ticket GLPI

Un ticket GLPI est le centre d'un graphe de relations. Ce document couvre toutes les tables liées.

---

## Vue d'ensemble

```
                    ┌──────────────┐
                    │    Ticket    │
                    └──────┬───────┘
          ┌────────────────┼────────────────────────┐
          │                │                        │
   ┌──────┴──────┐  ┌──────┴──────┐   ┌────────────┴──────────┐
   │ Item_Ticket │  │ Ticket_User │   │  TicketFollowup/Task  │
   │(éléments    │  │(acteurs :   │   │  TicketCost           │
   │ liés)       │  │ demandeur,  │   │  TicketValidation     │
   └─────────────┘  │ assigné,    │   └───────────────────────┘
                    │ observateur)│
                    └─────────────┘
```

---

## 1 — `glpi_items_tickets` (Item_Ticket)

Lie un ticket à un ou plusieurs éléments du parc.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int | PK |
| `tickets_id` | int | FK → `glpi_tickets.id` |
| `itemtype` | varchar | Type GLPI : `Computer`, `Monitor`, `NetworkEquipment`… |
| `items_id` | int | ID de l'élément (dans sa table respective) |

**Contrainte :** `UNIQUE KEY (itemtype, items_id, tickets_id)` — un élément ne peut être lié qu'une fois au même ticket.

**Endpoint API :** `POST /api/Item_Ticket`

```http
POST /api/Item_Ticket
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "tickets_id": 42,
    "itemtype": "Computer",
    "items_id": 15
  }
}
```

**Lire les éléments d'un ticket :**
```http
GET /api/Ticket/42/Item_Ticket
Session-Token: <token>
```

**Supprimer l'association :**
```http
DELETE /api/Item_Ticket/7
Session-Token: <token>
```

---

## 2 — `glpi_tickets_users` (Ticket_User)

Lie les acteurs humains au ticket.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int | PK |
| `tickets_id` | int | FK → `glpi_tickets.id` |
| `users_id` | int | FK → `glpi_users.id` |
| `type` | int | Rôle de l'acteur (voir ci-dessous) |
| `use_notification` | tinyint | `1` = recevoir les notifications |
| `alternative_email` | varchar | Email alternatif |

**Types d'acteurs (`type`) :**

| Valeur | Rôle |
|--------|------|
| `1` | Demandeur (requester) |
| `2` | Assigné (technician) |
| `3` | Observateur (watcher) |

**Ajouter un demandeur via l'API :**

```http
POST /api/Ticket_User
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "tickets_id": 42,
    "users_id": 5,
    "type": 1,
    "use_notification": 1
  }
}
```

> **Raccourci à la création :** on peut passer les acteurs directement dans le `POST /api/Ticket` :
> ```json
> {
>   "input": {
>     "name": "Mon ticket",
>     "content": "...",
>     "_users_id_requester": 5,
>     "_users_id_assign": 3
>   }
> }
> ```

---

## 3 — `glpi_ticketfollowups` (ITILFollowup)

Suivis / commentaires ajoutés au ticket.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int | PK |
| `tickets_id` | int | FK → `glpi_tickets.id` |
| `users_id` | int | FK → auteur du suivi |
| `content` | longtext | Texte du commentaire |
| `date` | timestamp | Date du suivi |
| `is_private` | tinyint | `1` = visible techniciens seulement |
| `requesttypes_id` | int | Canal de communication (téléphone, email…) |
| `sourceof_items_id` | int | ID du ticket source si promu depuis un incident |

**Endpoint API :** `POST /api/ITILFollowup`

```http
POST /api/ITILFollowup
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "itemtype": "Ticket",
    "items_id": 42,
    "content": "Le remplacement de l'écran a été commandé.",
    "is_private": 0
  }
}
```

**Lire les suivis d'un ticket :**
```http
GET /api/Ticket/42/ITILFollowup
Session-Token: <token>
```

---

## 4 — `glpi_ticketcosts` (TicketCost)

Coûts financiers associés au ticket.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int | PK |
| `tickets_id` | int | FK → `glpi_tickets.id` |
| `name` | varchar | Libellé du coût |
| `comment` | text | Commentaire |
| `begin_date` | date | Date de début |
| `end_date` | date | Date de fin |
| `actiontime` | int | Durée (secondes) |
| `cost_time` | decimal(20,4) | Coût horaire |
| `cost_fixed` | decimal(20,4) | Coût fixe |
| `cost_material` | decimal(20,4) | Coût matériel |
| `budgets_id` | int | FK → `glpi_budgets` |
| `entities_id` | int | FK → entité |

**Endpoint API :** `POST /api/TicketCost`

```http
POST /api/TicketCost
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "tickets_id": 42,
    "name": "Remplacement écran",
    "cost_fixed": 109.00,
    "cost_time": 8.70,
    "actiontime": 600
  }
}
```

---

## 5 — `glpi_tickettasks` (TicketTask)

Tâches à effectuer dans le cadre du ticket.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int | PK |
| `tickets_id` | int | FK → `glpi_tickets.id` |
| `users_id` | int | FK → technicien assigné |
| `content` | longtext | Description de la tâche |
| `begin` | timestamp | Début planifié |
| `end` | timestamp | Fin planifiée |
| `state` | int | `0`=À faire, `1`=Fait |
| `actiontime` | int | Durée (secondes) |
| `is_private` | tinyint | `1` = privé |

**Endpoint API :** `POST /api/TicketTask`

```http
POST /api/TicketTask
Session-Token: <token>
Content-Type: application/json

{
  "input": {
    "tickets_id": 42,
    "content": "Commander une dalle de remplacement 24\"",
    "state": 0,
    "actiontime": 1800
  }
}
```

---

## 6 — `glpi_ticketvalidations` (TicketValidation)

Demandes de validation (approbation) sur un ticket.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | int | PK |
| `tickets_id` | int | FK → `glpi_tickets.id` |
| `users_id` | int | FK → demandeur de validation |
| `users_id_validate` | int | FK → validateur |
| `comment_submission` | text | Commentaire à la demande |
| `comment_validation` | text | Commentaire à la validation |
| `status` | int | `1`=En attente, `2`=Accepté, `3`=Refusé |
| `submission_date` | timestamp | Date de soumission |
| `validation_date` | timestamp | Date de validation |

---

## Récapitulatif des endpoints de relations

| Relation | Endpoint API | Verbe |
|----------|-------------|-------|
| Associer un élément | `/api/Item_Ticket` | POST |
| Lire éléments d'un ticket | `/api/Ticket/{id}/Item_Ticket` | GET |
| Ajouter un acteur | `/api/Ticket_User` | POST |
| Ajouter un suivi | `/api/ITILFollowup` | POST |
| Lire suivis | `/api/Ticket/{id}/ITILFollowup` | GET |
| Ajouter un coût | `/api/TicketCost` | POST |
| Lire coûts | `/api/Ticket/{id}/TicketCost` | GET |
| Ajouter une tâche | `/api/TicketTask` | POST |
| Lire tâches | `/api/Ticket/{id}/TicketTask` | GET |
| Demander validation | `/api/TicketValidation` | POST |

---

## Droits GLPI nécessaires

| Action | Droit requis |
|--------|-------------|
| Créer/modifier ticket | Assistance > Tickets > Créer/Modifier |
| Lier des éléments | Assistance > Éléments associés > Créer |
| Ajouter un suivi | Assistance > Suivis > Créer |
| Voir suivis privés | Assistance > Suivis > Voir tous |
| Créer un coût | Assistance > Suivi financier > Créer |
| Créer une tâche | Assistance > Tâches > Créer |
| Valider | Assistance > Validation > Créer |
