<template>
  <div class="elements-page">
    <div class="page-header">
      <h1>Parc informatique</h1>
      <RouterLink to="/" class="btn-primary">
        ＋ Signaler un problème
      </RouterLink>
    </div>

    <!-- Filtres -->
    <div class="filters">
      <input v-model="searchText" type="search" placeholder="Rechercher par nom…" class="filter-input" />
      <select v-model="filterType" class="filter-select">
        <option value="">Tous les types</option>
        <option v-for="t in assets_types" :key="t.key" :value="t.key">
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
// import ElementFilters from '../components/Elements/ElementFilters.vue'
import { useElements } from '../composables/useElements.js'

const { filteredItems, loading, error, searchText, filterType, loadAll, clearFilters, assets_types } = useElements()
const page = ref(1)
const PAGE_SIZE = 15
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