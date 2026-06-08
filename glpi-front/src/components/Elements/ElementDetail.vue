<template>
  <div class="overlay" @mousedown.self="$emit('close')">
    <div class="detail-modal">
      <div class="modal-header">
        <h3>{{ item._icon }} {{ item.name }}</h3>
        <button @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <dl>
          <dt>Type</dt><dd>{{ item._typeLabel }}</dd>
          <dt>ID GLPI</dt><dd>{{ item.id }}</dd>
          <dt v-if="item.serial">N° de série</dt><dd v-if="item.serial">{{ item.serial }}</dd>
          <dt v-if="item.otherserial">Inventaire</dt><dd v-if="item.otherserial">{{ item.otherserial }}</dd>
          <dt v-if="item.comment">Commentaire</dt><dd v-if="item.comment">{{ item.comment }}</dd>
        </dl>
        <RouterLink :to="`/nouveau-ticket?item=${item._type}&id=${item.id}`" class="btn-primary">
          Signaler un problème sur cet élément
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ item: Object })
defineEmits(['close'])
</script>