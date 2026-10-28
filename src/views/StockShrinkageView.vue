<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import StockShrinkageForm from '@/components/StockShrinkageForm.vue'
import { formatMovementReason } from '@/movements'
import { useStockShrinkagesStore } from '@/stores/stockShrinkages'
import type { StockShrinkageInput } from '@/types/stockShrinkage'

const store = useStockShrinkagesStore()
const form = ref<InstanceType<typeof StockShrinkageForm> | null>(null)

onMounted(() => {
  store.clearResult()
  void store.loadOptions()
})

async function onSubmit(input: StockShrinkageInput): Promise<void> {
  store.clearResult()
  if (await store.register(input)) form.value?.reset()
}
</script>

<template>
  <section>
    <h1>Registrar merma</h1>
    <p class="hint">
      Descuenta unidades dañadas, vencidas, robadas o sobrantes de un conteo. Se valoran al costo
      promedio vigente, que no cambia.
    </p>

    <p v-if="store.optionsStatus === 'loading' || store.optionsStatus === 'idle'">
      Cargando bodegas y productos…
    </p>

    <div v-else-if="store.optionsStatus === 'error'" role="alert">
      <p>No se pudieron cargar las bodegas y los productos: {{ store.optionsError }}</p>
      <button type="button" @click="store.loadOptions()">Reintentar</button>
    </div>

    <p v-else-if="store.warehouses.length === 0" data-test="no-warehouses">
      No tienes bodegas asignadas. Pide a un administrador que te asigne una.
    </p>

    <p v-else-if="store.products.length === 0" data-test="no-products">
      Todavía no hay productos registrados.
    </p>

    <template v-else>
      <StockShrinkageForm
        ref="form"
        :warehouses="store.warehouses"
        :products="store.products"
        :saving="store.saving"
        :server-error="store.saveError"
        @submit="onSubmit"
      />

      <div v-if="store.lastShrinkage" class="result" role="status">
        <h2>Merma registrada</h2>
        <p>
          Stock actual: <strong>{{ store.lastShrinkage.stockLevel.quantity }}</strong> u
          <template v-if="store.lastShrinkage.stockLevel.avgCost !== undefined">
            · Costo promedio: <strong>${{ store.lastShrinkage.stockLevel.avgCost }}</strong>
          </template>
        </p>
        <p>
          Movimiento #{{ store.lastShrinkage.movement.id }}: -{{
            store.lastShrinkage.movement.quantity
          }}
          u
          <template v-if="store.lastShrinkage.movement.unitCost !== undefined">
            a ${{ store.lastShrinkage.movement.unitCost }}
          </template>
          · {{ formatMovementReason(store.lastShrinkage.movement.reason) }}
        </p>
        <p><RouterLink to="/stock">Ver el stock y el historial</RouterLink></p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.hint {
  color: #4b5563;
}
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
