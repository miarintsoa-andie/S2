# Challenge 04 — Recherche et filtres avancés

**Difficulté : ⭐⭐⭐ Moyen**  
**Durée estimée : 2 h 30**

---

## Objectif

Créer un module de recherche et de filtrage temps réel sur une liste d'items GLPI. L'utilisateur choisit un type d'objet, tape dans une barre de recherche, applique des filtres combinés, et parcourt les résultats paginés — tout ça sans recharger la page.

---

## Résultat attendu

```
Type : [ Tickets ▾ ]

[ 🔍 Rechercher par nom...            ]

Filtres : [ Statut ▾ ]  [ Urgence ▾ ]     [ ✕ Réinitialiser les filtres ]

┌──────────────────────────────────────────────────────┐
│ # │ Nom                     │ Statut    │ Urgence    │
├──────────────────────────────────────────────────────┤
│ 42│ Problème réseau bureau  │ Nouveau   │ Haute      │
│ 38│ Mise à jour Windows     │ En cours  │ Basse      │
│ 31│ Écran noir poste admin  │ Résolu    │ Très haute │
└──────────────────────────────────────────────────────┘

Page 1/4  [ ← Préc ]  [ Suiv → ]   14 résultats
```

---

## Fonctionnalités attendues

- [ ] Sélecteur de type d'item (Ticket, Computer, Software, Document...)
- [ ] Barre de recherche avec **debounce** de 300ms (ne pas appeler l'API à chaque frappe)
- [ ] Filtre **Statut** pour les Tickets (Nouveau, En cours, Résolu, Clos)
- [ ] Filtre **Urgence** pour les Tickets (1 à 5)
- [ ] Filtres réinitialisables d'un coup
- [ ] Pagination : 10 items par page, boutons Précédent / Suivant
- [ ] Affichage du total de résultats (lu depuis le header `Content-Range`)
- [ ] Tableau responsive avec colonnes adaptées au type sélectionné

---

## Fichiers à créer

```
src/composables/useSearch.js
src/components/Search/SearchBar.vue
src/components/Search/FilterBar.vue
src/components/Search/ItemsTable.vue
src/components/Search/Pagination.vue
src/views/SearchView.vue
```

Route : `{ path: '/search', component: () => import('../views/SearchView.vue') }`

---

## Amorce de code

### `useSearch.js`

```js
// src/composables/useSearch.js
import { ref, reactive, watch } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

const PAGE_SIZE = 10

export function useSearch() {
  const itemtype = ref('Ticket')
  const query = ref('')
  const filters = reactive({ status: '', urgency: '' })

  const items = ref([])
  const total = ref(0)
  const page = ref(1)
  const loading = ref(false)
  const error = ref(null)

  let debounceTimer = null

  async function fetchItems() {
    loading.value = true
    error.value = null

    const start = (page.value - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE - 1

    const params = { range: `${start}-${end}` }

    // Recherche par nom
    if (query.value) {
      params['searchText[name]'] = query.value
    }

    // TODO: ajouter les filtres status et urgency dans params
    // GLPI accepte : params['searchText[status]'] = filters.status

    try {
      const res = await fetch(
        `/api/${itemtype.value}?${new URLSearchParams(params)}`,
        { headers: { 'Session-Token': /* récupérer depuis glpiApi */ '', 'Content-Type': 'application/json' } }
      )
      const rangeHeader = res.headers.get('Content-Range')
      total.value = rangeHeader ? parseInt(rangeHeader.split('/')[1]) : 0
      items.value = await res.json()
    } catch (e) {
      error.value = e.message
      items.value = []
    } finally {
      loading.value = false
    }
  }

  // Debounce sur la recherche texte
  function onQueryChange() {
    clearTimeout(debounceTimer)
    page.value = 1
    debounceTimer = setTimeout(fetchItems, 300)
  }

  // Réagir aux changements
  watch(query, onQueryChange)
  watch(filters, () => { page.value = 1; fetchItems() })
  watch([itemtype, page], fetchItems)

  function resetFilters() {
    // TODO: réinitialiser filters.status et filters.urgency
    query.value = ''
    page.value = 1
  }

  const totalPages = () => Math.ceil(total.value / PAGE_SIZE)
  const prevPage = () => { if (page.value > 1) page.value-- }
  const nextPage = () => { if (page.value < totalPages()) page.value++ }

  return {
    itemtype, query, filters, items, total, page,
    loading, error, fetchItems, resetFilters,
    totalPages, prevPage, nextPage, PAGE_SIZE,
  }
}
```

### `SearchBar.vue`

```vue
<!-- src/components/Search/SearchBar.vue -->
<template>
  <div class="search-bar">
    <span class="icon">🔍</span>
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <button v-if="modelValue" class="clear" @click="$emit('update:modelValue', '')">✕</button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: String,
  placeholder: { type: String, default: 'Rechercher...' },
})
defineEmits(['update:modelValue'])
</script>

<style scoped>
.search-bar {
  display: flex; align-items: center;
  border: 1px solid #ccc; border-radius: 6px;
  padding: 0.5rem 0.75rem; gap: 0.5rem;
  background: #fff; max-width: 400px;
}
.search-bar:focus-within { border-color: #3498db; }
input { border: none; outline: none; flex: 1; font-size: 1rem; }
.icon { color: #888; }
.clear { background: none; border: none; cursor: pointer; color: #888; font-size: 0.9rem; }
</style>
```

### `ItemsTable.vue` (colonnes adaptatives)

```vue
<!-- src/components/Search/ItemsTable.vue -->
<template>
  <div class="table-wrapper">
    <p v-if="loading" class="loading">Chargement...</p>
    <p v-else-if="items.length === 0" class="empty">Aucun résultat.</p>

    <table v-else>
      <thead>
        <tr>
          <th>#</th>
          <th>Nom</th>
          <th v-if="itemtype === 'Ticket'">Statut</th>
          <th v-if="itemtype === 'Ticket'">Urgence</th>
          <th v-if="itemtype === 'Computer'">Numéro de série</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>{{ item.id }}</td>
          <td>{{ item.name || '(sans nom)' }}</td>
          <td v-if="itemtype === 'Ticket'">{{ STATUS_LABELS[item.status] || item.status }}</td>
          <td v-if="itemtype === 'Ticket'">{{ URGENCY_LABELS[item.urgency] || item.urgency }}</td>
          <td v-if="itemtype === 'Computer'">{{ item.serial || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  items: Array,
  itemtype: String,
  loading: Boolean,
})

const STATUS_LABELS = { 1: 'Nouveau', 2: 'En cours', 3: 'Planifié', 4: 'En attente', 5: 'Résolu', 6: 'Clos' }
const URGENCY_LABELS = { 1: 'Très basse', 2: 'Basse', 3: 'Moyenne', 4: 'Haute', 5: 'Très haute' }
</script>

<style scoped>
.table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.6rem 1rem; text-align: left; border-bottom: 1px solid #eee; }
th { background: #f8f8f8; font-weight: 600; }
tr:hover td { background: #f5f9ff; }
.loading, .empty { color: #888; padding: 2rem; text-align: center; }
</style>
```

### `Pagination.vue`

```vue
<!-- src/components/Search/Pagination.vue -->
<template>
  <div class="pagination">
    <button :disabled="page <= 1" @click="$emit('prev')">← Préc</button>
    <span>Page {{ page }} / {{ totalPages }}</span>
    <button :disabled="page >= totalPages" @click="$emit('next')">Suiv →</button>
    <span class="total">{{ total }} résultat(s)</span>
  </div>
</template>

<script setup>
defineProps({ page: Number, totalPages: Number, total: Number })
defineEmits(['prev', 'next'])
</script>

<style scoped>
.pagination { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; }
button { padding: 0.4rem 0.8rem; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background: #fff; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.total { margin-left: auto; color: #888; font-size: 0.9rem; }
</style>
```

---

## Indices

<details>
<summary>Indice 1 — Accéder au session token depuis glpiApi</summary>

Exposer le token dans `glpiApi.js` pour pouvoir l'utiliser dans `useSearch` :
```js
// Dans glpiApi.js, ajouter :
getToken() { return sessionToken },
```
Puis dans `useSearch.js` :
```js
import { glpiApi } from '../services/glpiApi.js'
// ...
headers: { 'Session-Token': glpiApi.getToken(), 'Content-Type': 'application/json' }
```
</details>

<details>
<summary>Indice 2 — Filtres GLPI par statut</summary>

L'API GLPI accepte des critères de recherche via `criteria` en query string. Pour filtrer les tickets par statut :
```
GET /api/Ticket?criteria[0][field]=12&criteria[0][searchtype]=equals&criteria[0][value]=1
```
Le champ 12 = statut des tickets. Encoder correctement avec `URLSearchParams`.
</details>

<details>
<summary>Indice 3 — Debounce sans librairie</summary>

```js
let timer = null
function debounce(fn, delay) {
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
```
</details>

---

## Pour aller plus loin

- Sauvegarder l'état des filtres dans l'URL (`useRoute` / `useRouter`) pour que la recherche soit partageable
- Ajouter le tri par colonne (clic sur un en-tête → change `sort` et `order`)
- Export CSV des résultats actuels (générer un fichier Blob côté client)
- Mémoriser la dernière recherche dans `sessionStorage` pour la retrouver après navigation
