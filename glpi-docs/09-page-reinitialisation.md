# Intégration de la page Réinitialisation

Guide pas-à-pas pour ajouter la page de réinitialisation de données à `glpi-front`.

> Le code source de référence (composable, composants, Vue) est dans `04-feature-reinitialisation.md`.  
> Ce guide couvre uniquement les étapes d'intégration dans le projet.

---

## Résultat attendu

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
└──────────────────────────────────────────────────────────┘
```

---

## Pré-requis

- `glpiApi.js` opérationnel (voir `02-api-client.md`)
- `vue-router` installé et `router/index.js` configuré (voir `00-curl-et-integration.md`)
- L'utilisateur GLPI doit avoir le droit **DELETE** sur les types à supprimer

---

## Étape 1 — Créer les fichiers

```
src/
├── composables/
│   └── useReinit.js              ← logique (appels API, sélection, suppression)
├── components/
│   └── Reinitialisation/
│       ├── ResetPanel.vue        ← liste + sélection + bouton supprimer
│       ├── ResetConfirm.vue      ← modale de confirmation
│       └── ResetResult.vue       ← résumé après suppression
└── views/
    └── ReinitialisationView.vue  ← page principale
```

---

### `src/composables/useReinit.js`

```js
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

export function useReinit() {
  const items = ref([])
  const selectedIds = ref([])
  const loading = ref(false)
  const loadingItems = ref(false)
  const error = ref(null)
  const results = ref([])

  async function loadItems(itemtype) {
    loadingItems.value = true
    error.value = null
    items.value = []
    selectedIds.value = []
    try {
      items.value = await glpiApi.getItems(itemtype, {
        range: '0-499',
        sort: 'id',
        order: 'ASC',
      })
    } catch (e) {
      error.value = e.message
    } finally {
      loadingItems.value = false
    }
  }

  function toggleSelect(id) {
    const idx = selectedIds.value.indexOf(id)
    if (idx === -1) selectedIds.value.push(id)
    else selectedIds.value.splice(idx, 1)
  }

  function toggleAll() {
    if (selectedIds.value.length === items.value.length) {
      selectedIds.value = []
    } else {
      selectedIds.value = items.value.map((i) => i.id)
    }
  }

  async function deleteSelected(itemtype) {
    if (selectedIds.value.length === 0) return
    loading.value = true
    error.value = null
    results.value = []
    try {
      results.value = await glpiApi.deleteItems(itemtype, selectedIds.value)
      const deletedIds = new Set(selectedIds.value)
      items.value = items.value.filter((i) => !deletedIds.has(i.id))
      selectedIds.value = []
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // Supprime TOUS les items d'un type (par lots de 100 pour éviter les timeouts)
  async function deleteAll(itemtype) {
    loadingItems.value = true
    error.value = null
    results.value = []
    try {
      const allItems = await glpiApi.getItems(itemtype, { range: '0-999', only_id: '1' })
      const allIds = allItems.map((i) => i.id)
      if (allIds.length === 0) return
      loading.value = true
      for (let i = 0; i < allIds.length; i += 100) {
        const batch = allIds.slice(i, i + 100)
        const batchResults = await glpiApi.deleteItems(itemtype, batch)
        results.value.push(...batchResults)
      }
      items.value = []
      selectedIds.value = []
    } catch (e) {
      error.value = e.message
    } finally {
      loadingItems.value = false
      loading.value = false
    }
  }

  function reset() {
    items.value = []
    selectedIds.value = []
    error.value = null
    results.value = []
  }

  return {
    items, selectedIds, loading, loadingItems, error, results,
    loadItems, toggleSelect, toggleAll, deleteSelected, deleteAll, reset,
  }
}
```

---

### `src/components/Reinitialisation/ResetConfirm.vue`

```vue
<template>
  <div class="overlay">
    <div class="modal">
      <h3>Confirmer la suppression</h3>
      <p>
        Vous allez supprimer <strong>{{ count }}</strong>
        élément(s) de type <strong>{{ itemtype }}</strong>.
      </p>
      <p class="warning">Cette action est irréversible.</p>
      <div class="modal-actions">
        <button class="btn-danger" @click="$emit('confirm')">Confirmer</button>
        <button class="btn-cancel" @click="$emit('cancel')">Annuler</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ count: Number, itemtype: String })
defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
.modal {
  background: #fff; border-radius: 8px;
  padding: 2rem; max-width: 420px; width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}
.warning { color: #e74c3c; font-weight: 600; }
.modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
.btn-danger {
  background: #e74c3c; color: #fff;
  border: none; padding: 0.6rem 1.4rem; border-radius: 4px; cursor: pointer;
}
.btn-cancel {
  background: #fff; border: 1px solid #ccc;
  padding: 0.6rem 1.4rem; border-radius: 4px; cursor: pointer;
}
</style>
```

---

### `src/components/Reinitialisation/ResetResult.vue`

```vue
<template>
  <div class="reset-result">
    <div class="stats">
      <div class="stat success">
        <span class="count">{{ successCount }}</span>
        <span class="label">supprimé(s)</span>
      </div>
      <div v-if="failCount > 0" class="stat fail">
        <span class="count">{{ failCount }}</span>
        <span class="label">échec(s)</span>
      </div>
    </div>

    <details v-if="failCount > 0" class="errors">
      <summary>Voir les erreurs ({{ failCount }})</summary>
      <ul>
        <li v-for="(r, i) in failedItems" :key="i">
          ID {{ Object.keys(r)[0] }} — {{ r.message || 'Erreur inconnue' }}
        </li>
      </ul>
    </details>

    <button class="btn-secondary" @click="$emit('recommencer')">
      Nouvelle sélection
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ results: Array })
defineEmits(['recommencer'])

// Chaque résultat GLPI est { "<id>": true|false, message: "" }
const successCount = computed(() =>
  props.results.filter((r) => Object.values(r).find(v => v === true) !== undefined).length
)
const failCount = computed(() => props.results.length - successCount.value)
const failedItems = computed(() =>
  props.results.filter((r) => Object.values(r).find(v => v === true) === undefined)
)
</script>

<style scoped>
.reset-result { margin-top: 1.5rem; }
.stats { display: flex; gap: 1rem; margin-bottom: 1rem; }
.stat {
  display: flex; flex-direction: column; align-items: center;
  padding: 1rem 2rem; border-radius: 6px;
}
.stat.success { background: #eafaf1; border: 1px solid #27ae60; }
.stat.fail { background: #fdf3f3; border: 1px solid #e74c3c; }
.count { font-size: 2rem; font-weight: 700; }
.label { font-size: 0.85rem; color: #555; }
.errors { margin: 1rem 0; font-size: 0.9rem; color: #c0392b; }
.errors ul { margin: 0.5rem 0 0 1.2rem; }
.btn-secondary {
  padding: 0.5rem 1.2rem; background: #fff;
  border: 1px solid #888; border-radius: 4px; cursor: pointer;
}
</style>
```

---

### `src/components/Reinitialisation/ResetPanel.vue`

```vue
<template>
  <div class="reset-panel">
    <h2>Réinitialisation de données</h2>

    <div class="field">
      <label for="itemtype">Type d'objet GLPI</label>
      <select id="itemtype" v-model="itemtype" @change="onTypeChange">
        <option value="">— Choisir —</option>
        <option value="Ticket">Tickets</option>
        <option value="Computer">Ordinateurs</option>
        <option value="Document">Documents</option>
        <option value="Software">Logiciels</option>
        <option value="Contract">Contrats</option>
        <option value="Problem">Problèmes</option>
        <option value="Change">Changements</option>
      </select>
    </div>

    <div v-if="loadingItems" class="loading">Chargement des éléments…</div>

    <div v-if="items.length > 0 && results.length === 0" class="items-list">
      <div class="list-header">
        <label>
          <input type="checkbox" :checked="isAllSelected" @change="toggleAll" />
          Tout sélectionner ({{ items.length }} élément(s))
        </label>
      </div>
      <ul>
        <li v-for="item in items" :key="item.id">
          <label>
            <input
              type="checkbox"
              :checked="selectedIds.includes(item.id)"
              @change="toggleSelect(item.id)"
            />
            [{{ item.id }}] {{ item.name || '(sans nom)' }}
          </label>
        </li>
      </ul>
    </div>

    <p v-if="itemtype && !loadingItems && items.length === 0 && results.length === 0" class="empty">
      Aucun élément trouvé pour ce type.
    </p>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="selectedIds.length > 0 && results.length === 0" class="actions">
      <button class="btn-danger" :disabled="loading" @click="showConfirm = true">
        {{ loading ? 'Suppression…' : `Supprimer ${selectedIds.length} élément(s)` }}
      </button>
    </div>

    <ResetResult
      v-if="results.length > 0"
      :results="results"
      @recommencer="onRecommencer"
    />

    <ResetConfirm
      v-if="showConfirm"
      :count="selectedIds.length"
      :itemtype="itemtype"
      @confirm="onConfirm"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useReinit } from '../../composables/useReinit.js'
import ResetConfirm from './ResetConfirm.vue'
import ResetResult from './ResetResult.vue'

const {
  items, selectedIds, loading, loadingItems, error, results,
  loadItems, toggleSelect, toggleAll, deleteSelected, reset,
} = useReinit()

const itemtype = ref('')
const showConfirm = ref(false)

const isAllSelected = computed(
  () => items.value.length > 0 && selectedIds.value.length === items.value.length
)

function onTypeChange() {
  reset()
  if (itemtype.value) loadItems(itemtype.value)
}

async function onConfirm() {
  showConfirm.value = false
  await deleteSelected(itemtype.value)
}

function onRecommencer() {
  reset()
  if (itemtype.value) loadItems(itemtype.value)
}
</script>

<style scoped>
.reset-panel { max-width: 640px; padding: 2rem; }
.field { margin: 1.5rem 0; display: flex; flex-direction: column; gap: 0.3rem; }
label { font-size: 0.9rem; font-weight: 600; }
select {
  padding: 0.5rem 0.75rem; border: 1px solid #ddd;
  border-radius: 4px; font-size: 1rem; max-width: 240px;
}
.items-list {
  border: 1px solid #ddd; border-radius: 6px;
  max-height: 320px; overflow-y: auto; margin: 1rem 0;
}
.list-header {
  padding: 0.6rem 1rem; background: #f7f8fa;
  border-bottom: 1px solid #ddd; font-weight: 600;
}
ul { list-style: none; margin: 0; padding: 0; }
li { padding: 0.45rem 1rem; border-bottom: 1px solid #f0f0f0; }
li:last-child { border-bottom: none; }
li label { font-weight: normal; display: flex; align-items: center; gap: 0.5rem; }
.empty { color: #999; font-style: italic; }
.error { color: #e74c3c; }
.loading { color: #888; font-style: italic; }
.actions { margin-top: 1rem; }
.btn-danger {
  background: #e74c3c; color: #fff;
  border: none; padding: 0.6rem 1.4rem; border-radius: 4px;
  font-size: 1rem; cursor: pointer;
}
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

---

### `src/views/ReinitialisationView.vue`

```vue
<template>
  <main class="page">
    <ResetPanel />
  </main>
</template>

<script setup>
import ResetPanel from '../components/Reinitialisation/ResetPanel.vue'
</script>

<style scoped>
.page { padding: 2rem; }
</style>
```

---

## Étape 2 — Ajouter la route

Dans `src/router/index.js`, ajouter dans le tableau `routes` :

```js
{
  path: '/reinitialisation',
  component: () => import('../views/ReinitialisationView.vue'),
},
```

---

## Étape 3 — Ajouter un lien de navigation (optionnel)

Dans `App.vue` ou un composant de navigation :

```vue
<nav>
  <RouterLink to="/dashboard">Dashboard</RouterLink>
  <RouterLink to="/reinitialisation">Réinitialisation</RouterLink>
</nav>
```

---

## Étape 4 — (Optionnel) Logger les suppressions dans Spring Boot

Si le backend Spring Boot est démarré (`glpi-spring`), on peut journaliser chaque suppression.

Dans `useReinit.js`, importer `logs` de `springApi.js` et appeler après `deleteSelected` :

```js
import { logs } from '../services/springApi.js'

async function deleteSelected(itemtype) {
  // ... code existant ...
  try {
    results.value = await glpiApi.deleteItems(itemtype, selectedIds.value)
    
    // Logger la suppression
    await logs.create({
      action: 'DELETE',
      itemtype,
      payload: JSON.stringify({ ids: selectedIds.value }),
      response: JSON.stringify(results.value),
      status: 'SUCCESS',
    })
    
    // ...
  } catch (e) {
    await logs.create({
      action: 'DELETE', itemtype,
      status: 'ERROR', errorMessage: e.message,
    })
    error.value = e.message
  }
}
```

---

## Étape 5 — Vérification

```bash
npm run dev
```

Checklist :

- [ ] `http://localhost:5173/reinitialisation` charge la page
- [ ] Le `<select>` déclenche le chargement des items via `GET /api/Ticket?range=0-499`
- [ ] Les checkboxes sélectionnent/désélectionnent des items
- [ ] "Tout sélectionner" coche tous les items
- [ ] Cliquer "Supprimer" ouvre la modale de confirmation
- [ ] Confirmer lance `DELETE /api/Ticket` avec les IDs sélectionnés
- [ ] `ResetResult` affiche le nombre de succès/échecs
- [ ] "Nouvelle sélection" recharge la liste
- [ ] Une erreur 403 affiche "Permission refusée"

---

## Erreurs courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `403 Forbidden` | Profil GLPI sans droit DELETE | Administration > Profils > cocher DELETE sur le type concerné |
| `400 Item locked` | Item lié à d'autres entités | Supprimer d'abord les dépendances dans GLPI |
| `401 Unauthorized` | Session expirée | La page est redirigée vers `/login` automatiquement via le guard |
| Liste vide | `range=0-499` insuffisant | Augmenter la plage ou utiliser `deleteAll` pour >499 items |
