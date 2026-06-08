# Challenge 06 — Actions en masse sur des items

**Difficulté : ⭐⭐⭐⭐⭐ Difficile**  
**Durée estimée : 4 h**

---

## Objectif

Créer un module permettant de sélectionner plusieurs items GLPI depuis un tableau et d'appliquer des actions en masse : modifier un champ sur tous les items sélectionnés (`PATCH`), transférer vers une autre entité, ou clore des tickets. Toutes les opérations doivent être traçables et annulables (dans la session).

---

## Résultat attendu

```
Type : [ Ticket ▾ ]    [ Statut : En cours ▾ ]

☐ Tout sélectionner
┌──────────────────────────────────────────────────────┐
│ ☑ │ #42 │ Problème réseau bureau 3A   │ Nouveau      │
│ ☑ │ #38 │ Mise à jour Windows 11      │ En cours     │
│ ☐ │ #31 │ Imprimante HP 3ème étage    │ En attente   │
│ ☑ │ #27 │ Accès VPN refusé            │ Nouveau      │
└──────────────────────────────────────────────────────┘
3 sélectionné(s)

Actions disponibles :
[ Changer le statut ▾ ]  [ Changer l'urgence ▾ ]  [ Clore les tickets ]

[ Appliquer sur 3 items ]

Historique de session :
  ✓ 14:22 — Statut changé sur 3 tickets (Nouveau → En cours)   [ Annuler ]
  ✓ 14:18 — 2 tickets clos                                      [ — ]
```

---

## Fonctionnalités attendues

- [ ] Chargement paginé d'items avec filtre par statut/type
- [ ] Cases à cocher pour sélection multiple + "Tout sélectionner"
- [ ] Action **Changer le statut** : PATCH `status` sur tous les items sélectionnés
- [ ] Action **Changer l'urgence** : PATCH `urgency`
- [ ] Action **Clore** : passer le statut à 6 (Clos)
- [ ] Confirmation avant chaque action (modale)
- [ ] Exécution en série avec barre de progression
- [ ] Historique des actions de la session avec possibilité d'annuler la dernière
- [ ] L'annulation effectue le PATCH inverse (restaure les valeurs d'origine)

---

## Fichiers à créer

```
src/composables/useBulkActions.js
src/composables/useActionHistory.js
src/components/BulkActions/ItemSelector.vue
src/components/BulkActions/ActionToolbar.vue
src/components/BulkActions/ActionHistory.vue
src/components/BulkActions/BulkConfirm.vue
src/views/BulkActionsView.vue
```

Route : `{ path: '/bulk', component: () => import('../views/BulkActionsView.vue') }`

---

## Amorce de code

### `useActionHistory.js`

```js
// src/composables/useActionHistory.js
// Historique en mémoire des actions effectuées sur cette session
import { ref } from 'vue'

export function useActionHistory() {
  const history = ref([])   // [{ id, label, timestamp, undo: fn, undone: bool }]

  function record(label, undoFn) {
    history.value.unshift({
      id: Date.now(),
      label,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      undo: undoFn,
      undone: false,
    })
    // Garder seulement les 10 dernières actions
    if (history.value.length > 10) history.value.pop()
  }

  async function undoLast() {
    const last = history.value.find((h) => !h.undone)
    if (!last) return
    try {
      await last.undo()
      last.undone = true
    } catch (e) {
      console.error('Annulation échouée', e)
    }
  }

  return { history, record, undoLast }
}
```

### `useBulkActions.js`

```js
// src/composables/useBulkActions.js
import { ref, computed } from 'vue'
import { glpiApi } from '../services/glpiApi.js'
import { useActionHistory } from './useActionHistory.js'

export function useBulkActions() {
  const { history, record } = useActionHistory()

  const items = ref([])
  const selectedIds = ref([])
  const loading = ref(false)
  const progress = ref(0)
  const actionResult = ref(null)

  const isAllSelected = computed(
    () => items.value.length > 0 && selectedIds.value.length === items.value.length
  )

  async function loadItems(itemtype, params = {}) {
    loading.value = true
    try {
      items.value = await glpiApi.getItems(itemtype, { range: '0-49', ...params })
      selectedIds.value = []
    } finally {
      loading.value = false
    }
  }

  function toggleAll() {
    selectedIds.value = isAllSelected.value ? [] : items.value.map((i) => i.id)
  }

  function toggleOne(id) {
    const idx = selectedIds.value.indexOf(id)
    idx === -1 ? selectedIds.value.push(id) : selectedIds.value.splice(idx, 1)
  }

  /**
   * Appliquer un PATCH sur tous les items sélectionnés.
   * Sauvegarde les valeurs d'origine pour permettre l'annulation.
   */
  async function applyPatch(itemtype, field, newValue, label) {
    if (selectedIds.value.length === 0) return

    // Sauvegarder les valeurs d'origine (pour annulation)
    const originals = selectedIds.value.map((id) => {
      const item = items.value.find((i) => i.id === id)
      return { id, original: item ? item[field] : null }
    })

    loading.value = true
    progress.value = 0
    actionResult.value = null
    const ids = [...selectedIds.value]

    let successCount = 0
    for (let i = 0; i < ids.length; i++) {
      try {
        await glpiApi.patchItem(itemtype, ids[i], { input: { id: ids[i], [field]: newValue } })
        // Mettre à jour localement
        const item = items.value.find((it) => it.id === ids[i])
        if (item) item[field] = newValue
        successCount++
      } catch (e) {
        console.error(`Échec sur #${ids[i]}:`, e.message)
      }
      progress.value = Math.round(((i + 1) / ids.length) * 100)
    }

    actionResult.value = { success: successCount, total: ids.length }
    loading.value = false

    // Enregistrer dans l'historique avec la fonction d'annulation
    record(
      `${label} sur ${successCount} item(s)`,
      async () => {
        for (const { id, original } of originals) {
          if (original !== null) {
            await glpiApi.patchItem(itemtype, id, { input: { id, [field]: original } })
            const item = items.value.find((it) => it.id === id)
            if (item) item[field] = original
          }
        }
      }
    )
  }

  return {
    items, selectedIds, isAllSelected, loading, progress, actionResult, history,
    loadItems, toggleAll, toggleOne, applyPatch,
  }
}
```

> **À ajouter dans `glpiApi.js`** — méthode `patchItem` :
> ```js
> async patchItem(itemtype, id, body) {
>   return request('PATCH', `/${itemtype}/${id}`, body)
> },
> ```

### `ActionToolbar.vue`

```vue
<!-- src/components/BulkActions/ActionToolbar.vue -->
<template>
  <div class="toolbar" v-if="selectedCount > 0">
    <span class="count">{{ selectedCount }} sélectionné(s)</span>

    <!-- Changer le statut -->
    <div class="action-group">
      <select v-model="selectedStatus">
        <option value="">Changer le statut…</option>
        <option value="1">Nouveau</option>
        <option value="2">En cours (assigné)</option>
        <option value="4">En attente</option>
        <option value="5">Résolu</option>
        <option value="6">Clos</option>
      </select>
      <button :disabled="!selectedStatus" @click="applyStatus">Appliquer</button>
    </div>

    <!-- Changer l'urgence -->
    <div class="action-group">
      <select v-model="selectedUrgency">
        <option value="">Changer l'urgence…</option>
        <option value="1">1 — Très basse</option>
        <option value="2">2 — Basse</option>
        <option value="3">3 — Moyenne</option>
        <option value="4">4 — Haute</option>
        <option value="5">5 — Très haute</option>
      </select>
      <button :disabled="!selectedUrgency" @click="applyUrgency">Appliquer</button>
    </div>

    <!-- Clore -->
    <button class="danger" @click="$emit('close-tickets')">Clore les tickets</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({ selectedCount: Number })
const emit = defineEmits(['patch', 'close-tickets'])

const selectedStatus = ref('')
const selectedUrgency = ref('')

function applyStatus() {
  if (selectedStatus.value) {
    emit('patch', 'status', parseInt(selectedStatus.value), `Statut → ${selectedStatus.value}`)
    selectedStatus.value = ''
  }
}
function applyUrgency() {
  if (selectedUrgency.value) {
    emit('patch', 'urgency', parseInt(selectedUrgency.value), `Urgence → ${selectedUrgency.value}`)
    selectedUrgency.value = ''
  }
}
</script>

<style scoped>
.toolbar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 1rem;
  padding: 0.75rem 1rem; background: #f0f7ff;
  border: 1px solid #3498db; border-radius: 6px; margin-bottom: 1rem;
}
.count { font-weight: bold; color: #2c3e50; }
.action-group { display: flex; gap: 0.5rem; }
select { padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px; }
button { padding: 0.3rem 0.8rem; border: 1px solid #3498db; background: #3498db; color: #fff; border-radius: 4px; cursor: pointer; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.danger { background: #e74c3c; border-color: #e74c3c; }
</style>
```

### `ActionHistory.vue`

```vue
<!-- src/components/BulkActions/ActionHistory.vue -->
<template>
  <div class="history" v-if="history.length > 0">
    <h4>Historique de session</h4>
    <ul>
      <li v-for="entry in history" :key="entry.id" :class="{ undone: entry.undone }">
        <span class="time">{{ entry.timestamp }}</span>
        <span class="label">{{ entry.label }}</span>
        <button
          v-if="!entry.undone"
          class="undo"
          @click="$emit('undo', entry)"
        >
          Annuler
        </button>
        <span v-else class="undone-tag">Annulé</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({ history: Array })
defineEmits(['undo'])
</script>

<style scoped>
.history { margin-top: 2rem; }
h4 { margin-bottom: 0.5rem; color: #555; }
ul { list-style: none; padding: 0; }
li { display: flex; align-items: center; gap: 1rem; padding: 0.4rem 0; border-bottom: 1px solid #f0f0f0; }
li.undone { opacity: 0.5; }
.time { font-size: 0.8rem; color: #888; width: 55px; }
.label { flex: 1; }
.undo { padding: 0.2rem 0.6rem; font-size: 0.8rem; border: 1px solid #e74c3c; background: #fff; color: #e74c3c; border-radius: 4px; cursor: pointer; }
.undone-tag { font-size: 0.8rem; color: #888; font-style: italic; }
</style>
```

---

## Indices

<details>
<summary>Indice 1 — PATCH sur les tickets GLPI</summary>

L'API GLPI attend le format suivant pour un PATCH (modification) :
```js
// PATCH /api/Ticket/42
// Body :
{ "input": { "id": 42, "status": 5 } }
```
Réponse `200` : `[{"42": true, "message": ""}]`
</details>

<details>
<summary>Indice 2 — Annulation partielle</summary>

Si l'annulation échoue sur certains items, ne pas bloquer les autres. Utiliser `Promise.allSettled` dans la fonction `undo` pour traiter toutes les restaurations même en cas d'erreur individuelle.
</details>

<details>
<summary>Indice 3 — Empêcher la double exécution</summary>

Désactiver tous les boutons d'action pendant qu'une opération est en cours (`loading`), sinon l'utilisateur peut déclencher deux opérations en parallèle qui vont se marcher dessus.
</details>

---

## Pour aller plus loin

- Implémenter le transfert vers une autre entité GLPI (`POST /api/Transfer`)
- Ajouter une action "Assigner à un technicien" (nécessite de charger la liste des utilisateurs GLPI)
- Persister l'historique dans `sessionStorage` pour survivre à un rechargement de page
- Ajouter des **keyboard shortcuts** : `Ctrl+Z` pour annuler, `Esc` pour désélectionner
