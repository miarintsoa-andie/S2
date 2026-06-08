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

<style>
* {
  box-sizing: border-box;
}
</style>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.navbar {
  background: rgba(255, 255, 255, 0.8);
  color: var(--text-strong);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.95rem 1.25rem;
  min-height: 64px;
  border: 1px solid var(--line);
  border-radius: 22px;
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(18px);
  flex-wrap: wrap;
}

.nav-brand {
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-strong);
  flex-shrink: 0;
}

.nav-links {
  display: flex;
  gap: 0.25rem;
  flex: 1;
  flex-wrap: wrap;
}

.nav-links a {
  color: var(--muted);
  text-decoration: none;
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.9rem;
  transition: background 0.18s, color 0.18s, border-color 0.18s, transform 0.18s;
}

.nav-links a:hover {
  background: rgba(19, 99, 223, 0.08);
  color: var(--primary-strong);
  transform: translateY(-1px);
}

.nav-links a.router-link-active {
  background: var(--primary-soft);
  color: var(--primary-strong);
  border-color: rgba(19, 99, 223, 0.12);
}

.btn-logout {
  margin-left: auto;
  padding: 0.62rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(19, 99, 223, 0.18);
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  color: #fff;
  cursor: pointer;
  font-size: 0.88rem;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.btn-logout:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px rgba(19, 99, 223, 0.18);
}

.navbar-front .nav-brand {
  color: var(--primary-strong);
}

.nav-admin-link {
  margin-left: auto;
  text-decoration: none;
  padding: 0.62rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(19, 99, 223, 0.18);
  color: var(--primary-strong);
  background: rgba(255, 255, 255, 0.9);
}
</style>
