<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { inventorySeries, totalTransfers, transfersSeries } from '@/dashboard'
import { formatMoney } from '@/format'
import { useDashboardStore } from '@/stores/dashboard'
import { TRANSFER_STATUS_LABELS, TRANSFER_STATUSES } from '@/transfers'

// Chart.js se descarga solo cuando se muestra el dashboard (va en su propio archivo del build)
const DashboardCharts = defineAsyncComponent(() => import('./DashboardCharts.vue'))

const store = useDashboardStore()

onMounted(() => store.fetchSummary())

const inventory = computed(() => (store.summary ? inventorySeries(store.summary) : null))
const transfers = computed(() => (store.summary ? transfersSeries(store.summary) : null))
const transferCount = computed(() => (store.summary ? totalTransfers(store.summary) : 0))
</script>

<template>
  <section>
    <p v-if="!store.summary && (store.status === 'loading' || store.status === 'idle')">
      Cargando el resumen…
    </p>

    <div v-else-if="!store.summary && store.status === 'error'" role="alert">
      <p>No se pudo cargar el resumen: {{ store.error }}</p>
      <button type="button" @click="store.fetchSummary({ force: true })">Reintentar</button>
    </div>

    <template v-else-if="store.summary">
      <div class="cards">
        <article class="card" data-test="card-transit">
          <h3>En tránsito</h3>
          <p class="big">{{ formatMoney(store.summary.inTransitValue) }}</p>
          <p class="hint">{{ store.summary.transfersByStatus.IN_TRANSIT }} traspasos en camino</p>
        </article>
        <article class="card" data-test="card-shrinkage">
          <h3>Mermas (últimos 30 días)</h3>
          <p class="big">{{ formatMoney(store.summary.shrinkageLast30Days.value) }}</p>
          <p class="hint">Cantidad total: {{ store.summary.shrinkageLast30Days.quantity }}</p>
        </article>
        <article class="card" data-test="card-transfers">
          <h3>Traspasos</h3>
          <p class="big">{{ transferCount }}</p>
          <p class="hint">
            {{ store.summary.transfersByStatus.DISCREPANCY }} con discrepancia por resolver
          </p>
        </article>
      </div>

      <p v-if="store.summary.inventoryValueByWarehouse.length === 0" data-test="no-warehouses">
        No hay bodegas activas para mostrar.
      </p>
      <template v-else>
        <DashboardCharts
          v-if="inventory && transfers"
          :inventory="inventory"
          :transfers="transfers"
        />

        <!-- Los mismos datos en texto: legibles sin el gráfico y para lectores de pantalla -->
        <div class="tables">
          <table data-test="inventory-table">
            <caption>
              Valor del inventario por bodega
            </caption>
            <thead>
              <tr>
                <th>Bodega</th>
                <th class="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="warehouse in store.summary.inventoryValueByWarehouse"
                :key="warehouse.warehouseId"
              >
                <td>{{ warehouse.code }} · {{ warehouse.name }}</td>
                <td class="num">{{ formatMoney(warehouse.value) }}</td>
              </tr>
            </tbody>
          </table>
          <table data-test="status-table">
            <caption>
              Traspasos por estado
            </caption>
            <tbody>
              <tr v-for="status in TRANSFER_STATUSES" :key="status">
                <td>{{ TRANSFER_STATUS_LABELS[status] }}</td>
                <td class="num">{{ store.summary.transfersByStatus[status] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1rem;
}
.card {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.card h3 {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
}
.big {
  margin: 0.25rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}
.hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.875rem;
}
.tables {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
}
table {
  width: 100%;
  border-collapse: collapse;
}
caption {
  text-align: left;
  font-weight: 600;
  margin-bottom: 0.25rem;
}
th,
td {
  padding: 0.4rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.num {
  text-align: right;
}
</style>
