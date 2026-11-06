<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PasswordChangeForm from '@/components/PasswordChangeForm.vue'
import { describeUserAgent } from '@/sessions'
import { useSessionsStore } from '@/stores/sessions'
import type { PasswordChangeInput } from '@/types/session'

const store = useSessionsStore()
const router = useRouter()
const passwordForm = ref<InstanceType<typeof PasswordChangeForm> | null>(null)

onMounted(() => store.fetchSessions())

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('es-CO') : '—'
}

async function onLogoutAll(): Promise<void> {
  if (await store.logoutAll()) await router.replace('/login')
}

async function onChangePassword(input: PasswordChangeInput): Promise<void> {
  if (await store.changePassword(input)) passwordForm.value?.reset()
}
</script>

<template>
  <section>
    <h1>Mi cuenta</h1>

    <h2>Sesiones activas</h2>
    <p class="hint">
      Cada navegador donde iniciaste sesión. Una sesión cerrada se pierde la próxima vez que ese
      navegador intente renovarla (al recargar o, como mucho, en unos minutos).
    </p>

    <p v-if="store.status === 'loading' || store.status === 'idle'">Cargando sesiones…</p>

    <div v-else-if="store.status === 'error'" role="alert">
      <p>No se pudieron cargar las sesiones: {{ store.error }}</p>
      <button type="button" @click="store.fetchSessions()">Reintentar</button>
    </div>

    <p v-else-if="store.items.length === 0" data-test="empty">
      No hay sesiones activas registradas.
    </p>

    <template v-else>
      <p v-if="store.actionError" class="field-error" role="alert">{{ store.actionError }}</p>
      <table>
        <thead>
          <tr>
            <th>Navegador</th>
            <th>Inició</th>
            <th>Último uso</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="session in store.items" :key="session.id" data-test="session-row">
            <td>
              {{ describeUserAgent(session.userAgent) }}
              <strong v-if="session.current" class="current">Esta sesión</strong>
            </td>
            <td>{{ formatDate(session.createdAt) }}</td>
            <td>{{ formatDate(session.lastUsedAt) }}</td>
            <td>
              <button
                v-if="!session.current"
                type="button"
                :disabled="store.acting"
                @click="store.revoke(session.id)"
              >
                Cerrar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="all" :disabled="store.acting" @click="onLogoutAll">
        Cerrar todas las sesiones (también esta)
      </button>
    </template>

    <PasswordChangeForm
      ref="passwordForm"
      :saving="store.passwordStatus === 'loading'"
      :server-error="store.passwordError"
      :done="store.passwordStatus === 'success'"
      @submit="onChangePassword"
    />
  </section>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}
.current {
  margin-left: 0.5rem;
  font-size: 0.8rem;
  color: #15803d;
}
.all {
  margin-top: 1rem;
}
.hint {
  color: #6b7280;
  font-size: 0.875rem;
}
.field-error {
  color: #b91c1c;
}
</style>
