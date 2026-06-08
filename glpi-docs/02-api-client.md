# Client API et Authentification GLPI

## Fonctionnement de l'API REST GLPI

L'API REST GLPI est exposée par `apirest.php`. Chaque requête nécessite un `session_token` obtenu via `initSession`.

**Flux d'authentification :**
```
1. POST /initSession  → session_token
2. Appels métier avec header Session-Token: <token>
3. GET  /killSession  → déconnexion
```

---

## Types TypeScript

```ts
// src/types/glpi.ts

export interface GlpiSession {
  session_token: string
}

export interface GlpiError {
  statusCode: number
  message: string
}

export interface GlpiItem {
  id: number
  name: string
  [key: string]: unknown
}

export interface GlpiDeleteResult {
  id: number
  message: string
}

export interface GlpiImportResult {
  success: boolean
  form_name?: string
  error?: string
}
```

---

## Service HTTP centralisé

```ts
// src/services/glpiApi.ts
import type { GlpiSession, GlpiItem, GlpiDeleteResult } from '../types/glpi'

// Base URL proxifiée par Vite (voir vite.config.ts)
const BASE_URL = '/api'

// Token stocké en mémoire (pas de localStorage pour la sécurité)
let sessionToken: string | null = null

function headers(extra: Record<string, string> = {}): HeadersInit {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  }
  if (sessionToken) h['Session-Token'] = sessionToken
  // App-Token optionnel : configurer si activé dans GLPI
  // h['App-Token'] = import.meta.env.VITE_GLPI_APP_TOKEN
  return h
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  customHeaders?: Record<string, string>
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(customHeaders),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err[1] ?? err.message ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const glpiApi = {
  // Authentification
  async initSession(login: string, password: string): Promise<string> {
    const credentials = btoa(`${login}:${password}`)
    const data = await request<GlpiSession>('GET', '/initSession', undefined, {
      Authorization: `Basic ${credentials}`,
    })
    sessionToken = data.session_token
    return sessionToken
  },

  async killSession(): Promise<void> {
    await request<void>('GET', '/killSession')
    sessionToken = null
  },

  // CRUD générique
  async getItems(itemtype: string, params?: Record<string, string>): Promise<GlpiItem[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<GlpiItem[]>('GET', `/${itemtype}${qs}`)
  },

  async getItem(itemtype: string, id: number): Promise<GlpiItem> {
    return request<GlpiItem>('GET', `/${itemtype}/${id}`)
  },

  async deleteItem(itemtype: string, id: number): Promise<GlpiDeleteResult[]> {
    return request<GlpiDeleteResult[]>('DELETE', `/${itemtype}/${id}`)
  },

  async deleteItems(itemtype: string, ids: number[]): Promise<GlpiDeleteResult[]> {
    return request<GlpiDeleteResult[]>('DELETE', `/${itemtype}`, {
      input: ids.map((id) => ({ id })),
    })
  },

  // Upload de fichier (multipart/form-data)
  async uploadDocument(file: File, name: string): Promise<GlpiItem> {
    const formData = new FormData()
    formData.append('uploadManifest', JSON.stringify({
      input: { name, _filename: [file.name] },
    }))
    formData.append('filename[0]', file, file.name)

    const res = await fetch(`${BASE_URL}/Document`, {
      method: 'POST',
      headers: sessionToken ? { 'Session-Token': sessionToken } : {},
      body: formData,
    })
    if (!res.ok) throw new Error(`Upload échoué : HTTP ${res.status}`)
    return res.json()
  },

  isAuthenticated(): boolean {
    return sessionToken !== null
  },
}
```

---

## Composable d'authentification

```ts
// src/composables/useGlpiAuth.ts
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi'

export function useGlpiAuth() {
  const authenticated = ref(glpiApi.isAuthenticated())
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function login(login: string, password: string) {
    loading.value = true
    error.value = null
    try {
      await glpiApi.initSession(login, password)
      authenticated.value = true
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await glpiApi.killSession()
    authenticated.value = false
  }

  return { authenticated, loading, error, login, logout }
}
```

---

## Composant `LoginForm.vue`

Composant prêt à l'emploi qui utilise `useGlpiAuth` et redirige après connexion.

```vue
<!-- src/components/shared/LoginForm.vue -->
<template>
  <form class="login-form" @submit.prevent="onSubmit">
    <div class="field">
      <label for="login">Identifiant</label>
      <input id="login" v-model="login" type="text" autocomplete="username" required />
    </div>
    <div class="field">
      <label for="password">Mot de passe</label>
      <input id="password" v-model="password" type="password" autocomplete="current-password" required />
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <button type="submit" :disabled="loading">
      {{ loading ? 'Connexion en cours…' : 'Se connecter' }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGlpiAuth } from '../../composables/useGlpiAuth'

const emit = defineEmits<{ success: [] }>()

const login = ref('')
const password = ref('')

const { loading, error, login: doLogin } = useGlpiAuth()

async function onSubmit() {
  await doLogin(login.value, password.value)
  if (!error.value) emit('success')
}
</script>

<style scoped>
.login-form { display: flex; flex-direction: column; gap: 1rem; max-width: 320px; }
.field { display: flex; flex-direction: column; gap: 0.25rem; }
label { font-size: 0.875rem; font-weight: 600; }
input { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
input:focus { outline: none; border-color: #3498db; }
.error { color: #e74c3c; font-size: 0.875rem; }
button { padding: 0.6rem 1.2rem; background: #3498db; color: #fff; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

---

## Gestion des erreurs 401 (session expirée)

Ajouter un intercepteur dans `glpiApi.ts` pour détecter les sessions expirées et déclencher une reconnexion :

```ts
// Dans la fonction request() de glpiApi.ts, remplacer le bloc if (!res.ok) par :
if (res.status === 401) {
  sessionToken = null
  // Émettre un événement global pour que le router redirige vers /login
  window.dispatchEvent(new CustomEvent('glpi:session-expired'))
  throw new Error('Session expirée, veuillez vous reconnecter.')
}
if (!res.ok) {
  const err = await res.json().catch(() => ({ message: res.statusText }))
  throw new Error(err[1] ?? err.message ?? `HTTP ${res.status}`)
}
```

Puis écouter cet événement dans `App.vue` :
```ts
// Dans App.vue, au montage :
onMounted(() => {
  window.addEventListener('glpi:session-expired', () => router.push('/login'))
})
```

---

## Variables d'environnement

Créer un fichier `.env.local` dans `glpi-front/` :

```env
VITE_GLPI_APP_TOKEN=votre_app_token_ici
```

Ne jamais committer ce fichier (déjà dans `.gitignore` par défaut).

---

---

## Version JavaScript

Supprimer toutes les annotations de types. Les fonctions restent identiques.

**`src/services/glpiApi.js`** :
```js
// src/services/glpiApi.js
const BASE_URL = '/api'
let sessionToken = null

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  if (sessionToken) h['Session-Token'] = sessionToken
  return h
}

async function request(method, path, body, customHeaders) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(customHeaders),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    sessionToken = null
    window.dispatchEvent(new CustomEvent('glpi:session-expired'))
    throw new Error('Session expirée, veuillez vous reconnecter.')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(Array.isArray(err) ? err[1] : (err.message ?? `HTTP ${res.status}`))
  }
  if (res.status === 204) return undefined
  return res.json()
}

export const glpiApi = {
  async initSession(login, password) {
    const credentials = btoa(`${login}:${password}`)
    const data = await request('GET', '/initSession', undefined, {
      Authorization: `Basic ${credentials}`,
    })
    sessionToken = data.session_token
    return sessionToken
  },

  async killSession() {
    await request('GET', '/killSession')
    sessionToken = null
  },

  async getItems(itemtype, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request('GET', `/${itemtype}${qs}`)
  },

  async getItem(itemtype, id) {
    return request('GET', `/${itemtype}/${id}`)
  },

  async deleteItem(itemtype, id) {
    return request('DELETE', `/${itemtype}/${id}`)
  },

  async deleteItems(itemtype, ids) {
    return request('DELETE', `/${itemtype}`, {
      input: ids.map((id) => ({ id })),
    })
  },

  async uploadDocument(file, name) {
    const formData = new FormData()
    formData.append('uploadManifest', JSON.stringify({
      input: { name, _filename: [file.name] },
    }))
    formData.append('filename[0]', file, file.name)

    const res = await fetch(`${BASE_URL}/Document`, {
      method: 'POST',
      headers: sessionToken ? { 'Session-Token': sessionToken } : {},
      body: formData,
    })
    if (!res.ok) throw new Error(`Upload échoué : HTTP ${res.status}`)
    return res.json()
  },

  isAuthenticated() {
    return sessionToken !== null
  },
}
```

**`src/composables/useGlpiAuth.js`** :
```js
// src/composables/useGlpiAuth.js
import { ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

export function useGlpiAuth() {
  const authenticated = ref(glpiApi.isAuthenticated())
  const loading = ref(false)
  const error = ref(null)

  async function login(loginStr, password) {
    loading.value = true
    error.value = null
    try {
      await glpiApi.initSession(loginStr, password)
      authenticated.value = true
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await glpiApi.killSession()
    authenticated.value = false
  }

  return { authenticated, loading, error, login, logout }
}
```

---

## Notes importantes GLPI API

- Les requêtes `GET` ne doivent **pas** avoir de corps JSON.
- Pour les suppressions en masse, le corps doit contenir `{ "input": [{"id": 1}, {"id": 2}] }`.
- L'upload de documents utilise obligatoirement `multipart/form-data` avec un champ `uploadManifest` en JSON.
- En cas d'erreur, GLPI retourne un tableau `["ERROR_CODE", "message lisible"]`.
