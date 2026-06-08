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

const successCount = computed(() =>
  props.results.filter((r) => Object.values(r).some((v) => v === true)).length
)
const failCount = computed(() => props.results.length - successCount.value)
const failedItems = computed(() =>
  props.results.filter((r) => !Object.values(r).some((v) => v === true))
)
</script>

<style scoped>
.reset-result { margin-top: 1.5rem; }
.stats { display: flex; gap: 1rem; margin-bottom: 1rem; }
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 2rem;
  border-radius: 6px;
}
.stat.success { background: #eafaf1; border: 1px solid #27ae60; }
.stat.fail    { background: #fdf3f3; border: 1px solid #e74c3c; }
.count { font-size: 2rem; font-weight: 700; }
.label { font-size: 0.85rem; color: #555; }
.errors { margin: 1rem 0; font-size: 0.9rem; color: #c0392b; }
.errors ul { margin: 0.5rem 0 0 1.2rem; }
.btn-secondary {
  padding: 0.5rem 1.2rem;
  background: #fff;
  border: 1px solid #888;
  border-radius: 4px;
  cursor: pointer;
}
.btn-secondary:hover { background: #f5f5f5; }
</style>
