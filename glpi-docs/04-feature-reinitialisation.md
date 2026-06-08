# Feature : Réinitialisation de données

## Vue d'ensemble

La réinitialisation de données permet de supprimer ou remettre à zéro des ensembles d'objets GLPI via l'API REST. Deux niveaux sont couverts :

| Niveau | Description | Méthode API |
|--------|-------------|-------------|
| **Item unique** | Supprimer un objet précis | `DELETE /api/{itemtype}/{id}` |
| **Liste filtrée** | Supprimer plusieurs items d'un même type | `DELETE /api/{itemtype}` avec `input: [{id}, ...]` |
| **Par type complet** | Lister puis tout supprimer | `GET` + `DELETE` en boucle |

> La réinitialisation est **irréversible** via l'API. Toujours afficher une confirmation avant d'exécuter.

---

## Endpoints API utilisés

```
# Lister les items (pour sélection avant reset)
GET /api/{itemtype}?range=0-999&only_id=true

# Supprimer un item
DELETE /api/{itemtype}/{id}

# Supprimer plusieurs items
DELETE /api/{itemtype}
Body: { "input": [{"id": 1}, {"id": 2}, {"id": 3}] }
```

Types d'objets GLPI courants (`itemtype`) :

| itemtype | Description |
|----------|-------------|
| `Ticket` | Tickets / incidents |
| `Computer` | Ordinateurs |
| `User` | Utilisateurs |
| `Document` | Documents uploadés |
| `Problem` | Problèmes |
| `Change` | Changements |
| `Contract` | Contrats |
| `Software` | Logiciels |

---

## Composable `useReinit`

```ts
// src/composables/useReinit.ts
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi'
import type { GlpiItem, GlpiDeleteResult } from '../types/glpi'

export function useReinit() {
  const items = ref<GlpiItem[]>([])
  const selectedIds = ref<number[]>([])
  const loading = ref(false)
  const loadingItems = ref(false)
  const error = ref<string | null>(null)
  const results = ref<GlpiDeleteResult[]>([])
  const confirmed = ref(false)

  // Charger les items d'un type pour permettre la sélection
  async function loadItems(itemtype: string) {
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
      error.value = (e as Error).message
    } finally {
      loadingItems.value = false
    }
  }

  // Sélectionner/désélectionner un item
  function toggleSelect(id: number) {
    const idx = selectedIds.value.indexOf(id)
    if (idx === -1) selectedIds.value.push(id)
    else selectedIds.value.splice(idx, 1)
  }

  // Tout sélectionner / désélectionner
  function toggleAll() {
    if (selectedIds.value.length === items.value.length) {
      selectedIds.value = []
    } else {
      selectedIds.value = items.value.map((i) => i.id)
    }
  }

  // Supprimer les items sélectionnés
  async function deleteSelected(itemtype: string) {
    if (selectedIds.value.length === 0) return
    loading.value = true
    error.value = null
    results.value = []
    try {
      results.value = await glpiApi.deleteItems(itemtype, selectedIds.value)
      // Retirer les items supprimés de la liste locale
      const deletedIds = new Set(selectedIds.value)
      items.value = items.value.filter((i) => !deletedIds.has(i.id))
      selectedIds.value = []
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
      confirmed.value = false
    }
  }

  // Supprimer TOUS les items d'un type (réinitialisation complète)
  async function deleteAll(itemtype: string) {
    loadingItems.value = true
    error.value = null
    try {
      // D'abord récupérer tous les IDs
      const allItems = await glpiApi.getItems(itemtype, { range: '0-999', only_id: '1' })
      const allIds = allItems.map((i) => i.id)
      if (allIds.length === 0) return

      loading.value = true
      // Supprimer par lots de 100 pour éviter les timeouts
      for (let i = 0; i < allIds.length; i += 100) {
        const batch = allIds.slice(i, i + 100)
        const batchResults = await glpiApi.deleteItems(itemtype, batch)
        results.value.push(...batchResults)
      }
      items.value = []
      selectedIds.value = []
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loadingItems.value = false
      loading.value = false
      confirmed.value = false
    }
  }

  function reset() {
    items.value = []
    selectedIds.value = []
    error.value = null
    results.value = []
    confirmed.value = false
  }

  return {
    items,
    selectedIds,
    loading,
    loadingItems,
    error,
    results,
    confirmed,
    loadItems,
    toggleSelect,
    toggleAll,
    deleteSelected,
    deleteAll,
    reset,
  }
}
```

---

## Composant `ResetPanel.vue`

```vue
<!-- src/components/Reinitialisation/ResetPanel.vue -->
<template>
  <div class="reset-panel">
    <h2>Réinitialisation de données</h2>

    <!-- Sélection du type d'objet -->
    <div class="row">
      <label>Type d'objet GLPI</label>
      <select v-model="itemtype" @change="onTypeChange">
        <option value="">-- Choisir --</option>
        <option value="Ticket">Tickets</option>
        <option value="Computer">Ordinateurs</option>
        <option value="Document">Documents</option>
        <option value="Software">Logiciels</option>
        <option value="Contract">Contrats</option>
        <option value="Problem">Problèmes</option>
        <option value="Change">Changements</option>
      </select>
    </div>

    <!-- Liste des items -->
    <div v-if="loadingItems" class="loading">Chargement...</div>

    <div v-if="items.length > 0" class="items-list">
      <div class="list-header">
        <label>
          <input type="checkbox" :checked="isAllSelected" @change="toggleAll" />
          Tout sélectionner ({{ items.length }} éléments)
        </label>
      </div>
      <ul>
        <li v-for="item in items" :key="item.id">
          <label>
            <input
              type="checkbox"
              :value="item.id"
              :checked="selectedIds.includes(item.id)"
              @change="toggleSelect(item.id)"
            />
            [{{ item.id }}] {{ item.name || '(sans nom)' }}
          </label>
        </li>
      </ul>
    </div>

    <p v-if="itemtype && !loadingItems && items.length === 0" class="empty">
      Aucun élément trouvé.
    </p>

    <!-- Erreur -->
    <p v-if="error" class="error">{{ error }}</p>

    <!-- Résultats -->
    <div v-if="results.length > 0" class="results">
      {{ results.length }} élément(s) supprimé(s) avec succès.
    </div>

    <!-- Actions -->
    <div v-if="selectedIds.length > 0" class="actions">
      <button class="danger" :disabled="loading" @click="askConfirm">
        Supprimer {{ selectedIds.length }} élément(s)
      </button>
    </div>

    <!-- Modale de confirmation -->
    <ResetConfirm
      v-if="showConfirm"
      :count="selectedIds.length"
      :itemtype="itemtype"
      @confirm="onConfirm"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useReinit } from '../../composables/useReinit'
import ResetConfirm from './ResetConfirm.vue'

const { items, selectedIds, loading, loadingItems, error, results, loadItems, toggleSelect, toggleAll, deleteSelected, reset } = useReinit()

const itemtype = ref('')
const showConfirm = ref(false)

const isAllSelected = computed(
  () => items.value.length > 0 && selectedIds.value.length === items.value.length
)

function onTypeChange() {
  reset()
  if (itemtype.value) loadItems(itemtype.value)
}

function askConfirm() {
  showConfirm.value = true
}

async function onConfirm() {
  showConfirm.value = false
  await deleteSelected(itemtype.value)
}
</script>

<style scoped>
.reset-panel { max-width: 600px; }
.row { margin: 1rem 0; }
.items-list { border: 1px solid #ddd; border-radius: 4px; max-height: 300px; overflow-y: auto; }
.list-header { padding: 0.5rem 1rem; background: #f5f5f5; border-bottom: 1px solid #ddd; }
ul { list-style: none; margin: 0; padding: 0; }
li { padding: 0.5rem 1rem; border-bottom: 1px solid #f0f0f0; }
li:last-child { border-bottom: none; }
.empty { color: #888; font-style: italic; }
.error { color: #e74c3c; }
.results { color: #27ae60; padding: 0.5rem; }
.actions { margin-top: 1rem; }
.danger { background: #e74c3c; color: #fff; border: none; padding: 0.5rem 1.5rem; border-radius: 4px; cursor: pointer; }
.danger:disabled { opacity: 0.5; cursor: not-allowed; }
.loading { color: #888; }
</style>
```

---

## Composant `ResetConfirm.vue` (modale)

```vue
<!-- src/components/Reinitialisation/ResetConfirm.vue -->
<template>
  <div class="overlay">
    <div class="modal">
      <h3>Confirmer la suppression</h3>
      <p>
        Vous êtes sur le point de supprimer <strong>{{ count }}</strong>
        élément(s) de type <strong>{{ itemtype }}</strong>.
      </p>
      <p class="warning">Cette action est irréversible.</p>
      <div class="modal-actions">
        <button class="danger" @click="$emit('confirm')">Confirmer</button>
        <button @click="$emit('cancel')">Annuler</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ count: number; itemtype: string }>()
defineEmits<{ confirm: []; cancel: [] }>()
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff; border-radius: 8px;
  padding: 2rem; max-width: 400px; width: 90%;
}
.warning { color: #e74c3c; font-weight: bold; }
.modal-actions { display: flex; gap: 1rem; margin-top: 1rem; }
.danger { background: #e74c3c; color: #fff; border: none; padding: 0.5rem 1.5rem; border-radius: 4px; cursor: pointer; }
</style>
```

---

## Composant `ResetResult.vue`

Affiche un résumé détaillé après la suppression, avec le décompte des succès et échecs.

```vue
<!-- src/components/Reinitialisation/ResetResult.vue -->
<template>
  <div class="reset-result">
    <div class="stat success">
      <span class="count">{{ successCount }}</span>
      <span class="label">supprimé(s)</span>
    </div>
    <div v-if="failCount > 0" class="stat fail">
      <span class="count">{{ failCount }}</span>
      <span class="label">échec(s)</span>
    </div>

    <details v-if="failCount > 0" class="errors">
      <summary>Voir les erreurs</summary>
      <ul>
        <li v-for="r in failed" :key="r.id">
          ID {{ r.id }} — {{ r.message || 'Erreur inconnue' }}
        </li>
      </ul>
    </details>

    <button class="secondary" @click="$emit('recommencer')">Nouvelle sélection</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GlpiDeleteResult } from '../../types/glpi'

const props = defineProps<{ results: GlpiDeleteResult[] }>()
defineEmits<{ recommencer: [] }>()

// GLPI retourne { id: true|false, message: "" } pour chaque item
const successCount = computed(() => props.results.filter((r) => Object.values(r)[0] === true).length)
const failCount = computed(() => props.results.filter((r) => Object.values(r)[0] !== true).length)
const failed = computed(() => props.results.filter((r) => Object.values(r)[0] !== true))
</script>

<style scoped>
.reset-result { margin-top: 1rem; }
.stat { display: inline-flex; flex-direction: column; align-items: center; padding: 1rem 2rem; border-radius: 6px; margin-right: 1rem; }
.stat.success { background: #eafaf1; border: 1px solid #27ae60; }
.stat.fail { background: #fdf3f3; border: 1px solid #e74c3c; }
.count { font-size: 2rem; font-weight: bold; }
.label { font-size: 0.85rem; color: #555; }
.errors { margin-top: 1rem; font-size: 0.9rem; color: #e74c3c; }
.errors ul { margin: 0.5rem 0 0 1rem; }
.secondary { display: block; margin-top: 1.5rem; padding: 0.5rem 1rem; background: #fff; border: 1px solid #888; border-radius: 4px; cursor: pointer; }
</style>
```

Utilisation dans `ResetPanel.vue` — remplacer le bloc `<!-- Résultats -->` :
```vue
<!-- Remplacer le div résultats par : -->
<ResetResult
  v-if="results.length > 0"
  :results="results"
  @recommencer="reset"
/>
```

Et dans `<script setup>` :
```ts
import ResetResult from './ResetResult.vue'
```

---

## Vue `ReinitialisationView.vue`

```vue
<!-- src/views/ReinitialisationView.vue -->
<template>
  <main>
    <ResetPanel />
  </main>
</template>

<script setup lang="ts">
import ResetPanel from '../components/Reinitialisation/ResetPanel.vue'
</script>
```

---

---

## Version JavaScript

**`src/composables/useReinit.js`** :
```js
// src/composables/useReinit.js
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

export function useReinit() {
  const items = ref([])
  const selectedIds = ref([])
  const loading = ref(false)
  const loadingItems = ref(false)
  const error = ref(null)
  const results = ref([])
  const confirmed = ref(false)

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
      confirmed.value = false
    }
  }

  async function deleteAll(itemtype) {
    loadingItems.value = true
    error.value = null
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
      confirmed.value = false
    }
  }

  function reset() {
    items.value = []
    selectedIds.value = []
    error.value = null
    results.value = []
    confirmed.value = false
  }

  return {
    items, selectedIds, loading, loadingItems, error, results, confirmed,
    loadItems, toggleSelect, toggleAll, deleteSelected, deleteAll, reset,
  }
}
```

**`ResetPanel.vue` en JavaScript** — seul le bloc `<script>` change :
```vue
<script setup>
import { ref, computed } from 'vue'
import { useReinit } from '../../composables/useReinit.js'
import ResetConfirm from './ResetConfirm.vue'
import ResetResult from './ResetResult.vue'

const { items, selectedIds, loading, loadingItems, error, results, loadItems, toggleSelect, toggleAll, deleteSelected, reset } = useReinit()

const itemtype = ref('')
const showConfirm = ref(false)

const isAllSelected = computed(
  () => items.value.length > 0 && selectedIds.value.length === items.value.length
)

function onTypeChange() {
  reset()
  if (itemtype.value) loadItems(itemtype.value)
}

function askConfirm() {
  showConfirm.value = true
}

async function onConfirm() {
  showConfirm.value = false
  await deleteSelected(itemtype.value)
}
</script>
```

**`ResetConfirm.vue` en JavaScript** :
```vue
<script setup>
defineProps({ count: Number, itemtype: String })
defineEmits(['confirm', 'cancel'])
</script>
```

---

## Points d'attention

### Permissions GLPI
Pour supprimer des items, l'utilisateur GLPI doit avoir le droit **DELETE** sur le type concerné. Vérifier le profil dans GLPI : Administration > Profils.

### Suppression en masse et performances
Au-delà de 100 items, découper en batches de 100 pour éviter les timeouts PHP. Le composable `deleteAll` le fait automatiquement.

### Items verrouillés
Certains items GLPI ne peuvent pas être supprimés s'ils ont des dépendances (ex. : tickets liés à des actifs). L'API retourne alors une erreur 400 avec un message explicatif à afficher à l'utilisateur.
