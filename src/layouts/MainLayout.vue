<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { ROLE_LABELS, type Permission } from '@/permissions'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function onLogout(): Promise<void> {
  await auth.logout()
  await router.replace('/login')
}

interface NavLink {
  to: string
  label: string
  /** Si se indica, el enlace solo aparece para los roles con ese permiso. */
  permission?: Permission
}

const allLinks: NavLink[] = [
  { to: '/', label: 'Inicio' },
  { to: '/bodegas', label: 'Bodegas' },
  { to: '/productos', label: 'Productos' },
  { to: '/stock', label: 'Stock' },
  { to: '/stock/entrada', label: 'Entrada de stock', permission: 'stock:entry' },
]

const links = computed(() =>
  allLinks.filter((link) => !link.permission || auth.can(link.permission)),
)
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <strong>Logística y Trazabilidad de Stock</strong>
      <nav aria-label="Principal">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</RouterLink>
      </nav>
      <div class="session">
        <span v-if="auth.user" data-test="user">
          {{ auth.user.name }} · {{ ROLE_LABELS[auth.user.role] }}
        </span>
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
