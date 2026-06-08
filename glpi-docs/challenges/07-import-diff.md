# Challenge 07 — Comparateur avant/après import

**Difficulté : ⭐⭐⭐⭐⭐ Avancé**  
**Durée estimée : 5 h+**

---

## Objectif

Créer un module qui, avant d'exécuter un import de données, compare l'état actuel de GLPI avec ce qui va être importé, et affiche une vue "diff" ligne par ligne — comme un diff Git. L'utilisateur peut sélectionner quelles lignes importer, lesquelles ignorer, et peut annuler l'import complet après coup en restaurant l'état précédent.

Ce challenge combine le parsing CSV (challenge 05), l'appel API pour lire l'état courant, un algorithme de diff, et un store réactif partagé entre plusieurs composants.

---

## Résultat attendu

```
Fichier importé : assets.csv (12 lignes)

┌──────────────────────────────────────────────────────────────────┐
│ Ligne │ Nom              │ Statut  │ Action détectée   │ Import  │
├──────────────────────────────────────────────────────────────────┤
│  1    │ PC-Bureau-01     │ En stock│ ≡ Identique       │  ☐      │
│  2    │ PC-Direction-02  │ En stock│ ✎ Modifié (serial)│  ☑      │
│  3    │ Laptop-RH-05     │ —       │ + Nouveau          │  ☑      │
│  4    │ Switch-3A        │ En stock│ ✎ Modifié (nom)   │  ☑      │
│  5    │ (Serveur-Prod)   │ Actif   │ ✕ Absent du CSV   │  —      │
└──────────────────────────────────────────────────────────────────┘

Résumé : 1 identique · 2 modifications · 1 nouveau · 1 absent
[ Importer la sélection (3 lignes) ]   [ Annuler tout ]

--- Après import ---
┌────────────────────────────────────────────────────┐
│ ✓ PC-Direction-02 mis à jour (serial: SN-XF-992)   │
│ ✓ Laptop-RH-05 créé (#89)                          │
│ ✓ Switch-3A mis à jour (nom: Switch-Bureau-3A)     │
└────────────────────────────────────────────────────┘
[ Annuler cet import ]
```

---

## Fonctionnalités attendues

- [ ] Upload d'un CSV et parsing (réutiliser `csvParser.js` du challenge 05)
- [ ] Chargement de l'état actuel dans GLPI pour le même type d'item
- [ ] Algorithme de **diff** : comparer par nom et détecter Identique / Modifié / Nouveau / Absent
- [ ] Tableau de diff avec une colonne "Import" (checkbox) pour chaque ligne modifiée/nouvelle
- [ ] Les lignes "Identique" et "Absent" ne sont pas importables (case grisée)
- [ ] Résumé des actions avant confirmation
- [ ] Exécution de l'import uniquement sur les lignes sélectionnées
- [ ] **Snapshot** de l'état avant import stocké dans un store Pinia
- [ ] Bouton "Annuler cet import" qui revert les modifications via l'API

---

## Fichiers à créer

```
src/stores/importStore.js          # Store Pinia (état partagé)
src/utils/diffEngine.js            # Algorithme de diff
src/composables/useImportDiff.js   # Logique principale
src/components/ImportDiff/DiffTable.vue
src/components/ImportDiff/DiffRow.vue
src/components/ImportDiff/DiffSummary.vue
src/components/ImportDiff/RollbackPanel.vue
src/views/ImportDiffView.vue
```

Route : `{ path: '/import/diff', component: () => import('../views/ImportDiffView.vue') }`

> **Prérequis** : installer Pinia
> ```bash
> npm install pinia
> ```
> Dans `main.js`, ajouter `app.use(createPinia())` avant `app.use(router)`.

---

## Amorce de code

### `diffEngine.js`

```js
// src/utils/diffEngine.js

/**
 * Compare les lignes CSV avec les items GLPI existants.
 * La comparaison se fait par le champ `name`.
 *
 * Retourne un tableau de DiffEntry :
 * { status: 'identical'|'modified'|'new'|'absent', csvRow, glpiItem, changedFields }
 */
export function computeDiff(csvRows, glpiItems, fieldMapping) {
  const results = []

  // Index GLPI par nom (en minuscule pour comparaison insensible à la casse)
  const glpiByName = new Map(
    glpiItems.map((item) => [item.name?.toLowerCase(), item])
  )
  const csvNames = new Set()

  for (const row of csvRows) {
    // Construire l'objet cible à partir du mapping
    const target = {}
    Object.entries(fieldMapping).forEach(([csvCol, glpiField]) => {
      if (glpiField) target[glpiField] = row[csvCol]
    })

    const name = target.name?.toLowerCase()
    if (!name) continue
    csvNames.add(name)

    const existing = glpiByName.get(name)

    if (!existing) {
      results.push({ status: 'new', csvRow: row, target, glpiItem: null, changedFields: [] })
      continue
    }

    // Détecter les champs modifiés
    const changedFields = Object.entries(target)
      .filter(([field, value]) => {
        const currentValue = String(existing[field] ?? '')
        return currentValue !== String(value ?? '')
      })
      .map(([field]) => field)

    results.push({
      status: changedFields.length > 0 ? 'modified' : 'identical',
      csvRow: row,
      target,
      glpiItem: existing,
      changedFields,
    })
  }

  // Items GLPI absents du CSV
  glpiItems
    .filter((item) => !csvNames.has(item.name?.toLowerCase()))
    .forEach((item) => {
      results.push({ status: 'absent', csvRow: null, target: null, glpiItem: item, changedFields: [] })
    })

  return results
}
```

### `importStore.js`

```js
// src/stores/importStore.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useImportStore = defineStore('import', () => {
  // Snapshot de l'état AVANT import { id -> { field: originalValue } }
  const snapshot = ref({})
  const importedIds = ref([])   // IDs créés (pour rollback complet)
  const patchedItems = ref([])  // { id, field, oldValue, newValue }

  function saveSnapshot(items, fields) {
    snapshot.value = {}
    items.forEach((item) => {
      snapshot.value[item.id] = {}
      fields.forEach((f) => {
        if (item[f] !== undefined) snapshot.value[item.id][f] = item[f]
      })
    })
  }

  function recordCreated(id) {
    importedIds.value.push(id)
  }

  function recordPatched(id, field, oldValue, newValue) {
    patchedItems.value.push({ id, field, oldValue, newValue })
  }

  function clear() {
    snapshot.value = {}
    importedIds.value = []
    patchedItems.value = []
  }

  const hasRollbackData = () =>
    importedIds.value.length > 0 || patchedItems.value.length > 0

  return { snapshot, importedIds, patchedItems, saveSnapshot, recordCreated, recordPatched, clear, hasRollbackData }
})
```

### `useImportDiff.js`

```js
// src/composables/useImportDiff.js
import { ref, computed } from 'vue'
import { glpiApi } from '../services/glpiApi.js'
import { parseCsv } from '../utils/csvParser.js'
import { computeDiff } from '../utils/diffEngine.js'
import { useImportStore } from '../stores/importStore.js'

export function useImportDiff() {
  const store = useImportStore()

  const step = ref('upload')   // 'upload' | 'diff' | 'result' | 'rollback'
  const itemtype = ref('Computer')
  const fieldMapping = ref({ name: 'name', serial: 'serial' })  // à rendre configurable

  const diffRows = ref([])
  const selectedIndexes = ref([])   // index dans diffRows à importer
  const loading = ref(false)
  const results = ref([])

  // Statistiques du diff
  const stats = computed(() => ({
    identical: diffRows.value.filter((r) => r.status === 'identical').length,
    modified:  diffRows.value.filter((r) => r.status === 'modified').length,
    newItems:  diffRows.value.filter((r) => r.status === 'new').length,
    absent:    diffRows.value.filter((r) => r.status === 'absent').length,
  }))

  async function loadAndDiff(file) {
    loading.value = true
    try {
      // 1. Parser le CSV
      const text = await file.text()
      const { rows } = parseCsv(text)

      // 2. Charger l'état actuel depuis GLPI (tous les items du type)
      const glpiItems = await glpiApi.getItems(itemtype.value, { range: '0-999' })

      // 3. Sauvegarder le snapshot avant modification
      const trackedFields = Object.values(fieldMapping.value).filter(Boolean)
      store.saveSnapshot(glpiItems, trackedFields)

      // 4. Calculer le diff
      diffRows.value = computeDiff(rows, glpiItems, fieldMapping.value)

      // Pré-sélectionner les lignes modifiées et nouvelles
      selectedIndexes.value = diffRows.value
        .map((r, i) => (['modified', 'new'].includes(r.status) ? i : null))
        .filter((i) => i !== null)

      step.value = 'diff'
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  async function executeImport() {
    const toImport = selectedIndexes.value.map((i) => diffRows.value[i])
    loading.value = true
    results.value = []

    for (const entry of toImport) {
      try {
        if (entry.status === 'new') {
          const res = await glpiApi.createItem(itemtype.value, { input: entry.target })
          store.recordCreated(res.id)
          results.value.push({ ok: true, label: entry.target.name, action: 'créé', id: res.id })
        } else if (entry.status === 'modified') {
          const patchBody = { input: { id: entry.glpiItem.id, ...entry.target } }
          await glpiApi.patchItem(itemtype.value, entry.glpiItem.id, patchBody)
          entry.changedFields.forEach((f) => {
            store.recordPatched(entry.glpiItem.id, f, entry.glpiItem[f], entry.target[f])
          })
          results.value.push({ ok: true, label: entry.target.name, action: 'modifié' })
        }
      } catch (e) {
        results.value.push({ ok: false, label: entry.target?.name || '?', error: e.message })
      }
    }

    loading.value = false
    step.value = 'result'
  }

  async function rollback() {
    loading.value = true
    step.value = 'rollback'

    // Supprimer les items créés
    for (const id of store.importedIds) {
      try { await glpiApi.deleteItem(itemtype.value, id) } catch {}
    }

    // Restaurer les champs modifiés
    const byId = {}
    store.patchedItems.forEach(({ id, field, oldValue }) => {
      if (!byId[id]) byId[id] = { id }
      byId[id][field] = oldValue
    })
    for (const patch of Object.values(byId)) {
      try { await glpiApi.patchItem(itemtype.value, patch.id, { input: patch }) } catch {}
    }

    store.clear()
    loading.value = false
    step.value = 'upload'
  }

  return {
    step, itemtype, diffRows, selectedIndexes, loading, results, stats,
    loadAndDiff, executeImport, rollback,
    hasRollback: store.hasRollbackData,
  }
}
```

### `DiffTable.vue`

```vue
<!-- src/components/ImportDiff/DiffTable.vue -->
<template>
  <div class="diff-table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Ligne</th>
          <th>Nom</th>
          <th>Champs modifiés</th>
          <th>Action</th>
          <th>
            <input
              type="checkbox"
              :checked="allSelectableSelected"
              @change="toggleAll"
              title="Tout sélectionner"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <DiffRow
          v-for="(row, index) in diffRows"
          :key="index"
          :row="row"
          :index="index"
          :selected="selectedIndexes.includes(index)"
          @toggle="$emit('toggle', index)"
        />
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DiffRow from './DiffRow.vue'

const props = defineProps({
  diffRows: Array,
  selectedIndexes: Array,
})
const emit = defineEmits(['toggle', 'toggle-all'])

const selectable = computed(() =>
  props.diffRows
    .map((r, i) => (['new', 'modified'].includes(r.status) ? i : null))
    .filter((i) => i !== null)
)

const allSelectableSelected = computed(() =>
  selectable.value.length > 0 &&
  selectable.value.every((i) => props.selectedIndexes.includes(i))
)

function toggleAll() {
  emit('toggle-all', allSelectableSelected.value ? [] : selectable.value)
}
</script>

<style scoped>
.diff-table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.6rem 1rem; text-align: left; border-bottom: 1px solid #eee; }
th { background: #f8f8f8; font-weight: 600; }
</style>
```

### `DiffRow.vue`

```vue
<!-- src/components/ImportDiff/DiffRow.vue -->
<template>
  <tr :class="statusClass">
    <td>{{ index + 1 }}</td>
    <td>{{ label }}</td>
    <td>
      <span v-if="row.changedFields.length > 0" class="changed-fields">
        {{ row.changedFields.join(', ') }}
      </span>
      <span v-else>—</span>
    </td>
    <td>
      <span class="badge" :class="row.status">{{ STATUS_LABELS[row.status] }}</span>
    </td>
    <td>
      <input
        v-if="isSelectable"
        type="checkbox"
        :checked="selected"
        @change="$emit('toggle')"
      />
      <span v-else class="na">—</span>
    </td>
  </tr>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  row: Object,
  index: Number,
  selected: Boolean,
})
defineEmits(['toggle'])

const STATUS_LABELS = {
  identical: '≡ Identique',
  modified:  '✎ Modifié',
  new:       '+ Nouveau',
  absent:    '✕ Absent',
}

const isSelectable = computed(() => ['new', 'modified'].includes(props.row.status))
const label = computed(() => props.row.target?.name ?? props.row.glpiItem?.name ?? '?')
const statusClass = computed(() => `row-${props.row.status}`)
</script>

<style scoped>
.row-identical { color: #888; }
.row-modified  { background: #fff8e1; }
.row-new       { background: #eafaf1; }
.row-absent    { background: #fdf3f3; color: #c0392b; }
.badge {
  display: inline-block; padding: 0.1rem 0.4rem;
  border-radius: 3px; font-size: 0.8rem; font-weight: 600;
}
.badge.identical { background: #ecf0f1; color: #7f8c8d; }
.badge.modified  { background: #fef9c3; color: #b7950b; }
.badge.new       { background: #d5f5e3; color: #1e8449; }
.badge.absent    { background: #fadbd8; color: #c0392b; }
.na { color: #ccc; }
.changed-fields { font-size: 0.82rem; font-family: monospace; color: #e67e22; }
</style>
```

### `RollbackPanel.vue`

```vue
<!-- src/components/ImportDiff/RollbackPanel.vue -->
<template>
  <div class="rollback-panel">
    <p class="warning">
      ⚠ Import terminé. Vous pouvez annuler toutes les modifications effectuées.
    </p>
    <div class="summary">
      <span>{{ successCount }} opération(s) effectuée(s)</span>
    </div>
    <button class="danger" :disabled="loading" @click="$emit('rollback')">
      {{ loading ? 'Annulation...' : 'Annuler cet import (rollback)' }}
    </button>
    <p class="hint">
      Le rollback supprimera les items créés et restaurera les valeurs d'origine des items modifiés.
    </p>
  </div>
</template>

<script setup>
defineProps({ successCount: Number, loading: Boolean })
defineEmits(['rollback'])
</script>

<style scoped>
.rollback-panel {
  margin-top: 1.5rem; padding: 1rem;
  background: #fdf3f3; border: 1px solid #e74c3c; border-radius: 6px;
}
.warning { color: #c0392b; font-weight: bold; }
.hint { font-size: 0.85rem; color: #888; margin-top: 0.5rem; }
.danger { background: #e74c3c; color: #fff; border: none; padding: 0.6rem 1.5rem; border-radius: 4px; cursor: pointer; }
.danger:disabled { opacity: 0.5; }
</style>
```

---

## Indices

<details>
<summary>Indice 1 — Comparer des valeurs hétérogènes</summary>

GLPI retourne certains champs numériques sous forme de string (`"3"` au lieu de `3`). Pour une comparaison fiable, toujours normaliser en string des deux côtés :
```js
String(existing[field] ?? '') !== String(value ?? '')
```
</details>

<details>
<summary>Indice 2 — Fichier trop volumineux pour charger tous les items</summary>

Si GLPI a plus de 1000 items, charger en plusieurs pages et les concaténer :
```js
async function getAllItems(itemtype) {
  const all = []
  let start = 0
  let hasMore = true
  while (hasMore) {
    const page = await glpiApi.getItems(itemtype, { range: `${start}-${start + 499}` })
    all.push(...page)
    hasMore = page.length === 500
    start += 500
  }
  return all
}
```
</details>

<details>
<summary>Indice 3 — Pinia dans un composable</summary>

`useImportStore()` doit être appelé à l'intérieur d'un composant ou d'un composable lui-même appelé depuis un composant — pas au niveau module. Si besoin d'y accéder en dehors, passer le store en paramètre.
</details>

<details>
<summary>Indice 4 — Rollback partiel</summary>

Si le rollback échoue sur un item, continuer quand même avec les autres (`try/catch` individuel). Afficher un bilan à la fin : "X restaurés, Y échecs".
</details>

---

## Pour aller plus loin

- Afficher les **détails du diff** au survol d'une ligne modifiée (tooltip montrant ancien/nouveau)
- Sauvegarder le snapshot dans `IndexedDB` (via la librairie `idb`) pour survivre à un rechargement de page
- Ajouter un mode "Simulation" qui exécute le diff sans modifier GLPI, et exporte le rapport en PDF
- Permettre la comparaison de deux fichiers CSV entre eux (sans passer par GLPI) pour détecter des évolutions dans le temps
