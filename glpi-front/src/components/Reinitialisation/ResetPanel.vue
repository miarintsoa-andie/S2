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
h2 { margin: 0 0 1.5rem; font-size: 1.3rem; color: #222; }
.field { margin: 0 0 1.5rem; display: flex; flex-direction: column; gap: 0.3rem; }
label { font-size: 0.9rem; font-weight: 600; color: #555; }
select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  max-width: 240px;
}
.items-list {
  border: 1px solid #ddd;
  border-radius: 6px;
  max-height: 320px;
  overflow-y: auto;
  margin: 0 0 1rem;
}
.list-header {
  padding: 0.6rem 1rem;
  background: #f7f8fa;
  border-bottom: 1px solid #ddd;
  font-weight: 600;
  position: sticky;
  top: 0;
}
ul { list-style: none; margin: 0; padding: 0; }
li { padding: 0.45rem 1rem; border-bottom: 1px solid #f0f0f0; }
li:last-child { border-bottom: none; }
li label { font-weight: normal; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.empty { color: #999; font-style: italic; }
.error { color: #e74c3c; background: #fdf3f3; padding: 0.4rem 0.6rem; border-radius: 4px; }
.loading { color: #888; font-style: italic; }
.actions { margin-top: 1rem; }
.btn-danger {
  background: #e74c3c;
  color: #fff;
  border: none;
  padding: 0.65rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-danger:hover:not(:disabled) { background: #c0392b; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
