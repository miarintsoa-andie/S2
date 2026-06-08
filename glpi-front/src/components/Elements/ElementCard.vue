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