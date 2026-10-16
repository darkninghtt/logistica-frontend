<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import StockEntryForm from '@/components/StockEntryForm.vue'
import { useStockEntriesStore } from '@/stores/stockEntries'
import type { StockEntryInput } from '@/types/stockEntry'

const store = useStockEntriesStore()
const form = ref<InstanceType<typeof StockEntryForm> | null>(null)

onMounted(() => {
  store.clearResult()
  void store.loadOptions()
})

async function onSubmit(input: StockEntryInput): Promise<void> {
  store.clearResult()
  if (await store.register(input)) form.value?.reset()
}
</script>

<template>
  <section>
    <h1>Entrada de stock</h1>

    <p v-if="store.optionsStatus === 'loading' || store.optionsStatus === 'idle'">
      Cargando bodegas y productos…
    </p>

    <div v-else-if="store.optionsStatus === 'error'" role="alert">
      <p>No se pudieron cargar las bodegas y los productos: {{ store.optionsError }}</p>
      <button type="button" @click="store.loadOptions()">Reintentar</button>
    </div>

    <p v-else-if="store.warehouses.length === 0 || store.products.length === 0">
      Para registrar una entrada hace falta al menos una bodega y un producto. Crea una
      <RouterLink to="/bodegas">bodega</RouterLink> y un
      <RouterLink to="/productos">producto</RouterLink>.
    </p>

    <template v-else>
      <StockEntryForm
        ref="form"
        :warehouses="store.warehouses"
        :products="store.products"
        :saving="store.saving"
        :server-error="store.saveError"
        @submit="onSubmit"
      />

      <div v-if="store.lastEntry" class="result" role="status">
        <h2>Entrada registrada</h2>
        <p>
          Stock actual: <strong>{{ store.lastEntry.stockLevel.quantity }}</strong> u · Costo
          promedio: <strong>${{ store.lastEntry.stockLevel.avgCost }}</strong> · Valor total:
          <strong>${{ store.lastEntry.stockLevel.totalValue }}</strong>
        </p>
        <p>
          Movimiento #{{ store.lastEntry.movement.id }}: +{{ store.lastEntry.movement.quantity }} u
          a ${{ store.lastEntry.movement.unitCost }}
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.result {
  max-width: 32rem;
  padding: 1rem;
  border: 1px solid #86efac;
  border-radius: 6px;
  background: #f0fdf4;
}
.result h2 {
  margin-top: 0;
  font-size: 1.1rem;
}
</style>
