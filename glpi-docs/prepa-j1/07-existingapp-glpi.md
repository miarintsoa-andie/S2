# Module 7 — ExistingApp : GLPI backoffice natif

> **Attendu :**  
> 1. Toutes les données importées sont visibles dans le backoffice GLPI.  
> 2. Les modifications faites dans GLPI impactent la NewAPP.

---

## Partie A — Vérifier la visibilité des données importées dans GLPI

### Données à vérifier après l'import

| Type importé | Où le voir dans GLPI |
|--------------|---------------------|
| Tickets (CSV) | Assistance > Tickets |
| Ordinateurs (CSV) | Parc > Ordinateurs |
| Équipements réseau (CSV) | Parc > Réseaux |
| Images (ZIP → Documents) | Gestion > Documents |

### Checklist de vérification dans GLPI

1. Se connecter à `http://localhost/glpi` (ou `http://glpi.localhost`) avec `glpi/glpi`
2. **Tickets** → Assistance > Tickets → vérifier le nombre et les titres correspondent aux CSV
3. **Ordinateurs** → Parc > Ordinateurs → vérifier les noms et numéros de série
4. **Réseau** → Parc > Équipements réseau → vérifier les items importés
5. **Documents** → Gestion > Documents → vérifier que les images du ZIP sont présentes

### Si un type n'apparaît pas dans GLPI

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| 0 items après import | Droits CREATE manquants | Setup > Profils > cocher CREATE sur le type concerné |
| Erreur 400 lors du POST | Champ obligatoire manquant dans le CSV | Vérifier le mapping et ajouter le champ `name` si absent |
| Items créés sans nom | Mauvais mapping CSV→GLPI | Corriger le mapping dans `ImportView.vue` |
| Documents invisibles | Profil sans droit sur Documents | Activer les droits Documents dans le profil GLPI |

---

## Partie B — Synchronisation GLPI → NewAPP

### Principe

La NewAPP **lit directement l'API GLPI** à chaque affichage — il n'y a pas de cache local pour les données GLPI.  
Toute modification faite dans GLPI (changement de nom, statut, suppression) est donc **automatiquement reflétée** dans la NewAPP au prochain chargement de la page ou au prochain rafraîchissement.

```
┌─────────────────────────────────────────────────────┐
│  GLPI (backoffice natif)                            │
│  Modification d'un ticket : status → "Résolu"       │
└───────────────┬─────────────────────────────────────┘
                │  Données stockées dans la base MySQL de GLPI
                ▼
┌─────────────────────────────────────────────────────┐
│  GLPI REST API  (/apirest.php)                       │
│  GET /Ticket/{id} → retourne le nouveau statut      │
└───────────────┬─────────────────────────────────────┘
                │  Appel fetch() depuis la NewAPP
                ▼
┌─────────────────────────────────────────────────────┐
│  NewAPP (glpi-front)                                │
│  TicketsView, ElementsView, Dashboard               │
│  Affichent toujours les données en temps réel       │
└─────────────────────────────────────────────────────┘
```

### Cas de test à valider

| Action dans GLPI | Impact attendu dans NewAPP |
|------------------|---------------------------|
| Créer un ticket | Apparaît dans Tickets après rafraîchissement |
| Modifier le statut d'un ticket (ex: Résolu) | Badge "Résolu" dans la liste tickets |
| Renommer un ordinateur | Nouveau nom dans la liste éléments |
| Supprimer un item | Disparaît de la liste |
| Ajouter un document à un item | Visible dans la fiche détail |

### Test end-to-end recommandé

```
1. Ouvrir GLPI : http://localhost/glpi
   → Créer manuellement un ticket test "TEST-SYNC-001"

2. Ouvrir la NewAPP : http://localhost:5173/tickets
   → Cliquer "Rafraîchir"
   → Vérifier que "TEST-SYNC-001" apparaît

3. Dans GLPI, passer le ticket en statut "Résolu"

4. Dans la NewAPP, rafraîchir
   → Vérifier le badge "Résolu"

5. Dans GLPI, supprimer le ticket

6. Dans la NewAPP, rafraîchir
   → Vérifier que le ticket a disparu
```

---

## Partie C — Droits GLPI recommandés pour la NewAPP

Le profil utilisé par la NewAPP (`glpi/glpi` par défaut) doit avoir les droits suivants.

### Droits minimum requis

| Section GLPI | Droits nécessaires |
|--------------|-------------------|
| Assistance > Tickets | Voir, Créer, Modifier, Supprimer |
| Parc > Ordinateurs | Voir |
| Parc > Moniteurs | Voir |
| Parc > Réseaux | Voir |
| Parc > Logiciels | Voir |
| Parc > Imprimantes | Voir |
| Gestion > Documents | Voir, Créer |
| Assistance > Éléments associés | Créer (pour `Item_Ticket`) |

### Comment configurer

1. Dans GLPI → **Setup > Profils**
2. Sélectionner le profil associé à l'utilisateur `glpi`
3. Onglet **Assistance** : activer Voir / Créer / Modifier / Supprimer sur Tickets
4. Onglet **Parc** : activer Voir sur chaque type d'asset
5. Sauvegarder

---

## Partie D — Variables d'environnement à configurer

Fichier `.env` à la racine de `glpi-front` :

```
# Credentials GLPI (utilisés par la NewAPP pour initSession)
VITE_GLPI_LOGIN=glpi
VITE_GLPI_PASSWORD=glpi

# Code d'accès backoffice
VITE_BACKOFFICE_CODE=admin2026
```

> Adapter `VITE_GLPI_LOGIN` et `VITE_GLPI_PASSWORD` si l'instance GLPI utilise
> un utilisateur dédié à l'API (recommandé en production).

---

## Partie E — Points d'attention sur les données importées

### Structure des tickets CSV

Les tickets créés via l'API GLPI ont `status=1` (Nouveau) par défaut si le champ n'est pas mappé.
Pour importer des tickets avec un statut spécifique, inclure le champ `status` dans le mapping :

```js
mapping: { titre: 'name', description: 'content', urgence: 'urgency', statut: 'status' }
```

Valeurs de statut : 1=Nouveau, 2=Assigné, 3=Planifié, 4=En attente, 5=Résolu, 6=Clos

### Structure des assets CSV

Les assets nécessitent au minimum le champ `name`.  
Les champs optionnels utiles :

| Champ GLPI | Description |
|------------|-------------|
| `name` | Nom de l'item (obligatoire) |
| `serial` | Numéro de série |
| `otherserial` | Numéro d'inventaire |
| `comment` | Commentaire |
| `locations_id` | ID de la localisation (doit exister dans GLPI) |
| `states_id` | ID de l'état (0=En service par défaut) |

### Récupérer les IDs de localisations existantes dans GLPI

```bash
curl -s "http://localhost/glpi/apirest.php/Location?range=0-99" \
  -H "Session-Token: $TOKEN" | python3 -m json.tool
```
