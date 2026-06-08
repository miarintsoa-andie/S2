# Modules principaux de GLPI 11.0.7

Cartographie des modules, leur rôle, leur architecture PHP et leur exposition via l'API REST.

> Source : analyse du code source `/var/www/glpi/src/` (625 fichiers PHP).

---

## Architecture générale

```
CommonGLPI                        ← classe racine (rendu HTML, droits)
  └── CommonDBTM                  ← ORM maison (CRUD, recherche, historique)
        ├── CommonITILObject      ← base ITIL (Ticket, Problem, Change)
        ├── CommonDBVisible       ← items avec visibilité (KnowbaseItem)
        ├── LevelAgreement        ← accords de niveau (SLA, OLA)
        └── [85+ classes métier]  ← Computer, User, Contract, Project…
```

Chaque entité GLPI est une sous-classe de `CommonDBTM`. Elle hérite de :
- **CRUD** automatique sur une table MariaDB
- **Historique** des modifications
- **Droits** par profil et entité
- **Recherche** (moteur `SearchEngine`)
- **Notifications** déclenchables sur les événements

---

## 1 — Module ITIL (Help Desk)

### Rôle
Gestion des processus ITIL : incidents, demandes, problèmes, changements.

### Classes principales

| Classe | Table BDD | Description |
|--------|-----------|-------------|
| `Ticket` | `glpi_tickets` | Incidents et demandes de service |
| `Problem` | `glpi_problems` | Problèmes récurrents liés à des incidents |
| `Change` | `glpi_changes` | Demandes de changement |
| `CommonITILObject` | — | Classe abstraite partagée (timeline, SLA, équipe) |

```
CommonDBTM
  └── CommonITILObject  (implements KanbanInterface, TeamworkInterface)
        ├── Ticket      (implements DefaultSearchRequestInterface)
        ├── Problem
        └── Change
```

### Fonctionnement
- **Cycle de vie** : `1` Nouveau → `2` En cours (assigné) → `3` En cours (planifié) → `4` En attente → `5` Résolu → `6` Clos
- **Équipe** : acteurs liés via `Ticket_User`, `Group_Ticket`, `Supplier_Ticket`
- **Timeline** : suivi, tâches, solutions, approbations (`TicketTask`, `TicketValidation`)
- **Templates** : champs pré-remplis, masqués, obligatoires (`TicketTemplate`)
- **SLA/OLA** : délais de résolution calculés automatiquement

### API REST
```
GET    /api/Ticket?range=0-49&sort=id&order=DESC
POST   /api/Ticket          body: { "input": { "name", "content", "type", "urgency" } }
PATCH  /api/Ticket/{id}     body: { "input": { "status": 5 } }
DELETE /api/Ticket/{id}
```
Type `type` : `1` = Incident, `2` = Demande de service.

---

## 2 — Module Parc (Assets)

### Rôle
Inventaire de tous les actifs matériels et logiciels du SI.

### Classes principales

| Classe | Table | Description |
|--------|-------|-------------|
| `Computer` | `glpi_computers` | Postes de travail, serveurs |
| `Monitor` | `glpi_monitors` | Écrans |
| `Printer` | `glpi_printers` | Imprimantes |
| `NetworkEquipment` | `glpi_networkequipments` | Switches, routeurs |
| `Phone` | `glpi_phones` | Téléphones |
| `Peripheral` | `glpi_peripherals` | Périphériques divers |
| `Software` | `glpi_softwares` | Logiciels |
| `SoftwareLicense` | `glpi_softwarelicenses` | Licences logicielles |
| `Rack` | `glpi_racks` | Baies serveur (datacenter) |
| `Appliance` | `glpi_appliances` | Applications métier |
| `Certificate` | `glpi_certificates` | Certificats SSL/TLS |
| `Domain` | `glpi_domains` | Domaines et DNS |
| `Cable` | `glpi_cables` | Câblage réseau |

Toutes étendent `CommonDBTM`.  
`Computer` implémente en plus `AssignableItemInterface`, `DCBreadcrumbInterface`, `StateInterface`.

### Fonctionnement
- **Liaison aux tickets** : `Computer_Item`, `Change_Item` — un ticket peut être lié à un actif
- **Composants** : CPU, RAM, disques, cartes réseau gérés via des tables `*_Item`
- **Réseau** : `NetworkPort` + `NetworkName` + `NetworkAlias` — topologie complète
- **Datacenter** : `Rack` contient des items positionnés par unité (U)
- **Localisation** : `Location` (arborescence) assignée à chaque actif
- **Statuts** : `State` (En stock, En production, En réparation…)

### API REST
```
GET  /api/Computer?range=0-49
GET  /api/Computer/{id}
POST /api/Computer    body: { "input": { "name", "entities_id", "states_id" } }
```

---

## 3 — Module Assets personnalisés (Custom Assets)

### Rôle
Définir ses propres types d'actifs sans modifier le code GLPI (nouveau dans GLPI 10+).

### Classes principales

| Classe | Package | Description |
|--------|---------|-------------|
| `AssetDefinition` | `Glpi\Asset` | Définition d'un type personnalisé |
| `Asset` | `Glpi\Asset` | Instance d'un actif personnalisé |
| `CustomFieldDefinition` | `Glpi\Asset` | Champs additionnels |
| `Capacity` | `Glpi\Asset\Capacity` | Capacités activables (réseau, composants…) |

### Fonctionnement
1. L'admin crée un `AssetDefinition` (ex : "Caméra IP")
2. Des `CustomFieldDefinition` y sont rattachés (numéro de série, résolution…)
3. Des `Capacity` sont activées (possibilité de lier à des tickets, des réseaux…)
4. Les instances apparaissent dans le parc comme n'importe quel actif standard

---

## 4 — Module Utilisateurs et Droits

### Rôle
Gestion des identités, profils, entités, groupes.

### Classes principales

| Classe | Table | Description |
|--------|-------|-------------|
| `User` | `glpi_users` | Utilisateurs |
| `Group` | `glpi_groups` | Groupes |
| `Profile` | `glpi_profiles` | Profils de droits |
| `Entity` | `glpi_entities` | Entités (arborescence organisationnelle) |
| `Auth` | — | Authentification (locale, LDAP, mail) |
| `AuthLDAP` | `glpi_authldaps` | Annuaires LDAP |

### Fonctionnement
- **Entités** : arborescence hiérarchique (siège → filiales → services). Les items sont cloisonnés par entité.
- **Profils** : définissent les droits CRUD par type d'item (lire, créer, modifier, supprimer, purger)
- **Authentification** : locale, LDAP/AD, CAS, SAML (via plugin), OAuth2 (GLPI 11)
- **Délégation** : `Group_User` — un utilisateur peut appartenir à plusieurs groupes

---

## 5 — Module Financier et Contrats

### Rôle
Suivi budgétaire, contrats de maintenance et fournisseurs.

### Classes principales

| Classe | Description |
|--------|-------------|
| `Contract` | Contrats (maintenance, support, leasing) |
| `ContractType` | Types de contrats |
| `Contract_Item` | Liaison contrat ↔ actif |
| `Budget` | Budgets alloués |
| `Supplier` | Fournisseurs |
| `Infocom` | Informations financières d'un actif (prix, amortissement, garantie) |

### Fonctionnement
- Chaque actif peut avoir une `Infocom` (prix d'achat, date d'achat, garantie, amortissement)
- Un `Contract` est lié à des items via `Contract_Item`
- Les alertes d'expiration sont gérées par le `CronTask` d'alerte

---

## 6 — Module SLA / OLA (Accords de Niveau de Service)

### Rôle
Définir et surveiller les délais de résolution et de prise en charge des tickets.

### Classes

| Classe | Description |
|--------|-------------|
| `SLA` | Service Level Agreement (côté utilisateur) |
| `OLA` | Operational Level Agreement (côté équipe interne) |
| `LevelAgreement` | Classe abstraite parente de SLA et OLA |
| `SlaLevel` | Paliers d'escalade du SLA |
| `SlaLevel_Ticket` | Liaison palier ↔ ticket |

### Fonctionnement
- Un SLA définit un **délai de résolution** et un **délai de prise en charge**
- Calendriers de service (`Calendar`) associés pour exclure les week-ends/jours fériés
- Les escalades (`SlaLevel`) déclenchent des actions automatiques (changer la priorité, notifier) si le délai n'est pas respecté
- Le dépassement déclenche des notifications et apparaît dans les tableaux de bord

---

## 7 — Moteur de Recherche

### Rôle
Recherche transversale sur n'importe quel type d'item avec filtres, tri et export.

### Classes

| Classe | Package | Description |
|--------|---------|-------------|
| `SearchEngine` | `Glpi\Search` | Orchestre la recherche |
| `SearchOption` | `Glpi\Search` | Définit un champ recherchable |
| `Provider` | `Glpi\Search\Provider` | Fournisseurs SQL (MySQL) |
| `Output` | `Glpi\Search\Output` | Formats de sortie (HTML, CSV, PDF…) |
| `CriteriaFilter` | `Glpi\Search` | Filtres composables |

### Fonctionnement
- Chaque classe `CommonDBTM` déclare ses `SearchOptions` (colonnes filtrables/triables)
- Les requêtes sont construites dynamiquement en SQL avec jointures automatiques
- **Recherches sauvegardées** (`SavedSearch`) : persistées par utilisateur
- **Export** : CSV, PDF, SysLog

### API REST (recherche avancée)
```
GET /api/Ticket?searchText[name]=réseau&range=0-49
```

---

## 8 — Module Règles (Rules Engine)

### Rôle
Automatiser des actions sur les items selon des critères configurables (sans code).

### Familles de règles

| Classe | Application |
|--------|-------------|
| `RuleTicket` | Attribution automatique des tickets (groupe, technicien, catégorie) |
| `RuleProblem` | Attribution des problèmes |
| `RuleChange` | Attribution des changements |
| `RuleAsset` | Classification des actifs à l'import |
| `RuleImportAsset` | Dédoublonnage à l'inventaire |
| `RuleImportEntity` | Affectation d'entité à l'inventaire |
| `RuleDictionnarySoftware` | Normalisation des noms de logiciels |
| `RuleMailCollector` | Traitement des e-mails entrants |
| `RuleRight` | Attribution de profils aux utilisateurs |

### Fonctionnement
1. Chaque règle contient des **critères** (`RuleCriteria`) et des **actions** (`RuleAction`)
2. Les critères évaluent des champs de l'item entrant (sujet, expéditeur, type…)
3. Les actions modifient l'item (affecter un groupe, changer la catégorie, ignorer…)
4. Les règles sont évaluées dans l'ordre de priorité ; on peut s'arrêter à la première règle correspondante

---

## 9 — Module Inventaire (Agent GLPI)

### Rôle
Collecte automatisée de l'inventaire depuis les postes via l'agent GLPI (remplace FusionInventory).

### Classes

| Classe | Package | Description |
|--------|---------|-------------|
| `Inventory` | `Glpi\Inventory` | Orchestrateur principal |
| `Agent` | `src/Agent.php` | Représente un agent enregistré |
| `MainAsset` | `Glpi\Inventory\MainAsset` | Traitement de l'asset principal |
| `Asset/*` | `Glpi\Inventory\Asset` | Sous-composants (CPU, réseau, logiciels…) |
| `RuleImportAsset` | — | Dédoublonnage et affectation d'entité |
| `Conf` | `Glpi\Inventory` | Configuration de l'inventaire |

### Fonctionnement
1. L'agent GLPI tourne sur le poste client et collecte : matériel, logiciels, réseau, utilisateurs connectés
2. Il envoie un rapport JSON compressé au serveur via `POST /api.php/v1/inventory`
3. GLPI applique les `RuleImportAsset` : dédoublonnage par numéro de série / MAC
4. L'item existant est mis à jour ou un nouveau `Computer` est créé
5. Les écarts sont visibles dans l'onglet "Inventaire" de chaque actif

---

## 10 — Module Notifications

### Rôle
Envoi d'alertes par e-mail ou notification AJAX sur les événements GLPI.

### Classes

| Classe | Description |
|--------|-------------|
| `Notification` | Règle de notification (événement → destinataires → gabarit) |
| `NotificationTemplate` | Gabarit avec variables (Twig-like) |
| `NotificationEvent` | Déclencheur d'événement |
| `NotificationTargetTicket` | Destinataires pour les tickets |
| `NotificationTargetChange` | Destinataires pour les changements |
| `NotificationMailing` | Transport e-mail |
| `NotificationAjax` | Transport notification in-app |

### Fonctionnement
- Les événements déclencheurs : création, modification, résolution, relance, escalade SLA…
- Les destinataires : rédacteur, technicien assigné, groupe, observateur, utilisateur du ticket
- Les gabarits utilisent des variables (`##ticket.title##`, `##user.name##`…)
- L'envoi se fait via la file CRON (`QueuedNotification`)

---

## 11 — Module Base de Connaissance

### Rôle
Wiki interne : articles, catégories, visibilité par profil/groupe/entité.

### Classes

| Classe | Description |
|--------|-------------|
| `KnowbaseItem` | Article (extends `CommonDBVisible`) |
| `KnowbaseItemCategory` | Catégories arborescentes |
| `KnowbaseItem_Comment` | Commentaires sur les articles |
| `KnowbaseItem_Revision` | Historique des révisions |
| `Entity_KnowbaseItem` | Restriction par entité |
| `Group_KnowbaseItem` | Restriction par groupe |

### Fonctionnement
- Visibilité fine : public, privé, par entité, par groupe, par profil
- Liée aux tickets : un article peut être suggéré ou attaché lors de la résolution
- Accessible depuis le portail self-service

---

## 12 — Module Projets

### Rôle
Gestion de projets et tâches de projet avec suivi d'avancement et Kanban.

### Classes

| Classe | Description |
|--------|-------------|
| `Project` | Projet (implements `KanbanInterface`) |
| `ProjectTask` | Tâche de projet |
| `ProjectTeam` | Équipe projet |
| `ProjectCost` | Coûts associés |
| `ProjectTask_Ticket` | Liaison tâche ↔ ticket |
| `ProjectState` | États personnalisables |

### Fonctionnement
- Vue Kanban disponible par état
- Tâches avec durée, dates, assignation, avancement (%)
- Les tickets peuvent être liés à des tâches de projet

---

## 13 — Tableaux de Bord (Dashboard)

### Rôle
Tableaux de bord configurables avec widgets temps réel.

### Classes

| Classe | Package | Description |
|--------|---------|-------------|
| `Dashboard` | `Glpi\Dashboard` | Configuration d'un tableau de bord |
| `Grid` | `Glpi\Dashboard` | Grille de disposition des widgets |
| `Widget` | `Glpi\Dashboard` | Rendu d'un widget |
| `Provider` | `Glpi\Dashboard` | Source de données d'un widget |
| `Filter` | `Glpi\Dashboard` | Filtres interactifs |

### Widgets disponibles
Compteurs, barres, courbes, camemberts, listes de tickets, flux RSS, calendrier, carte géographique.

### API REST
```
GET /api.php/v2.3/Dashboard
```

---

## 14 — Constructeur de Formulaires (Form Builder)

### Rôle
Créer des formulaires de saisie pour le portail self-service (nouveau dans GLPI 10.1+).

### Classes principales

| Classe | Package | Description |
|--------|---------|-------------|
| `Form` | `Glpi\Form` | Définition du formulaire |
| `Question` | `Glpi\Form` | Question du formulaire |
| `QuestionType` | `Glpi\Form\QuestionType` | Types : texte, liste, date, fichier… |
| `Answer` | `Glpi\Form` | Réponse d'un utilisateur |
| `AnswersSet` | `Glpi\Form` | Ensemble de réponses (soumission) |
| `FormDestination` | `Glpi\Form\Destination` | Cible : crée un ticket/problème/changement |
| `AccessControl` | `Glpi\Form\AccessControl` | Contrôle d'accès au formulaire |

### Fonctionnement
1. L'admin conçoit un formulaire (questions, validations, conditions d'affichage)
2. Les utilisateurs le remplissent via le portail self-service
3. Une soumission déclenche une `FormDestination` qui crée automatiquement un Ticket/Problem/Change avec les champs pré-remplis
4. Les `AccessControl` limitent l'accès par profil, groupe ou entité

---

## 15 — API REST (double version)

### v1 — API Héritée
- **Point d'entrée** : `http://glpi.localhost/apirest.php`
- **Auth** : Basic Auth ou `user_token` → `session_token`
- **Usage** : tous les `itemtype` CRUD standard
- **Documentation** : `GET /apirest.php`

### v2.3 — API Haut Niveau (moderne)
- **Point d'entrée** : `http://glpi.localhost/api.php/v2.3/`
- **Auth** : OAuth 2.0 (scopes : `api`, `user`, `email`, `graphql`, `inventory`)
- **Documentation Swagger** : `GET /api.php/v2.3/doc`
- **GraphQL** : `POST /api.php/v2.3/GraphQL`

| Contrôleur HL | Ressources exposées |
|---------------|---------------------|
| `ITILController` | Tickets, Problems, Changes |
| `AssetController` | Computer, Monitor, Printer, NetworkEquipment… |
| `CustomAssetController` | Assets personnalisés |
| `ComponentController` | Composants des assets |
| `ManagementController` | Contracts, Suppliers |
| `ProjectController` | Projects, ProjectTasks |
| `AdministrationController` | Users, Groups, Entities, Profiles |
| `DropdownController` | Listes de référence (types, catégories…) |
| `DashboardController` | Tableaux de bord |
| `KnowbaseController` | Base de connaissance |
| `NotificationController` | Notifications |
| `InventoryController` | Inventaire agent |
| `ReportController` | Rapports |
| `GraphQLController` | Interface GraphQL |

---

## 16 — Système de Plugins / Marketplace

### Rôle
Étendre GLPI sans modifier le cœur.

### Classes

| Classe | Description |
|--------|-------------|
| `Plugin` | Gestion du cycle de vie des plugins |
| `Glpi\Marketplace\*` | Interface marketplace intégrée |

### Fonctionnement
- Les plugins sont des dossiers dans `/var/www/glpi/plugins/`
- Chaque plugin expose des hooks (`GLPI_HOOK_*`) pour s'injecter dans le cœur
- Le Marketplace GLPI permet d'installer/mettre à jour les plugins depuis l'interface
- Plugins courants : Formcreator, OCS Inventory, Reports, Behaviors, Data Injection

---

## Résumé — Hiérarchie des modules

```
GLPI 11.0.7
├── Help Desk (ITIL)
│   ├── Tickets (Incidents & Demandes)
│   ├── Problèmes
│   ├── Changements
│   └── SLA / OLA
├── Parc (Assets)
│   ├── Matériel (Computer, Monitor, Printer, Network…)
│   ├── Logiciels & Licences
│   ├── Datacenter (Racks, PDUs)
│   └── Assets personnalisés
├── Gestion
│   ├── Contrats & Budget
│   ├── Fournisseurs
│   └── Projets
├── Administration
│   ├── Utilisateurs, Groupes, Profils
│   ├── Entités
│   └── Règles (attribution, dictionnaires)
├── Self-Service
│   ├── Portail utilisateur
│   ├── Formulaires (Form Builder)
│   └── Base de connaissance
├── Automatisation
│   ├── Notifications
│   ├── Règles métier
│   ├── Tâches CRON
│   └── Inventaire automatique (Agent GLPI)
└── API
    ├── REST v1 (apirest.php) — tous les itemtypes
    └── REST v2.3 (api.php)  — contrôleurs HL + GraphQL + OAuth2
```
