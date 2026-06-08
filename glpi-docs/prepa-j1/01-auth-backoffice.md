# Module 1 — Authentification Backoffice (Code unique)

> **Attendu :** Code unique comme mot de passe, pré-rempli par défaut sur le formulaire.  
> **Statut glpi-front :** ⚠️ Partiel — le guard et le router existent, seul le formulaire est à adapter.

---

## Principe

L'accès au backoffice est protégé par un **code unique** (un seul champ, pré-rempli).  
Côté GLPI, la connexion se fait en arrière-plan avec les credentials fixes de l'instance.  
Le code n'est jamais transmis à GLPI — il est validé localement (ou comparé à une variable d'env).

```
┌──────────────────────────────────────┐
│  Accès Backoffice                    │
│                                      │
│  Code d'accès                        │
│  ┌──────────────────────────────┐   │
│  │ admin2026              ←pré-rempli│
│  └──────────────────────────────┘   │
│                                      │
│  [ Accéder au backoffice ]           │
└──────────────────────────────────────┘
```

---

## Étape 1 — Variable d'environnement

Créer `.env` à la racine de `glpi-front` :

```
VITE_BACKOFFICE_CODE=admin2026
VITE_GLPI_LOGIN=glpi
VITE_GLPI_PASSWORD=glpi
```

> `.env` ne doit pas être commité. Ajouter `.env` à `.gitignore`.

---

## Étape 2 — Modifier `src/services/glpiApi.js`

Ajouter une méthode `initSessionWithEnvCredentials` pour que la connexion GLPI
se fasse automatiquement sans exposer les credentials dans le formulaire :

```js
// Dans glpiApi (après initSession existant)
async initSessionAuto() {
  const login = import.meta.env.VITE_GLPI_LOGIN ?? 'glpi'
  const password = import.meta.env.VITE_GLPI_PASSWORD ?? 'glpi'
  return this.initSession(login, password)
},
```

---

## Étape 3 — Modifier `src/views/LoginView.vue`

Remplacer le formulaire login/password par un formulaire code unique.

```vue
<template>
  <div class="login-page">
    <form class="login-form" @submit.prevent="onSubmit">
      <div class="logo"><span class="logo-text">Backoffice</span></div>
      <h2>Accès administrateur</h2>

      <div class="field">
        <label for="code">Code d'accès</label>
        <input
          id="code"
          v-model="code"
          type="password"
          required
          autocomplete="current-password"
        />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Vérification…' : 'Accéder' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { glpiApi } from '../services/glpiApi.js'

const router = useRouter()
const EXPECTED_CODE = import.meta.env.VITE_BACKOFFICE_CODE ?? 'admin2026'

// Pré-rempli avec la valeur par défaut
const code = ref(EXPECTED_CODE)
const loading = ref(false)
const error = ref(null)

async function onSubmit() {
  if (code.value !== EXPECTED_CODE) {
    error.value = 'Code incorrect.'
    return
  }
  loading.value = true
  error.value = null
  try {
    await glpiApi.initSessionAuto()
    router.push('/dashboard')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
```

---

## Étape 4 — Architecture Backoffice / FrontOffice dans le router

Séparer les routes en deux groupes dans `src/router/index.js` :

```js
import { createRouter, createWebHistory } from 'vue-router'
import { glpiApi } from '../services/glpiApi.js'

const routes = [
  // ── Auth ──────────────────────────────────────────────────────
  {
    path: '/login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },

  // ── Backoffice (protégé) ───────────────────────────────────────
  {
    path: '/dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { backoffice: true },
  },
  {
    path: '/import',
    component: () => import('../views/ImportView.vue'),
    meta: { backoffice: true },
  },
  {
    path: '/tickets',
    component: () => import('../views/TicketsView.vue'),
    meta: { backoffice: true },
  },
  {
    path: '/reinitialisation',
    component: () => import('../views/ReinitialisationView.vue'),
    meta: { backoffice: true },
  },

  // ── FrontOffice (public) ───────────────────────────────────────
  {
    path: '/',
    component: () => import('../views/ElementsView.vue'),
    meta: { public: true },
  },
  {
    path: '/nouveau-ticket',
    component: () => import('../views/NouveauTicketView.vue'),
    meta: { public: true },
  },

  // Redirect racine si non auth
  { path: '/backoffice', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.meta.backoffice && !glpiApi.isAuthenticated()) {
    return '/login'
  }
})

export default router
```

---

## Étape 5 — Deux navbars dans `App.vue`

```vue
<template>
  <div class="app">
    <!-- Navbar backoffice -->
    <nav v-if="isBackoffice && isAuthenticated" class="navbar navbar-admin">
      <span class="nav-brand">⚙ Backoffice</span>
      <div class="nav-links">
        <RouterLink to="/dashboard">Dashboard</RouterLink>
        <RouterLink to="/import">Import</RouterLink>
        <RouterLink to="/tickets">Tickets</RouterLink>
        <RouterLink to="/reinitialisation">Réinitialisation</RouterLink>
      </div>
      <button class="btn-logout" @click="onLogout">Déconnexion</button>
    </nav>

    <!-- Navbar frontoffice -->
    <nav v-else-if="isFrontoffice" class="navbar navbar-front">
      <span class="nav-brand">Mon Parc</span>
      <div class="nav-links">
        <RouterLink to="/">Éléments</RouterLink>
        <RouterLink to="/nouveau-ticket">Signaler un problème</RouterLink>
      </div>
      <RouterLink to="/login" class="nav-admin-link">Admin</RouterLink>
    </nav>

    <RouterView />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { glpiApi } from './services/glpiApi.js'

const router = useRouter()
const route = useRoute()
const isAuthenticated = ref(glpiApi.isAuthenticated())

const isBackoffice = computed(() => !!route.meta.backoffice)
const isFrontoffice = computed(() => !!route.meta.public && route.path !== '/login')

onMounted(() => {
  window.addEventListener('glpi:session-expired', () => {
    isAuthenticated.value = false
    router.push('/login')
  })
})

async function onLogout() {
  await glpiApi.killSession().catch(() => {})
  isAuthenticated.value = false
  router.push('/login')
}
</script>
```

---

## Vérification

- [ ] `http://localhost:5173/dashboard` → redirige vers `/login`
- [ ] Le code est pré-rempli sur la page login
- [ ] Un code incorrect affiche "Code incorrect."
- [ ] Un code correct appelle GLPI en arrière-plan et redirige vers `/dashboard`
- [ ] `http://localhost:5173/` (FrontOffice) → accessible sans auth
- [ ] La navbar backoffice n'apparaît pas sur les pages frontoffice
