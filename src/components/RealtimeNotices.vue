<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useRealtimeStore } from '@/stores/realtime'

const realtime = useRealtimeStore()
</script>

<template>
  <!-- role="status": los lectores de pantalla leen el aviso sin mover el foco -->
  <div class="notices" role="status" aria-live="polite">
    <div v-for="notice in realtime.notices" :key="notice.id" class="notice" data-test="notice">
      <span>{{ notice.text }}</span>
      <RouterLink v-if="notice.to" :to="notice.to" @click="realtime.dismiss(notice.id)">
        Ver
      </RouterLink>
      <button type="button" aria-label="Cerrar aviso" @click="realtime.dismiss(notice.id)">
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.notices {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(24rem, calc(100vw - 2rem));
  z-index: 10;
}
.notice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #1f2937;
  color: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
}
.notice span {
  flex: 1;
}
.notice a {
  color: #93c5fd;
}
.notice button {
  background: none;
  border: none;
  color: #d1d5db;
  font-size: 1.25rem;
  cursor: pointer;
}
</style>
