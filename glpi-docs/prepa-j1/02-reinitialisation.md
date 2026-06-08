# Module 2 — Page Réinitialisation des données

> **Attendu :** Page backoffice avec bouton pour réinitialiser les données.  
> **Statut glpi-front :** ✅ Déjà implémenté — rien à créer.

---

## Ce qui est déjà en place

La page de réinitialisation est complète dans `glpi-front` :

| Fichier | Rôle |
|---------|------|
| `src/views/ReinitialisationView.vue` | Vue principale |
| `src/components/Reinitialisation/ResetPanel.vue` | Sélection type, liste items, bouton supprimer |
| `src/components/Reinitialisation/ResetConfirm.vue` | Modale de confirmation |
| `src/components/Reinitialisation/ResetResult.vue` | Résumé succès/échecs |
| `src/composables/useReinit.js` | Logique chargement + suppression batch |

Route : `/reinitialisation` (protégée, meta `backoffice: true`)

---

## Fonctionnalités disponibles

```
┌──────────────────────────────────────────────────────────┐
│  Réinitialisation de données                             │
│                                                          │
│  Type d'objet : [ Tickets ▼ ]                            │
│                                                          │
│  ☑ Tout sélectionner (3 éléments)                        │
│  ☑ [42] Problème réseau bureau 3                         │
│  ☑ [43] Écran cassé                                      │
│  ☐ [44] Demande logiciel                                 │
│                                                          │
│  [ Supprimer 2 élément(s) ]                              │
│                                                          │
│  Confirmation → modale → résumé succès/échecs            │
└──────────────────────────────────────────────────────────┘
```

- Sélection par type (Ticket, Computer, Document, Software, Contract, Problem, Change)
- Case "Tout sélectionner"
- Suppression batch (`DELETE /api/{type}` avec tableau d'IDs)
- Modale de confirmation avant suppression
- Résumé des résultats (succès / échecs)
- Chaque suppression loggée dans Spring Boot (`/spring/logs`)

---

## Seule action requise

S'assurer que la route est bien marquée `meta: { backoffice: true }` dans le router  
(voir [`01-auth-backoffice.md`](./01-auth-backoffice.md) section "Étape 4").

```js
{
  path: '/reinitialisation',
  component: () => import('../views/ReinitialisationView.vue'),
  meta: { backoffice: true },
},
```

---

## Extension optionnelle — "Tout réinitialiser" en un clic

Ajouter un bouton "Réinitialiser toutes les données" qui déclenche `deleteAll` du composable
en boucle sur tous les types définis :

```js
const ALL_TYPES = ['Ticket', 'Computer', 'Monitor', 'NetworkEquipment', 'Software', 'Document']

async function resetAllTypes() {
  for (const type of ALL_TYPES) {
    await deleteAll(type)
  }
}
```
