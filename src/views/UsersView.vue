<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UserForm from '@/components/UserForm.vue'
import { ROLE_LABELS, roleUsesWarehouses } from '@/permissions'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import type { ManagedUser, UserFormValue } from '@/types/user'

const store = useUsersStore()
const auth = useAuthStore()

// Estado de la vista: qué formulario está abierto. `null` = cerrado; `'new'` = crear.
const editing = ref<ManagedUser | 'new' | null>(null)

onMounted(() => {
  void store.fetchPage()
  // Para la selección del formulario y los nombres de la lista; si falla, se muestra el aviso
  void store.loadWarehouses()
})

function openForm(target: ManagedUser | 'new'): void {
  store.clearSaveError()
  editing.value = target
}

async function onSubmit(value: UserFormValue): Promise<void> {
  const current = editing.value
  const result = await store.save(value, current && current !== 'new' ? current : undefined)
  if (result.ok) editing.value = null
  // Se creó pero faltaron las bodegas: se pasa a editarlo para que reintentar no lo duplique
  else if (result.user) editing.value = result.user
}

function isSelf(user: ManagedUser): boolean {
  return user.id === auth.user?.id
}

function warehousesOf(user: ManagedUser): string {
  if (!roleUsesWarehouses(user.role)) return 'Todas'
  if (user.warehouseIds.length === 0) return 'Ninguna'
  return user.warehouseIds.map((id) => store.warehouseNames[id] ?? 'Bodega desconocida').join(', ')
}
</script>

<template>
  <section>
    <div class="header">
      <h1>Usuarios</h1>
      <button type="button" @click="openForm('new')">Nuevo usuario</button>
    </div>

    <p v-if="store.optionsStatus === 'error'" role="alert" data-test="options-error">
      No se pudieron cargar las bodegas: {{ store.optionsError }}
      <button type="button" @click="store.loadWarehouses({ force: true })">Reintentar</button>
    </p>

    <UserForm
      v-if="editing"
      :user="editing === 'new' ? undefined : editing"
      :warehouses="store.warehouses"
      :saving="store.saving"
      :server-error="store.saveError"
      :is-self="editing !== 'new' && isSelf(editing)"
      @submit="onSubmit"
      @cancel="editing = null"
    />

    <p v-if="store.status === 'loading' || store.status === 'idle'">Cargando usuarios…</p>

    <div v-else-if="store.status === 'error'" role="alert">
      <p>No se pudieron cargar los usuarios: {{ store.error }}</p>
      <button type="button" @click="store.fetchPage()">Reintentar</button>
    </div>

    <p v-else-if="store.items.length === 0" data-test="empty">
      Todavía no hay usuarios. Crea el primero.
    </p>

    <template v-else>
      <p v-if="store.actionError" class="field-error" role="alert">{{ store.actionError }}</p>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Bodegas</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in store.items" :key="user.id" data-test="user-row">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ ROLE_LABELS[user.role] }}</td>
            <td>{{ warehousesOf(user) }}</td>
            <td>{{ user.active ? 'Activo' : 'Inactivo' }}</td>
            <td class="row-actions">
              <button type="button" :disabled="store.saving" @click="openForm(user)">Editar</button>
              <!-- El ADMIN no se desactiva a sí mismo: se quedaría sin acceso -->
              <button
                v-if="!isSelf(user)"
                type="button"
                :disabled="store.saving"
                @click="store.setActive(user, !user.active)"
              >
                {{ user.active ? 'Desactivar' : 'Activar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <nav class="pager" aria-label="Paginación">
        <button type="button" :disabled="store.page <= 1" @click="store.fetchPage(store.page - 1)">
          Anterior
        </button>
        <span>Página {{ store.page }} de {{ store.totalPages }} ({{ store.total }} usuarios)</span>
        <button
          type="button"
          :disabled="store.page >= store.totalPages"
          @click="store.fetchPage(store.page + 1)"
        >
          Siguiente
        </button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.row-actions {
  display: flex;
  gap: 0.5rem;
}
.pager {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
.field-error {
  color: var(--danger);
}
</style>
