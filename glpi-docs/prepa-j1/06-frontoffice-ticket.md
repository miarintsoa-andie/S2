# Module 6 — FrontOffice : Créer un ticket avec association d'éléments

> **Attendu :** Page publique pour créer un ticket, avec possibilité d'associer plusieurs éléments GLPI.  
> **Statut glpi-front :** ❌ À créer (`TicketsView` / `TicketModal` existants sont pour le backoffice uniquement).

---

## Résultat attendu

```
╔══════════════════════════════════════════════════════════╗
║  Signaler un problème                                    ║
╠══════════════════════════════════════════════════════════╣
║  Type      ○ Incident  ● Demande                        ║
║  Titre     [Écran cassé bureau 3A                    ]  ║
║  Urgence   [ Moyenne ▾ ]                                ║
║  Description                                            ║
║  ┌──────────────────────────────────────────────────┐  ║
║  │ L'écran du PC Dell (bureau 3A) est fissuré.      │  ║
║  └──────────────────────────────────────────────────┘  ║
║                                                         ║
║  Éléments concernés                                     ║
║  ┌──────────────────────────────────────────────┐      ║
║  │ Rechercher un élément…  🔍                   │      ║
║  │  ✓ [42] Dell OptiPlex 7090        ×          │      ║
║  │  ✓ [8]  Moniteur HP Z24           ×          │      ║
║  └──────────────────────────────────────────────┘      ║
║                                                         ║
║  [ Annuler ]              [ Envoyer le ticket ]         ║
╚══════════════════════════════════════════════════════════╝

✓ Ticket #201 créé avec succès.
```

---

## Architecture des fichiers

```
src/
├── views/
│   └── NouveauTicketView.vue       ← page principale
├── components/
│   └── NouveauTicket/
│       ├── TicketForm.vue          ← formulaire (titre, type, urgence, description)
│       ├── ElementPicker.vue       ← sélecteur d'éléments (recherche + liste sélectionnés)
│       └── TicketSuccess.vue       ← confirmation après création
└── composables/
    └── useTicketForm.js            ← logique formulaire + création API
```

Route à ajouter (publique) :
```js
{
  path: '/nouveau-ticket',
  component: () => import('../views/NouveauTicketView.vue'),
  meta: { public: true },
}
```

---

## Étape 1 — Composable `useTicketForm.js`

```js
// src/composables/useTicketForm.js
import { ref, reactive } from 'vue'
import { glpiApi } from '../services/glpiApi.js'

export function useTicketForm() {
  const form = reactive({
    type: 1,          // 1=Incident, 2=Demande
    name: '',
    content: '',
    urgency: 3,       // 1-5
    itilcategories_id: 0,
  })

  const associatedItems = ref([])  // [{ itemtype: 'Computer', items_id: 42, name: 'Dell...' }]
  const submitting = ref(false)
  const error = ref(null)
  const createdTicket = ref(null)

  // Validation
  function validate() {
    if (!form.name || form.name.length < 3) return 'Le titre doit faire au moins 3 caractères.'
    if (!form.content || form.content.length < 10) return 'La description doit faire au moins 10 caractères.'
    return null
  }

  function addItem(item) {
    const already = associatedItems.value.some(
      (i) => i.itemtype === item._type && i.items_id === item.id
    )
    if (!already) {
      associatedItems.value.push({ itemtype: item._type, items_id: item.id, name: item.name })
    }
  }

  function removeItem(index) {
    associatedItems.value.splice(index, 1)
  }

  async function submit() {
    const validationError = validate()
    if (validationError) { error.value = validationError; return }

    submitting.value = true
    error.value = null
    try {
      // 1. Créer le ticket
      const created = await glpiApi.createItem('Ticket', {
        type: form.type,
        name: form.name,
        content: form.content,
        urgency: form.urgency,
        itilcategories_id: form.itilcategories_id,
      })

      // 2. Associer les éléments via Item_Ticket
      for (const assoc of associatedItems.value) {
        await glpiApi.createItem('Item_Ticket', {
          tickets_id: created.id,
          itemtype: assoc.itemtype,
          items_id: assoc.items_id,
        }).catch(() => {}) // ne pas bloquer si l'association échoue
      }

      createdTicket.value = created
    } catch (e) {
      error.value = e.message
    } finally {
      submitting.value = false
    }
  }

  function resetForm() {
    form.type = 1
    form.name = ''
    form.content = ''
    form.urgency = 3
    form.itilcategories_id = 0
    associatedItems.value = []
    createdTicket.value = null
    error.value = null
  }

  return {
    form, associatedItems, submitting, error, createdTicket,
    addItem, removeItem, submit, resetForm,
  }
}
```

---

## Étape 2 — Composant `ElementPicker.vue`

Recherche d'éléments dans GLPI et ajout à la liste des éléments associés au ticket :

```vue
<template>
  <div class="element-picker">
    <label>Éléments concernés</label>

    <!-- Éléments sélectionnés -->
    <ul v-if="modelValue.length > 0" class="selected-list">
      <li v-for="(item, i) in modelValue" :key="i">
        <span>{{ item.name || item.itemtype + ' #' + item.items_id }}</span>
        <button class="btn-remove" @click="$emit('remove', i)">×</button>
      </li>
    </ul>

    <!-- Recherche -->
    <div class="search-wrap">
      <input
        v-model="query"
        type="search"
        placeholder="Rechercher un élément (ordinateur, moniteur…)"
        class="search-input"
        @input="onSearch"
      />
    </div>

    <!-- Résultats -->
    <ul v-if="results.length > 0" class="results-list">
      <li
        v-for="item in results"
        :key="`${item._type}-${item.id}`"
        class="result-item"
        @click="onSelect(item)"
      >
        {{ item._icon }} [{{ item.id }}] {{ item.name }} <span class="type-hint">{{ item._typeLabel }}</span>
      </li>
    </ul>

    <p v-if="searching" class="hint">Recherche en cours…</p>
    <p v-else-if="query.length >= 2 && results.length === 0 && !searching" class="hint">Aucun résultat.</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { glpiApi } from '../../services/glpiApi.js'

defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['add', 'remove'])

const TYPES = [
  { key: 'Computer', label: 'Ordinateur', icon: '🖥' },
  { key: 'Monitor',  label: 'Moniteur',   icon: '🖱' },
  { key: 'NetworkEquipment', label: 'Réseau', icon: '📡' },
  { key: 'Printer',  label: 'Imprimante', icon: '🖨' },
  { key: 'Phone',    label: 'Téléphone',  icon: '📱' },
]

const query = ref('')
const results = ref([])
const searching = ref(false)
let debounceTimer = null

async function onSearch() {
  clearTimeout(debounceTimer)
  if (query.value.length < 2) { results.value = []; return }

  debounceTimer = setTimeout(async () => {
    searching.value = true
    const all = await Promise.allSettled(
      TYPES.map(async ({ key, label, icon }) => {
        const items = await glpiApi.getItems(key, {
          searchText: query.value,
          range: '0-9',
        })
        return items.map((i) => ({ ...i, _type: key, _typeLabel: label, _icon: icon }))
      })
    )
    results.value = all
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .slice(0, 20)
    searching.value = false
  }, 300)
}

function onSelect(item) {
  emit('add', item)
  query.value = ''
  results.value = []
}
</script>

<style scoped>
.element-picker { display: flex; flex-direction: column; gap: 0.5rem; }
label { font-size: 0.85rem; font-weight: 600; color: #555; }
.selected-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.selected-list li {
  display: flex; justify-content: space-between; align-items: center;
  background: #ebf5fb; border: 1px solid #aed6f1;
  padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.88rem;
}
.btn-remove { background: none; border: none; cursor: pointer; color: #888; font-size: 1rem; }
.search-input {
  width: 100%; padding: 0.5rem 0.75rem;
  border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem;
}
.results-list {
  list-style: none; margin: 0; padding: 0;
  border: 1px solid #ddd; border-radius: 6px; max-height: 180px; overflow-y: auto;
}
.result-item {
  padding: 0.45rem 0.75rem; cursor: pointer; font-size: 0.88rem; border-bottom: 1px solid #f0f0f0;
}
.result-item:hover { background: #f0f7ff; }
.type-hint { color: #999; font-size: 0.8rem; margin-left: 0.5rem; }
.hint { color: #999; font-size: 0.82rem; font-style: italic; margin: 0; }
</style>
```

---

## Étape 3 — Vue principale `NouveauTicketView.vue`

```vue
<template>
  <div class="new-ticket-page">
    <!-- Succès -->
    <div v-if="createdTicket" class="success-panel">
      <div class="success-icon">✓</div>
      <h2>Ticket #{{ createdTicket.id }} créé avec succès</h2>
      <p>Votre demande a bien été enregistrée.</p>
      <div class="success-actions">
        <button class="btn-primary" @click="resetForm">Créer un autre ticket</button>
        <RouterLink to="/" class="btn-secondary">Retour au parc</RouterLink>
      </div>
    </div>

    <!-- Formulaire -->
    <form v-else class="ticket-form" @submit.prevent="submit">
      <h1>Signaler un problème</h1>

      <!-- Type -->
      <div class="field">
        <label>Type de demande</label>
        <div class="radio-group">
          <label class="radio-option">
            <input v-model="form.type" type="radio" :value="1" /> Incident
          </label>
          <label class="radio-option">
            <input v-model="form.type" type="radio" :value="2" /> Demande
          </label>
        </div>
      </div>

      <!-- Titre -->
      <div class="field">
        <label for="name">Titre <span class="req">*</span></label>
        <input id="name" v-model="form.name" type="text" required placeholder="Décrivez le problème en quelques mots" />
      </div>

      <!-- Urgence -->
      <div class="field">
        <label for="urgency">Urgence</label>
        <select id="urgency" v-model="form.urgency">
          <option :value="1">Très basse</option>
          <option :value="2">Basse</option>
          <option :value="3">Moyenne</option>
          <option :value="4">Haute</option>
          <option :value="5">Très haute</option>
        </select>
      </div>

      <!-- Description -->
      <div class="field">
        <label for="content">Description <span class="req">*</span></label>
        <textarea id="content" v-model="form.content" rows="5" placeholder="Décrivez le problème en détail…" required />
      </div>

      <!-- Éléments associés -->
      <ElementPicker
        :modelValue="associatedItems"
        @add="addItem"
        @remove="removeItem"
      />

      <p v-if="error" class="error">{{ error }}</p>

      <div class="form-actions">
        <RouterLink to="/" class="btn-secondary">Annuler</RouterLink>
        <button type="submit" class="btn-primary" :disabled="submitting">
          {{ submitting ? 'Envoi en cours…' : 'Envoyer le ticket' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ElementPicker from '../components/NouveauTicket/ElementPicker.vue'
import { useTicketForm } from '../composables/useTicketForm.js'
import { glpiApi } from '../services/glpiApi.js'

const route = useRoute()
const { form, associatedItems, submitting, error, createdTicket, addItem, removeItem, submit, resetForm } = useTicketForm()

onMounted(async () => {
  // Initialiser session GLPI si pas encore auth
  if (!glpiApi.isAuthenticated()) {
    await glpiApi.initSessionAuto().catch(() => {})
  }

  // Pré-remplir l'élément si transmis en query param (/nouveau-ticket?item=Computer&id=42)
  if (route.query.item && route.query.id) {
    const item = await glpiApi.getItem(route.query.item, route.query.id).catch(() => null)
    if (item) {
      addItem({ ...item, _type: route.query.item, name: item.name })
    }
  }
})
</script>
```

---

## Association d'éléments au ticket — Endpoint GLPI

```
POST /api/Item_Ticket
Body: {
  "input": {
    "tickets_id": 201,
    "itemtype": "Computer",
    "items_id": 42
  }
}
```

> Si la création d'`Item_Ticket` retourne 403, activer le droit "Item_Ticket" sur le profil GLPI :  
> **Setup > Profils > {profil} > Assistance > cocher "Éléments associés au ticket"**

---

## Navigation depuis la liste des éléments

Dans `ElementCard.vue` ou `ElementDetail.vue`, ajouter un lien :

```vue
<RouterLink :to="`/nouveau-ticket?item=${item._type}&id=${item.id}`">
  Signaler un problème
</RouterLink>
```

Le composant `NouveauTicketView` détecte les query params et pré-remplit l'élément automatiquement.
