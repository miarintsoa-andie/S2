<template>
    <div class="login-page">
        <form class="login-form" @submit.prevent="onSubmit">
            <div class="logo">
                <span class="logo-text">GLPI</span>
            </div>
            <h2>Connexion</h2>

            <!-- <div class="field">
        <label for="login">Identifiant</label>
        <input id="login" v-model="loginStr" type="text" required autocomplete="username" placeholder="glpi" />
      </div>

      <div class="field">
        <label for="password">Mot de passe</label>
        <input id="password" v-model="password" type="password" required autocomplete="current-password" placeholder="••••••" />
      </div> -->
            <div class="field">
                <label for="admin">Connexion admin</label>
                <input id="admin" v-model="admin" type="password" required autocomplete="current-password"
                    placeholder="••••••">
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
import { glpiApi } from '../services/glpiApi.js'

const router = useRouter()
// const loginStr = ref('glpi')
// const password = ref('glpi')
// const { loading, error, login } = useGlpiAuth()
// const ADMIN_PASS = 'admin123';

// async function onSubmit() {
//   await login(loginStr.value, password.value)
//   if (!error.value ) router.push('/tickets')
// }
const code = import.meta.env.VITE_BACKOFFICE_CODE
const admin = ref(code)

const loading = ref(false)
const error = ref(null)

async function onSubmit() {
    if (admin.value !== code) {
        error.value = 'Code incorrect ! Reessayez ...'
        return
    }
    loading.value = true
    error.value = null
    try {
        await glpiApi.initSessionAuto()
        router.push('./tickets')
    } catch (e) {
        error.value = e.message
    } finally {
        loading.value = false
    }
}

</script>

<style scoped>
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f2f5;
}

.login-form {
    background: #fff;
    padding: 2.5rem 2rem;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 320px;
}

.logo {
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
}

.logo-text {
    background: #3498db;
    color: #fff;
    font-size: 1.4rem;
    font-weight: 700;
    padding: 0.4rem 1rem;
    border-radius: 6px;
    letter-spacing: 2px;
}

h2 {
    margin: 0;
    font-size: 1.2rem;
    text-align: center;
    color: #333;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #555;
}

input {
    padding: 0.55rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.15s;
}

input:focus {
    outline: none;
    border-color: #3498db;
}

.error {
    color: #e74c3c;
    font-size: 0.85rem;
    margin: 0;
    background: #fdf3f3;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
}

button {
    padding: 0.7rem;
    background: #3498db;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}

button:hover:not(:disabled) {
    background: #2980b9;
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
