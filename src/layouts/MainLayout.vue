<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import RealtimeNotices from '@/components/RealtimeNotices.vue'
import { useRealtime } from '@/composables/useRealtime'
import { ROLE_LABELS, type Permission } from '@/permissions'
import { screenFromRoute } from '@/realtime'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'
import type { RealtimeStatus } from '@/types/realtime'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const realtime = useRealtimeStore()

// Conexión en vivo mientras haya sesión; los eventos recargan lo que está en pantalla
useRealtime(() => screenFromRoute(route.name, route.params.id))

const REALTIME_LABELS: Record<RealtimeStatus, string> = {
  connected: 'En vivo',
  connecting: 'Conectando…',
  disconnected: 'Sin conexión en vivo',
}

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
  { to: '/stock/merma', label: 'Mermas', permission: 'stock:shrinkage' },
  { to: '/traspasos', label: 'Traspasos' },
  { to: '/kardex', label: 'Kardex', permission: 'reports:view' },
  { to: '/reportes', label: 'Reportes', permission: 'reports:view' },
  { to: '/usuarios', label: 'Usuarios', permission: 'users:manage' },
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
        <span
          class="live"
          :class="realtime.status"
          data-test="realtime-status"
          :title="
            realtime.status === 'connected'
              ? 'Los cambios de otros usuarios aparecen solos'
              : 'Los datos se actualizan al recargar cada pantalla'
          "
        >
          {{ REALTIME_LABELS[realtime.status] }}
        </span>
        <span v-if="auth.user" data-test="user">
          {{ auth.user.name }} · {{ ROLE_LABELS[auth.user.role] }}
        </span>
        <RouterLink to="/mi-cuenta" class="account">Mi cuenta</RouterLink>
        <button type="button" @click="onLogout">Cerrar sesión</button>
      </div>
    </header>
    <main class="content">
      <RouterView />
    </main>
    <RealtimeNotices />
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
.account {
  color: #d1d5db;
}
.live {
  font-size: 0.8rem;
  color: #d1d5db;
}
.live::before {
  content: '';
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  margin-right: 0.35rem;
  border-radius: 50%;
  background: #9ca3af;
}
.live.connected::before {
  background: #22c55e;
}
.live.connecting::before {
  background: #f59e0b;
}
</style>
