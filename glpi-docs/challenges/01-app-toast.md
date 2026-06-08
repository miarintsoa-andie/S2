# Challenge 01 — Système de notifications (Toast)

**Difficulté : ⭐ Facile**  
**Durée estimée : 1 h**

---

## Objectif

Créer un système de notifications "toast" global utilisable depuis n'importe quel composant de l'application, sans avoir à le passer en props.

Un toast est un petit message qui apparaît en bas ou en haut de l'écran, reste quelques secondes, puis disparaît automatiquement. On s'en sert pour confirmer une action ("Document importé !") ou signaler une erreur ("Session expirée").

---

## Résultat attendu

```
┌─────────────────────────────────┐
│  ✓  Document importé avec succès │  ← toast "success" (vert)
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ✕  Erreur : Session expirée    │  ← toast "error" (rouge)
└─────────────────────────────────┘
```

Les toasts s'empilent verticalement et disparaissent après 3 secondes.

---

## Fonctionnalités attendues

- [ ] Afficher un toast de type `success`, `error` ou `info`
- [ ] Disparition automatique après 3 secondes
- [ ] Fermeture manuelle possible (croix)
- [ ] Plusieurs toasts simultanés (pile)
- [ ] Transition d'apparition/disparition animée
- [ ] Utilisable via un composable `useToast()` depuis n'importe quel composant

---

## Fichiers à créer

```
src/components/shared/AppToast.vue      # Composant de rendu
src/composables/useToast.js             # Logique et état partagé
```

---

## Amorce de code

### `useToast.js`

```js
// src/composables/useToast.js
import { ref } from 'vue'

// État partagé au niveau module (singleton)
const toasts = ref([])
let nextId = 0

export function useToast() {
  function add(message, type = 'info', duration = 3000) {
    const id = nextId++
    toasts.value.push({ id, message, type })

    // TODO: retirer automatiquement le toast après `duration` ms
  }

  function remove(id) {
    // TODO: filtrer `toasts` pour retirer le toast avec cet id
  }

  // Raccourcis pratiques
  const success = (msg) => add(msg, 'success')
  const error   = (msg) => add(msg, 'error')
  const info    = (msg) => add(msg, 'info')

  return { toasts, add, remove, success, error, info }
}
```

### `AppToast.vue` (structure de base)

```vue
<!-- src/components/shared/AppToast.vue -->
<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="toast.type"
      >
        <span class="toast-message">{{ toast.message }}</span>
        <!-- TODO: ajouter un bouton de fermeture -->
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useToast } from '../../composables/useToast.js'
const { toasts, remove } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toast {
  min-width: 260px;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.toast.success { background: #27ae60; }
.toast.error   { background: #e74c3c; }
.toast.info    { background: #2980b9; }

/* TODO: ajouter les règles CSS pour l'animation TransitionGroup */
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from  { opacity: 0; transform: translateX(60px); }
.toast-leave-to    { opacity: 0; transform: translateX(60px); }
</style>
```

### Intégration dans `App.vue`

```vue
<!-- Ajouter dans le template de App.vue -->
<AppToast />

<!-- Ajouter dans <script setup> -->
import AppToast from './components/shared/AppToast.vue'
```

### Utilisation dans un autre composant

```js
import { useToast } from '../composables/useToast.js'
const toast = useToast()

// Après un import réussi :
toast.success('Document importé avec succès !')

// Après une erreur :
toast.error('Impossible de supprimer : item verrouillé.')
```

---

## Indices

<details>
<summary>Indice 1 — Disparition automatique</summary>

Dans la fonction `add()`, appeler `setTimeout(() => remove(id), duration)` juste après avoir poussé le toast dans le tableau.
</details>

<details>
<summary>Indice 2 — Fermeture manuelle</summary>

Ajouter un `<button @click="remove(toast.id)">✕</button>` dans le template. Styliser avec `background: none; border: none; color: #fff; cursor: pointer`.
</details>

<details>
<summary>Indice 3 — Pourquoi l'état est au niveau module et pas dans le composable ?</summary>

Si `toasts` était déclaré à l'intérieur de `useToast()`, chaque appel créerait un tableau indépendant. En le déclarant au niveau du module (hors de la fonction), tous les appels à `useToast()` partagent le même tableau réactif — c'est le pattern "singleton réactif" de Vue 3.
</details>

---

## Pour aller plus loin

- Ajouter un type `warning` (orange)
- Limiter le nombre de toasts visibles simultanément à 3 (les anciens disparaissent quand on en ajoute un nouveau)
- Brancher automatiquement les toasts sur les erreurs API : dans `glpiApi.js`, appeler `toast.error(message)` depuis le bloc `catch`
- Ajouter une barre de progression qui se vide en temps réel pendant le délai
