# Module 3 — Page Import (CSV + ZIP images)

> **Attendu :** Importer 3 fichiers CSV + 1 ZIP d'images dans GLPI.  
> **Statut glpi-front :** ❌ À créer.

---

## Fichiers à importer

| # | Fichier | Contenu |
|---|---------|---------|
| 1 | `Feuille 1.csv` | Éléments du parc (Computer, Monitor…) |
| 2 | `Feuille 2.csv` | Tickets d'incidents |
| 3 | `Feuille 3.csv` | Coûts associés aux tickets |
| 4 | `images.zip` | Photos produits (t-shirt, casquette, pantalon, montre) |

**Ordre impératif :** Feuille 1 → Feuille 2 → Feuille 3 → ZIP  
(Feuille 2 référence les noms d'éléments de Feuille 1 ; Feuille 3 référence les numéros de Feuille 2)

---

## Analyse des fichiers CSV

### Feuille 1 — Éléments du parc

```
Name,Status,Location,Manufacturer,Item_Type,Model,Inventory_Number,User
PC-ADM-001,En production,Administration,Dell,Computer,OptiPlex 7010,ITU-2026-0001,Rakoto Jean
MN-FORM-002,En panne,Salle 301,Dell,Monitor,AC1000,ITU-2026-0010,Rakoto Michel
```

| Colonne CSV | Champ GLPI | Type | Notes |
|-------------|-----------|------|-------|
| `Name` | `name` | string | Obligatoire |
| `Status` | `states_id` | FK → State | Lookup/création par nom |
| `Location` | `locations_id` | FK → Location | Lookup/création par nom |
| `Manufacturer` | `manufacturers_id` | FK → Manufacturer | Lookup/création par nom |
| `Item_Type` | — | routing | Détermine l'endpoint GLPI (`Computer`, `Monitor`…) |
| `Model` | `computermodels_id` / `monitormodels_id` | FK → Model | Lookup/création, champ dépend du type |
| `Inventory_Number` | `otherserial` | string | Numéro inventaire interne |
| `User` | `users_id_tech` | FK → User | Lookup par nom complet (Prénom Nom) |

**Mapping des statuts :**
```js
const STATUS_MAP = {
  'En production': 'En production',
  'Maintenance':   'Maintenance',
  'En panne':      'En panne',
  'En stock':      'En stock',
}
// Ces états doivent être créés dans GLPI via GET/POST /api/State
```

**Mapping du champ Model selon Item_Type :**
```js
const MODEL_FIELD = {
  Computer:         'computermodels_id',
  Monitor:          'monitormodels_id',
  NetworkEquipment: 'networkequipmentmodels_id',
  Printer:          'printermodels_id',
  Phone:            'phonemodels_id',
}
```

---

### Feuille 2 — Tickets

```
Ref_Ticket,Date,Heure,Type,Titre,Description,Status,Priority,Items
1,03/06/2026,13:45,Incident,Tsy mandeha,hafahafa be,New,Medium,"[""PC-ADM-001""]"
2,04/06/2026,13:45,Incident,Michauffe,mamay be,New,Medium,"[""PC-ADM-001"",""MN-FORM-002""]"
```

| Colonne CSV | Champ GLPI | Transformation |
|-------------|-----------|----------------|
| `Ref_Ticket` | — | Clé interne (non envoyée à GLPI, utilisée par Feuille 3) |
| `Date` + `Heure` | `date` | `DD/MM/YYYY` + `HH:MM` → `YYYY-MM-DD HH:MM:SS` |
| `Type` | `type` | `Incident`→`1`, `Demande`→`2` |
| `Titre` | `name` | Direct |
| `Description` | `content` | Direct |
| `Status` | `status` | `New`→`1`, `Assigned`→`2`, `Pending`→`4`, `Solved`→`5` |
| `Priority` | `priority` | `Low`→`2`, `Medium`→`3`, `High`→`4`, `Very High`→`5` |
| `Items` | via `Item_Ticket` | JSON array de noms → résoudre avec la map de Feuille 1 |

**Conversion date :**
```js
function parseGlpiDate(date, heure) {
  const [d, m, y] = date.split('/')
  return `${y}-${m}-${d} ${heure}:00`
}
// "03/06/2026" + "13:45" → "2026-06-03 13:45:00"
```

**Parsing du champ Items (JSON entre guillemets doubles doublés dans CSV) :**
```js
// La valeur brute après parsing CSV est : ["PC-ADM-001","MN-FORM-002"]
const itemNames = JSON.parse(row.Items)
// → ['PC-ADM-001', 'MN-FORM-002']
```

---

### Feuille 3 — Coûts tickets

```
Num_Ticket,Duration_second,Time_Cost,Fixed_Cost
1,0,0,109
1,600,"8,7",50
```

| Colonne CSV | Champ GLPI (`TicketCost`) | Notes |
|-------------|--------------------------|-------|
| `Num_Ticket` | `tickets_id` | Via map Ref_Ticket → GLPI ticket ID |
| `Duration_second` | `actiontime` | Entier (secondes) |
| `Time_Cost` | `cost_time` | Décimal FR (`"8,7"` → `8.7`) |
| `Fixed_Cost` | `cost_fixed` | Entier |

**Conversion décimale française :**
```js
function parseDecimal(str) {
  return parseFloat(String(str).replace(',', '.')) || 0
}
// "8,7" → 8.7
```

---

### Images ZIP

4 images fournies (à nommer de manière explicite dans le ZIP) :

| Image | Nom suggéré dans le ZIP | Type GLPI |
|-------|------------------------|-----------|
| T-shirt noir | `tshirt-noir.jpg` | Document |
| Casquette NY rouge | `casquette-ny-rouge.jpg` | Document |
| Pantalon noir | `pantalon-noir.jpg` | Document |
| Montre plongée bleue | `montre-plongee-bleue.jpg` | Document |

Chaque image est importée comme `Document` GLPI via `POST /api/Document` (multipart).

---

## Architecture des fichiers dans glpi-front

```
src/
├── views/
│   └── ImportView.vue
├── components/
│   └── Import/
│       ├── FileDropZone.vue      ← zone de dépôt (réutilisable)
│       ├── ImportProgress.vue    ← barre progression + logs ligne par ligne
│       └── ImportReport.vue      ← résumé final par fichier
└── composables/
    ├── useGlpiLookup.js          ← helpers GET ou POST pour FK (State, Location…)
    ├── useFeuille1Import.js      ← import éléments (Computer, Monitor…)
    ├── useFeuille2Import.js      ← import tickets + associations Items
    ├── useFeuille3Import.js      ← import coûts tickets
    └── useZipImport.js           ← extraction ZIP + upload Documents
```

---

## Étape 1 — Helper de lookup GLPI `useGlpiLookup.js`

Cherche une entité par nom dans GLPI. Si elle n'existe pas, la crée.

```js
// src/composables/useGlpiLookup.js
import { glpiApi } from '../services/glpiApi.js'

// Cache en mémoire par type → { nom: id }
const cache = {}

export async function lookupOrCreate(itemtype, name) {
  if (!name) return 0
  if (!cache[itemtype]) cache[itemtype] = {}
  if (cache[itemtype][name] !== undefined) return cache[itemtype][name]

  // 1. Chercher dans GLPI
  try {
    const results = await glpiApi.getItems(itemtype, { searchText: name, range: '0-4' })
    const found = results.find((r) => r.name?.toLowerCase() === name.toLowerCase())
    if (found) {
      cache[itemtype][name] = found.id
      return found.id
    }
  } catch {
    // Peut être 404 si type inconnu — on continue
  }

  // 2. Créer si pas trouvé
  try {
    const created = await glpiApi.createItem(itemtype, { name })
    cache[itemtype][name] = created.id
    return created.id
  } catch {
    cache[itemtype][name] = 0
    return 0
  }
}

export async function lookupUser(fullName) {
  if (!fullName) return 0
  if (cache['User']?.[fullName] !== undefined) return cache['User'][fullName]
  if (!cache['User']) cache['User'] = {}

  try {
    const results = await glpiApi.getItems('User', { searchText: fullName, range: '0-4' })
    const found = results.find((u) => {
      const glpiName = `${u.firstname ?? ''} ${u.realname ?? ''}`.trim()
      return glpiName.toLowerCase() === fullName.toLowerCase()
    })
    cache['User'][fullName] = found?.id ?? 0
    return cache['User'][fullName]
  } catch {
    cache['User'][fullName] = 0
    return 0
  }
}

export function clearCache() {
  Object.keys(cache).forEach((k) => delete cache[k])
}
```

---

## Étape 2 — `useFeuille1Import.js` — Éléments du parc

```js
// src/composables/useFeuille1Import.js
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'
import { imports as springImports } from '../services/springApi.js'
import { lookupOrCreate, lookupUser } from './useGlpiLookup.js'

const TYPE_MAP = {
  'Incident': 1, 'Demande': 2,   // pour tickets
  'Computer': 'Computer', 'Monitor': 'Monitor',
  'NetworkEquipment': 'NetworkEquipment',
  'Printer': 'Printer', 'Phone': 'Phone',
}

const MODEL_FIELD = {
  Computer: 'computermodels_id', Monitor: 'monitormodels_id',
  NetworkEquipment: 'networkequipmentmodels_id',
  Printer: 'printermodels_id', Phone: 'phonemodels_id',
}

export function useFeuille1Import() {
  const progress = ref(0)
  const total = ref(0)
  const logs = ref([])
  const running = ref(false)

  // Map nom → { itemtype, id } — partagé avec Feuille 2
  const itemNameMap = {}

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/)
    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map((h) => h.trim())
    return lines.slice(1).map((line, idx) => {
      // Gestion des virgules dans les chaînes entre guillemets
      const values = []
      let inQuotes = false, cur = ''
      for (const ch of line + sep) {
        if (ch === '"') { inQuotes = !inQuotes; continue }
        if (ch === sep && !inQuotes) { values.push(cur.trim()); cur = ''; continue }
        cur += ch
      }
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
    })
  }

  async function importFile(file) {
    running.value = true
    progress.value = 0
    logs.value = []

    const text = await file.text()
    const rows = parseCSV(text)
    total.value = rows.length
    let success = 0, failure = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const itemtype = row['Item_Type']?.trim()

      if (!itemtype || !row['Name']) {
        logs.value.push({ status: 'error', message: `Ligne ${i + 2} : Name ou Item_Type manquant` })
        failure++
        progress.value = i + 1
        continue
      }

      try {
        // Résolution des FK en parallèle
        const [stateId, locationId, manufacturerId, modelId, userId] = await Promise.all([
          lookupOrCreate('State', row['Status']),
          lookupOrCreate('Location', row['Location']),
          lookupOrCreate('Manufacturer', row['Manufacturer']),
          lookupOrCreate(itemtype + 'Model', row['Model']),
          lookupUser(row['User']),
        ])

        const input = {
          name: row['Name'],
          otherserial: row['Inventory_Number'] || '',
          states_id: stateId,
          locations_id: locationId,
          manufacturers_id: manufacturerId,
          users_id_tech: userId,
          [MODEL_FIELD[itemtype] || 'comment']: MODEL_FIELD[itemtype] ? modelId : row['Model'],
        }

        const created = await glpiApi.createItem(itemtype, input)
        itemNameMap[row['Name']] = { itemtype, id: created.id }
        logs.value.push({ status: 'ok', message: `${itemtype} #${created.id} — ${row['Name']}` })
        success++
      } catch (e) {
        logs.value.push({ status: 'error', message: `${row['Name']} : ${e.message}` })
        failure++
      }

      progress.value = i + 1
    }

    await springImports.create({
      filename: file.name, itemtype: 'Multi',
      totalRows: rows.length, successCount: success, failureCount: failure,
      status: failure === 0 ? 'COMPLETED' : success === 0 ? 'FAILED' : 'PARTIAL',
    }).catch(() => {})

    running.value = false
    return { success, failure, itemNameMap }
  }

  return { progress, total, logs, running, importFile, itemNameMap }
}
```

---

## Étape 3 — `useFeuille2Import.js` — Tickets

```js
// src/composables/useFeuille2Import.js
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'
import { imports as springImports } from '../services/springApi.js'

const TYPE_MAP    = { 'Incident': 1, 'Demande': 2, 'Request': 2 }
const STATUS_MAP  = { 'New': 1, 'Assigned': 2, 'Planning': 3, 'Pending': 4, 'Solved': 5, 'Closed': 6 }
const PRIORITY_MAP = { 'Very Low': 1, 'Low': 2, 'Medium': 3, 'High': 4, 'Very High': 5, 'Major': 6 }

function parseGlpiDate(date, heure) {
  if (!date) return undefined
  const [d, m, y] = date.split('/')
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')} ${heure || '00:00'}:00`
}

export function useFeuille2Import() {
  const progress = ref(0)
  const total = ref(0)
  const logs = ref([])
  const running = ref(false)

  // Map Ref_Ticket → GLPI ticket ID — partagé avec Feuille 3
  const ticketRefMap = {}

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/)
    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map((h) => h.trim())
    return lines.slice(1).map((line) => {
      const values = []
      let inQuotes = false, cur = ''
      for (const ch of line + sep) {
        if (ch === '"') { inQuotes = !inQuotes; continue }
        if (ch === sep && !inQuotes) { values.push(cur.trim()); cur = ''; continue }
        cur += ch
      }
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
    })
  }

  async function importFile(file, itemNameMap = {}) {
    running.value = true
    progress.value = 0
    logs.value = []

    const text = await file.text()
    const rows = parseCSV(text)
    total.value = rows.length
    let success = 0, failure = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      try {
        const input = {
          name:     row['Titre'],
          content:  row['Description'],
          type:     TYPE_MAP[row['Type']] ?? 1,
          status:   STATUS_MAP[row['Status']] ?? 1,
          priority: PRIORITY_MAP[row['Priority']] ?? 3,
          date:     parseGlpiDate(row['Date'], row['Heure']),
        }

        const created = await glpiApi.createItem('Ticket', input)

        // Stocker la correspondance Ref → ID GLPI
        if (row['Ref_Ticket']) ticketRefMap[row['Ref_Ticket']] = created.id

        // Associer les éléments (Items = JSON array de noms)
        if (row['Items']) {
          let itemNames = []
          try { itemNames = JSON.parse(row['Items']) } catch { /* ignore */ }

          for (const itemName of itemNames) {
            const assoc = itemNameMap[itemName]
            if (assoc) {
              await glpiApi.createItem('Item_Ticket', {
                tickets_id: created.id,
                itemtype: assoc.itemtype,
                items_id: assoc.id,
              }).catch(() => {})
            } else {
              logs.value.push({ status: 'warn', message: `Ticket #${created.id} — élément inconnu : ${itemName}` })
            }
          }
        }

        logs.value.push({ status: 'ok', message: `Ticket #${created.id} — ${row['Titre']}` })
        success++
      } catch (e) {
        logs.value.push({ status: 'error', message: `Ligne ${i + 2} (${row['Titre'] || '?'}) : ${e.message}` })
        failure++
      }

      progress.value = i + 1
    }

    await springImports.create({
      filename: file.name, itemtype: 'Ticket',
      totalRows: rows.length, successCount: success, failureCount: failure,
      status: failure === 0 ? 'COMPLETED' : success === 0 ? 'FAILED' : 'PARTIAL',
    }).catch(() => {})

    running.value = false
    return { success, failure, ticketRefMap }
  }

  return { progress, total, logs, running, importFile, ticketRefMap }
}
```

---

## Étape 4 — `useFeuille3Import.js` — Coûts tickets

```js
// src/composables/useFeuille3Import.js
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

function parseDecimal(str) {
  return parseFloat(String(str).replace(',', '.')) || 0
}

export function useFeuille3Import() {
  const progress = ref(0)
  const total = ref(0)
  const logs = ref([])
  const running = ref(false)

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/)
    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map((h) => h.trim())
    return lines.slice(1).map((line) => {
      const values = []
      let inQuotes = false, cur = ''
      for (const ch of line + sep) {
        if (ch === '"') { inQuotes = !inQuotes; continue }
        if (ch === sep && !inQuotes) { values.push(cur.trim()); cur = ''; continue }
        cur += ch
      }
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
    })
  }

  async function importFile(file, ticketRefMap = {}) {
    running.value = true
    progress.value = 0
    logs.value = []

    const text = await file.text()
    const rows = parseCSV(text)
    total.value = rows.length
    let success = 0, failure = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const ticketGlpiId = ticketRefMap[row['Num_Ticket']]

      if (!ticketGlpiId) {
        logs.value.push({ status: 'error', message: `Ligne ${i + 2} : Ref_Ticket ${row['Num_Ticket']} introuvable` })
        failure++
        progress.value = i + 1
        continue
      }

      try {
        const input = {
          tickets_id:  ticketGlpiId,
          name:        `Coût — ticket ${row['Num_Ticket']}`,
          actiontime:  parseInt(row['Duration_second']) || 0,
          cost_time:   parseDecimal(row['Time_Cost']),
          cost_fixed:  parseDecimal(row['Fixed_Cost']),
        }

        await glpiApi.createItem('TicketCost', input)
        logs.value.push({ status: 'ok', message: `Coût ticket #${ticketGlpiId} — fixe: ${input.cost_fixed}, temps: ${input.cost_time}` })
        success++
      } catch (e) {
        logs.value.push({ status: 'error', message: `Ligne ${i + 2} : ${e.message}` })
        failure++
      }

      progress.value = i + 1
    }

    running.value = false
    return { success, failure }
  }

  return { progress, total, logs, running, importFile }
}
```

---

## Étape 5 — `useZipImport.js` — Images

```js
// src/composables/useZipImport.js
import { ref } from 'vue'
import JSZip from 'jszip'
import { glpiApi } from '../services/glpiApi.js'

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i

export function useZipImport() {
  const progress = ref(0)
  const total = ref(0)
  const logs = ref([])
  const running = ref(false)

  async function importZip(zipFile) {
    running.value = true
    progress.value = 0
    logs.value = []

    const zip = await JSZip.loadAsync(zipFile)
    const images = []
    zip.forEach((path, entry) => {
      if (!entry.dir && IMAGE_EXT.test(path)) images.push({ path, entry })
    })

    total.value = images.length

    for (let i = 0; i < images.length; i++) {
      const { path, entry } = images[i]
      const filename = path.split('/').pop()
      const docName = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

      try {
        const blob = await entry.async('blob')
        const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg'
        const file = new File([blob], filename, { type: mimeType })
        const doc = await glpiApi.uploadDocument(file, docName)
        logs.value.push({ status: 'ok', message: `Document #${doc.id} — ${filename}` })
      } catch (e) {
        logs.value.push({ status: 'error', message: `${filename} : ${e.message}` })
      }

      progress.value = i + 1
    }

    running.value = false
  }

  return { progress, total, logs, running, importZip }
}
```

> Installer jszip : `npm install jszip`

---

## Étape 6 — `ImportView.vue` — Vue principale

```vue
<template>
  <div class="import-page">
    <h1>Import de données — Jour 1</h1>

    <div class="import-grid">
      <section class="import-section">
        <h3>1. Éléments du parc <span class="badge">Feuille 1.csv</span></h3>
        <p class="hint">Computer, Monitor… (colonnes : Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User)</p>
        <FileDropZone label="Feuille 1.csv" accept=".csv" @update:file="(f) => files.feuille1 = f" />
      </section>

      <section class="import-section">
        <h3>2. Tickets <span class="badge">Feuille 2.csv</span></h3>
        <p class="hint">Incidents / Demandes (colonnes : Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items)</p>
        <FileDropZone label="Feuille 2.csv" accept=".csv" @update:file="(f) => files.feuille2 = f" />
      </section>

      <section class="import-section">
        <h3>3. Coûts tickets <span class="badge">Feuille 3.csv</span></h3>
        <p class="hint">Coûts associés (colonnes : Num_Ticket, Duration_second, Time_Cost, Fixed_Cost)</p>
        <FileDropZone label="Feuille 3.csv" accept=".csv" @update:file="(f) => files.feuille3 = f" />
      </section>

      <section class="import-section">
        <h3>4. Images <span class="badge">.zip</span></h3>
        <p class="hint">Photos des éléments (.jpg / .png dans une archive ZIP)</p>
        <FileDropZone label="images.zip" accept=".zip" @update:file="(f) => files.zip = f" />
      </section>
    </div>

    <div class="import-actions">
      <button class="btn-primary" :disabled="!hasFiles || running" @click="runImport">
        {{ running ? `Import en cours… (étape ${currentStep}/4)` : 'Lancer l\'import' }}
      </button>
    </div>

    <!-- Progression en temps réel -->
    <div v-if="running || allLogs.length > 0" class="import-log-section">
      <div v-for="(step, i) in stepLogs" :key="i" class="step-block">
        <h4>{{ step.label }}</h4>
        <div class="progress-bar-wrap">
          <div class="progress-bar" :style="{ width: step.pct + '%' }"></div>
        </div>
        <ul class="log-list">
          <li v-for="(entry, j) in step.logs.slice(-10)" :key="j" :class="entry.status">
            {{ entry.status === 'ok' ? '✓' : entry.status === 'warn' ? '⚠' : '✗' }} {{ entry.message }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Rapport final -->
    <ImportReport v-if="report" :report="report" @reset="resetAll" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import FileDropZone from '../components/Import/FileDropZone.vue'
import ImportReport from '../components/Import/ImportReport.vue'
import { useFeuille1Import } from '../composables/useFeuille1Import.js'
import { useFeuille2Import } from '../composables/useFeuille2Import.js'
import { useFeuille3Import } from '../composables/useFeuille3Import.js'
import { useZipImport } from '../composables/useZipImport.js'

const files = ref({ feuille1: null, feuille2: null, feuille3: null, zip: null })
const currentStep = ref(0)
const report = ref(null)
const running = ref(false)

const f1 = useFeuille1Import()
const f2 = useFeuille2Import()
const f3 = useFeuille3Import()
const zip = useZipImport()

const hasFiles = computed(() => Object.values(files.value).some(Boolean))

const stepLogs = computed(() => [
  { label: '1. Éléments du parc', logs: f1.logs.value, pct: f1.total.value ? (f1.progress.value / f1.total.value) * 100 : 0 },
  { label: '2. Tickets',          logs: f2.logs.value, pct: f2.total.value ? (f2.progress.value / f2.total.value) * 100 : 0 },
  { label: '3. Coûts tickets',    logs: f3.logs.value, pct: f3.total.value ? (f3.progress.value / f3.total.value) * 100 : 0 },
  { label: '4. Images ZIP',       logs: zip.logs.value, pct: zip.total.value ? (zip.progress.value / zip.total.value) * 100 : 0 },
].filter((s) => s.logs.length > 0))

const allLogs = computed(() => [...f1.logs.value, ...f2.logs.value, ...f3.logs.value, ...zip.logs.value])

async function runImport() {
  running.value = true
  report.value = null
  const results = []

  // Étape 1 — Éléments
  if (files.value.feuille1) {
    currentStep.value = 1
    const r = await f1.importFile(files.value.feuille1)
    results.push({ label: 'Éléments (Feuille 1)', ...r })
  }

  // Étape 2 — Tickets (utilise la map éléments de l'étape 1)
  if (files.value.feuille2) {
    currentStep.value = 2
    const r = await f2.importFile(files.value.feuille2, f1.itemNameMap)
    results.push({ label: 'Tickets (Feuille 2)', ...r })
  }

  // Étape 3 — Coûts (utilise la map tickets de l'étape 2)
  if (files.value.feuille3) {
    currentStep.value = 3
    const r = await f3.importFile(files.value.feuille3, f2.ticketRefMap)
    results.push({ label: 'Coûts (Feuille 3)', ...r })
  }

  // Étape 4 — Images ZIP
  if (files.value.zip) {
    currentStep.value = 4
    await zip.importZip(files.value.zip)
    const okCount = zip.logs.value.filter((l) => l.status === 'ok').length
    results.push({ label: 'Images (ZIP)', success: okCount, failure: zip.logs.value.length - okCount })
  }

  report.value = results
  running.value = false
}

function resetAll() {
  files.value = { feuille1: null, feuille2: null, feuille3: null, zip: null }
  report.value = null
}
</script>

<style scoped>
.import-page { padding: 1.5rem 2rem; max-width: 900px; margin: 0 auto; }
h1 { margin: 0 0 1.5rem; }
.import-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
.import-section { background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 1.25rem; }
.import-section h3 { margin: 0 0 0.4rem; font-size: 0.95rem; }
.badge { background: #ebf5fb; color: #2980b9; font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 10px; font-weight: 600; }
.hint { font-size: 0.78rem; color: #999; margin: 0 0 0.75rem; }
.import-actions { margin: 1rem 0 1.5rem; }
.step-block { margin-bottom: 1.5rem; }
.step-block h4 { margin: 0 0 0.4rem; font-size: 0.9rem; color: #555; }
.progress-bar-wrap { height: 6px; background: #eee; border-radius: 3px; margin-bottom: 0.4rem; }
.progress-bar { height: 100%; background: #3498db; border-radius: 3px; transition: width 0.15s; }
.log-list { list-style: none; padding: 0; margin: 0; max-height: 160px; overflow-y: auto; font-size: 0.82rem; }
.log-list li.ok   { color: #27ae60; }
.log-list li.warn { color: #e67e22; }
.log-list li.error { color: #e74c3c; }
.btn-primary { background: #3498db; color: #fff; border: none; padding: 0.65rem 1.5rem; border-radius: 6px; font-size: 1rem; font-weight: 600; cursor: pointer; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

---

## Ordre d'import et dépendances

```
Feuille 1 (éléments)
  └── Produit : itemNameMap { "PC-ADM-001" → { itemtype: "Computer", id: 42 } }
        ↓
Feuille 2 (tickets)
  └── Utilise itemNameMap pour créer Item_Ticket
  └── Produit : ticketRefMap { "1" → glpiTicketId, "2" → glpiTicketId }
        ↓
Feuille 3 (coûts)
  └── Utilise ticketRefMap pour lier les coûts aux tickets GLPI
        ↓
ZIP (images)
  └── Upload chaque image comme Document GLPI (indépendant)
```

---

## Erreurs courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `403` sur création Computer | Profil sans droit CREATE sur Parc | Setup > Profils > Parc > activer Créer |
| `403` sur Item_Ticket | Profil sans droit sur éléments associés | Setup > Profils > Assistance > activer |
| `403` sur TicketCost | Profil sans droit Coûts | Setup > Profils > Assistance > Suivi financier |
| Item non trouvé dans map (Feuille 2) | Feuille 1 non importée avant, ou nom différent | Importer Feuille 1 en premier |
| Ref_Ticket introuvable (Feuille 3) | Feuille 2 non importée avant | Importer Feuille 2 en premier |
| Décimale incorrecte (Time_Cost) | Séparateur `,` au lieu de `.` | Géré par `parseDecimal()` |
| État/Localisation dupliqué | Lookup créé deux fois en parallèle | Le cache de `useGlpiLookup` évite les doublons |
