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

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: #f0f2f5;
  color: #333;
}
</style>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background: #2c3e50;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1.5rem;
  height: 52px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.nav-brand {
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.5px;
  color: #ecf0f1;
  flex-shrink: 0;
}

.nav-links {
  display: flex;
  gap: 0.25rem;
  flex: 1;
}

.nav-links a {
  color: #bdc3c7;
  text-decoration: none;
  padding: 0.35rem 0.85rem;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s;
}

.nav-links a:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-links a.router-link-active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.btn-logout {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #bdc3c7;
  padding: 0.3rem 0.85rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.15s, color 0.15s;
}

.btn-logout:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
</style>
