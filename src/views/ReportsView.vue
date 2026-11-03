<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { MOVEMENT_TYPE_LABELS, formatMovementReason } from '@/movements'
import { useReportsStore } from '@/stores/reports'
import { useStockStore } from '@/stores/stock'
import type { ShrinkageFilters } from '@/types/report'

// Las bodegas del selector son las del store de stock: el backend ya filtra las visibles por rol
const stock = useStockStore()
const reports = useReportsStore()

// Estado del formulario: solo de esta vista. Sin bodega, el reporte cubre todas las visibles
const filters = reactive<ShrinkageFilters>({ warehouseId: '', from: '', to: '' })

function consult(): void {
  // Copia: si la persona edita los filtros mientras llega la respuesta, no cambia lo pedido
  const current = { ...filters }
  void reports.loadShrinkage(current)
  void reports.loadInTransit(current.warehouseId)
}

onMounted(() => {
  void stock.loadOptions()
  consult()
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO')
}
</script>

<template>
  <section>
    <h1>Reportes</h1>

    <form class="filters" @submit.prevent="consult">
      <label>
        Bodega
        <select v-model="filters.warehouseId" name="warehouse">
          <option value="">Todas mis bodegas</option>
          <option v-for="w in stock.warehouses" :key="w.id" :value="w.id">
            {{ w.code }} · {{ w.name }}
          </option>
        </select>
      </label>
      <label>
        Desde
        <input v-model="filters.from" type="date" name="from" />
      </label>
      <label>
        Hasta
        <input v-model="filters.to" type="date" name="to" />
      </label>
      <button type="submit">Consultar</button>
    </form>
    <p v-if="stock.optionsStatus === 'error'" role="alert">
      No se pudieron cargar las bodegas: {{ stock.optionsError }}
    </p>

    <h2>Mermas</h2>
    <p class="hint">Mermas de bodega y en tránsito, valoradas al costo con que se registraron.</p>
    <p v-if="reports.shrinkageStatus === 'loading' || reports.shrinkageStatus === 'idle'">
      Cargando mermas…
    </p>
    <div v-else-if="reports.shrinkageStatus === 'error'" role="alert" data-test="shrinkage-error">
      <p>No se pudo cargar el reporte de mermas: {{ reports.shrinkageError }}</p>
      <button type="button" @click="consult">Reintentar</button>
    </div>
    <p v-else-if="!reports.shrinkage?.data.length" data-test="shrinkage-empty">
      No hay mermas para estos filtros.
    </p>
    <template v-else>
      <div class="scroll">
        <table data-test="shrinkage-table">
          <thead>
            <tr>
              <th>Bodega</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Motivo</th>
              <th class="num">Cantidad</th>
              <th class="num">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in reports.shrinkage.data"
              :key="`${row.warehouseId}|${row.productId}|${row.type}|${row.reason}`"
            >
              <td>{{ row.warehouseCode }} · {{ row.warehouseName }}</td>
              <td>{{ row.productSku }} · {{ row.productName }}</td>
              <td>{{ MOVEMENT_TYPE_LABELS[row.type] }}</td>
              <td>{{ formatMovementReason(row.reason) }}</td>
              <td class="num">{{ row.quantity }}</td>
              <td class="num">{{ row.value }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr data-test="shrinkage-totals">
              <th colspan="4">Total</th>
              <th class="num">{{ reports.shrinkage.totals.quantity }}</th>
              <th class="num">{{ reports.shrinkage.totals.value }}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
    <div class="actions">
      <button
        type="button"
        data-test="export-csv"
        :disabled="reports.exportStatus === 'loading'"
        @click="reports.exportShrinkage({ ...filters }, 'csv')"
      >
        Exportar CSV
      </button>
      <button
        type="button"
        data-test="export-pdf"
        :disabled="reports.exportStatus === 'loading'"
        @click="reports.exportShrinkage({ ...filters }, 'pdf')"
      >
        Exportar PDF
      </button>
      <span v-if="reports.exportStatus === 'loading'">Generando archivo…</span>
      <span v-if="reports.exportStatus === 'error'" role="alert" data-test="export-error">
        No se pudo exportar: {{ reports.exportError }}
      </span>
    </div>

    <h2>Mercancía en tránsito</h2>
    <p class="hint">
      Traspasos despachados que aún no se reciben, al costo congelado al despachar.
    </p>
    <p v-if="reports.inTransitStatus === 'loading' || reports.inTransitStatus === 'idle'">
      Cargando traspasos en tránsito…
    </p>
    <div v-else-if="reports.inTransitStatus === 'error'" role="alert" data-test="in-transit-error">
      <p>No se pudo cargar la mercancía en tránsito: {{ reports.inTransitError }}</p>
      <button type="button" @click="reports.loadInTransit(filters.warehouseId)">Reintentar</button>
    </div>
    <p v-else-if="!reports.inTransit?.data.length" data-test="in-transit-empty">
      No hay mercancía en tránsito.
    </p>
    <div v-else class="scroll">
      <table data-test="in-transit-table">
        <thead>
          <tr>
            <th>Traspaso</th>
            <th>Origen</th>
            <th>Destino</th>
            <th>Despachado</th>
            <th class="num">Días</th>
            <th class="num">Cantidad</th>
            <th class="num">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in reports.inTransit.data" :key="row.transferId">
            <td><RouterLink :to="`/traspasos/${row.transferId}`">Ver</RouterLink></td>
            <td>{{ row.originCode }} · {{ row.originName }}</td>
            <td>{{ row.destinationCode }} · {{ row.destinationName }}</td>
            <td>{{ formatDate(row.dispatchedAt) }}</td>
            <td class="num">{{ row.daysInTransit }}</td>
            <td class="num">{{ row.quantity }}</td>
            <td class="num">{{ row.value }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr data-test="in-transit-totals">
            <th colspan="5">{{ reports.inTransit.totals.transfers }} traspasos</th>
            <th class="num">{{ reports.inTransit.totals.quantity }}</th>
            <th class="num">{{ reports.inTransit.totals.value }}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 1rem;
  margin: 1rem 0;
}
.filters label {
  display: grid;
  gap: 0.25rem;
}
.hint {
  color: #4b5563;
  margin-top: 0;
}
.scroll {
  overflow-x: auto;
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
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0 2rem;
}
</style>
