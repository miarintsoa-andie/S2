# Module 4 — Dashboard (Stats éléments + tickets)

> **Attendu :** Afficher le nombre d'éléments général avec détails par type, et le nombre de tickets avec détail par type.  
> **Statut glpi-front :** ❌ À créer.

---

## Résultat attendu

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard                           [ Rafraîchir ] 14:32:05   │
├────────────────────── ÉLÉMENTS ─────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Ordinateurs│  │Moniteurs │  │  Réseau  │  │ Logiciels│       │
│  │    38    │  │    12    │  │    24    │  │    76    │       │
│  │● En ligne│  │● En ligne│  │● En ligne│  │● En ligne│       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│            Total éléments : 150                                 │
│                                                                 │
├────────────────────── TICKETS ──────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Nouveaux │  │ En cours │  │En attente│  │  Résolus │       │
│  │    12    │  │    27    │  │     8    │  │    45    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│            Total tickets : 142   (dont 6 clos)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture des fichiers

```
src/
├── views/
│   └── DashboardView.vue
├── components/
│   └── Dashboard/
│       ├── StatCard.vue        ← carte générique (nom + compteur + état)
│       └── StatSection.vue     ← groupe de cartes avec titre de section
└── composables/
    └── useStats.js             ← chargement parallèle des compteurs
```

Route à ajouter :
```js
{ path: '/dashboard', component: () => import('../views/DashboardView.vue'), meta: { backoffice: true } }
```

---

## Étape 1 — Composable `useStats.js`

Utilise le header `Content-Range` pour obtenir les totaux sans charger tous les items :

```js
// src/composables/useStats.js
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

export function useStats() {
  const stats = ref({})
  const loading = ref(false)
  const lastUpdate = ref(null)

  const ASSET_TYPES = [
    { key: 'Computer',        label: 'Ordinateurs' },
    { key: 'Monitor',         label: 'Moniteurs' },
    { key: 'NetworkEquipment',label: 'Réseau' },
    { key: 'Software',        label: 'Logiciels' },
    { key: 'Printer',         label: 'Imprimantes' },
    { key: 'Phone',           label: 'Téléphones' },
    { key: 'Document',        label: 'Documents' },
  ]

  // Statuts tickets à compter séparément
  const TICKET_STATUSES = [
    { key: 1, label: 'Nouveaux' },
    { key: 2, label: 'Assignés' },
    { key: 4, label: 'En attente' },
    { key: 5, label: 'Résolus' },
    { key: 6, label: 'Clos' },
  ]

  async function fetchCount(itemtype, params = {}) {
    try {
      const { total } = await glpiApi.getItemsRaw(itemtype, {
        range: '0-0',
        only_id: '1',
        ...params,
      })
      return { total, error: false }
    } catch {
      return { total: 0, error: true }
    }
  }

  async function loadAll() {
    loading.value = true

    // Compteurs assets en parallèle
    const assetResults = await Promise.all(
      ASSET_TYPES.map(async ({ key, label }) => {
        const { total, error } = await fetchCount(key)
        return { key, label, total, error }
      })
    )

    // Compteur total tickets + par statut
    const [ticketTotal, ...ticketByStatus] = await Promise.all([
      fetchCount('Ticket'),
      ...TICKET_STATUSES.map(async ({ key, label }) => {
        // GLPI filtre par statut via le paramètre `searchText` ou criteria
        // Méthode simple : charger tous les tickets et filtrer côté client si volume faible
        // Pour de gros volumes, utiliser l'API de recherche GLPI
        const { total, error } = await fetchCount('Ticket', { 'criteria[0][field]': 12, 'criteria[0][value]': key })
        return { key, label, total, error }
      }),
    ])

    stats.value = {
      assets: assetResults,
      assetTotal: assetResults.reduce((sum, a) => sum + a.total, 0),
      tickets: ticketByStatus,
      ticketTotal: ticketTotal.total,
    }

    lastUpdate.value = new Date().toLocaleTimeString('fr-FR')
    loading.value = false
  }

  return { stats, loading, lastUpdate, loadAll, ASSET_TYPES }
}
```

---

## Étape 2 — Composant `StatCard.vue`

```vue
<template>
  <div class="stat-card" :class="{ 'stat-card--error': error }">
    <div class="card-label">{{ label }}</div>
    <div class="card-count">
      <span v-if="loading" class="skeleton">—</span>
      <span v-else>{{ total.toLocaleString('fr-FR') }}</span>
    </div>
    <div class="card-status">
      <span v-if="error" class="dot dot--error">● Erreur</span>
      <span v-else class="dot dot--ok">● En ligne</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  label:   { type: String, required: true },
  total:   { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  error:   { type: Boolean, default: false },
})
</script>

<style scoped>
.stat-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 1.25rem 1rem;
  text-align: center;
  min-width: 120px;
  transition: box-shadow 0.15s;
}
.stat-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.stat-card--error { border-color: #fad7d7; background: #fff5f5; }
.card-label { font-size: 0.82rem; color: #777; margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.card-count { font-size: 2rem; font-weight: 700; color: #222; margin-bottom: 0.4rem; }
.skeleton { color: #ddd; }
.dot { font-size: 0.78rem; }
.dot--ok    { color: #27ae60; }
.dot--error { color: #e74c3c; }
</style>
```

---

## Étape 3 — Vue principale `DashboardView.vue`

```vue
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
```

---

## Note sur le filtrage des tickets par statut

L'API GLPI accepte des critères de recherche via les paramètres `criteria` :

```
GET /api/Ticket?criteria[0][field]=12&criteria[0][value]=1&criteria[0][searchtype]=equals&range=0-0&only_id=1
```

- `field=12` = champ statut dans GLPI (peut varier selon la version)
- `value=1` = statut "Nouveau"

Si cette méthode ne retourne pas les bons totaux, une alternative est de charger
tous les tickets (`range=0-999`) et de filtrer côté client par statut.
