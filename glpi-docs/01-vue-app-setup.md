# Guide de mise en place de l'application Vue.js

## Présentation du projet

Le projet Vue.js (`glpi-front/`) est une application TypeScript + Vite + Vue 3 destinée à consommer l'API REST de GLPI pour exposer deux fonctionnalités principales :

- **Import de fichier** : upload et traitement de fichiers JSON/CSV vers GLPI
- **Réinitialisation de données** : suppression et remise à zéro d'objets GLPI via l'API

Le backend cible est l'instance GLPI 11.0.7 hébergée dans `/var/www/glpi`, dont l'API REST est exposée via `apirest.php`.

---

## Structure cible du projet

```
glpi-front/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── ImportFichier/
│   │   │   ├── ImportForm.vue          # Formulaire d'upload
│   │   │   ├── ImportPreview.vue       # Aperçu avant import
│   │   │   └── ImportResult.vue        # Résultat de l'import
│   │   ├── Reinitialisation/
│   │   │   ├── ResetPanel.vue          # Panneau de sélection
│   │   │   ├── ResetConfirm.vue        # Modale de confirmation
│   │   │   └── ResetResult.vue         # Résultat du reset
│   │   └── shared/
│   │       ├── AppLoader.vue
│   │       └── AppAlert.vue
│   ├── composables/
│   │   ├── useGlpiAuth.ts              # Authentification (session)
│   │   ├── useImport.ts                # Logique import fichier
│   │   └── useReinit.ts                # Logique réinitialisation
│   ├── services/
│   │   └── glpiApi.ts                  # Client HTTP centralisé
│   ├── types/
│   │   └── glpi.ts                     # Types TypeScript des réponses API
│   ├── views/
│   │   ├── ImportView.vue
│   │   └── ReinitialisationView.vue
│   ├── router/
│   │   └── index.ts
│   ├── App.vue
│   └── main.ts
├── package.json
└── vite.config.ts
```

---

## Installation des dépendances

```bash
cd glpi-front

# Router et HTTP
npm install vue-router@4 axios

# UI (optionnel mais recommandé)
npm install @vueuse/core

# Types
npm install --save-dev @types/node
```

---

## Configuration Vite (proxy API)

Modifier `vite.config.ts` pour proxifier les appels vers GLPI et éviter les problèmes CORS en développement :

```ts
// glpi-front/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost/glpi',   // adapter selon votre config Apache
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/apirest.php'),
      },
    },
  },
})
```

Tous les appels `fetch('/api/...')` seront redirigés vers `http://localhost/glpi/apirest.php/...`.

---

## Router Vue

Le router inclut une navigation guard qui redirige vers `/login` si l'utilisateur n'est pas authentifié.

```ts
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { glpiApi } from '../services/glpiApi'
import ImportView from '../views/ImportView.vue'
import ReinitialisationView from '../views/ReinitialisationView.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/import' },
    { path: '/login', component: LoginView },
    { path: '/import', component: ImportView },
    { path: '/reinitialisation', component: ReinitialisationView },
  ],
})

// Protéger toutes les routes sauf /login
router.beforeEach((to) => {
  if (to.path !== '/login' && !glpiApi.isAuthenticated()) {
    return '/login'
  }
})

export default router
```

```ts
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')
```

---

## App.vue de base

```vue
<!-- src/App.vue -->
<template>
  <div>
    <nav v-if="authenticated">
      <RouterLink to="/import">Import fichier</RouterLink>
      <RouterLink to="/reinitialisation">Réinitialisation</RouterLink>
      <button @click="logout">Déconnexion</button>
    </nav>
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { useGlpiAuth } from './composables/useGlpiAuth'
import { useRouter } from 'vue-router'

const { authenticated, logout: doLogout } = useGlpiAuth()
const router = useRouter()

async function logout() {
  await doLogout()
  router.push('/login')
}
</script>
```

## LoginView.vue

```vue
<!-- src/views/LoginView.vue -->
<template>
  <div class="login-page">
    <h1>Connexion GLPI</h1>
    <form @submit.prevent="onSubmit">
      <label>
        Identifiant
        <input v-model="form.login" type="text" required autofocus />
      </label>
      <label>
        Mot de passe
        <input v-model="form.password" type="password" required />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Connexion...' : 'Se connecter' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useGlpiAuth } from '../composables/useGlpiAuth'

const form = reactive({ login: '', password: '' })
const { loading, error, login } = useGlpiAuth()
const router = useRouter()

async function onSubmit() {
  await login(form.login, form.password)
  if (!error.value) router.push('/import')
}
</script>

<style scoped>
.login-page { max-width: 360px; margin: 4rem auto; }
form { display: flex; flex-direction: column; gap: 1rem; }
.error { color: #e74c3c; }
button { padding: 0.6rem; background: #3498db; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
button:disabled { opacity: 0.5; }
</style>
```

---

---

## Version JavaScript

Pour un projet sans TypeScript, remplacer les fichiers `.ts` par des `.js` et retirer les annotations de types.

**`vite.config.js`** — identique, juste renommer le fichier :
```js
// glpi-front/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
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

**`src/router/index.js`** :
```js
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { glpiApi } from '../services/glpiApi.js'
import ImportView from '../views/ImportView.vue'
import ReinitialisationView from '../views/ReinitialisationView.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/import' },
    { path: '/login', component: LoginView },
    { path: '/import', component: ImportView },
    { path: '/reinitialisation', component: ReinitialisationView },
  ],
})

router.beforeEach((to) => {
  if (to.path !== '/login' && !glpiApi.isAuthenticated()) {
    return '/login'
  }
})

export default router
```

**`src/main.js`** :
```js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'

createApp(App).use(router).mount('#app')
```

Dans `package.json`, s'assurer que le script de démarrage pointe bien sur Vite :
```json
"scripts": {
  "serve": "vite",
  "build": "vite build"
}
```

---

## Étapes suivantes

| Étape | Document |
|-------|----------|
| Authentification et client API | [02-api-client.md](./02-api-client.md) |
| Feature Import de fichier | [03-feature-import.md](./03-feature-import.md) |
| Feature Réinitialisation | [04-feature-reinitialisation.md](./04-feature-reinitialisation.md) |
| Référence des endpoints GLPI | [05-api-reference.md](./05-api-reference.md) |
