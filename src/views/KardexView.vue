<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { formatCost, formatDateTime, formatMoney } from '@/format'
import { MOVEMENT_TYPE_LABELS, formatMovementReason } from '@/movements'
import { useReportsStore } from '@/stores/reports'
import { useStockStore } from '@/stores/stock'
import type { KardexRow } from '@/types/report'

// Las opciones de los selectores son las del store de stock: el backend ya filtra las bodegas
// visibles para cada rol
const stock = useStockStore()
const reports = useReportsStore()

onMounted(() => stock.loadOptions())

function onWarehouseChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement) {
    void reports.loadKardex(event.target.value, reports.kardexProductId)
  }
}

function onProductChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement) {
    void reports.loadKardex(reports.kardexWarehouseId, event.target.value)
  }
}

/** Entrada o salida; vacío si es cero (la merma en tránsito no es ninguna de las dos). */
function quantityCell(quantity: number): string {
  return quantity === 0 ? '' : String(quantity)
}

function referenceText(row: KardexRow): string {
  const reason = row.reference === row.transferId ? '' : formatMovementReason(row.reference)
  if (row.type === 'TRANSIT_SHRINKAGE') {
    return `${row.quantity} perdidas en tránsito${reason ? ` · ${reason}` : ''}`
  }
  return reason
}
</script>

<template>
  <section>
    <h1>Kardex valorizado</h1>

    <p v-if="stock.optionsStatus === 'loading' || stock.optionsStatus === 'idle'">
      Cargando bodegas y productos…
    </p>
    <div v-else-if="stock.optionsStatus === 'error'" role="alert" data-test="options-error">
      <p>No se pudieron cargar las bodegas y los productos: {{ stock.optionsError }}</p>
      <button type="button" @click="stock.loadOptions({ force: true })">Reintentar</button>
    </div>
    <template v-else>
      <div class="pickers">
        <label>
          Bodega
          <select name="warehouse" :value="reports.kardexWarehouseId" @change="onWarehouseChange">
            <option value="">Elige una bodega</option>
            <option v-for="w in stock.warehouses" :key="w.id" :value="w.id">
              {{ w.code }} · {{ w.name }}{{ w.active ? '' : ' (inactiva)' }}
            </option>
          </select>
        </label>
        <label>
          Producto
          <select name="product" :value="reports.kardexProductId" @change="onProductChange">
            <option value="">Elige un producto</option>
            <option v-for="p in stock.products" :key="p.id" :value="p.id">
              {{ p.sku }} · {{ p.name }}
            </option>
          </select>
        </label>
      </div>

      <p v-if="reports.kardexStatus === 'idle'" data-test="kardex-hint">
        Elige una bodega y un producto para ver su kardex.
      </p>
      <p v-else-if="reports.kardexStatus === 'loading'">Cargando kardex…</p>
      <div v-else-if="reports.kardexStatus === 'error'" role="alert" data-test="kardex-error">
        <p>No se pudo cargar el kardex: {{ reports.kardexError }}</p>
        <button
          type="button"
          @click="reports.loadKardex(reports.kardexWarehouseId, reports.kardexProductId)"
        >
          Reintentar
        </button>
      </div>
      <p v-else-if="reports.kardex.length === 0" data-test="kardex-empty">
        Este producto no tiene movimientos en esta bodega.
      </p>
      <template v-else>
        <p v-if="reports.kardexProduct && reports.kardexWarehouse" data-test="kardex-title">
          {{ reports.kardexProduct.sku }} · {{ reports.kardexProduct.name }} ({{
            reports.kardexProduct.unit
          }}) en {{ reports.kardexWarehouse.code }} · {{ reports.kardexWarehouse.name }}
        </p>
        <div class="more">
          <button
            type="button"
            data-test="export-csv"
            :disabled="reports.exportStatus === 'loading'"
            @click="reports.exportKardex('csv')"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            data-test="export-pdf"
            :disabled="reports.exportStatus === 'loading'"
            @click="reports.exportKardex('pdf')"
          >
            Exportar PDF
          </button>
          <span v-if="reports.exportStatus === 'loading'">Generando archivo…</span>
          <span v-if="reports.exportStatus === 'error'" role="alert" data-test="export-error">
            No se pudo exportar: {{ reports.exportError }}
          </span>
        </div>
        <div class="scroll">
          <table data-test="kardex-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Referencia</th>
                <th class="num">Entrada</th>
                <th class="num">Salida</th>
                <th class="num">Saldo</th>
                <th class="num">Costo unitario</th>
                <th class="num">CPP</th>
                <th class="num">Valor del saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in reports.kardex" :key="row.id">
                <td>{{ formatDateTime(row.createdAt) }}</td>
                <td>{{ MOVEMENT_TYPE_LABELS[row.type] }}</td>
                <td>
                  {{ referenceText(row) }}
                  <RouterLink v-if="row.transferId" :to="`/traspasos/${row.transferId}`">
                    Ver traspaso
                  </RouterLink>
                </td>
                <td class="num">{{ quantityCell(row.quantityIn) }}</td>
                <td class="num">{{ quantityCell(row.quantityOut) }}</td>
                <td class="num">{{ row.balanceQty }}</td>
                <td class="num">{{ formatCost(row.unitCost) }}</td>
                <td class="num">{{ formatCost(row.balanceAvgCost) }}</td>
                <td class="num">{{ formatMoney(row.balanceValue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="more">
          <p v-if="reports.moreKardexStatus === 'error'" role="alert" data-test="more-error">
            No se pudieron cargar más filas: {{ reports.moreKardexError }}
          </p>
          <button
            v-if="reports.hasMoreKardex"
            type="button"
            data-test="load-more"
            :disabled="reports.moreKardexStatus === 'loading'"
            @click="reports.loadMoreKardex()"
          >
            {{ reports.moreKardexStatus === 'loading' ? 'Cargando…' : 'Cargar más' }}
          </button>
          <p v-else data-test="kardex-end">Fin del kardex.</p>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.pickers {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 1rem 0;
}
.pickers label {
  display: grid;
  gap: 0.25rem;
  min-width: 14rem;
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
  border-bottom: 1px solid var(--border);
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.more {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0;
}
</style>
