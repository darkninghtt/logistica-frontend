<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TransferForm from '@/components/TransferForm.vue'
import { useTransfersStore } from '@/stores/transfers'
import type { TransferInput } from '@/types/transfer'

const store = useTransfersStore()
const router = useRouter()

onMounted(() => {
  store.clearSaveError()
  void store.loadOptions()
})

async function onSubmit(input: TransferInput): Promise<void> {
  const id = await store.create(input)
  if (id) await router.push(`/traspasos/${id}`)
}
</script>

<template>
  <section>
    <h1>Nuevo traspaso</h1>
    <p class="hint">
      Crea un borrador entre dos bodegas. No mueve stock hasta que el jefe de la bodega de origen lo
      despache.
    </p>

    <p v-if="store.optionsStatus === 'loading' || store.optionsStatus === 'idle'">
      Cargando bodegas y productos…
    </p>

    <div v-else-if="store.optionsStatus === 'error'" role="alert">
      <p>No se pudieron cargar las bodegas y los productos: {{ store.optionsError }}</p>
      <button type="button" @click="store.loadOptions({ force: true })">Reintentar</button>
    </div>

    <p v-else-if="store.origins.length === 0" data-test="no-origins">
      No tienes bodegas asignadas. Pide a un administrador que te asigne una.
    </p>

    <p v-else-if="store.products.length === 0" data-test="no-products">
      Todavía no hay productos registrados.
    </p>

    <TransferForm
      v-else
      :origins="store.origins"
      :destinations="store.destinations"
      :products="store.products"
      :saving="store.saving"
      :server-error="store.saveError"
      @submit="onSubmit"
      @cancel="router.push('/traspasos')"
    />
  </section>
</template>

<style scoped>
.hint {
  color: #4b5563;
}
</style>
