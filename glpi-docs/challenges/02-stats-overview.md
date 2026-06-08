# Challenge 02 — Tableau de bord de statistiques

**Difficulté : ⭐⭐ Facile+**  
**Durée estimée : 1 h 30**

---

## Objectif

Créer une vue "Dashboard" qui affiche en temps réel le nombre d'éléments présents dans GLPI pour plusieurs types d'objets. L'utilisateur peut choisir quels types afficher et rafraîchir les données manuellement.

---

## Résultat attendu

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Tickets    │  │  Ordinateurs │  │   Logiciels  │  │  Documents   │
│              │  │              │  │              │  │              │
│     142      │  │      38      │  │      76      │  │      21      │
│              │  │              │  │              │  │              │
│  ● En ligne  │  │  ● En ligne  │  │  ● En ligne  │  │  ● En ligne  │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

                    [ Rafraîchir ]   Dernière MAJ : 14:32:05
```

---

## Fonctionnalités attendues

- [ ] Afficher des cartes avec le nom du type et le nombre d'éléments
- [ ] Charger plusieurs types en parallèle (`Promise.all`)
- [ ] Indicateur de chargement par carte
- [ ] Indicateur d'erreur si un type est inaccessible (droits insuffisants)
- [ ] Bouton "Rafraîchir" qui recharge tous les compteurs
- [ ] Afficher l'heure de la dernière mise à jour
- [ ] Au moins 4 types configurables

---

## Fichiers à créer

```
src/components/shared/StatCard.vue     # Carte individuelle
src/composables/useStats.js            # Logique de chargement
src/views/DashboardView.vue            # Vue principale
```

Ajouter la route dans `router/index.js` :
```js
{ path: '/dashboard', component: () => import('../views/DashboardView.vue') }
```

---

## Amorce de code

### `useStats.js`

```js
// src/composables/useStats.js
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

// Types à surveiller (modifiable)
const WATCHED_TYPES = [
  { itemtype: 'Ticket',   label: 'Tickets' },
  { itemtype: 'Computer', label: 'Ordinateurs' },
  { itemtype: 'Software', label: 'Logiciels' },
  { itemtype: 'Document', label: 'Documents' },
  { itemtype: 'Contract', label: 'Contrats' },
]

export function useStats() {
  // Un objet réactif : { Ticket: { count, loading, error }, ... }
  const stats = ref({})
  const lastUpdated = ref(null)

  async function fetchAll() {
    // Initialiser toutes les cartes en état "loading"
    WATCHED_TYPES.forEach(({ itemtype }) => {
      stats.value[itemtype] = { count: null, loading: true, error: null }
    })

    // TODO: lancer tous les appels en parallèle avec Promise.all
    // Pour chaque type, appeler glpiApi.getItems(itemtype, { range: '0-0', only_id: '1' })
    // et lire le header Content-Range pour obtenir le total
    // En cas d'erreur 403, mettre error: 'Accès refusé'
  }

  return { stats, lastUpdated, WATCHED_TYPES, fetchAll }
}
```

### `StatCard.vue`

```vue
<!-- src/components/shared/StatCard.vue -->
<template>
  <div class="stat-card" :class="{ loading: stat.loading, error: !!stat.error }">
    <h3>{{ label }}</h3>

    <div v-if="stat.loading" class="skeleton" />

    <p v-else-if="stat.error" class="error-msg">
      {{ stat.error }}
    </p>

    <p v-else class="count">{{ stat.count }}</p>

    <span class="status-dot" />
  </div>
</template>

<script setup>
defineProps({
  label: String,
  stat: Object,   // { count, loading, error }
})
</script>

<style scoped>
.stat-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  min-width: 150px;
  transition: box-shadow 0.2s;
}
.stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.stat-card.error { border-color: #e74c3c; }

.count {
  font-size: 2.5rem;
  font-weight: bold;
  color: #2c3e50;
  margin: 0.5rem 0;
}

.skeleton {
  height: 2.5rem;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
  border-radius: 4px;
  margin: 0.5rem auto;
  width: 80px;
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

.error-msg { color: #e74c3c; font-size: 0.85rem; }

.status-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #27ae60;
  margin-top: 0.5rem;
}
.error .status-dot { background: #e74c3c; }
</style>
```

### `DashboardView.vue` (squelette)

```vue
<!-- src/views/DashboardView.vue -->
<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h2>Tableau de bord</h2>
      <div class="controls">
        <!-- TODO: bouton Rafraîchir -->
        <!-- TODO: afficher lastUpdated -->
      </div>
    </div>

    <div class="cards-grid">
      <!-- TODO: boucler sur WATCHED_TYPES et afficher StatCard pour chacun -->
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import StatCard from '../components/shared/StatCard.vue'
import { useStats } from '../composables/useStats.js'

const { stats, lastUpdated, WATCHED_TYPES, fetchAll } = useStats()

onMounted(fetchAll)
</script>

<style scoped>
.dashboard { padding: 2rem; }
.dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.cards-grid { display: flex; flex-wrap: wrap; gap: 1.5rem; }
</style>
```

---

## Astuce — Lire le total d'items sans les charger

GLPI retourne le nombre total d'éléments dans le header HTTP `Content-Range` :

```
Content-Range: 0-0/142
                    ^^^-- total
```

Dans `fetch`, récupérer ce header ainsi :
```js
const res = await fetch(`/api/${itemtype}?range=0-0&only_id=1`, { headers: headers() })
const contentRange = res.headers.get('Content-Range')  // ex: "0-0/142"
const total = contentRange ? parseInt(contentRange.split('/')[1]) : 0
```

---

## Indices

<details>
<summary>Indice 1 — Promise.all avec gestion d'erreur individuelle</summary>

Utiliser `Promise.allSettled` au lieu de `Promise.all` pour que l'échec d'un type n'empêche pas les autres de s'afficher :

```js
const results = await Promise.allSettled(
  WATCHED_TYPES.map(({ itemtype }) => fetchOne(itemtype))
)
```
</details>

<details>
<summary>Indice 2 — Heure de dernière mise à jour</summary>

```js
lastUpdated.value = new Date().toLocaleTimeString('fr-FR')
```
Afficher ensuite `{{ lastUpdated }}` dans le template.
</details>

---

## Pour aller plus loin

- Rafraîchissement automatique toutes les 30 secondes (`setInterval` + nettoyage dans `onUnmounted`)
- Cliquer sur une carte navigue vers la vue Réinitialisation filtrée sur ce type
- Ajouter un mini-graphique sparkline (librairie `Chart.js` ou `echarts`) montrant l'évolution sur la session
- Permettre à l'utilisateur de choisir quels types afficher (cases à cocher persistées dans `localStorage`)
