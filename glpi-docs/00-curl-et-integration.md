# Guide GLPI API — curl & intégration glpi-front

Version : GLPI 11.0.7  
Point d'entrée API : `http://glpi.localhost/apirest.php`

---

## Partie 1 — Pré-requis : activer l'API GLPI

Dans l'interface GLPI (connecté en admin) :

1. **Setup > Général > API** → cocher "Activer l'API REST"
2. Vérifier que "Autoriser l'authentification par identifiants" est activé
3. (Optionnel mais recommandé) Créer un **App-Token** : Setup > Général > API > Ajouter un client API

Credentials par défaut GLPI : `glpi` / `glpi`

---

## Partie 2 — Commandes curl

### Variable utilitaire (shell)

Définir une fois en début de session :

```bash
BASE="http://glpi.localhost/apirest.php"
```

---

### 1 — Authentification : obtenir un `session_token`

#### Via identifiants (Basic Auth)

```bash
# glpi:glpi encodé en base64 = Z2xwaTpnbHBp
curl -s -X GET "$BASE/initSession" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic Z2xwaTpnbHBp" \
  | python3 -m json.tool
```

Pour encoder tes propres credentials :

```bash
echo -n "glpi:glpi" | base64
# → Z2xwaTpnbHBp
```

**Réponse attendue :**

```json
{ "session_token": "83af7e620c83a50a18d3eac2f6ed05a3ca0bea62" }
```

**Stocker le token dans une variable shell :**

```bash
TOKEN=$(curl -s -X GET "$BASE/initSession" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic Z2xwaTpnbHBp" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['session_token'])")

echo $TOKEN
```

#### Via user_token (clé d'accès distant)

Trouver son token dans GLPI : Préférences utilisateur > Accès distant (API).

```bash
curl -s -X GET "$BASE/initSession" \
  -H "Content-Type: application/json" \
  -H "Authorization: user_token VOTRE_USER_TOKEN" \
  | python3 -m json.tool
```

---

### 2 — Lister des items (Tickets, Computers…)

```bash
# 50 premiers tickets, triés par ID décroissant
curl -s -X GET "$BASE/Ticket?range=0-49&sort=id&order=DESC" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool
```

```bash
# Ordinateurs
curl -s -X GET "$BASE/Computer?range=0-49" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool
```

---

### 3 — Lire le total via `Content-Range` (stats — challenge 02)

Technique clé pour les statistiques : récupérer le total **sans charger tous les items**.

```bash
curl -sI -X GET "$BASE/Ticket?range=0-0&only_id=1" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  | grep -i "Content-Range"

# → Content-Range: 0-0/142
#                      ^^^— total = 142 tickets
```

Pour extraire le total directement :

```bash
curl -si -X GET "$BASE/Ticket?range=0-0&only_id=1" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  | grep -i "Content-Range" \
  | awk -F'/' '{print $2}'
# → 142
```

---

### 4 — Créer un ticket

```bash
curl -s -X POST "$BASE/Ticket" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "name": "Problème réseau bureau 3",
      "content": "Impossible de se connecter au réseau depuis ce matin.",
      "type": 1,
      "urgency": 3
    }
  }' \
  | python3 -m json.tool
```

**Réponse (HTTP 201) :**

```json
{ "id": 187, "message": "Item successfully added: Problème réseau bureau 3" }
```

Valeurs possibles :

| Champ | Valeurs |
|-------|---------|
| `type` | `1` = Incident, `2` = Demande |
| `urgency` | `1` (très basse) → `5` (très haute) |
| `status` | `1` = Nouveau, `2` = En cours assigné, `5` = Résolu, `6` = Clos |

---

### 5 — Mettre à jour un ticket (PATCH)

```bash
# Passer le ticket 187 en statut "Résolu" (5) avec urgence haute (4)
curl -s -X PATCH "$BASE/Ticket/187" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "id": 187,
      "status": 5,
      "urgency": 4
    }
  }' \
  | python3 -m json.tool
```

**Réponse :**

```json
[{ "187": true, "message": "" }]
```

---

### 6 — Supprimer un item

#### Unitaire

```bash
curl -s -X DELETE "$BASE/Ticket/187" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool
```

#### Batch (plusieurs IDs)

```bash
curl -s -X DELETE "$BASE/Ticket" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": [
      { "id": 10 },
      { "id": 11 },
      { "id": 12 }
    ]
  }' \
  | python3 -m json.tool
```

**Réponse :**

```json
[
  { "10": true, "message": "" },
  { "11": true, "message": "" },
  { "12": false, "message": "Item locked" }
]
```

---

### 7 — Upload d'un document (multipart/form-data)

```bash
curl -s -X POST "$BASE/Document" \
  -H "Session-Token: $TOKEN" \
  -F 'uploadManifest={"input":{"name":"Mon rapport","_filename":["rapport.pdf"]}}' \
  -F "filename[0]=@/chemin/vers/rapport.pdf" \
  | python3 -m json.tool
```

**Réponse (HTTP 201) :**

```json
{ "id": 42, "message": "Item successfully added: Mon rapport" }
```

> Ne pas ajouter `Content-Type: application/json` sur cet appel — `curl -F` gère automatiquement `multipart/form-data`.

---

### 8 — Fermer la session

```bash
curl -s -X GET "$BASE/killSession" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json"
# → true
```

---

### Codes HTTP courants

| Code | Signification |
|------|---------------|
| 200 | OK |
| 201 | Item créé (POST) |
| 204 | Succès sans contenu |
| 400 | Champ manquant ou item verrouillé |
| 401 | Non authentifié / session expirée |
| 403 | Droits insuffisants |
| 404 | Item introuvable |

Les erreurs GLPI ont toujours la forme `["ERROR_CODE", "message lisible"]`.

---

## Partie 3 — Intégration glpi-front

Cinq fichiers à créer/modifier dans le projet Vue 3 (`glpi-front/`), dans l'ordre.

### Étape 0 — Installer vue-router

```bash
npm install vue-router
```

---

### Fichier 1 — `vite.config.js` — Proxy API

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost/glpi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/apirest.php'),
      },
    },
  },
})
```

> Tous les `fetch('/api/Ticket')` du frontend deviennent `http://localhost/glpi/apirest.php/Ticket`.
> Le navigateur ne voit jamais l'URL GLPI directement → pas de problème CORS en dev.

---

### Fichier 2 — `src/services/glpiApi.js` — Client HTTP centralisé

```js
// src/services/glpiApi.js
const BASE_URL = '/api'
let sessionToken = null

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  if (sessionToken) h['Session-Token'] = sessionToken
  // App-Token optionnel : h['App-Token'] = import.meta.env.VITE_GLPI_APP_TOKEN
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

  // Retourne data + total extrait du header Content-Range (pour les stats)
  async getItemsRaw(itemtype, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await fetch(`${BASE_URL}/${itemtype}${qs}`, { headers: headers() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const contentRange = res.headers.get('Content-Range')
    const total = contentRange ? parseInt(contentRange.split('/')[1]) : data.length
    return { data, total }
  },

  async getItems(itemtype, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request('GET', `/${itemtype}${qs}`)
  },

  async getItem(itemtype, id) {
    return request('GET', `/${itemtype}/${id}`)
  },

  async createItem(itemtype, input) {
    return request('POST', `/${itemtype}`, { input })
  },

  async patchItem(itemtype, id, input) {
    return request('PATCH', `/${itemtype}/${id}`, { input })
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

---

### Fichier 3 — `src/composables/useGlpiAuth.js`

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
    await glpiApi.killSession().catch(() => {})
    authenticated.value = false
  }

  return { authenticated, loading, error, login, logout }
}
```

---

### Fichier 4 — `src/router/index.js`

```js
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { glpiApi } from '../services/glpiApi.js'

const routes = [
  {
    path: '/login',
    component: () => import('../views/LoginView.vue'),
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
  // Ajouter les autres routes ici au fur et à mesure
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard : redirige vers /login si pas de session
router.beforeEach((to) => {
  if (to.path !== '/login' && !glpiApi.isAuthenticated()) {
    return '/login'
  }
})

export default router
```

---

### Fichier 5 — `src/views/LoginView.vue`

```vue
<!-- src/views/LoginView.vue -->
<template>
  <div class="login-page">
    <form class="login-form" @submit.prevent="onSubmit">
      <h2>Connexion GLPI</h2>

      <div class="field">
        <label for="login">Identifiant</label>
        <input id="login" v-model="login" type="text" required autocomplete="username" />
      </div>

      <div class="field">
        <label for="password">Mot de passe</label>
        <input id="password" v-model="password" type="password" required autocomplete="current-password" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGlpiAuth } from '../composables/useGlpiAuth.js'

const router = useRouter()
const login = ref('')
const password = ref('')
const { loading, error, login: doLogin } = useGlpiAuth()

async function onSubmit() {
  await doLogin(login.value, password.value)
  if (!error.value) router.push('/dashboard')
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f6fa;
}
.login-form {
  background: #fff;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 300px;
}
.field { display: flex; flex-direction: column; gap: 0.3rem; }
label { font-size: 0.85rem; font-weight: 600; color: #555; }
input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}
input:focus { outline: none; border-color: #3498db; }
.error { color: #e74c3c; font-size: 0.85rem; margin: 0; }
button {
  padding: 0.65rem;
  background: #3498db;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

---

### Mettre à jour `src/main.js`

```js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'

createApp(App).use(router).mount('#app')
```

---

### Mettre à jour `src/App.vue`

```vue
<template>
  <RouterView />
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  // Redirige vers /login si la session expire côté serveur (401 intercepté dans glpiApi)
  window.addEventListener('glpi:session-expired', () => router.push('/login'))
})
</script>
```

---

## Partie 4 — Validation end-to-end

```bash
npm run dev
# → http://localhost:5173
```

Checklist :

- [ ] `http://localhost:5173` redirige vers `/login` (navigation guard OK)
- [ ] Se connecter avec `glpi/glpi` → redirige vers `/dashboard`
- [ ] DevTools > Network : la requête part vers `/api/initSession` (proxy transparent, pas de CORS)
- [ ] Header `Session-Token` présent sur les requêtes suivantes
- [ ] Fermer l'onglet et rouvrir → redirige vers `/login` (token en mémoire, pas persisté)
