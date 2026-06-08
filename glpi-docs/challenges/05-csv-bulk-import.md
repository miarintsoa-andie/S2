# Challenge 05 — Import CSV avec prévisualisation

**Difficulté : ⭐⭐⭐⭐ Moyen+**  
**Durée estimée : 3 h**

---

## Objectif

Créer un module d'import de données en masse depuis un fichier CSV. L'utilisateur charge un fichier, voit une prévisualisation des données parsées, mappe les colonnes CSV aux champs GLPI, puis déclenche la création en lot via l'API — avec un suivi ligne par ligne du résultat.

---

## Résultat attendu

```
Étape 1 — Choisir un fichier CSV
┌──────────────────────────────────────────┐
│  Glissez votre fichier CSV ici           │
│  ou [ Parcourir ]                        │
└──────────────────────────────────────────┘
Type cible : [ Ticket ▾ ]

Étape 2 — Prévisualisation et mapping
CSV détecté : 3 colonnes, 25 lignes
┌──────────────┬──────────┬─────────────────┐
│ titre        │ priorite │ description     │
├──────────────┼──────────┼─────────────────┤
│ Pb réseau    │ 3        │ Switch HS...    │
│ Écran cassé  │ 2        │ Dalle brisée... │
└──────────────┴──────────┴─────────────────┘
Mapping colonnes :
  titre       →  [ name    ▾ ]
  priorite    →  [ urgency ▾ ]
  description →  [ content ▾ ]

[ Importer 25 tickets ]

Étape 3 — Progression
[█████████░░░░░] 14/25
  ✓ Ticket #201 — Pb réseau
  ✓ Ticket #202 — Écran cassé
  ✗ Ligne 3 : Champ "name" manquant
```

---

## Fonctionnalités attendues

- [ ] Upload et parsing d'un fichier CSV (séparateur `,` ou `;` auto-détecté)
- [ ] Prévisualisation des 5 premières lignes dans un tableau
- [ ] Mapping manuel des colonnes CSV vers les champs GLPI
- [ ] Validation : avertir si le champ obligatoire `name` n'est pas mappé
- [ ] Import en batch avec progression affichée ligne par ligne
- [ ] Récapitulatif final : nb succès / nb erreurs
- [ ] Téléchargement d'un rapport d'erreurs en CSV

---

## Fichiers à créer

```
src/utils/csvParser.js
src/composables/useCsvImport.js
src/components/CsvImport/CsvDropzone.vue
src/components/CsvImport/CsvPreview.vue
src/components/CsvImport/ColumnMapper.vue
src/components/CsvImport/ImportProgress.vue
src/views/CsvImportView.vue
```

Route : `{ path: '/import/csv', component: () => import('../views/CsvImportView.vue') }`

---

## Amorce de code

### `csvParser.js`

```js
// src/utils/csvParser.js

/**
 * Détecte le séparateur (virgule ou point-virgule) et parse le CSV.
 * Retourne { headers: string[], rows: object[] }
 */
export function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) throw new Error('Le fichier doit contenir au moins une ligne d\'en-tête et une ligne de données.')

  // Détecter le séparateur
  const sep = lines[0].includes(';') ? ';' : ','

  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ''))

  const rows = lines.slice(1).map((line, index) => {
    const values = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ''))
    if (values.length !== headers.length) {
      console.warn(`Ligne ${index + 2} ignorée : nombre de colonnes incorrect`)
      return null
    }
    // Construire un objet { header: value, ... }
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]))
  }).filter(Boolean)

  return { headers, rows }
}

/**
 * Génère un CSV à partir d'un tableau d'objets (pour le rapport d'erreurs)
 */
export function toCsv(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(',')),
  ]
  return lines.join('\n')
}

/**
 * Déclenche le téléchargement d'un fichier depuis le navigateur
 */
export function downloadFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### `useCsvImport.js`

```js
// src/composables/useCsvImport.js
import { ref, reactive, computed } from 'vue'
import { parseCsv, toCsv, downloadFile } from '../utils/csvParser.js'
import { glpiApi } from '../services/glpiApi.js'

// Champs GLPI disponibles pour le mapping
export const GLPI_FIELDS = {
  Ticket: [
    { key: 'name',    label: 'Titre (requis)' },
    { key: 'content', label: 'Description' },
    { key: 'urgency', label: 'Urgence (1-5)' },
    { key: 'type',    label: 'Type (1=Incident, 2=Demande)' },
  ],
  Computer: [
    { key: 'name',   label: 'Nom (requis)' },
    { key: 'serial', label: 'Numéro de série' },
    { key: 'otherserial', label: 'Numéro d\'inventaire' },
  ],
}

export function useCsvImport() {
  const step = ref(1)               // 1=upload, 2=mapping, 3=import
  const itemtype = ref('Ticket')
  const headers = ref([])
  const rows = ref([])
  const mapping = reactive({})      // { csvColumn: glpiField }
  const results = ref([])
  const progress = ref(0)
  const importing = ref(false)
  const parseError = ref(null)

  // Lignes prévisualisées (5 premières)
  const preview = computed(() => rows.value.slice(0, 5))
  const totalRows = computed(() => rows.value.length)
  const successCount = computed(() => results.value.filter((r) => r.ok).length)
  const errorCount = computed(() => results.value.filter((r) => !r.ok).length)

  function loadFile(file) {
    parseError.value = null
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const { headers: h, rows: r } = parseCsv(e.target.result)
        headers.value = h
        rows.value = r
        // Auto-mapping : si le nom de colonne CSV correspond exactement à un champ GLPI
        h.forEach((col) => {
          const fields = GLPI_FIELDS[itemtype.value] || []
          const match = fields.find((f) => f.key === col.toLowerCase())
          if (match) mapping[col] = match.key
        })
        step.value = 2
      } catch (e) {
        parseError.value = e.message
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  function buildInput(row) {
    const input = {}
    Object.entries(mapping).forEach(([csvCol, glpiField]) => {
      if (glpiField && row[csvCol] !== undefined) {
        // Convertir en entier si le champ le nécessite
        const intFields = ['urgency', 'type', 'priority']
        input[glpiField] = intFields.includes(glpiField) ? parseInt(row[csvCol]) : row[csvCol]
      }
    })
    return input
  }

  async function startImport() {
    importing.value = true
    step.value = 3
    results.value = []
    progress.value = 0

    for (let i = 0; i < rows.value.length; i++) {
      const row = rows.value[i]
      const input = buildInput(row)

      // TODO: valider que 'name' est présent si itemtype === 'Ticket'

      try {
        const res = await glpiApi.createItem(itemtype.value, { input })
        results.value.push({ ok: true, id: res.id, label: input.name || `Ligne ${i + 1}` })
      } catch (e) {
        results.value.push({ ok: false, label: input.name || `Ligne ${i + 1}`, error: e.message })
      }

      progress.value = Math.round(((i + 1) / rows.value.length) * 100)
    }

    importing.value = false
  }

  function downloadErrorReport() {
    const errors = results.value
      .filter((r) => !r.ok)
      .map((r) => ({ label: r.label, erreur: r.error }))
    downloadFile(toCsv(errors), 'erreurs-import.csv')
  }

  function reset() {
    step.value = 1
    headers.value = []
    rows.value = []
    Object.keys(mapping).forEach((k) => delete mapping[k])
    results.value = []
    progress.value = 0
    importing.value = false
    parseError.value = null
  }

  return {
    step, itemtype, headers, rows, mapping, results, progress, importing,
    parseError, preview, totalRows, successCount, errorCount,
    loadFile, startImport, downloadErrorReport, reset, GLPI_FIELDS,
  }
}
```

### `ColumnMapper.vue`

```vue
<!-- src/components/CsvImport/ColumnMapper.vue -->
<template>
  <div class="mapper">
    <h3>Mapping des colonnes</h3>
    <p class="hint">Associer chaque colonne CSV à un champ GLPI.</p>
    <table>
      <thead>
        <tr><th>Colonne CSV</th><th>Champ GLPI</th></tr>
      </thead>
      <tbody>
        <tr v-for="col in headers" :key="col">
          <td><code>{{ col }}</code></td>
          <td>
            <select v-model="mapping[col]">
              <option value="">— ignorer —</option>
              <option v-for="field in availableFields" :key="field.key" :value="field.key">
                {{ field.label }}
              </option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="!nameIsMapped" class="warning">
      ⚠ Le champ <strong>name</strong> (titre) n'est pas mappé — l'import échouera.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  headers: Array,
  mapping: Object,
  availableFields: Array,
})

const nameIsMapped = computed(() =>
  Object.values(props.mapping).includes('name')
)
</script>

<style scoped>
table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
th, td { padding: 0.5rem 1rem; border-bottom: 1px solid #eee; text-align: left; }
th { background: #f8f8f8; }
code { background: #f0f0f0; padding: 0.1rem 0.3rem; border-radius: 3px; }
select { padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px; }
.warning { color: #e67e22; background: #fef9f0; padding: 0.5rem; border-radius: 4px; margin-top: 1rem; }
.hint { color: #666; font-size: 0.9rem; }
</style>
```

### `ImportProgress.vue`

```vue
<!-- src/components/CsvImport/ImportProgress.vue -->
<template>
  <div class="import-progress">
    <h3>Import en cours — {{ progress }}%</h3>
    <div class="bar">
      <div class="fill" :style="{ width: progress + '%' }" />
    </div>

    <div class="log">
      <div
        v-for="(r, i) in results"
        :key="i"
        class="log-line"
        :class="r.ok ? 'ok' : 'fail'"
      >
        {{ r.ok ? '✓' : '✗' }}
        {{ r.ok ? `#${r.id} — ${r.label}` : `${r.label} : ${r.error}` }}
      </div>
    </div>

    <div v-if="!importing" class="summary">
      <span class="success">{{ successCount }} réussi(s)</span>
      <span class="fail">{{ errorCount }} échoué(s)</span>
      <button v-if="errorCount > 0" @click="$emit('download-errors')">
        Télécharger le rapport d'erreurs
      </button>
      <button class="secondary" @click="$emit('reset')">Nouvel import</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  progress: Number,
  results: Array,
  successCount: Number,
  errorCount: Number,
  importing: Boolean,
})
defineEmits(['download-errors', 'reset'])
</script>

<style scoped>
.bar { height: 10px; background: #eee; border-radius: 5px; margin: 1rem 0; }
.fill { height: 100%; background: #3498db; border-radius: 5px; transition: width 0.2s; }
.log { max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; padding: 0.5rem; }
.log-line { font-size: 0.85rem; padding: 0.2rem 0.5rem; }
.log-line.ok { color: #27ae60; }
.log-line.fail { color: #e74c3c; }
.summary { display: flex; gap: 1.5rem; align-items: center; margin-top: 1rem; }
.success { color: #27ae60; font-weight: bold; }
.fail { color: #e74c3c; font-weight: bold; }
button { padding: 0.4rem 0.8rem; border: 1px solid #3498db; background: #fff; color: #3498db; border-radius: 4px; cursor: pointer; }
.secondary { border-color: #888; color: #888; }
</style>
```

---

## Indices

<details>
<summary>Indice 1 — Gérer l'encodage UTF-8 avec BOM</summary>

Certains fichiers CSV exportés depuis Excel contiennent un BOM (Byte Order Mark) au début. Le supprimer avant parsing :
```js
text = text.replace(/^﻿/, '')
```
</details>

<details>
<summary>Indice 2 — Éviter de surcharger GLPI</summary>

Ajouter un délai de 50ms entre chaque requête pour ne pas saturer PHP-FPM :
```js
await new Promise((r) => setTimeout(r, 50))
```
</details>

<details>
<summary>Indice 3 — Gérer les virgules dans les valeurs CSV</summary>

Les valeurs entre guillemets peuvent contenir le séparateur (`"Paris, France"`). Le parser simple ne gère pas ce cas. Pour une solution robuste, utiliser une regex ou la librairie `papaparse` (`npm install papaparse`).
</details>

---

## Pour aller plus loin

- Supporter plusieurs séparateurs : tab (`\t`), pipe (`|`)
- Ajouter une étape de **déduplication** : détecter les lignes déjà présentes dans GLPI (par nom) avant d'importer
- Permettre la reprise d'un import interrompu (sauvegarder la progression dans `sessionStorage`)
- Ajouter une option "Dry run" qui simule l'import sans rien créer, et affiche uniquement les erreurs de validation
