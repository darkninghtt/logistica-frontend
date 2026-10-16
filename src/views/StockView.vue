<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useStockStore } from '@/stores/stock'

const store = useStockStore()

onMounted(() => store.loadOptions())

function onWarehouseChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement) void store.selectWarehouse(event.target.value)
}

function onProductChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement) void store.selectProduct(event.target.value)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO')
}
</script>

<template>
  <section>
    <h1>Stock por bodega</h1>

    <p v-if="store.optionsStatus === 'loading' || store.optionsStatus === 'idle'">
      Cargando bodegas…
    </p>

    <div v-else-if="store.optionsStatus === 'error'" role="alert">
      <p>No se pudieron cargar las bodegas: {{ store.optionsError }}</p>
      <button type="button" @click="store.loadOptions()">Reintentar</button>
    </div>

    <p v-else-if="store.warehouses.length === 0">
      Todavía no hay bodegas. Crea una en <RouterLink to="/bodegas">Bodegas</RouterLink>.
    </p>

    <template v-else>
      <label class="picker">
        Bodega
        <select name="warehouse" :value="store.warehouseId" @change="onWarehouseChange">
          <option value="">Selecciona una bodega</option>
          <option v-for="w in store.warehouses" :key="w.id" :value="w.id">
            {{ w.code }} · {{ w.name }}
          </option>
        </select>
      </label>

      <p v-if="!store.warehouseId">
        Selecciona una bodega para ver sus existencias y su historial.
      </p>

      <template v-else>
        <h2>Existencias</h2>

        <p v-if="store.levelsStatus === 'loading' || store.levelsStatus === 'idle'">
          Cargando existencias…
        </p>
        <div v-else-if="store.levelsStatus === 'error'" role="alert" data-test="levels-error">
          <p>No se pudieron cargar las existencias: {{ store.levelsError }}</p>
          <button type="button" @click="store.fetchLevels()">Reintentar</button>
        </div>
        <p v-else-if="store.levels.length === 0" data-test="levels-empty">
          Esta bodega todavía no tiene existencias.
        </p>
        <template v-else>
          <table data-test="levels-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Unidad</th>
                <th class="num">Cantidad</th>
                <th class="num">Costo promedio</th>
                <th class="num">Valor total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="level in store.levels" :key="level.productId">
                <td>{{ level.productSku }}</td>
                <td>{{ level.productName }}</td>
                <td>{{ level.productUnit }}</td>
                <td class="num">{{ level.quantity }}</td>
                <td class="num">{{ level.avgCost }}</td>
                <td class="num">{{ level.totalValue }}</td>
              </tr>
            </tbody>
          </table>
          <nav class="pager" aria-label="Paginación de existencias">
            <button
              type="button"
              :disabled="store.levelsPage <= 1"
              @click="store.fetchLevels(store.levelsPage - 1)"
            >
              Anterior
            </button>
            <span>Página {{ store.levelsPage }} de {{ store.levelsPages }}</span>
            <button
              type="button"
              :disabled="store.levelsPage >= store.levelsPages"
              @click="store.fetchLevels(store.levelsPage + 1)"
            >
              Siguiente
            </button>
          </nav>
        </template>

        <h2>Historial de movimientos</h2>

        <label class="picker">
          Producto
          <select name="product" :value="store.productId" @change="onProductChange">
            <option value="">Todos los productos</option>
            <option v-for="p in store.products" :key="p.id" :value="p.id">
              {{ p.sku }} · {{ p.name }}
            </option>
          </select>
        </label>

        <p v-if="store.movementsStatus === 'loading' || store.movementsStatus === 'idle'">
          Cargando historial…
        </p>
        <div v-else-if="store.movementsStatus === 'error'" role="alert" data-test="movements-error">
          <p>No se pudo cargar el historial: {{ store.movementsError }}</p>
          <button type="button" @click="store.fetchMovements()">Reintentar</button>
        </div>
        <p v-else-if="store.movements.length === 0" data-test="movements-empty">
          No hay movimientos para esta selección.
        </p>
        <template v-else>
          <table data-test="movements-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>SKU</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th class="num">Cantidad</th>
                <th class="num">Costo unitario</th>
                <th class="num">Saldo</th>
                <th class="num">Costo promedio</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="movement in store.movements" :key="movement.id">
                <td>{{ formatDate(movement.createdAt) }}</td>
                <td>{{ movement.productSku }}</td>
                <td>{{ movement.productName }}</td>
                <td>{{ movement.type === 'ENTRY' ? 'Entrada' : movement.type }}</td>
                <td class="num">{{ movement.quantity }}</td>
                <td class="num">{{ movement.unitCost }}</td>
                <td class="num">{{ movement.balanceQty }}</td>
                <td class="num">{{ movement.balanceAvgCost }}</td>
              </tr>
            </tbody>
          </table>
          <nav class="pager" aria-label="Paginación del historial">
            <button
              type="button"
              :disabled="store.movementsPage <= 1"
              @click="store.fetchMovements(store.movementsPage - 1)"
            >
              Anterior
            </button>
            <span>
              Página {{ store.movementsPage }} de {{ store.movementsPages }} ({{
                store.movementsTotal
              }}
              movimientos)
            </span>
            <button
              type="button"
              :disabled="store.movementsPage >= store.movementsPages"
              @click="store.fetchMovements(store.movementsPage + 1)"
            >
              Siguiente
            </button>
          </nav>
        </template>
      </template>
    </template>
  </section>
</template>

<style scoped>
.picker {
  display: grid;
  gap: 0.25rem;
  max-width: 24rem;
  margin: 1rem 0;
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
.pager {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0;
}
</style>
