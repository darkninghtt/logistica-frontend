<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function onLogout(): Promise<void> {
  auth.logout()
  await router.replace('/login')
}

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/bodegas', label: 'Bodegas' },
  { to: '/productos', label: 'Productos' },
  { to: '/stock', label: 'Stock' },
]
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <strong>Logística y Trazabilidad de Stock</strong>
      <nav aria-label="Principal">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</RouterLink>
      </nav>
      <div class="session">
        <span v-if="auth.user">{{ auth.user.name }}</span>
        <button type="button" @click="onLogout">Cerrar sesión</button>
      </div>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  font-family: system-ui, sans-serif;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0.75rem 1.5rem;
  background: #1f2937;
  color: #fff;
}
nav {
  display: flex;
  gap: 1rem;
}
.session {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
nav a {
  color: #d1d5db;
  text-decoration: none;
}
nav a.router-link-exact-active {
  color: #fff;
  font-weight: 600;
}
.content {
  padding: 1.5rem;
}
</style>
