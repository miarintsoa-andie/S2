# Module 5 — FrontOffice : Liste des éléments avec recherche multi-critère

> **Attendu :** Page publique (sans auth) affichant tous les éléments GLPI avec recherche multi-critère.  
> **Statut glpi-front :** ❌ À créer.

---

## Résultat attendu

```
┌──────────────────────────────────────────────────────────────────┐
│  Mon Parc informatique           [ Signaler un problème → ]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Rechercher : [ réseau           ]  Type : [ Tous ▼ ]           │
│  Localisation : [ Bâtiment A ▼ ]   Statut : [ Tous ▼ ]          │
│                                                                  │
│  24 éléments trouvés                           [ Effacer filtres]│
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ 🖥  [42] Dell OptiPlex 7090    Bureau 3A   En service  │     │
│  │ 📡  [15] Switch HP 2960        Salle Réseau En service │     │
│  │ 🖨  [8]  Imprimante Kyocera    Bureau 1B   En panne    │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ◀ Préc    Page 1 / 3    Suiv ▶                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Architecture des fichiers

```
src/
├── views/
│   └── ElementsView.vue            ← page principale (route /)
├── components/
│   └── Elements/
│       ├── ElementCard.vue         ← ligne / carte d'un élément
│       ├── ElementDetail.vue       ← fiche détail (modal ou page)
│       └── ElementFilters.vue      ← barre de filtres
└── composables/
    └── useElements.js              ← chargement + filtrage
```

---

## Étape 1 — Composable `useElements.js`

```js
// src/composables/useElements.js
import { ref, computed } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

// Types d'assets à afficher dans le frontoffice
const ASSET_TYPES = [
  { key: 'Computer',         label: 'Ordinateurs',   icon: '🖥' },
  { key: 'Monitor',          label: 'Moniteurs',     icon: '🖱' },
  { key: 'NetworkEquipment', label: 'Réseau',        icon: '📡' },
  { key: 'Printer',          label: 'Imprimantes',   icon: '🖨' },
  { key: 'Phone',            label: 'Téléphones',    icon: '📱' },
  { key: 'Software',         label: 'Logiciels',     icon: '💿' },
]

export function useElements() {
  const allItems = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Filtres
  const searchText = ref('')
  const filterType = ref('')
  const filterLocation = ref('')
  const filterState = ref('')

  async function loadAll() {
    loading.value = true
    error.value = null
    allItems.value = []

    // Charger tous les types en parallèle
    const results = await Promise.allSettled(
      ASSET_TYPES.map(async ({ key, label, icon }) => {
        const items = await glpiApi.getItems(key, {
          range: '0-499',
          sort: 'name',
          order: 'ASC',
        })
        return items.map((item) => ({ ...item, _type: key, _typeLabel: label, _icon: icon }))
      })
    )

    allItems.value = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)

    loading.value = false
  }

  const filteredItems = computed(() => {
    let list = allItems.value

    if (filterType.value) {
      list = list.filter((i) => i._type === filterType.value)
    }

    if (searchText.value.trim()) {
      const q = searchText.value.toLowerCase()
      list = list.filter((i) =>
        (i.name ?? '').toLowerCase().includes(q) ||
        (i.serial ?? '').toLowerCase().includes(q) ||
        (i.comment ?? '').toLowerCase().includes(q)
      )
    }

    if (filterLocation.value) {
      list = list.filter((i) =>
        String(i.locations_id) === filterLocation.value ||
        (i.location_name ?? '').toLowerCase().includes(filterLocation.value.toLowerCase())
      )
    }

    return list
  })

  function clearFilters() {
    searchText.value = ''
    filterType.value = ''
    filterLocation.value = ''
    filterState.value = ''
  }

  return {
    allItems, filteredItems, loading, error,
    searchText, filterType, filterLocation, filterState,
    loadAll, clearFilters, ASSET_TYPES,
  }
}
```

---

## Étape 2 — Composant `ElementFilters.vue`

```vue
<template>
  <div class="filters">
    <input
      v-model="searchText"
      type="search"
      placeholder="Rechercher par nom, numéro de série…"
      class="filter-input filter-input--wide"
    />
    <select v-model="filterType" class="filter-select">
      <option value="">Tous les types</option>
      <option v-for="t in ASSET_TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
    </select>
    <button v-if="hasActiveFilter" class="btn-clear" @click="$emit('clear')">
      ✕ Effacer les filtres
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
defineProps({ searchText: String, filterType: String, ASSET_TYPES: Array })
const emit = defineEmits(['update:searchText', 'update:filterType', 'clear'])

// Rendre v-model fonctionnel sur les props
import { useVModel } from '@vueuse/core' // si disponible
// ou gérer manuellement via @input

const hasActiveFilter = computed(() => props.searchText || props.filterType)
</script>
```

Version simplifiée sans dépendance externe — dans `ElementsView.vue` directement :

```vue
<div class="filters">
  <input v-model="searchText" type="search" placeholder="Rechercher…" class="filter-input" />
  <select v-model="filterType" class="filter-select">
    <option value="">Tous les types</option>
    <option v-for="t in ASSET_TYPES" :key="t.key" :value="t.key">{{ t.icon }} {{ t.label }}</option>
  </select>
  <button v-if="searchText || filterType" class="btn-clear" @click="clearFilters">✕ Effacer</button>
</div>
```

---

## Étape 3 — Composant `ElementCard.vue`

```vue
<template>
  <div class="element-card" @click="$emit('select', item)">
    <span class="icon">{{ item._icon }}</span>
    <div class="info">
      <span class="name">{{ item.name || '(sans nom)' }}</span>
      <span class="meta">[{{ item.id }}] · {{ item._typeLabel }}</span>
    </div>
    <div class="badges">
      <span v-if="item.serial" class="badge-serial">{{ item.serial }}</span>
      <span :class="['badge-state', stateClass]">{{ stateLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ item: Object })
defineEmits(['select'])

const STATE_LABELS = { 0: 'En service', 1: 'En panne', 2: 'En réparation', 3: 'Mis au rebut' }
const STATE_CLASSES = { 0: 'state-ok', 1: 'state-down', 2: 'state-repair', 3: 'state-retired' }

const stateLabel = computed(() => STATE_LABELS[props.item.states_id ?? 0] ?? 'Inconnu')
const stateClass = computed(() => STATE_CLASSES[props.item.states_id ?? 0] ?? '')
</script>

<style scoped>
.element-card {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.1s;
}
.element-card:hover { background: #f8f9fb; }
.icon { font-size: 1.3rem; }
.info { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; }
.name { font-weight: 600; font-size: 0.95rem; }
.meta { font-size: 0.8rem; color: #888; }
.badges { display: flex; gap: 0.5rem; align-items: center; }
.badge-serial { font-size: 0.78rem; color: #666; font-family: monospace; }
.badge-state { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 10px; }
.state-ok     { background: #eafaf1; color: #27ae60; }
.state-down   { background: #fdf3f3; color: #e74c3c; }
.state-repair { background: #fef9e7; color: #d4ac0d; }
.state-retired { background: #f0f0f0; color: #999; }
</style>
```

---

## Étape 4 — Vue principale `ElementsView.vue`

```vue
<template>
  <div class="elements-page">
    <div class="page-header">
      <h1>Parc informatique</h1>
      <RouterLink to="/nouveau-ticket" class="btn-primary">
        ＋ Signaler un problème
      </RouterLink>
    </div>

    <!-- Filtres -->
    <div class="filters">
      <input v-model="searchText" type="search" placeholder="Rechercher par nom…" class="filter-input" />
      <select v-model="filterType" class="filter-select">
        <option value="">Tous les types</option>
        <option v-for="t in ASSET_TYPES" :key="t.key" :value="t.key">
          {{ t.icon }} {{ t.label }}
        </option>
      </select>
      <button v-if="searchText || filterType" class="btn-clear" @click="clearFilters">✕</button>
    </div>

    <!-- Résumé -->
    <div v-if="!loading" class="result-summary">
      {{ filteredItems.length }} élément(s) trouvé(s)
    </div>

    <!-- État -->
    <div v-if="loading" class="state-msg">Chargement du parc…</div>
    <div v-else-if="error" class="error-msg">{{ error }}</div>

    <!-- Liste -->
    <div v-else class="list-wrapper">
      <ElementCard
        v-for="item in pagedItems"
        :key="`${item._type}-${item.id}`"
        :item="item"
        @select="openDetail"
      />
      <div v-if="filteredItems.length === 0" class="empty">Aucun élément correspondant.</div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button :disabled="page <= 1" @click="page--">‹ Préc.</button>
      <span>Page {{ page }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="page++">Suiv. ›</button>
    </div>

    <!-- Fiche détail -->
    <ElementDetail v-if="selectedItem" :item="selectedItem" @close="selectedItem = null" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import ElementCard from '../components/Elements/ElementCard.vue'
import ElementDetail from '../components/Elements/ElementDetail.vue'
import { useElements } from '../composables/useElements.js'

const { filteredItems, loading, error, searchText, filterType, loadAll, clearFilters, ASSET_TYPES } = useElements()
const page = ref(1)
const PAGE_SIZE = 25
const selectedItem = ref(null)

watch([searchText, filterType], () => { page.value = 1 })

const totalPages = computed(() => Math.ceil(filteredItems.value.length / PAGE_SIZE))
const pagedItems = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredItems.value.slice(start, start + PAGE_SIZE)
})

function openDetail(item) { selectedItem.value = item }

onMounted(loadAll)
</script>
```

---

## Étape 5 — Composant `ElementDetail.vue` (fiche)

Modal affichant les détails d'un élément :

```vue
<template>
  <div class="overlay" @mousedown.self="$emit('close')">
    <div class="detail-modal">
      <div class="modal-header">
        <h3>{{ item._icon }} {{ item.name }}</h3>
        <button @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <dl>
          <dt>Type</dt><dd>{{ item._typeLabel }}</dd>
          <dt>ID GLPI</dt><dd>{{ item.id }}</dd>
          <dt v-if="item.serial">N° de série</dt><dd v-if="item.serial">{{ item.serial }}</dd>
          <dt v-if="item.otherserial">Inventaire</dt><dd v-if="item.otherserial">{{ item.otherserial }}</dd>
          <dt v-if="item.comment">Commentaire</dt><dd v-if="item.comment">{{ item.comment }}</dd>
        </dl>
        <RouterLink :to="`/nouveau-ticket?item=${item._type}&id=${item.id}`" class="btn-primary">
          Signaler un problème sur cet élément
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ item: Object })
defineEmits(['close'])
</script>
```

---

## Note sur la session GLPI

Les pages FrontOffice sont publiques mais appellent quand même l'API GLPI.  
Il faut donc une session GLPI active en arrière-plan même pour les utilisateurs non identifiés.

**Solution recommandée** : appeler `glpiApi.initSessionAuto()` au montage de `ElementsView`
si `glpiApi.isAuthenticated()` retourne `false` :

```js
onMounted(async () => {
  if (!glpiApi.isAuthenticated()) {
    await glpiApi.initSessionAuto()
  }
  await loadAll()
})
```

> La méthode `initSessionAuto` utilise les credentials fixes de `.env`.
