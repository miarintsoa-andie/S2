<template>
  <div class="overlay">
    <div class="modal">
      <h3>Confirmer la suppression</h3>
      <p>
        Vous allez supprimer <strong>{{ count }}</strong>
        élément(s) de type <strong>{{ itemtype }}</strong>.
      </p>
      <p class="warning">Cette action est irréversible.</p>
      <div class="modal-actions">
        <button class="btn-danger" @click="$emit('confirm')">Confirmer</button>
        <button class="btn-cancel" @click="$emit('cancel')">Annuler</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ count: Number, itemtype: String })
defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 2rem;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}
.modal h3 { margin: 0 0 0.75rem; }
.modal p { margin: 0.3rem 0; }
.warning { color: #e74c3c; font-weight: 600; margin-top: 0.5rem !important; }
.modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
.btn-danger {
  background: #e74c3c;
  color: #fff;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.btn-danger:hover { background: #c0392b; }
.btn-cancel {
  background: #fff;
  border: 1px solid #ccc;
  padding: 0.6rem 1.4rem;
  border-radius: 4px;
  cursor: pointer;
}
.btn-cancel:hover { background: #f5f5f5; }
</style>
