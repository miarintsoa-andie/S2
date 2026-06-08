// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { glpiApi } from '../services/glpiApi.js'

const routes = [
    {
        path: '/login',
        component: () => import('../views/LoginView.vue'),
        meta: { public: true }
    },
    {
        path: '/',
        redirect: '/tickets',
    },
    {
        path: '/tickets',
        component: () => import('../views/TicketsView.vue'),
    },
    {
        path: '/reinitialisation',
        component: () => import('../views/ReinitialisationView.vue'),
    },
    {
        path: '/import',
        component: () => import('../views/ImportView.vue'),
    },
    {
        path: '/elements',
        component: () => import('../views/ElementsView.vue'),
        meta: { public: true }
    },
    { path: '/dashboard', component: () => import('../views/DashboardView.vue'), meta: { backoffice: true } }
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

router.beforeEach((to) => {
    // Laisser passer les pages publiques (FrontOffice et Login)
    if (to.meta.public) {
        return true
    }
    
    // Protéger le reste (BackOffice)
    if (to.path !== '/login' && !glpiApi.isAuthenticated()) {
        return '/login'
    }
})

export default router
