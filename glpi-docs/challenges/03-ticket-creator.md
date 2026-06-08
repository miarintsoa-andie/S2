# Challenge 03 — Formulaire de création de ticket

**Difficulté : ⭐⭐⭐ Moyen**  
**Durée estimée : 2 h**

---

## Objectif

Créer un formulaire complet permettant de soumettre un nouveau ticket d'incident ou de demande dans GLPI via l'API REST. Le formulaire doit valider les données côté client avant l'envoi et afficher le résultat avec le lien vers le ticket créé.

---

## Résultat attendu

```
╔══════════════════════════════════════════════╗
║        Nouveau ticket                        ║
╠══════════════════════════════════════════════╣
║  Type      ○ Incident  ● Demande             ║
║  Titre     [Problème réseau bureau 3A    ]   ║
║  Urgence   [ Moyen ▾ ]                       ║
║  Catégorie [ Réseau    ▾ ]                   ║
║  Description                                 ║
║  ┌────────────────────────────────────────┐  ║
║  │ Le switch du bureau 3A ne répond plus  │  ║
║  │ depuis ce matin.                       │  ║
║  └────────────────────────────────────────┘  ║
║                                              ║
║  [ Annuler ]          [ Créer le ticket ]    ║
╚══════════════════════════════════════════════╝

✓ Ticket #187 créé — voir dans GLPI
```

---

## Fonctionnalités attendues

- [ ] Champ **Type** : Incident (1) ou Demande (2) — boutons radio
- [ ] Champ **Titre** requis, minimum 5 caractères
- [ ] Champ **Urgence** : sélecteur (1 Très basse → 5 Très haute)
- [ ] Champ **Description** requis, minimum 10 caractères
- [ ] Validation complète avant soumission (messages d'erreur inline)
- [ ] Appel `POST /api/Ticket` avec le bon payload
- [ ] Affichage de l'ID du ticket créé après succès
- [ ] Bouton "Créer un autre" pour réinitialiser le formulaire
- [ ] État de chargement pendant l'envoi

---

## Fichiers à créer

```
src/components/TicketCreator/TicketForm.vue
src/components/TicketCreator/TicketSuccess.vue
src/composables/useTicketForm.js
src/views/TicketView.vue
```

Route à ajouter : `{ path: '/ticket/new', component: () => import('../views/TicketView.vue') }`

---

## Structure du payload API

```js
// POST /api/Ticket
// Body JSON :
{
  input: {
    name: "Titre du ticket",          // string, requis
    content: "Description détaillée", // string, requis
    type: 1,                          // 1=Incident, 2=Demande
    urgency: 3,                       // 1 à 5
    itilcategories_id: 0,             // ID catégorie (0 = aucune)
  }
}
```

Réponse `201` :
```json
{ "id": 187, "message": "Item successfully added: Titre du ticket" }
```

---

## Amorce de code

### `useTicketForm.js`

```js
// src/composables/useTicketForm.js
import { reactive, ref } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

// Valeurs par défaut du formulaire
function defaultForm() {
  return {
    type: 1,
    name: '',
    urgency: 3,
    itilcategories_id: 0,
    content: '',
  }
}

export function useTicketForm() {
  const form = reactive(defaultForm())
  const errors = reactive({})
  const loading = ref(false)
  const createdId = ref(null)

  function validate() {
    // Vider les erreurs précédentes
    Object.keys(errors).forEach((k) => delete errors[k])

    if (!form.name || form.name.trim().length < 5) {
      errors.name = 'Le titre doit faire au moins 5 caractères.'
    }
    if (!form.content || form.content.trim().length < 10) {
      errors.content = 'La description doit faire au moins 10 caractères.'
    }

    // TODO: ajouter d'autres validations si nécessaire

    return Object.keys(errors).length === 0
  }

  async function submit() {
    if (!validate()) return

    loading.value = true
    createdId.value = null
    try {
      const result = await glpiApi.createItem('Ticket', { input: { ...form } })
      createdId.value = result.id
    } catch (e) {
      errors.api = e.message
    } finally {
      loading.value = false
    }
  }

  function reset() {
    Object.assign(form, defaultForm())
    Object.keys(errors).forEach((k) => delete errors[k])
    createdId.value = null
  }

  return { form, errors, loading, createdId, submit, reset }
}
```

> **À ajouter dans `glpiApi.js`** — méthode `createItem` manquante :
> ```js
> async createItem(itemtype, body) {
>   return request('POST', `/${itemtype}`, body)
> },
> ```

### `TicketForm.vue` (squelette)

```vue
<!-- src/components/TicketCreator/TicketForm.vue -->
<template>
  <form class="ticket-form" @submit.prevent="submit">
    <h2>Nouveau ticket</h2>

    <!-- Type -->
    <fieldset class="field">
      <legend>Type</legend>
      <label><input type="radio" v-model="form.type" :value="1" /> Incident</label>
      <label><input type="radio" v-model="form.type" :value="2" /> Demande</label>
    </fieldset>

    <!-- Titre -->
    <div class="field">
      <label for="name">Titre <span class="required">*</span></label>
      <input
        id="name"
        v-model="form.name"
        type="text"
        :class="{ invalid: errors.name }"
        placeholder="Décrivez le problème en une phrase"
      />
      <p v-if="errors.name" class="error">{{ errors.name }}</p>
    </div>

    <!-- Urgence -->
    <div class="field">
      <label for="urgency">Urgence</label>
      <select id="urgency" v-model="form.urgency">
        <option :value="1">1 — Très basse</option>
        <option :value="2">2 — Basse</option>
        <option :value="3">3 — Moyenne</option>
        <option :value="4">4 — Haute</option>
        <option :value="5">5 — Très haute</option>
      </select>
    </div>

    <!-- Description -->
    <div class="field">
      <label for="content">Description <span class="required">*</span></label>
      <textarea
        id="content"
        v-model="form.content"
        rows="5"
        :class="{ invalid: errors.content }"
        placeholder="Décrivez le problème en détail"
      />
      <p v-if="errors.content" class="error">{{ errors.content }}</p>
    </div>

    <!-- Erreur API -->
    <p v-if="errors.api" class="error api-error">{{ errors.api }}</p>

    <!-- Actions -->
    <div class="actions">
      <button type="button" @click="reset">Annuler</button>
      <button type="submit" class="primary" :disabled="loading">
        {{ loading ? 'Création...' : 'Créer le ticket' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { useTicketForm } from '../../composables/useTicketForm.js'

const emit = defineEmits(['created'])
const { form, errors, loading, createdId, submit: doSubmit, reset } = useTicketForm()

async function submit() {
  await doSubmit()
  if (createdId.value) emit('created', createdId.value)
}
</script>

<style scoped>
.ticket-form { max-width: 560px; display: flex; flex-direction: column; gap: 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
fieldset { border: 1px solid #ddd; border-radius: 4px; padding: 0.75rem; display: flex; gap: 1.5rem; }
legend { font-weight: 600; padding: 0 0.25rem; }
input[type="text"], select, textarea { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
input.invalid, textarea.invalid { border-color: #e74c3c; }
.required { color: #e74c3c; }
.error { color: #e74c3c; font-size: 0.85rem; margin: 0; }
.api-error { padding: 0.5rem; background: #fdf3f3; border-radius: 4px; }
.actions { display: flex; gap: 1rem; justify-content: flex-end; }
.primary { background: #3498db; color: #fff; border: none; padding: 0.6rem 1.5rem; border-radius: 4px; cursor: pointer; }
.primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

### `TicketSuccess.vue`

```vue
<!-- src/components/TicketCreator/TicketSuccess.vue -->
<template>
  <div class="success-card">
    <span class="icon">✓</span>
    <div>
      <p><strong>Ticket #{{ ticketId }} créé avec succès</strong></p>
      <p class="hint">Il est maintenant visible dans GLPI → Assistance → Tickets.</p>
    </div>
    <button @click="$emit('nouveau')">Créer un autre</button>
  </div>
</template>

<script setup>
defineProps({ ticketId: Number })
defineEmits(['nouveau'])
</script>

<style scoped>
.success-card {
  display: flex; align-items: center; gap: 1rem;
  padding: 1.25rem; border-radius: 8px;
  background: #eafaf1; border: 1px solid #27ae60;
  max-width: 560px;
}
.icon { font-size: 2rem; color: #27ae60; }
.hint { font-size: 0.85rem; color: #555; margin: 0.2rem 0 0; }
button { margin-left: auto; padding: 0.5rem 1rem; border: 1px solid #27ae60; background: #fff; color: #27ae60; border-radius: 4px; cursor: pointer; }
</style>
```

### `TicketView.vue`

```vue
<!-- src/views/TicketView.vue -->
<template>
  <main class="ticket-view">
    <TicketSuccess v-if="createdId" :ticket-id="createdId" @nouveau="createdId = null" />
    <TicketForm v-else @created="(id) => createdId = id" />
  </main>
</template>

<script setup>
import { ref } from 'vue'
import TicketForm from '../components/TicketCreator/TicketForm.vue'
import TicketSuccess from '../components/TicketCreator/TicketSuccess.vue'

const createdId = ref(null)
</script>

<style scoped>
.ticket-view { padding: 2rem; }
</style>
```

---

## Indices

<details>
<summary>Indice 1 — Le `content` GLPI accepte du HTML</summary>

GLPI stocke la description en HTML. Envoyer du texte brut fonctionne, mais si tu veux des retours à la ligne, remplacer `\n` par `<br>` :
```js
content: form.content.replace(/\n/g, '<br>')
```
</details>

<details>
<summary>Indice 2 — Validation en temps réel</summary>

Pour effacer l'erreur d'un champ dès que l'utilisateur le corrige, utiliser `watch` :
```js
import { watch } from 'vue'
watch(() => form.name, () => { delete errors.name })
watch(() => form.content, () => { delete errors.content })
```
</details>

---

## Pour aller plus loin

- Charger les catégories GLPI depuis `GET /api/ITILCategory` et les afficher dans un `<select>`
- Ajouter un champ "Observateurs" (champ multi-select d'utilisateurs GLPI)
- Pré-remplir le formulaire si des paramètres sont passés via la query string (`?type=2&urgency=4`)
- Ajouter un aperçu markdown de la description en temps réel à côté du textarea
