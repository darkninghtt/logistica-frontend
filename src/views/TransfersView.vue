<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { TRANSFER_STATUSES, TRANSFER_STATUS_LABELS } from '@/transfers'
import { useAuthStore } from '@/stores/auth'
import { useTransfersStore } from '@/stores/transfers'
import type { TransferStatus } from '@/types/transfer'

const auth = useAuthStore()
const store = useTransfersStore()

onMounted(() => {
  // Solo las bodegas, para el filtro (los productos no hacen falta aquí)
  void store.loadWarehouses()
  void store.fetchPage()
})

function isStatus(value: string): value is TransferStatus {
  return Object.hasOwn(TRANSFER_STATUS_LABELS, value)
}

function onStatusChange(event: Event): void {
  if (!(event.target instanceof HTMLSelectElement)) return
  const value = event.target.value
  void store.setFilters({ status: isStatus(value) ? value : '' })
}

function onWarehouseChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement) {
    void store.setFilters({ warehouseId: event.target.value })
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO')
}
</script>

<template>
  <section>
    <div class="header">
      <h1>Traspasos</h1>
      <RouterLink v-if="auth.can('transfer:create')" to="/traspasos/nuevo" class="button">
        Nuevo traspaso
      </RouterLink>
    </div>

    <div class="filters">
      <label>
        Estado
        <select name="status" :value="store.filters.status" @change="onStatusChange">
          <option value="">Todos</option>
          <option v-for="s in TRANSFER_STATUSES" :key="s" :value="s">
            {{ TRANSFER_STATUS_LABELS[s] }}
          </option>
        </select>
      </label>
      <label>
        Bodega (origen o destino)
        <select name="warehouse" :value="store.filters.warehouseId" @change="onWarehouseChange">
          <option value="">Todas</option>
          <option v-for="w in store.destinations" :key="w.id" :value="w.id">
            {{ w.code }} · {{ w.name }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="store.status === 'loading' || store.status === 'idle'">Cargando traspasos…</p>

    <div v-else-if="store.status === 'error'" role="alert">
      <p>No se pudieron cargar los traspasos: {{ store.error }}</p>
      <button type="button" @click="store.fetchPage(store.page, { force: true })">
        Reintentar
      </button>
    </div>

    <p v-else-if="store.items.length === 0" data-test="empty">
      {{
        store.filters.status || store.filters.warehouseId
          ? 'No hay traspasos con esos filtros.'
          : 'Todavía no hay traspasos.'
      }}
    </p>

    <template v-else>
      <table>
        <thead>
          <tr>
            <th>Origen</th>
            <th>Destino</th>
            <th>Estado</th>
            <th>Productos</th>
            <th>Creado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="transfer in store.items" :key="transfer.id">
            <td>{{ transfer.origin.code }} · {{ transfer.origin.name }}</td>
            <td>{{ transfer.destination.code }} · {{ transfer.destination.name }}</td>
            <td>
              <span class="status" :data-status="transfer.status">
                {{ TRANSFER_STATUS_LABELS[transfer.status] }}
              </span>
            </td>
            <td>{{ transfer.itemCount }}</td>
            <td>{{ formatDate(transfer.createdAt) }}</td>
            <td><RouterLink :to="`/traspasos/${transfer.id}`">Ver</RouterLink></td>
          </tr>
        </tbody>
      </table>

      <nav class="pager" aria-label="Paginación">
        <button type="button" :disabled="store.page <= 1" @click="store.fetchPage(store.page - 1)">
          Anterior
        </button>
        <span>Página {{ store.page }} de {{ store.totalPages }} ({{ store.total }} traspasos)</span>
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
.button {
  padding: 0.4rem 0.8rem;
  border: 1px solid #1f2937;
  border-radius: 4px;
  color: inherit;
  text-decoration: none;
}
.filters {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
}
.filters label {
  display: grid;
  gap: 0.25rem;
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
.status {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: #e5e7eb;
  font-size: 0.85rem;
}
.status[data-status='IN_TRANSIT'] {
  background: #dbeafe;
}
.status[data-status='RECEIVED'],
.status[data-status='RESOLVED'] {
  background: #dcfce7;
}
.status[data-status='DISCREPANCY'] {
  background: #fee2e2;
}
.pager {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
