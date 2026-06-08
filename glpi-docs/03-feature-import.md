# Feature : Import de fichier

## Vue d'ensemble

Cette fonctionnalité permet à l'utilisateur de charger un fichier depuis son navigateur et de l'envoyer vers GLPI. Deux modes sont couverts :

| Mode | Format | Endpoint GLPI | Usage |
|------|--------|---------------|-------|
| **Import de formulaire** | `.json` | `/Form/Import` (Web) | Importer des formulaires GLPI exportés |
| **Pièce jointe / document** | Tout format | `POST /api/Document` | Attacher un fichier à un élément GLPI |

---

## Mode 1 — Import de formulaire JSON (4 étapes GLPI)

GLPI expose nativement un workflow en 4 étapes pour importer des formulaires :

```
Étape 1 : Upload du fichier JSON  →  GET  /Form/Import
Étape 2 : Aperçu                  →  POST /Form/Import/Preview
Étape 3 : Résolution des conflits →  POST /Form/Import/ResolveIssues
Étape 4 : Exécution               →  POST /Form/Import/Execute
```

Ces routes sont des routes **web** (Symfony/Twig), pas des routes API REST. Pour les consommer depuis Vue, il faut soit :

- **Option A** : Appeler directement les routes web avec des formulaires HTML classiques (fetch + FormData)
- **Option B** : Recréer la logique côté Vue en utilisant uniquement l'API REST pour créer les items manuellement

> Pour un import JSON de formulaires, l'**Option A** est recommandée car GLPI gère la désérialisation et la résolution de conflits automatiquement.

---

## Composable `useImport`

```ts
// src/composables/useImport.ts
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi'
import type { GlpiItem } from '../types/glpi'

export type ImportMode = 'document' | 'json-preview'

export function useImport() {
  const file = ref<File | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const result = ref<GlpiItem | null>(null)
  const progress = ref(0)

  function selectFile(selectedFile: File) {
    file.value = selectedFile
    error.value = null
    result.value = null
  }

  // Upload d'un fichier comme Document GLPI
  async function uploadDocument(name?: string) {
    if (!file.value) return
    loading.value = true
    error.value = null
    progress.value = 0
    try {
      const documentName = name ?? file.value.name
      result.value = await glpiApi.uploadDocument(file.value, documentName)
      progress.value = 100
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  // Lire le contenu JSON d'un fichier localement (pour prévisualisation)
  async function readJsonFile(): Promise<unknown> {
    if (!file.value) throw new Error('Aucun fichier sélectionné')
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          resolve(JSON.parse(e.target?.result as string))
        } catch {
          reject(new Error('Le fichier n\'est pas un JSON valide'))
        }
      }
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'))
      reader.readAsText(file.value!)
    })
  }

  function reset() {
    file.value = null
    loading.value = false
    error.value = null
    result.value = null
    progress.value = 0
  }

  return { file, loading, error, result, progress, selectFile, uploadDocument, readJsonFile, reset }
}
```

---

## Composant `ImportForm.vue`

```vue
<!-- src/components/ImportFichier/ImportForm.vue -->
<template>
  <div class="import-form">
    <h2>Importer un fichier</h2>

    <!-- Zone de dépôt -->
    <div
      class="drop-zone"
      :class="{ active: isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <p v-if="!file">Glissez un fichier ici ou</p>
      <p v-else>Fichier sélectionné : <strong>{{ file.name }}</strong></p>
      <label>
        <input type="file" :accept="acceptedTypes" @change="onFileChange" hidden />
        <span class="btn">Parcourir</span>
      </label>
    </div>

    <!-- Nom du document (optionnel) -->
    <div v-if="file">
      <label>
        Nom du document dans GLPI
        <input v-model="documentName" type="text" :placeholder="file.name" />
      </label>
    </div>

    <!-- Barre de progression -->
    <div v-if="loading" class="progress">
      <div class="progress-bar" :style="{ width: progress + '%' }" />
    </div>

    <!-- Erreur -->
    <p v-if="error" class="error">{{ error }}</p>

    <!-- Résultat -->
    <div v-if="result" class="success">
      Document créé avec l'ID : <strong>{{ result.id }}</strong>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button :disabled="!file || loading" @click="submit">
        {{ loading ? 'Envoi en cours...' : 'Importer' }}
      </button>
      <button :disabled="loading" @click="reset">Réinitialiser</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useImport } from '../../composables/useImport'

const acceptedTypes = '.json,.csv,.xml,.zip'
const isDragging = ref(false)
const documentName = ref('')

const { file, loading, error, result, progress, selectFile, uploadDocument, reset } = useImport()

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) selectFile(input.files[0])
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const dropped = e.dataTransfer?.files[0]
  if (dropped) selectFile(dropped)
}

async function submit() {
  await uploadDocument(documentName.value || undefined)
}
</script>

<style scoped>
.drop-zone {
  border: 2px dashed #aaa;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: border-color 0.2s;
}
.drop-zone.active { border-color: #3498db; }
.btn {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #3498db;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
}
.progress { height: 8px; background: #eee; border-radius: 4px; margin: 1rem 0; }
.progress-bar { height: 100%; background: #3498db; border-radius: 4px; transition: width 0.3s; }
.error { color: #e74c3c; }
.success { color: #27ae60; }
.actions { display: flex; gap: 1rem; margin-top: 1rem; }
</style>
```

---

## Composant `ImportResult.vue`

Affiche le résultat après upload avec les informations du document créé.

```vue
<!-- src/components/ImportFichier/ImportResult.vue -->
<template>
  <div class="import-result">
    <div class="result-card success">
      <span class="icon">✓</span>
      <div class="info">
        <p><strong>Document importé avec succès</strong></p>
        <p>ID GLPI : <code>{{ result.id }}</code></p>
        <p v-if="result.name">Nom : {{ result.name }}</p>
        <p v-if="result.mime">Type : {{ result.mime }}</p>
        <p v-if="result.filesize">
          Taille : {{ (result.filesize / 1024).toFixed(1) }} Ko
        </p>
      </div>
    </div>
    <button class="secondary" @click="$emit('nouveau')">Importer un autre fichier</button>
  </div>
</template>

<script setup lang="ts">
import type { GlpiItem } from '../../types/glpi'
defineProps<{ result: GlpiItem }>()
defineEmits<{ nouveau: [] }>()
</script>

<style scoped>
.import-result { margin-top: 1rem; }
.result-card { display: flex; align-items: flex-start; gap: 1rem; padding: 1rem; border-radius: 6px; }
.result-card.success { background: #eafaf1; border: 1px solid #27ae60; }
.icon { font-size: 1.5rem; color: #27ae60; }
code { background: #f0f0f0; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.9rem; }
.secondary { margin-top: 1rem; padding: 0.5rem 1rem; background: #fff; border: 1px solid #3498db; color: #3498db; border-radius: 4px; cursor: pointer; }
</style>
```

Utilisation dans `ImportForm.vue` — ajouter après le bloc `<!-- Résultat -->` :
```vue
<!-- Remplacer le div résultat existant par : -->
<ImportResult v-if="result" :result="result" @nouveau="reset" />
```

Et dans `<script setup>` :
```ts
import ImportResult from './ImportResult.vue'
```

---

## Validation du type de fichier avant upload

Ajouter dans `useImport.ts` une fonction de validation :

```ts
const ALLOWED_TYPES = [
  'application/json',
  'text/csv',
  'text/xml',
  'application/zip',
  'application/pdf',
  'image/png',
  'image/jpeg',
]

function validateFile(f: File): string | null {
  if (!ALLOWED_TYPES.includes(f.type)) {
    return `Type non autorisé : ${f.type || 'inconnu'}. Types acceptés : JSON, CSV, XML, ZIP, PDF, PNG, JPG.`
  }
  const MAX_MB = 10
  if (f.size > MAX_MB * 1024 * 1024) {
    return `Fichier trop volumineux (max ${MAX_MB} Mo).`
  }
  return null
}

// Dans selectFile() :
function selectFile(selectedFile: File) {
  const validationError = validateFile(selectedFile)
  if (validationError) {
    error.value = validationError
    return
  }
  file.value = selectedFile
  error.value = null
  result.value = null
}
```

---

## Vue `ImportView.vue`

```vue
<!-- src/views/ImportView.vue -->
<template>
  <main>
    <ImportForm />
  </main>
</template>

<script setup lang="ts">
import ImportForm from '../components/ImportFichier/ImportForm.vue'
</script>
```

---

---

## Version JavaScript

**`src/composables/useImport.js`** :
```js
// src/composables/useImport.js
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

const ALLOWED_TYPES = [
  'application/json', 'text/csv', 'text/xml',
  'application/zip', 'application/pdf', 'image/png', 'image/jpeg',
]

function validateFile(f) {
  if (!ALLOWED_TYPES.includes(f.type)) {
    return `Type non autorisé : ${f.type || 'inconnu'}`
  }
  if (f.size > 10 * 1024 * 1024) {
    return 'Fichier trop volumineux (max 10 Mo).'
  }
  return null
}

export function useImport() {
  const file = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const result = ref(null)
  const progress = ref(0)

  function selectFile(selectedFile) {
    const validationError = validateFile(selectedFile)
    if (validationError) {
      error.value = validationError
      return
    }
    file.value = selectedFile
    error.value = null
    result.value = null
  }

  async function uploadDocument(name) {
    if (!file.value) return
    loading.value = true
    error.value = null
    progress.value = 0
    try {
      const documentName = name || file.value.name
      result.value = await glpiApi.uploadDocument(file.value, documentName)
      progress.value = 100
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function readJsonFile() {
    if (!file.value) throw new Error('Aucun fichier sélectionné')
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try { resolve(JSON.parse(e.target.result)) }
        catch { reject(new Error("Le fichier n'est pas un JSON valide")) }
      }
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'))
      reader.readAsText(file.value)
    })
  }

  function reset() {
    file.value = null
    loading.value = false
    error.value = null
    result.value = null
    progress.value = 0
  }

  return { file, loading, error, result, progress, selectFile, uploadDocument, readJsonFile, reset }
}
```

**`ImportForm.vue` en JavaScript** — seul le bloc `<script>` change :
```vue
<script setup>
import { ref } from 'vue'
import { useImport } from '../../composables/useImport.js'
import ImportResult from './ImportResult.vue'

const acceptedTypes = '.json,.csv,.xml,.zip,.pdf,.png,.jpg'
const isDragging = ref(false)
const documentName = ref('')

const { file, loading, error, result, progress, selectFile, uploadDocument, reset } = useImport()

function onFileChange(e) {
  if (e.target.files?.[0]) selectFile(e.target.files[0])
}

function onDrop(e) {
  isDragging.value = false
  const dropped = e.dataTransfer?.files[0]
  if (dropped) selectFile(dropped)
}

async function submit() {
  await uploadDocument(documentName.value || undefined)
}
</script>
```

---

## Points d'attention

### Taille des fichiers
GLPI limite la taille des uploads. Vérifier la configuration dans :
- `php.ini` : `upload_max_filesize` et `post_max_size`
- Config GLPI : Administration > Configuration > Taille maximale des fichiers mis en ligne

### CORS
En production, s'assurer que le serveur Apache/Nginx GLPI autorise les requêtes cross-origin depuis le domaine Vue. En développement, le proxy Vite gère cela.

### Authentification requise
L'endpoint `POST /Document` exige un `Session-Token` valide. S'assurer que l'utilisateur est connecté avant d'activer l'interface d'import.
