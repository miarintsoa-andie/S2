<template>
  <div class="dashboard">
    <div class="dash-header">
      <h1>Dashboard</h1>
      <div class="dash-meta">
        <span v-if="lastUpdate" class="last-update">Dernière MAJ : {{ lastUpdate }}</span>
        <button class="btn-secondary" :disabled="loading" @click="loadAll">
          {{ loading ? '…' : 'Rafraîchir' }}
        </button>
      </div>
    </div>

    <!-- Éléments -->
    <section class="dash-section">
      <div class="section-title">
        Éléments
        <span class="section-total">Total : {{ stats.assetTotal ?? '—' }}</span>
      </div>
      <div class="cards-grid">
        <StatCard
          v-for="asset in stats.assets ?? []"
          :key="asset.key"
          :label="asset.label"
          :total="asset.total"
          :loading="loading"
          :error="asset.error"
        />
      </div>
    </section>

    <!-- Tickets -->
    <section class="dash-section">
      <div class="section-title">
        Tickets
        <span class="section-total">Total : {{ stats.ticketTotal ?? '—' }}</span>
      </div>
      <div class="cards-grid">
        <StatCard
          v-for="ticket in stats.tickets ?? []"
          :key="ticket.key"
          :label="ticket.label"
          :total="ticket.total"
          :loading="loading"
          :error="ticket.error"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import StatCard from '../components/Dashboard/StatCard.vue'
import { useStats } from '../composables/useStats.js'

const { stats, loading, lastUpdate, loadAll } = useStats()
onMounted(loadAll)
</script>

<style scoped>
.dashboard { padding: 1.5rem 2rem; max-width: 1100px; margin: 0 auto; }
.dash-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 2rem;
}
h1 { margin: 0; font-size: 1.5rem; }
.dash-meta { display: flex; align-items: center; gap: 1rem; }
.last-update { font-size: 0.85rem; color: #888; }
.dash-section { margin-bottom: 2.5rem; }
.section-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.section-total {
  font-weight: 400;
  color: #888;
  font-size: 0.85rem;
  text-transform: none;
  letter-spacing: 0;
}
.cards-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.btn-secondary {
  background: #fff; border: 1px solid #ccc;
  padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;
}
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>