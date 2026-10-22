<script setup lang="ts">
import { onMounted, ref } from 'vue'
import WarehouseForm from '@/components/WarehouseForm.vue'
import { useAuthStore } from '@/stores/auth'
import { useWarehousesStore } from '@/stores/warehouses'
import type { Warehouse, WarehouseInput } from '@/types/warehouse'

const store = useWarehousesStore()
// Solo el ADMIN crea y edita; el resto ve la lista (la API ya filtra por asignación)
const canWrite = useAuthStore().can('catalog:write')

// Estado de la vista: qué formulario está abierto. `null` = cerrado; `'new'` = crear.
const editing = ref<Warehouse | 'new' | null>(null)

onMounted(() => store.fetchPage())

async function onSubmit(input: WarehouseInput): Promise<void> {
  const current = editing.value
  const id = current && current !== 'new' ? current.id : undefined
  if (await store.save(input, id)) editing.value = null
}

function openForm(target: Warehouse | 'new'): void {
  store.clearSaveError()
  editing.value = target
}

async function toggleActive(warehouse: Warehouse): Promise<void> {
  await store.save(
    { code: warehouse.code, name: warehouse.name, active: !warehouse.active },
    warehouse.id,
  )
}
</script>

<template>
  <section>
    <div class="header">
      <h1>Bodegas</h1>
      <button v-if="canWrite" type="button" @click="openForm('new')">Nueva bodega</button>
    </div>

    <WarehouseForm
      v-if="canWrite && editing"
      :warehouse="editing === 'new' ? undefined : editing"
      :saving="store.saving"
      :server-error="store.saveError"
      @submit="onSubmit"
      @cancel="editing = null"
    />

    <p v-if="store.status === 'loading' || store.status === 'idle'">Cargando bodegas…</p>

    <div v-else-if="store.status === 'error'" role="alert">
      <p>No se pudieron cargar las bodegas: {{ store.error }}</p>
      <button type="button" @click="store.fetchPage()">Reintentar</button>
    </div>

    <p v-else-if="store.items.length === 0" data-test="empty">
      {{
        canWrite
          ? 'Todavía no hay bodegas. Crea la primera.'
          : 'No tienes bodegas asignadas. Pide a un administrador que te asigne una.'
      }}
    </p>

    <template v-else>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Estado</th>
            <th v-if="canWrite">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="warehouse in store.items" :key="warehouse.id">
            <td>{{ warehouse.code }}</td>
            <td>{{ warehouse.name }}</td>
            <td>{{ warehouse.active ? 'Activa' : 'Inactiva' }}</td>
            <td v-if="canWrite" class="row-actions">
              <button type="button" :disabled="store.saving" @click="openForm(warehouse)">
                Editar
              </button>
              <button type="button" :disabled="store.saving" @click="toggleActive(warehouse)">
                {{ warehouse.active ? 'Desactivar' : 'Activar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <nav class="pager" aria-label="Paginación">
        <button type="button" :disabled="store.page <= 1" @click="store.fetchPage(store.page - 1)">
          Anterior
        </button>
        <span>Página {{ store.page }} de {{ store.totalPages }} ({{ store.total }} bodegas)</span>
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
  border-bottom: 1px solid #e5e7eb;
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
</style>
